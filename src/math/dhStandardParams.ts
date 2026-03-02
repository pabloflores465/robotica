import type { Joint, RotationAxis } from "../core/types/robot";
import {
  cross,
  dot,
  normalize,
  isParallel,
  signedAngle,
  rotateAboutAxis,
  UNIT_X,
  UNIT_Y,
  UNIT_Z,
  type Vec3,
} from "./vec3";

/** A single row in the standard DH parameter table */
export interface StandardDHRow {
  /** The original joint element this row corresponds to */
  joint: Joint;
  /** 1-based row index */
  index: number;
  /** Constant theta offset (radians) from the joint's dhParams.theta */
  thetaOffset: number;
  /** d_p: offset along Z_{p-1} */
  d: number;
  /** a_p (=r_p): link length perpendicular to Z_p */
  a: number;
  /** alpha_p: twist angle from Z_{p-1} to Z_p (radians) */
  alpha: number;
  /** Whether this joint is revolute */
  isRevolute: boolean;
  /** Whether this joint is prismatic */
  isPrismatic: boolean;
}

const AXIS_VEC: Record<RotationAxis, Vec3> = {
  x: UNIT_X,
  y: UNIT_Y,
  z: UNIT_Z,
};

/**
 * Compute the DH twist angle (alpha) between two rotation axes.
 *
 * Alpha is the angle from Z_{i-1} to Z_i measured about the common normal X_i.
 * For perpendicular unit axes the magnitude is always pi/2; the sign comes from
 * the cross-product direction.
 */
function computeAlpha(prevAxis: RotationAxis, currAxis: RotationAxis): number {
  if (prevAxis === currAxis) return 0;

  const u = AXIS_VEC[prevAxis];
  const v = AXIS_VEC[currAxis];

  const c = cross(u, v);
  const cosAlpha = dot(u, v);
  // For unit axis vectors, |cross| = sin(angle). The sign of the non-zero
  // component of the cross product tells us the rotation direction.
  const sinSign = Math.sign(c.x + c.y + c.z);
  const sinAlpha = sinSign * Math.sqrt(dot(c, c));

  return Math.atan2(sinAlpha, cosAlpha);
}

/**
 * Returns the initial X axis direction for a given Z reference axis.
 * Follows the cyclic pattern: z->x, x->y, y->z.
 */
function getInitialXAxis(referenceAxis: RotationAxis): Vec3 {
  switch (referenceAxis) {
    case "z": return UNIT_X;
    case "x": return UNIT_Y;
    case "y": return UNIT_Z;
  }
}

/**
 * Apply the standard DH common-normal convention to recompute theta offsets
 * and alpha values from axis transitions.
 *
 * Both modes track physical Z and X axes through the chain and compute
 * X_i = normalize(Z_{i-1} x Z_i), then derive theta and alpha from
 * signed angles.
 *
 * Raw mode (different rotationAxis values): Z_i comes directly from the
 * joint's rotationAxis vector.
 *
 * Remap mode (all same rotationAxis): Z_i is reconstructed from the alpha
 * twist by rotating the previous Z about the frame's Y axis (positive cyclic
 * direction) by |alpha|. This ensures the standard textbook convention where
 * alpha is positive for perpendicular axis transitions (Z->X->Y->Z cycle).
 */
function applyCommonNormalConvention(
  rows: StandardDHRow[],
  referenceAxis: RotationAxis,
): StandardDHRow[] {
  const allSameAxis = rows.every(
    (row) => row.joint.rotationAxis === referenceAxis,
  );

  let prevX = getInitialXAxis(referenceAxis);
  let prevZ = AXIS_VEC[referenceAxis];

  return rows.map((row) => {
    // Determine the physical Z_i for this joint
    let currZ: Vec3;
    if (allSameAxis) {
      // Remap mode: reconstruct physical Z from alpha twist.
      // Use the positive cyclic direction (prevY) to rotate prevZ by |alpha|.
      const rawAlpha = row.alpha;
      if (Math.abs(rawAlpha) < 1e-10) {
        // No twist: axes are parallel, nothing to adjust
        return row;
      }
      const prevY = cross(prevZ, prevX);
      currZ = rotateAboutAxis(prevZ, prevY, Math.abs(rawAlpha));
    } else {
      // Raw mode: Z_i is directly the joint's rotation axis vector
      currZ = AXIS_VEC[row.joint.rotationAxis];
    }

    if (isParallel(prevZ, currZ)) {
      // No axis change: X stays the same, no theta adjustment
      prevZ = currZ;
      return row;
    }

    // X_i = normalize(Z_{i-1} x Z_i) -- common normal direction
    const newX = normalize(cross(prevZ, currZ));

    // theta_adj = signed angle from X_{i-1} to X_i about Z_{i-1}
    const thetaAdj = signedAngle(prevX, newX, prevZ);

    // alpha_std = signed angle from Z_{i-1} to Z_i about X_i
    const alphaStd = signedAngle(prevZ, currZ, newX);

    // Update tracking for next iteration
    prevX = newX;
    prevZ = currZ;

    if (allSameAxis) {
      // Remap mode: theta and alpha are fully derived from the convention
      return { ...row, thetaOffset: thetaAdj, alpha: alphaStd };
    }

    // Raw mode: add the joint's own dhParams contributions
    return {
      ...row,
      thetaOffset: row.joint.dhParams.theta + thetaAdj,
      alpha: alphaStd + row.joint.dhParams.alpha,
    };
  });
}

