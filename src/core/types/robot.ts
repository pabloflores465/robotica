/** Joint type: revolute rotates around z-axis, prismatic translates along z-axis */
export type JointType = "revolute" | "prismatic";

/** Denavit-Hartenberg parameters for a single joint */
export interface DHParameters {
  /** Rotation angle about z-axis (radians). Variable for revolute joints. */
  theta: number;
  /** Translation along z-axis. Variable for prismatic joints. */
  d: number;
  /** Link length (translation along x-axis) */
  a: number;
  /** Twist angle (rotation about x-axis, radians) */
  alpha: number;
}

/** A single joint in the robot arm */
export interface Joint {
  id: string;
  name: string;
  type: JointType;
  /** DH parameters (theta/d contain the constant offset; variable value is separate) */
  dhParams: DHParameters;
  /** Current value of the variable parameter (theta for revolute, d for prismatic) */
  variableValue: number;
  /** Min limit for the variable parameter */
  minLimit: number;
  /** Max limit for the variable parameter */
  maxLimit: number;
}
