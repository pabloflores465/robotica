/**
 * Automatic Standard DH (Craig) Frame Assignment Algorithm.
 *
 * Convention (Craig's Standard DH):
 * - n joints produce n+1 frames: frame {0} (base) through frame {n} (end-effector).
 * - z_{i-1} is aligned with joint i axis (i = 1..n).
 * - ^{i-1}T_i = Rz(theta_i) * Tz(d_i) * Tx(a_i) * Rx(alpha_i)
 * - x_i is along the common normal from z_{i-1} to z_i.
 * - y_i = z_i x x_i (right-hand rule).
 */

import type {
  Joint,
  DHParameters,
  WorldJointInfo,
  FrameOption,
  DHFrameAssignment,
  ToolTransform,
  DHAutoResult,
  AxisRelation,
  FrameSelection,
} from "../core/types/robot";
import type { Matrix4x4 } from "../core/types/matrix";
import {
  type Vec3,
  vec3,
  add,
  subtract,
  scale,
  dot,
  cross,
  length,
  normalize,
  isNearZero,
  isParallel,
  closestPointsBetweenLines,
  lineLineIntersection,
  signedAngle,
  projectOntoPlane,
  perpendicularTo,
  rotateAboutAxis,
  distance,
  ZERO,
  EPS_ABS,
  EPS_REL,
} from "./vec3";
import { computeForwardKinematics } from "./forwardKinematics";
import { extractFrameAxes, getPositionVec3, identity4 } from "./matrixOps";

// ---------------------------------------------------------------------------
// World joint info extraction
// ---------------------------------------------------------------------------

/**
 * Extracts world-space joint axis info from the existing element chain.
 * Uses zero-configuration (variableValue = 0) to capture structural geometry.
 */
export function extractWorldJointInfo(
  elements: Joint[],
  baseMatrix: Matrix4x4,
): { joints: WorldJointInfo[]; endEffectorPosition: Vec3 } {
  // Create zero-config copy
  const zeroElements = elements.map((el) => ({
    ...el,
    variableValue: 0,
  }));

  const fk = computeForwardKinematics(zeroElements, baseMatrix);

  const joints: WorldJointInfo[] = [];

  for (let i = 0; i < zeroElements.length; i++) {
    const el = zeroElements[i]!;
    if (el.elementKind !== "joint") continue;

    const cumMatrix = fk.cumulativeMatrices[i]!;
    const axes = extractFrameAxes(cumMatrix);
    const pos = getPositionVec3(cumMatrix);

    // Axis direction = the column corresponding to rotationAxis
    let axisDir: Vec3;
    if (el.rotationAxis === "x") axisDir = axes.x;
    else if (el.rotationAxis === "y") axisDir = axes.y;
    else axisDir = axes.z;

    // Normalize to guard against floating-point drift
    axisDir = normalize(axisDir);

    joints.push({
      type: el.type,
      axisPoint: pos,
      axisDirection: axisDir,
      elementIndex: i,
      minLimit: el.minLimit,
      maxLimit: el.maxLimit,
      prismaticMax: el.prismaticMax,
      prismaticDirection: el.prismaticDirection,
    });
  }

  const endEffectorPosition = getPositionVec3(fk.endEffectorTransform);

  return { joints, endEffectorPosition };
}

// ---------------------------------------------------------------------------
// Axis classification
// ---------------------------------------------------------------------------

/** Compute the characteristic length of the robot (max distance between consecutive joints) */
function computeCharacteristicLength(joints: WorldJointInfo[]): number {
  let maxDist = 1; // minimum 1m to avoid issues with co-located joints
  for (let i = 1; i < joints.length; i++) {
    const d = distance(joints[i - 1]!.axisPoint, joints[i]!.axisPoint);
    if (d > maxDist) maxDist = d;
  }
  return maxDist;
}

