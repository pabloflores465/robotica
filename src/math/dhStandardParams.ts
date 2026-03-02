import type { Joint, RotationAxis } from "../core/types/robot";
import { cross, dot, UNIT_X, UNIT_Y, UNIT_Z, type Vec3 } from "./vec3";

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
 * Compute standard DH parameter rows by absorbing link elements into
 * adjacent joints' parameters.
 *
 * When the internal model stores joints and links as separate elements, the
 * standard DH table needs to fold link translations into each joint row:
 *   - d_i  = sum of link translations along Z_{i-1} (between joint i-1 and joint i)
 *   - a_i  = sum of link translations perpendicular to Z_i (between joint i and joint i+1)
 *   - alpha_i = twist angle from Z_{i-1} to Z_i
 *   - theta_i = joint's constant theta offset
 *
 * Also adds the joint's own dhParams.d to d_i (for joints that have a built-in
 * offset along their axis), and dhParams.a to a_i.
 */
export function computeStandardDHTable(
  elements: Joint[],
  referenceAxis: RotationAxis,
): StandardDHRow[] {
  // Find indices of joint elements in the flat list
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
    const linkBeforeEnd = jointIdx;
    let d = 0;
    for (let i = linkBeforeStart; i < linkBeforeEnd; i++) {
      const el = elements[i]!;
      if (el.elementKind === "link" && el.rotationAxis === prevAxis) {
        d += el.dhParams.d;
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

  return rows;
}
