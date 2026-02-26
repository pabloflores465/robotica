import { create } from "zustand";
import type { Joint, JointType, DHParameters } from "../core/types/robot";
import {
  computeForwardKinematics,
  type ForwardKinematicsResult,
} from "../math/forwardKinematics";
import { identity4 } from "../math/matrixOps";

interface RobotState {
  joints: Joint[];
  kinematics: ForwardKinematicsResult;

  addJoint: (
    type: JointType,
    dhParams?: Partial<DHParameters>,
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
  clearJoints: () => void;
}

function recompute(joints: Joint[]): ForwardKinematicsResult {
  if (joints.length === 0) {
    return {
      individualMatrices: [],
      cumulativeMatrices: [],
      endEffectorTransform: identity4(),
    };
  }
  return computeForwardKinematics(joints);
}

let jointCounter = 0;

export const useRobotStore = create<RobotState>((set) => ({
  joints: [],
  kinematics: {
    individualMatrices: [],
    cumulativeMatrices: [],
    endEffectorTransform: identity4(),
  },

  addJoint: (type, dhParams, name) => {
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
      variableValue: 0,
      minLimit: type === "revolute" ? -Math.PI : -2,
      maxLimit: type === "revolute" ? Math.PI : 2,
    };
    set((state) => {
      const joints = [...state.joints, newJoint];
      return { joints, kinematics: recompute(joints) };
    });
  },

  removeJoint: (id) => {
    set((state) => {
      const joints = state.joints.filter((j) => j.id !== id);
      return { joints, kinematics: recompute(joints) };
    });
  },

  updateJointDHParam: (id, param, value) => {
    set((state) => {
      const joints = state.joints.map((j) =>
        j.id === id
          ? { ...j, dhParams: { ...j.dhParams, [param]: value } }
          : j,
      );
      return { joints, kinematics: recompute(joints) };
    });
  },

  updateJointVariable: (id, value) => {
    set((state) => {
      const joints = state.joints.map((j) =>
        j.id === id ? { ...j, variableValue: value } : j,
      );
      return { joints, kinematics: recompute(joints) };
    });
  },

  updateJointLimits: (id, min, max) => {
    set((state) => {
      const joints = state.joints.map((j) =>
        j.id === id ? { ...j, minLimit: min, maxLimit: max } : j,
      );
      return { joints, kinematics: recompute(joints) };
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
      return { joints, kinematics: recompute(joints) };
    });
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
