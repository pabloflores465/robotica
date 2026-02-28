import type { Joint } from "../core/types/robot";
import type { Matrix4x4 } from "../core/types/matrix";
import { getEffectiveDHParams, computeDHMatrix } from "./dhTransform";
import { multiplyMatrices, identity4, rotationAroundAxis } from "./matrixOps";

export interface ForwardKinematicsResult {
  /** Individual transformation matrix for each joint (A_i) */
  individualMatrices: Matrix4x4[];
  /** Cumulative transforms: cumulativeMatrices[i] = T_0^(i+1) = A_1 * ... * A_(i+1) */
  cumulativeMatrices: Matrix4x4[];
  /** Final end-effector transform T_0^n */
  endEffectorTransform: Matrix4x4;
}

/**
 * Computes forward kinematics for all joints.
 * Returns individual and cumulative transformation matrices.
 * @param baseMatrix - optional base frame transform (default: identity)
 */
export function computeForwardKinematics(
  joints: Joint[],
  baseMatrix?: Matrix4x4,
): ForwardKinematicsResult {
  const individualMatrices: Matrix4x4[] = [];
  const cumulativeMatrices: Matrix4x4[] = [];
  let cumulative = baseMatrix ?? identity4();

  for (const joint of joints) {
    const effectiveParams = getEffectiveDHParams(joint);
    const ai = computeDHMatrix(effectiveParams, joint.rotationAxis);

    // Apply frame angle: rotate the output frame around its rotation axis
    const hasFrameAngle = Math.abs(joint.frameAngle) > 1e-10;
    const aiEffective = hasFrameAngle
      ? multiplyMatrices(ai, rotationAroundAxis(joint.rotationAxis, joint.frameAngle))
      : ai;

    individualMatrices.push(aiEffective);

    cumulative = multiplyMatrices(cumulative, aiEffective);
    cumulativeMatrices.push(
      cumulative.map((row) => [...row]) as Matrix4x4,
    );
  }

  return {
    individualMatrices,
    cumulativeMatrices,
    endEffectorTransform:
      cumulativeMatrices.length > 0
        ? cumulativeMatrices[cumulativeMatrices.length - 1]!
        : identity4(),
  };
}