/**
 * Compute standard DH parameter rows by absorbing link elements into
 * adjacent joints' parameters.
 *
 * Every joint (revolute and prismatic) generates its own DH table row.
 *
 * When the internal model stores joints and links as separate elements, the
 * standard DH table needs to fold link translations into each joint row:
 *   - d_i  = sum of link translations along Z_{i-1} (between joint i-1 and joint i)
 *   - a_i  = sum of link translations perpendicular to Z_i (between joint i and joint i+1)
 *   - alpha_i = twist angle from Z_{i-1} to Z_i
 *   - theta_i = joint's constant theta offset
 *
 * Link contributions to d use Math.abs() because in frame-remap mode the
 * sign of the offset is encoded in the frame assignment, not in the link
 * modeling direction (same convention already used for a).
 *
 * @param useCommonNormal - when true, apply the standard common-normal convention
 *   for X-axis placement. In raw mode this computes theta offsets from axis
 *   transitions; in remap mode it normalizes alpha signs to positive.
 */
export function computeStandardDHTable(
  elements: Joint[],
  referenceAxis: RotationAxis,
  useCommonNormal?: boolean,
): StandardDHRow[] {
  // Find indices of all joint elements in the flat list
  const jointIndices: number[] = [];
  for (let i = 0; i < elements.length; i++) {
    if (elements[i]!.elementKind === "joint") {
      jointIndices.push(i);
    }
  }

  if (jointIndices.length === 0) return [];

  const rows: StandardDHRow[] = [];

  for (let p = 0; p < jointIndices.length; p++) {
    const jointIdx = jointIndices[p]!;
    const joint = elements[jointIdx]!;
    const prevAxis: RotationAxis =
      p === 0 ? referenceAxis : elements[jointIndices[p - 1]!]!.rotationAxis;

    // --- d_p: links between joint(p-1) and joint(p) aligned with prevAxis ---
    const linkBeforeStart = p === 0 ? 0 : jointIndices[p - 1]! + 1;
    let d = 0;
    for (let i = linkBeforeStart; i < jointIdx; i++) {
      const el = elements[i]!;
      if (el.elementKind === "link" && el.rotationAxis === prevAxis) {
        d += Math.abs(el.dhParams.d);
      }
    }
    // Add the joint's own constant d offset (if any)
    d += joint.dhParams.d;

    // --- a_p: links between joint(p) and joint(p+1) perpendicular to current axis ---
    const linkAfterStart = jointIdx + 1;
    const linkAfterEnd =
      p < jointIndices.length - 1 ? jointIndices[p + 1]! : elements.length;
    let a = 0;
    for (let i = linkAfterStart; i < linkAfterEnd; i++) {
      const el = elements[i]!;
      if (el.elementKind === "link" && el.rotationAxis !== joint.rotationAxis) {
        a += Math.abs(el.dhParams.d);
      }
    }
    // Add the joint's own constant a (if any)
    a += joint.dhParams.a;

    // --- alpha_p: twist from previous axis to current axis ---
    const alpha = computeAlpha(prevAxis, joint.rotationAxis) + joint.dhParams.alpha;

    rows.push({
      joint,
      index: p + 1,
      thetaOffset: joint.dhParams.theta,
      d,
      a,
      alpha,
      isRevolute: joint.type === "revolute",
      isPrismatic: joint.type === "prismatic",
    });
  }

  if (useCommonNormal) {
    return applyCommonNormalConvention(rows, referenceAxis);
  }

  return rows;
}