/** Classify the geometric relationship between two consecutive joint axes */
export function classifyAxes(
  zPrev: Vec3,
  pPrev: Vec3,
  zCurr: Vec3,
  pCurr: Vec3,
  characteristicLength: number,
): AxisRelation {
  if (isParallel(zPrev, zCurr)) {
    // Parallel or collinear: check distance between the lines
    const result = closestPointsBetweenLines(pPrev, zPrev, pCurr, zCurr);
    const tol = Math.max(EPS_ABS, EPS_REL * characteristicLength);
    if (result.distance < tol) {
      return "collinear";
    }
    return "parallel";
  }

  // Non-parallel: check if they intersect
  const intersection = lineLineIntersection(
    pPrev,
    zPrev,
    pCurr,
    zCurr,
    characteristicLength,
  );
  if (intersection !== null) {
    return "intersecting";
  }

  return "skew";
}

// ---------------------------------------------------------------------------
// DH parameter computation from frame geometry
// ---------------------------------------------------------------------------

/**
 * Given two consecutive frames (origins + axes), compute the 4 DH parameters.
 *
 * Craig convention: ^{i-1}T_i = Rz(theta_i) * Tz(d_i) * Tx(a_i) * Rx(alpha_i)
 *
 * @param oPrev - origin of frame i-1
 * @param xPrev - x-axis of frame i-1
 * @param zPrev - z-axis of frame i-1 (= z_{i-1}, along joint i axis)
 * @param oCurr - origin of frame i
 * @param xCurr - x-axis of frame i
 * @param zCurr - z-axis of frame i (= z_i, along joint i+1 axis)
 */
function computeDHParamsFromFrames(
  oPrev: Vec3,
  xPrev: Vec3,
  zPrev: Vec3,
  oCurr: Vec3,
  xCurr: Vec3,
  zCurr: Vec3,
): DHParameters {
  // Vector from O_{i-1} to O_i
  const diff = subtract(oCurr, oPrev);

  // d_i = component of (O_i - O_{i-1}) along z_{i-1}
  const d = dot(diff, zPrev);

  // a_i = component of (O_i - O_{i-1}) along x_i
  const a = dot(diff, xCurr);

  // theta_i = signed angle from x_{i-1} to x_i about z_{i-1}
  const theta = signedAngle(xPrev, xCurr, zPrev);

  // alpha_i = signed angle from z_{i-1} to z_i about x_i
  const alpha = signedAngle(zPrev, zCurr, xCurr);

  return { theta, d, a, alpha };
}

// ---------------------------------------------------------------------------
// Frame option generation
// ---------------------------------------------------------------------------

/**
 * Compute x_i candidates for a non-locked frame (parallel, intersecting, or collinear).
 * Returns the candidate x_i vectors and full DH params for each.
 */
