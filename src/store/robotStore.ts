import { create } from "zustand";
import type { Joint, JointType, DHParameters, RotationAxis } from "../core/types/robot";
import {
  computeForwardKinematics,
  type ForwardKinematicsResult,
} from "../math/forwardKinematics";
import { identity4, rotationAroundAxis, multiplyMatrices } from "../math/matrixOps";
import type { Matrix4x4 } from "../core/types/matrix";

/** Euler angles (radians) for the base frame orientation in world space */
export interface BaseRotation {
  x: number;
  y: number;
  z: number;
}

interface RobotState {
  joints: Joint[];
  kinematics: ForwardKinematicsResult;
  baseRotation: BaseRotation;
  /** Base matrix computed from baseRotation (cached) */
  baseMatrix: Matrix4x4;

  addJoint: (
    type: JointType,
    dhParams?: Partial<DHParameters>,
    rotationAxis?: RotationAxis,
    frameAngle?: number,
    name?: string,
  ) => void;
  removeJoint: (id: string) => void;
  updateJointDHParam: (
    id: string,
    param: keyof DHParameters,
    value: number,
  ) => void;
  updateJointVariable: (id: string, value: number) => void;
  updateJointLimits: (id: string, min: number, max: number) => void;
  updateJointType: (id: string, type: JointType) => void;
  updateJointRotationAxis: (id: string, axis: RotationAxis) => void;
  updateJointFrameAngle: (id: string, angle: number) => void;
  setBaseRotation: (rotation: BaseRotation) => void;
  clearJoints: () => void;
}

function buildBaseMatrix(rot: BaseRotation): Matrix4x4 {
  // Euler XYZ: Rx * Ry * Rz
  const rx = rotationAroundAxis("x", rot.x);
  const ry = rotationAroundAxis("y", rot.y);
  const rz = rotationAroundAxis("z", rot.z);
  return multiplyMatrices(multiplyMatrices(rx, ry), rz);
}

function recompute(joints: Joint[], baseMat: Matrix4x4): ForwardKinematicsResult {
  if (joints.length === 0) {
    return {
      individualMatrices: [],
      cumulativeMatrices: [],
      endEffectorTransform: identity4(),
    };
  }
  return computeForwardKinematics(joints, baseMat);
}

let jointCounter = 0;

export const useRobotStore = create<RobotState>((set) => ({
  joints: [],
  kinematics: {
    individualMatrices: [],
    cumulativeMatrices: [],
    endEffectorTransform: identity4(),
  },
  baseRotation: { x: 0, y: 0, z: 0 },
  baseMatrix: identity4(),

  addJoint: (type, dhParams, rotationAxis, frameAngle, name) => {
    jointCounter++;
    const newJoint: Joint = {
      id: crypto.randomUUID(),
      name: name ?? `Joint ${jointCounter}`,
      type,
      dhParams: {
        theta: dhParams?.theta ?? 0,
        d: dhParams?.d ?? 0,
        a: dhParams?.a ?? 1,
        alpha: dhParams?.alpha ?? 0,
      },
      rotationAxis: rotationAxis ?? "z",
      frameAngle: frameAngle ?? 0,
      variableValue: 0,
      minLimit: type === "revolute" ? -Math.PI : -2,
      maxLimit: type === "revolute" ? Math.PI : 2,
    };
    set((state) => {
      const joints = [...state.joints, newJoint];
      return { joints, kinematics: recompute(joints, state.baseMatrix) };
    });
  },

  removeJoint: (id) => {
    set((state) => {
      const joints = state.joints.filter((j) => j.id !== id);
      return { joints, kinematics: recompute(joints, state.baseMatrix) };
    });
  },

  updateJointDHParam: (id, param, value) => {
    set((state) => {
      const joints = state.joints.map((j) =>
        j.id === id
          ? { ...j, dhParams: { ...j.dhParams, [param]: value } }
          : j,
      );
      return { joints, kinematics: recompute(joints, state.baseMatrix) };
    });
  },

  updateJointVariable: (id, value) => {
    set((state) => {
      const joints = state.joints.map((j) =>
        j.id === id ? { ...j, variableValue: value } : j,
      );
      return { joints, kinematics: recompute(joints, state.baseMatrix) };
    });
  },

  updateJointLimits: (id, min, max) => {
    set((state) => {
      const joints = state.joints.map((j) =>
        j.id === id ? { ...j, minLimit: min, maxLimit: max } : j,
      );
      return { joints, kinematics: recompute(joints, state.baseMatrix) };
    });
  },

  updateJointType: (id, type) => {
    set((state) => {
      const joints = state.joints.map((j) =>
        j.id === id
          ? {
              ...j,
              type,
              minLimit: type === "revolute" ? -Math.PI : -2,
              maxLimit: type === "revolute" ? Math.PI : 2,
              variableValue: 0,
            }
          : j,
      );
      return { joints, kinematics: recompute(joints, state.baseMatrix) };
    });
  },

  updateJointRotationAxis: (id, axis) => {
    set((state) => {
      const joints = state.joints.map((j) =>
        j.id === id ? { ...j, rotationAxis: axis } : j,
      );
      return { joints, kinematics: recompute(joints, state.baseMatrix) };
    });
  },

  updateJointFrameAngle: (id, angle) => {
    set((state) => {
      const joints = state.joints.map((j) =>
        j.id === id ? { ...j, frameAngle: angle } : j,
      );
      return { joints, kinematics: recompute(joints, state.baseMatrix) };
    });
  },

  setBaseRotation: (rotation) => {
    const baseMat = buildBaseMatrix(rotation);
    set((state) => ({
      baseRotation: rotation,
      baseMatrix: baseMat,
      kinematics: recompute(state.joints, baseMat),
    }));
  },

  clearJoints: () => {
    jointCounter = 0;
    set({
      joints: [],
      kinematics: {
        individualMatrices: [],
        cumulativeMatrices: [],
        endEffectorTransform: identity4(),
      },
    });
  },
}));
