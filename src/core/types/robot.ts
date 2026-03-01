import type { Vec3 } from "../../math/vec3";
import type { Matrix4x4 } from "./matrix";

/** Joint type: revolute rotates around z-axis, prismatic translates along z-axis */
export type JointType = "revolute" | "prismatic";

/** Rotation axis for the joint: z (default DH), x, or y */
export type RotationAxis = "x" | "y" | "z";

/** Discriminator for elements in the kinematic chain */
export type ElementKind = "joint" | "link";

/** Direction preset for link segments */
export type LinkDirection = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

/** Classification of geometric relationship between consecutive joint axes */
export type AxisRelation = "skew" | "parallel" | "intersecting" | "collinear";

/** Denavit-Hartenberg parameters for a single joint */
export interface DHParameters {
  /** Rotation angle about z-axis (radians). Variable for revolute joints. */
  theta: number;
  /** Translation along the rotation axis (distance from origin). Variable for prismatic joints. */
  d: number;
  /** Link length (translation along x-axis) */
  a: number;
  /** Twist angle (rotation about x-axis, radians) */
  alpha: number;
}

/** A single element (joint or link) in the robot arm kinematic chain */
export interface Joint {
  id: string;
  name: string;
  /** Whether this element is an articulated joint or a rigid link segment */
  elementKind: ElementKind;
  type: JointType;
  /** DH parameters (theta/d contain the constant offset; variable value is separate) */
  dhParams: DHParameters;
  /** Rotation axis for the joint variable (theta for revolute) */
  rotationAxis: RotationAxis;
  /** Extra rotation (radians) of X/Y around the rotation axis to orient the frame */
  frameAngle: number;
  /** Current value of the variable parameter (theta for revolute, d for prismatic) */
  variableValue: number;
  /** Min limit for the variable parameter */
  minLimit: number;
  /** Max limit for the variable parameter */
  maxLimit: number;
  /** Maximum extension for prismatic joints (0 to prismaticMax) */
  prismaticMax?: number;
  /** Whether prismatic joint starts retracted (extend) or extended (retract) */
  prismaticDirection?: "extend" | "retract";
  /** Whether this joint's DH params were auto-computed */
  autoComputed?: boolean;
}

// ---------------------------------------------------------------------------
// Auto-DH types
// ---------------------------------------------------------------------------

/** World-space info about a joint extracted from the kinematic chain */
export interface WorldJointInfo {
  type: JointType;
  /** A point on the joint axis in world/base frame */
  axisPoint: Vec3;
  /** Unit direction of the joint axis in world/base frame */
  axisDirection: Vec3;
  /** Original index in the elements array */
  elementIndex: number;
  /** Original joint limits */
  minLimit: number;
  maxLimit: number;
  prismaticMax?: number;
  prismaticDirection?: "extend" | "retract";
}

/** A named option for x_i placement when the frame is not uniquely determined */
export interface FrameOption {
  /** Short identifier: "A", "B", "C" */
  id: string;
  /** Human-readable label */
  label: string;
  /** Detailed description */
  description: string;
  /** The candidate x_i unit vector in world frame */
  candidateXi: Vec3;
  /** The candidate frame origin in world frame (for parallel axes where origin varies) */
  candidateOrigin?: Vec3;
  /** DH params that result from choosing this x_i */
  resultingDHParams: DHParameters;
  /** Which params are invariant across options */
  invariants: {
    aConstant: boolean;
    alphaConstant: boolean;
    dVaries: boolean;
    thetaVaries: boolean;
  };
}

/** Result of DH frame assignment for a single frame in the chain */
export interface DHFrameAssignment {
  /** DH params for the currently selected option */
  dhParams: DHParameters;
  /** Constant offset for the variable parameter (theta_offset or d_offset) */
  variableOffset: number;
  /** Geometric relationship to the previous axis */
  axisRelation: AxisRelation;
  /** Whether the frame choice is uniquely determined (skew) */
  frameLocked: boolean;
  /** Available frame placement options (empty for skew/locked) */
  options: FrameOption[];
  /** Currently selected option id */
  selectedOptionId: string;
  /** Custom angle (radians) used when selectedOptionId = "C" */
  customAngle: number;
  /** Human-readable explanation of the degree of freedom */
  ruleDescription: string;
  /** Frame origin in world/base coordinates */
  frameOrigin: Vec3;
  /** Frame axes in world/base coordinates */
  frameAxes: { x: Vec3; y: Vec3; z: Vec3 };
  /** Whether this is the auto-generated end-effector frame */
  isEndEffector?: boolean;
}

/** Tool transform for end-effector that may not be DH-compatible */
export interface ToolTransform {
  /** Full 4x4 homogeneous transform from last DH frame to end-effector */
  matrix: Matrix4x4;
  /** End-effector position in base frame */
  position: Vec3;
  /** End-effector orientation (inherited or custom) */
  axes: { x: Vec3; y: Vec3; z: Vec3 };
  /** Whether this transform can be expressed as a standard DH row */
  isDHCompatible: boolean;
  /** Local displacement from last frame [dx, dy, dz] */
  localDisplacement: Vec3;
}

/** Complete result of auto-DH frame assignment */
export interface DHAutoResult {
  /** Per-joint frame assignments */
  assignments: DHFrameAssignment[];
  /** End-effector tool transform */
  toolTransform: ToolTransform;
  /** Synthesized Joint[] for FK (all rotationAxis "z") */
  elements: Joint[];
  /** Base frame matrix (world-space position + orientation of frame 0) */
  baseFrame: Matrix4x4;
  /** Diagnostic messages */
  diagnostics: string[];
}

/** Per-joint user selection for frame options */
export interface FrameSelection {
  optionId: string;
  customAngle: number;
}