function computeFrameOptionsForRelation(
  relation: AxisRelation,
  zPrev: Vec3,
  pPrev: Vec3,
  xPrev: Vec3,
  oPrev: Vec3,
  zCurr: Vec3,
  pCurr: Vec3,
  characteristicLength: number,
): { options: FrameOption[]; defaultXi: Vec3; defaultOrigin: Vec3 } {
  const options: FrameOption[] = [];

  if (relation === "parallel") {
    // For parallel axes: x_i direction is FIXED (common normal = perpendicular displacement)
    // Only O_i position along z_i varies between options.
    const disp = subtract(pCurr, pPrev);
    const perpDisp = projectOntoPlane(disp, zCurr);
    const perpLen = length(perpDisp);

    const xi = perpLen > EPS_ABS ? normalize(perpDisp) : perpendicularTo(zCurr);

    // Option A: O_i at foot of perpendicular from O_{i-1} (minimizes |d|)
    const tA = dot(subtract(oPrev, pCurr), zCurr);
    const originA = add(pCurr, scale(zCurr, tA));
    const paramsA = computeDHParamsFromFrames(oPrev, xPrev, zPrev, originA, xi, zCurr);
    options.push({
      id: "A",
      label: "Nearest to previous",
      description: "O_i at foot of perpendicular from O_{i-1} to z_i axis. Minimizes |d|.",
      candidateXi: xi,
      candidateOrigin: originA,
      resultingDHParams: paramsA,
      invariants: { aConstant: true, alphaConstant: true, dVaries: true, thetaVaries: false },
    });

    // Option B: O_i at the joint's axis point (if different from A)
    const originB = pCurr;
    if (distance(originA, originB) > Math.max(EPS_ABS, EPS_REL * characteristicLength)) {
      const paramsB = computeDHParamsFromFrames(oPrev, xPrev, zPrev, originB, xi, zCurr);
      options.push({
        id: "B",
        label: "At joint position",
        description: "O_i at the joint's axis point on z_i.",
        candidateXi: xi,
        candidateOrigin: originB,
        resultingDHParams: paramsB,
        invariants: { aConstant: true, alphaConstant: true, dVaries: true, thetaVaries: false },
      });
    }

    // Option C: custom z-offset from A
    options.push({
      id: "C",
      label: "Custom z-offset",
      description: "O_i at a custom offset along z_i from the default position.",
      candidateXi: xi,
      candidateOrigin: originA,
      resultingDHParams: paramsA,
      invariants: { aConstant: true, alphaConstant: true, dVaries: true, thetaVaries: false },
    });

    return { options, defaultXi: xi, defaultOrigin: originA };
  }

  if (relation === "collinear") {
    // Collinear: axes on the same line, a = 0. x_i direction is FREE.
    const projected = projectOntoPlane(xPrev, zCurr);
    const xiA = length(projected) > EPS_ABS ? normalize(projected) : perpendicularTo(zCurr);

    const tA = dot(subtract(oPrev, pCurr), zCurr);
    const originA = add(pCurr, scale(zCurr, tA));
    const paramsA = computeDHParamsFromFrames(oPrev, xPrev, zPrev, originA, xiA, zCurr);
    options.push({
      id: "A",
      label: "Inherit from previous x",
      description: "x_i inherits direction from x_{i-1}, projected perpendicular to z_i.",
      candidateXi: xiA,
      candidateOrigin: originA,
      resultingDHParams: paramsA,
      invariants: { aConstant: true, alphaConstant: true, dVaries: true, thetaVaries: true },
    });

    // Option B: perpendicular to world axis
    const xiB = perpendicularTo(zCurr);
    const xiDiff = length(subtract(xiA, xiB));
    const xiDiffNeg = length(add(xiA, xiB));
    if (xiDiff > 0.01 && xiDiffNeg > 0.01) {
      const paramsB = computeDHParamsFromFrames(oPrev, xPrev, zPrev, originA, xiB, zCurr);
      options.push({
        id: "B",
        label: "World axis perpendicular",
        description: "x_i from the most perpendicular world axis.",
        candidateXi: xiB,
        candidateOrigin: originA,
        resultingDHParams: paramsB,
        invariants: { aConstant: true, alphaConstant: true, dVaries: true, thetaVaries: true },
      });
    }

    // Option C: custom angle
    options.push({
      id: "C",
      label: "Custom angle",
      description: "Rotate x_i by a custom angle about z_i.",
      candidateXi: xiA,
      candidateOrigin: originA,
      resultingDHParams: paramsA,
      invariants: { aConstant: true, alphaConstant: true, dVaries: true, thetaVaries: true },
    });

    return { options, defaultXi: xiA, defaultOrigin: originA };
  }

  // Intersecting case: O_i at intersection point (fixed), x_i direction is FREE.
  const crossVec = cross(zPrev, zCurr);
  const crossLen = length(crossVec);
  const xiA = crossLen > EPS_ABS ? normalize(crossVec) : perpendicularTo(zCurr);

  const intersection = lineLineIntersection(pPrev, zPrev, pCurr, zCurr, characteristicLength);
  const originInt = intersection ?? pCurr;

  const paramsA = computeDHParamsFromFrames(oPrev, xPrev, zPrev, originInt, xiA, zCurr);
  options.push({
    id: "A",
    label: "Cross product (right-hand)",
    description: "x_i = z_{i-1} x z_i (canonical right-hand rule choice)",
    candidateXi: xiA,
    candidateOrigin: originInt,
    resultingDHParams: paramsA,
    invariants: { aConstant: true, alphaConstant: false, dVaries: false, thetaVaries: true },
  });

  // Option B: negative cross product
  const xiB = scale(xiA, -1);
  const paramsB = computeDHParamsFromFrames(oPrev, xPrev, zPrev, originInt, xiB, zCurr);
  options.push({
    id: "B",
    label: "Negative cross product",
    description: "x_i = -(z_{i-1} x z_i) (opposite direction)",
    candidateXi: xiB,
    candidateOrigin: originInt,
    resultingDHParams: paramsB,
    invariants: { aConstant: true, alphaConstant: false, dVaries: false, thetaVaries: true },
  });

  // Option C: custom angle
  options.push({
    id: "C",
    label: "Custom angle",
    description: "Rotate x_i by a custom angle about z_i from the cross-product direction.",
    candidateXi: xiA,
    candidateOrigin: originInt,
    resultingDHParams: paramsA,
    invariants: { aConstant: true, alphaConstant: false, dVaries: false, thetaVaries: true },
  });

  return { options, defaultXi: xiA, defaultOrigin: originInt };
}

