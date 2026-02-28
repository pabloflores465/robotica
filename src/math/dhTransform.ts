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
 * R(axis, theta) * T(axis, d) * Tx(a) * Rx(alpha)
 *
 * d translates along the rotation axis (distance from origin).
 * axis = 'z': Rz(theta) * Tz(d) (standard DH)
 * axis = 'x': Rx(theta) * Tx(d)
 * axis = 'y': Ry(theta) * Ty(d)
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
    // Rx(theta) * Tx(d) * Tx(a) * Rx(alpha)
    // d translates along the rotation axis (x)
    const cta = Math.cos(theta + alpha);
    const sta = Math.sin(theta + alpha);
    return [
      [1, 0, 0, d + a],
      [0, cta, -sta, 0],
      [0, sta, cta, 0],
      [0, 0, 0, 1],
    ];
  }

  if (rotationAxis === "y") {
    // Ry(theta) * Ty(d) * Tx(a) * Rx(alpha)
    // d translates along the rotation axis (y)
    return [
      [ct, st * sa, st * ca, ct * a],
      [0, ca, -sa, d],
      [-st, ct * sa, ct * ca, -st * a],
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
