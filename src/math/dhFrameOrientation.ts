import type { Joint } from "../core/types/robot";
import type { Matrix4x4 } from "../core/types/matrix";
import {
  extractFrameAxes,
  getPositionVec3,
  buildFrameMatrix,
} from "./matrixOps";
import {
  normalize,
  cross,
  isParallel,
  projectOntoPlane,
  length as vecLength,
  perpendicularTo,
  type Vec3,
  EPS_ABS,
} from "./vec3";

/**
 * Computes DH-convention oriented frames for display purposes.
 *
 * Classical DH frame rules:
 * 1. Z_i = axis of revolution (rotation axis) of joint i
 * 2. X_i = common normal between Z_{i-1} and Z_i (perpendicular to both)
 * 3. X_i must intersect Z_{i-1}
 * 4. Y_i = Z_i x X_i (right-hand rule)
 *
 * The rotation axis direction for each joint is determined from the
 * DH-oriented frame of the previous joint (n-1 reference), not from
 * the FK frame. This keeps the DH chain self-consistent: once frame i-1
 * is assigned, frame i's Z is read from frame i-1's axes.
 *
 * Positions come from FK; only orientations are recomputed.
 * The first joint's X axis is derived from the FK frame (user-configurable
 * via frameAngle). All subsequent joints have their orientation fully
 * determined by the DH rules.
 *
 * Link elements keep their FK orientation unchanged.
 */
export function computeDHOrientedFrames(
  elements: Joint[],
  cumulativeMatrices: Matrix4x4[],
  baseMatrix: Matrix4x4,
): Matrix4x4[] {
  const result: Matrix4x4[] = [];

  // DH reference axes: orientation of the last DH joint frame.
  // Each joint reads its rotation axis direction from these axes,
  // then updates them after computing its own DH frame.
  let dhRefAxes = extractFrameAxes(baseMatrix);

  let prevZ: Vec3 | null = null;
  let prevX: Vec3 | null = null;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!;
    const fkMatrix = cumulativeMatrices[i]!;

    if (el.elementKind === "link") {
      result.push(fkMatrix);
      // Links are pure translations (no rotation) in this system,
      // so the DH reference orientation stays unchanged.
      continue;
    }

    const position = getPositionVec3(fkMatrix);

    // Z_i = rotation axis relative to the DH reference (n-1 frame)
    let z_i: Vec3;
    if (el.rotationAxis === "x") z_i = normalize(dhRefAxes.x);
    else if (el.rotationAxis === "y") z_i = normalize(dhRefAxes.y);
    else z_i = normalize(dhRefAxes.z);

    let x_i: Vec3;

    if (prevZ === null) {
      // First joint: X is free to choose.
      // Project a sensible axis from the FK frame onto the plane
      // perpendicular to Z. This respects the user's frameAngle setting.
      const fkAxes = extractFrameAxes(fkMatrix);
      // Pick the FK axis that is NOT the rotation axis as candidate
      const candidate: Vec3 =
        el.rotationAxis === "z" ? fkAxes.x :
        el.rotationAxis === "y" ? fkAxes.x :
        fkAxes.y;

      const projected = projectOntoPlane(candidate, z_i);
      if (vecLength(projected) > EPS_ABS) {
        x_i = normalize(projected);
      } else {
        x_i = perpendicularTo(z_i);
      }
    } else if (isParallel(prevZ, z_i)) {
      // Parallel consecutive Z axes: keep previous X direction
      // projected onto the new Z plane.
      if (prevX) {
        const projected = projectOntoPlane(prevX, z_i);
        if (vecLength(projected) > EPS_ABS) {
          x_i = normalize(projected);
        } else {
          x_i = perpendicularTo(z_i);
        }
      } else {
        x_i = perpendicularTo(z_i);
      }
    } else {
      // Non-parallel: X_i = common normal = Z_{i-1} x Z_i
      x_i = normalize(cross(prevZ, z_i));
    }

    // Y_i = Z_i x X_i (right-hand rule)
    const y_i = normalize(cross(z_i, x_i));

    result.push(buildFrameMatrix(x_i, y_i, z_i, position));

    // Update DH reference axes for the next joint
    dhRefAxes = { x: x_i, y: y_i, z: z_i };

    prevZ = z_i;
    prevX = x_i;
  }

  return result;
}