// ---------------------------------------------------------------------------
// Build rule description
// ---------------------------------------------------------------------------

function buildRuleDescription(relation: AxisRelation): string {
  switch (relation) {
    case "parallel":
      return "Parallel axes: x_i can be freely rotated about z_i. a and alpha are invariant; theta and d depend on the choice.";
    case "collinear":
      return "Collinear axes: x_i can be freely rotated about z_i. a = 0, alpha invariant; theta and d depend on the choice.";
    case "intersecting":
      return "Intersecting axes: x_i direction is free (a = 0). a is invariant; alpha sign, theta, and d depend on x_i choice.";
    case "skew":
      return "Skew axes: unique solution. The common normal uniquely determines x_i.";
  }
}

// ---------------------------------------------------------------------------
// Main algorithm
// ---------------------------------------------------------------------------

/**
 * Assigns standard DH frames to a serial chain of joints.
 *
 * @param worldJoints - World-space joint info extracted from the chain
 * @param endEffectorPos - Position of the end-effector tip in world frame
 * @param selections - Optional user selections for non-locked frames
 */
export function assignDHFrames(
  worldJoints: WorldJointInfo[],
  endEffectorPos: Vec3,
  selections?: Record<number, FrameSelection>,
): DHAutoResult {
  const n = worldJoints.length;
  const diagnostics: string[] = [];

  if (n === 0) {
    return {
      assignments: [],
      toolTransform: buildIdentityToolTransform(),
      elements: [],
      diagnostics: ["No joints to assign frames to."],
    };
  }

  const charLength = computeCharacteristicLength(worldJoints);

  // z-axes: z_i is along joint (i+1) axis in Craig convention
  // Here we index frames 0..n, where frame i has z_i
  // z_0 = worldJoints[0].axisDirection (joint 1 axis)
  // z_i = worldJoints[i].axisDirection for i < n
  // z_n = z_{n-1} (end-effector inherits from last joint)

  const zAxes: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    zAxes.push(worldJoints[i]!.axisDirection);
  }
  // z_n for end-effector
  zAxes.push(zAxes[n - 1]!);

  // Step 1: Compute frame 0 (base frame)
  const z0 = zAxes[0]!;
  let x0: Vec3;
  if (n > 1) {
    // Choose x_0 to align with the common normal toward joint 2
    const disp = subtract(worldJoints[1]!.axisPoint, worldJoints[0]!.axisPoint);
    const perpDisp = projectOntoPlane(disp, z0);
    if (length(perpDisp) > EPS_ABS) {
      // Parallel or skew with offset: use perpendicular displacement
      x0 = normalize(perpDisp);
    } else if (!isParallel(z0, zAxes[1]!)) {
      // Intersecting at same point: use cross product of axes
      const crossVec = cross(z0, zAxes[1]!);
      x0 = length(crossVec) > EPS_ABS ? normalize(crossVec) : perpendicularTo(z0);
    } else {
      // Collinear: fallback heuristic
      x0 = perpendicularTo(z0);
    }
  } else {
    x0 = perpendicularTo(z0);
  }
  const y0 = normalize(cross(z0, x0));

  // Frame 0 origin: on the joint 1 axis, at the joint 1 position
  const o0 = worldJoints[0]!.axisPoint;

  // Build assignments array. Frame 0 is implicit (base), frames 1..n are assigned.
  // But we store frames 0..n-1 corresponding to joints 0..n-1
  const assignments: DHFrameAssignment[] = [];

  // Frame origins and axes for propagation
  const frameOrigins: Vec3[] = [o0];
  const frameXAxes: Vec3[] = [x0];
  const frameYAxes: Vec3[] = [y0];

  // Frame 0 assignment (joint 0 / first joint)
  // The DH params for frame 0 describe the transform from the "world base" to frame 0
  // In practice, this is identity or determined by the base rotation.
  // We include it as the first assignment.

  // For frame i (i = 0..n-1), compute DH params for ^{i-1}T_i
  // Frame -1 is the world base: O = (0,0,0), x = (1,0,0), z = z_0
  // Actually for Craig: frame 0 has z_0 along joint 1. The base frame (before frame 0)
  // is separate. We treat frame 0 as the first DH frame.
  // The transform from base to frame 0 would be ^base T_0.
  // But since the user defines the base rotation separately, frame 0 just IS the first joint frame.

  // We produce n assignments for n joints (frames 0 to n-1).
  // Each assignment i gives the DH params for ^{i-1}T_i.
  // For i=0, prev frame is the base (identity or baseRotation-defined).

  // Prev frame for i=0: use base frame with z along z_0 but we'll use a virtual prev
  // Actually, for the first joint, there's no "previous" z to compare against.
  // The DH params for joint 1 describe how to get from frame 0 to frame 1.
  // Frame 0 is at joint 1 with z_0 = joint1.axis, x_0 = perpendicularTo(z_0).
  // So assignment[0] will have theta=0, d=0, a=0, alpha=0 (identity transform for frame 0 itself).

  // Actually, let me reconsider. The user builds: base -> elements (joints+links).
  // In auto mode, we produce n DH joints (one per real joint).
  // The first DH joint describes ^{0}T_1 from frame 0 to frame 1.
  // But frame 0 is at joint 1 position. For a single-joint robot, there's only frame 0.

  // Better approach: we produce n joints. Joint i (1-indexed) is described by DH params
  // (theta_i, d_i, a_i, alpha_i) which give ^{i-1}T_i.
  // Frame 0 is the base frame, positioned at the first joint.
  // We compute frames 1..n from the axis geometry.

  // For joint 1 (first joint):
  //   z_0 = joint1.axis, z_1 = joint2.axis (if exists)
  //   x_1 = common normal from z_0 to z_1
  //   DH params describe how to get from frame 0 to frame 1.

  // For a single joint, frame 0 is at joint 1 and frame 1 is the end-effector.

  for (let i = 0; i < n; i++) {
    const zPrev = zAxes[i]!;       // z_{i} (current frame's z)
    const zNext = zAxes[i + 1]!;   // z_{i+1} (next frame's z)
    const pCurr = worldJoints[i]!.axisPoint;
    const pNext = i + 1 < n ? worldJoints[i + 1]!.axisPoint : endEffectorPos;

    if (i === 0) {
      // Frame 0 assignment: this is the base joint frame
      // DH params are for ^{base}T_0 which is handled by baseMatrix
      // We store the frame info but with zero DH params
      assignments.push({
        dhParams: { theta: 0, d: 0, a: 0, alpha: 0 },
        variableOffset: 0,
        axisRelation: "skew", // N/A for first frame
        frameLocked: true,
        options: [],
        selectedOptionId: "",
        customAngle: 0,
        ruleDescription: "Base frame: z_0 aligned with joint 1 axis.",
        frameOrigin: o0,
        frameAxes: { x: x0, y: y0, z: z0 },
      });

      // If only one joint, we're done with assignments
      if (n === 1) continue;

      // Compute frame 1 from the relationship between z_0 and z_1
      const relation = classifyAxes(zPrev, pCurr, zNext, pNext, charLength);

      let xi: Vec3;
      let origin: Vec3;
      let options: FrameOption[] = [];
      const locked = relation === "skew";

      if (relation === "skew") {
        // Unique common normal
        const closest = closestPointsBetweenLines(pCurr, zPrev, pNext, zNext);
        const normalDir = subtract(closest.point2, closest.point1);
        const normalLen = length(normalDir);
        xi = normalLen > EPS_ABS ? normalize(normalDir) : perpendicularTo(zNext);
        origin = closest.point2;
      } else {
        const optResult = computeFrameOptionsForRelation(
          relation, zPrev, pCurr, x0, o0, zNext, pNext, charLength,
        );
        options = optResult.options;

        // Apply user selection if available
        const sel = selections?.[1];
        if (sel && sel.optionId !== "C") {
          const chosen = options.find((o) => o.id === sel.optionId);
          xi = chosen ? chosen.candidateXi : optResult.defaultXi;
          origin = chosen?.candidateOrigin ?? optResult.defaultOrigin;
        } else if (sel && sel.optionId === "C") {
          if (relation === "parallel") {
            // For parallel: customAngle is z-offset
            origin = add(optResult.defaultOrigin, scale(zNext, sel.customAngle));
            xi = optResult.defaultXi;
          } else {
            xi = rotateAboutAxis(optResult.defaultXi, zNext, sel.customAngle);
            origin = optResult.defaultOrigin;
          }
        } else {
          xi = optResult.defaultXi;
          origin = optResult.defaultOrigin;
        }
      }

      const yi = normalize(cross(zNext, xi));
      const dhParams = computeDHParamsFromFrames(o0, x0, zPrev, origin, xi, zNext);

      // Update options with final DH params if user selected custom
      if (!locked && selections?.[1]?.optionId === "C") {
        const customOpt = options.find((o) => o.id === "C");
        if (customOpt) {
          customOpt.candidateXi = xi;
          customOpt.candidateOrigin = origin;
          customOpt.resultingDHParams = dhParams;
        }
      }

      assignments.push({
        dhParams,
        variableOffset: worldJoints[1]!.type === "revolute" ? dhParams.theta : dhParams.d,
        axisRelation: relation,
        frameLocked: locked,
        options,
        selectedOptionId: selections?.[1]?.optionId ?? (options.length > 0 ? "A" : ""),
        customAngle: selections?.[1]?.customAngle ?? 0,
        ruleDescription: buildRuleDescription(relation),
        frameOrigin: origin,
        frameAxes: { x: xi, y: yi, z: zNext },
      });

      frameOrigins.push(origin);
      frameXAxes.push(xi);
      frameYAxes.push(yi);
      continue;
    }

    // For i >= 1: compute frame i+1 from relationship between z_i and z_{i+1}
    if (i + 1 >= n) {
      // Last joint: no next frame to compute (end-effector handled separately)
      continue;
    }

    const oPrevFrame = frameOrigins[frameOrigins.length - 1]!;
    const xPrevFrame = frameXAxes[frameXAxes.length - 1]!;
    const zPrevFrame = zAxes[i]!;
    const frameIdx = i + 1; // 1-indexed frame number

    const relation = classifyAxes(zPrev, pCurr, zNext, pNext, charLength);

    let xi: Vec3;
    let origin: Vec3;
    let options: FrameOption[] = [];
    const locked = relation === "skew";

    if (relation === "skew") {
      const closest = closestPointsBetweenLines(pCurr, zPrev, pNext, zNext);
      const normalDir = subtract(closest.point2, closest.point1);
      const normalLen = length(normalDir);
      xi = normalLen > EPS_ABS ? normalize(normalDir) : perpendicularTo(zNext);
      origin = closest.point2;
    } else {
      const optResult = computeFrameOptionsForRelation(
        relation, zPrev, pCurr, xPrevFrame, oPrevFrame, zNext, pNext, charLength,
      );
      options = optResult.options;

      const sel = selections?.[frameIdx];
      if (sel && sel.optionId !== "C") {
        const chosen = options.find((o) => o.id === sel.optionId);
        xi = chosen ? chosen.candidateXi : optResult.defaultXi;
        origin = chosen?.candidateOrigin ?? optResult.defaultOrigin;
      } else if (sel && sel.optionId === "C") {
        if (relation === "parallel") {
          origin = add(optResult.defaultOrigin, scale(zNext, sel.customAngle));
          xi = optResult.defaultXi;
        } else {
          xi = rotateAboutAxis(optResult.defaultXi, zNext, sel.customAngle);
          origin = optResult.defaultOrigin;
        }
      } else {
        xi = optResult.defaultXi;
        origin = optResult.defaultOrigin;
      }
    }

    const yi = normalize(cross(zNext, xi));
    const dhParams = computeDHParamsFromFrames(oPrevFrame, xPrevFrame, zPrevFrame, origin, xi, zNext);

    if (!locked && selections?.[frameIdx]?.optionId === "C") {
      const customOpt = options.find((o) => o.id === "C");
      if (customOpt) {
        customOpt.candidateXi = xi;
        customOpt.candidateOrigin = origin;
        customOpt.resultingDHParams = dhParams;
      }
    }

    const jointInfo = worldJoints[i + 1]!;
    assignments.push({
      dhParams,
      variableOffset: jointInfo.type === "revolute" ? dhParams.theta : dhParams.d,
      axisRelation: relation,
      frameLocked: locked,
      options,
      selectedOptionId: selections?.[frameIdx]?.optionId ?? (options.length > 0 ? "A" : ""),
      customAngle: selections?.[frameIdx]?.customAngle ?? 0,
      ruleDescription: buildRuleDescription(relation),
      frameOrigin: origin,
      frameAxes: { x: xi, y: yi, z: zNext },
    });

    frameOrigins.push(origin);
    frameXAxes.push(xi);
    frameYAxes.push(yi);
  }

  // Compute tool transform (end-effector frame)
  const lastFrameOrigin = frameOrigins[frameOrigins.length - 1]!;
  const lastFrameX = frameXAxes[frameXAxes.length - 1]!;
  const lastFrameY = frameYAxes[frameYAxes.length - 1]!;
  const lastFrameZ = zAxes[n - 1]!;

  const toolTransform = computeToolTransform(
    lastFrameOrigin,
    lastFrameX,
    lastFrameY,
    lastFrameZ,
    endEffectorPos,
    diagnostics,
  );

  // Synthesize Joint[] for FK
  const synthesizedElements = synthesizeJoints(assignments, worldJoints, toolTransform);

  return { assignments, toolTransform, elements: synthesizedElements, diagnostics };
}

