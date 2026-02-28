import type { Joint, DHParameters, RotationAxis } from "../core/types/robot";
import type { Matrix4x4 } from "../core/types/matrix";

/**
 * Returns the effective DH parameters for a joint, incorporating
 * the variable value into the appropriate parameter.
 */
export function getEffectiveDHParams(joint: Joint): DHParameters {
  if (joint.type === "revolute") {
    return {
      ...joint.dhParams,
      theta: joint.dhParams.theta + joint.variableValue,
    };
  }
  return {
    ...joint.dhParams,
    d: joint.dhParams.d + joint.variableValue,
  };
}

/**
 * Computes the 4x4 homogeneous transformation matrix for a single
 * set of DH parameters.
 *
 * R(axis, theta) * Tz(d) * Tx(a) * Rx(alpha)
 *
 * axis = 'z': standard DH (Rz)
 * axis = 'x': Rx
 * axis = 'y': Ry
 */
export function computeDHMatrix(
  params: DHParameters,
  rotationAxis: RotationAxis = "z",
): Matrix4x4 {
  const { theta, d, a, alpha } = params;
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);

  if (rotationAxis === "x") {
    // Rx(theta) * Tz(d) * Tx(a) * Rx(alpha)
    const cta = Math.cos(theta + alpha);
    const sta = Math.sin(theta + alpha);
    return [
      [1, 0, 0, a],
      [0, cta, -sta, -d * st],
      [0, sta, cta, d * ct],
      [0, 0, 0, 1],
    ];
  }

  if (rotationAxis === "y") {
    // Ry(theta) * Tz(d) * Tx(a) * Rx(alpha)
    return [
      [ct, st * sa, st * ca, ct * a + st * d],
      [0, ca, -sa, 0],
      [-st, ct * sa, ct * ca, -st * a + ct * d],
      [0, 0, 0, 1],
    ];
  }

  // Standard DH: Rz(theta) * Tz(d) * Tx(a) * Rx(alpha)
  return [
    [ct, -st * ca, st * sa, a * ct],
    [st, ct * ca, -ct * sa, a * st],
    [0, sa, ca, d],
    [0, 0, 0, 1],
  ];
}
