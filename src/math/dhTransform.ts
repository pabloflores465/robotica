import type { Joint, DHParameters } from "../core/types/robot";
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
 * set of DH parameters using the standard convention:
 *
 * A_i = Rot(z, theta) * Trans(0, 0, d) * Trans(a, 0, 0) * Rot(x, alpha)
 *
 * Expanded:
 * [cos(theta)  -sin(theta)*cos(alpha)   sin(theta)*sin(alpha)   a*cos(theta)]
 * [sin(theta)   cos(theta)*cos(alpha)  -cos(theta)*sin(alpha)   a*sin(theta)]
 * [0            sin(alpha)              cos(alpha)               d           ]
 * [0            0                       0                        1           ]
 */
export function computeDHMatrix(params: DHParameters): Matrix4x4 {
  const { theta, d, a, alpha } = params;
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);

  return [
    [ct, -st * ca, st * sa, a * ct],
    [st, ct * ca, -ct * sa, a * st],
    [0, sa, ca, d],
    [0, 0, 0, 1],
  ];
}