// ---------------------------------------------------------------------------
// Tool transform computation
// ---------------------------------------------------------------------------

function computeToolTransform(
  lastOrigin: Vec3,
  lastX: Vec3,
  lastY: Vec3,
  lastZ: Vec3,
  eePos: Vec3,
  diagnostics: string[],
): ToolTransform {
  const displacement = subtract(eePos, lastOrigin);

  // Express displacement in the last frame's local coordinates
  const dx = dot(displacement, lastX);
  const dy = dot(displacement, lastY);
  const dz = dot(displacement, lastZ);
  const localDisp = vec3(dx, dy, dz);

  const isDHCompatible = isNearZero(dy, Math.max(EPS_ABS, EPS_REL * length(displacement)));

  if (!isDHCompatible) {
    diagnostics.push(
      `End-effector has a y-component of ${dy.toFixed(4)}m relative to the last joint frame. ` +
      `This requires a tool transform outside standard DH convention.`,
    );
  }

  // Build the 4x4 transform from last DH frame to end-effector
  // Orientation inherits from last frame (z_n = z_{n-1}, x_n = x_{n-1})
  const matrix: Matrix4x4 = [
    [1, 0, 0, dx],
    [0, 1, 0, dy],
    [0, 0, 1, dz],
    [0, 0, 0, 1],
  ];

  return {
    matrix,
    position: eePos,
    axes: { x: lastX, y: lastY, z: lastZ },
    isDHCompatible,
    localDisplacement: localDisp,
  };
}

function buildIdentityToolTransform(): ToolTransform {
  return {
    matrix: identity4(),
    position: ZERO,
    axes: { x: vec3(1, 0, 0), y: vec3(0, 1, 0), z: vec3(0, 0, 1) },
    isDHCompatible: true,
    localDisplacement: ZERO,
  };
}

// ---------------------------------------------------------------------------
// Joint synthesis
// ---------------------------------------------------------------------------

/**
 * Synthesize a Joint[] array from DH frame assignments.
 * All synthesized joints have rotationAxis = "z" and frameAngle = 0.
 */
function synthesizeJoints(
  assignments: DHFrameAssignment[],
  worldJoints: WorldJointInfo[],
  toolTransform: ToolTransform,
): Joint[] {
  const joints: Joint[] = [];

  for (let i = 0; i < assignments.length; i++) {
    const assignment = assignments[i]!;
    const worldJoint = worldJoints[i];

    if (!worldJoint) continue;

    const isRevolute = worldJoint.type === "revolute";

    joints.push({
      id: crypto.randomUUID(),
      name: `J${i + 1}`,
      elementKind: "joint",
      type: worldJoint.type,
      dhParams: {
        theta: isRevolute ? assignment.variableOffset : assignment.dhParams.theta,
        d: isRevolute ? assignment.dhParams.d : assignment.variableOffset,
        a: assignment.dhParams.a,
        alpha: assignment.dhParams.alpha,
      },
      rotationAxis: "z",
      frameAngle: 0,
      variableValue:
        !isRevolute && worldJoint.prismaticDirection === "retract"
          ? (worldJoint.prismaticMax ?? worldJoint.maxLimit)
          : 0,
      minLimit: worldJoint.minLimit,
      maxLimit: worldJoint.maxLimit,
      prismaticMax: worldJoint.prismaticMax,
      prismaticDirection: worldJoint.prismaticDirection,
      autoComputed: true,
    });
  }

  // If tool transform has non-zero displacement, add a link element for it
  const disp = toolTransform.localDisplacement;
  const dispLen = length(disp);
  if (dispLen > EPS_ABS) {
    if (toolTransform.isDHCompatible) {
      // DH-compatible: add as a link along z (d) and x (a)
      if (!isNearZero(disp.z)) {
        joints.push({
          id: crypto.randomUUID(),
          name: "EE-dz",
          elementKind: "link",
          type: "revolute",
          dhParams: { theta: 0, d: disp.z, a: 0, alpha: 0 },
          rotationAxis: "z",
          frameAngle: 0,
          variableValue: 0,
          minLimit: 0,
          maxLimit: 0,
          autoComputed: true,
        });
      }
      if (!isNearZero(disp.x)) {
        joints.push({
          id: crypto.randomUUID(),
          name: "EE-ax",
          elementKind: "link",
          type: "revolute",
          dhParams: { theta: 0, d: 0, a: disp.x, alpha: 0 },
          rotationAxis: "z",
          frameAngle: 0,
          variableValue: 0,
          minLimit: 0,
          maxLimit: 0,
          autoComputed: true,
        });
      }
    } else {
      // Non-DH-compatible: the displacement has a y-component that can't be
      // represented by a single z-axis DH transform. Split into separate links
      // for each axis component so FK renders the full displacement correctly.
      if (!isNearZero(disp.z)) {
        joints.push({
          id: crypto.randomUUID(),
          name: "EE-dz",
          elementKind: "link",
          type: "revolute",
          dhParams: { theta: 0, d: disp.z, a: 0, alpha: 0 },
          rotationAxis: "z",
          frameAngle: 0,
          variableValue: 0,
          minLimit: 0,
          maxLimit: 0,
          autoComputed: true,
        });
      }
      if (!isNearZero(disp.x)) {
        joints.push({
          id: crypto.randomUUID(),
          name: "EE-ax",
          elementKind: "link",
          type: "revolute",
          dhParams: { theta: 0, d: 0, a: disp.x, alpha: 0 },
          rotationAxis: "z",
          frameAngle: 0,
          variableValue: 0,
          minLimit: 0,
          maxLimit: 0,
          autoComputed: true,
        });
      }
      if (!isNearZero(disp.y)) {
        joints.push({
          id: crypto.randomUUID(),
          name: "EE-dy",
          elementKind: "link",
          type: "revolute",
          dhParams: { theta: 0, d: disp.y, a: 0, alpha: 0 },
          rotationAxis: "y",
          frameAngle: 0,
          variableValue: 0,
          minLimit: 0,
          maxLimit: 0,
          autoComputed: true,
        });
      }
    }
  }

  return joints;
}
