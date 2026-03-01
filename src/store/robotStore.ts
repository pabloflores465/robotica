import { create } from "zustand";
import type { Joint, JointType, DHParameters, RotationAxis, LinkDirection } from "../core/types/robot";
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

const DIRECTION_MAP: Record<LinkDirection, { axis: RotationAxis; sign: 1 | -1 }> = {
  "+x": { axis: "x", sign: 1 },
  "-x": { axis: "x", sign: -1 },
  "+y": { axis: "y", sign: 1 },
  "-y": { axis: "y", sign: -1 },
  "+z": { axis: "z", sign: 1 },
  "-z": { axis: "z", sign: -1 },
};

interface RobotState {
  elements: Joint[];
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
    prismaticMax?: number,
    prismaticDirection?: "extend" | "retract",
  ) => void;
  addLink: (
    direction: LinkDirection,
    length: number,
    name?: string,
  ) => void;
  removeElement: (id: string) => void;
  updateJointDHParam: (
    id: string,
    param: keyof DHParameters,
    value: number,
  ) => void;
  updateJointVariable: (id: string, value: number) => void;
  updateJointLimits: (id: string, min: number, max: number) => void;
  updateJointType: (id: string, type: JointType) => void;
  updatePrismaticConfig: (id: string, prismaticMax: number, prismaticDirection: "extend" | "retract") => void;
  updateJointRotationAxis: (id: string, axis: RotationAxis) => void;
  updateJointFrameAngle: (id: string, angle: number) => void;
  updateLinkLength: (id: string, length: number) => void;
  updateLinkDirection: (id: string, direction: LinkDirection) => void;
  updateElementName: (id: string, name: string) => void;
  setBaseRotation: (rotation: BaseRotation) => void;
  clearAll: () => void;
  importDiagram: (data: DiagramData) => void;
}

/** Serializable snapshot of the entire diagram */
export interface DiagramData {
  version: string;
  baseRotation: BaseRotation;
  elements: Omit<Joint, "id">[];
}

function buildBaseMatrix(rot: BaseRotation): Matrix4x4 {
  // Euler XYZ: Rx * Ry * Rz
  const rx = rotationAroundAxis("x", rot.x);
  const ry = rotationAroundAxis("y", rot.y);
  const rz = rotationAroundAxis("z", rot.z);
  return multiplyMatrices(multiplyMatrices(rx, ry), rz);
}

function recompute(elements: Joint[], baseMat: Matrix4x4): ForwardKinematicsResult {
  if (elements.length === 0) {
    return {
      individualMatrices: [],
      cumulativeMatrices: [],
      endEffectorTransform: identity4(),
    };
  }
  return computeForwardKinematics(elements, baseMat);
}

const STORAGE_KEY = "dh-diagram";

function saveToStorage(elements: Joint[], baseRotation: BaseRotation): void {
  try {
    const data: DiagramData = {
      version: "1.0.0",
      baseRotation,
      elements: elements.map(({ id: _id, ...rest }) => rest),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Silently ignore storage errors (quota, private browsing, etc.)
  }
}

function loadFromStorage(): { elements: Joint[]; baseRotation: BaseRotation } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return null;
    const obj = data as Record<string, unknown>;
    if (!Array.isArray(obj.elements)) return null;
    if (typeof obj.baseRotation !== "object" || obj.baseRotation === null) return null;
    const br = obj.baseRotation as Record<string, unknown>;
    if (typeof br.x !== "number" || typeof br.y !== "number" || typeof br.z !== "number") return null;

    const elements: Joint[] = (obj.elements as Omit<Joint, "id">[]).map((el) => ({
      ...el,
      id: crypto.randomUUID(),
    }));
    return { elements, baseRotation: obj.baseRotation as BaseRotation };
  } catch {
    return null;
  }
}

let jointCounter = 0;
let linkCounter = 0;

// Restore persisted state
const persisted = loadFromStorage();
if (persisted) {
  for (const el of persisted.elements) {
    if (el.elementKind === "joint") jointCounter++;
    else linkCounter++;
  }
}

const initialBaseRotation = persisted?.baseRotation ?? { x: 0, y: 0, z: 0 };
const initialBaseMatrix = buildBaseMatrix(initialBaseRotation);
const initialElements = persisted?.elements ?? [];

export const useRobotStore = create<RobotState>((set) => ({
  elements: initialElements,
  kinematics: recompute(initialElements, initialBaseMatrix),
  baseRotation: initialBaseRotation,
  baseMatrix: initialBaseMatrix,

  addJoint: (type, dhParams, rotationAxis, frameAngle, name, prismaticMax, prismaticDirection) => {
    jointCounter++;
    const pMax = prismaticMax ?? 2;
    const pDir = prismaticDirection ?? "extend";
    const newJoint: Joint = {
      id: crypto.randomUUID(),
      name: name ?? `Joint ${jointCounter}`,
      elementKind: "joint",
      type,
      dhParams: {
        theta: dhParams?.theta ?? 0,
        d: dhParams?.d ?? 0,
        a: dhParams?.a ?? 0,
        alpha: dhParams?.alpha ?? 0,
      },
      rotationAxis: rotationAxis ?? "z",
      frameAngle: frameAngle ?? 0,
      variableValue: type === "prismatic" && pDir === "retract" ? pMax : 0,
      minLimit: type === "revolute" ? -Math.PI : 0,
      maxLimit: type === "revolute" ? Math.PI : pMax,
      prismaticMax: type === "prismatic" ? pMax : undefined,
      prismaticDirection: type === "prismatic" ? pDir : undefined,
    };
    set((state) => {
      const elements = [...state.elements, newJoint];
      return { elements, kinematics: recompute(elements, state.baseMatrix) };
    });
  },

  addLink: (direction, length, name) => {
    linkCounter++;
    const { axis, sign } = DIRECTION_MAP[direction];
    const newLink: Joint = {
      id: crypto.randomUUID(),
      name: name ?? `Link ${linkCounter}`,
      elementKind: "link",
      type: "revolute",
      dhParams: { theta: 0, d: sign * length, a: 0, alpha: 0 },
      rotationAxis: axis,
      frameAngle: 0,
      variableValue: 0,
      minLimit: 0,
      maxLimit: 0,
    };
    set((state) => {
      const elements = [...state.elements, newLink];
      return { elements, kinematics: recompute(elements, state.baseMatrix) };
    });
  },

  removeElement: (id) => {
    set((state) => {
      const elements = state.elements.filter((el) => el.id !== id);
      return { elements, kinematics: recompute(elements, state.baseMatrix) };
    });
  },

  updateJointDHParam: (id, param, value) => {
    set((state) => {
      const elements = state.elements.map((el) =>
        el.id === id
          ? { ...el, dhParams: { ...el.dhParams, [param]: value } }
          : el,
      );
      return { elements, kinematics: recompute(elements, state.baseMatrix) };
    });
  },

  updateJointVariable: (id, value) => {
    set((state) => {
      const elements = state.elements.map((el) =>
        el.id === id ? { ...el, variableValue: value } : el,
      );
      return { elements, kinematics: recompute(elements, state.baseMatrix) };
    });
  },

  updateJointLimits: (id, min, max) => {
    set((state) => {
      const elements = state.elements.map((el) =>
        el.id === id ? { ...el, minLimit: min, maxLimit: max } : el,
      );
      return { elements, kinematics: recompute(elements, state.baseMatrix) };
    });
  },

  updateJointType: (id, type) => {
    set((state) => {
      const elements = state.elements.map((el) => {
        if (el.id !== id) return el;
        if (type === "prismatic") {
          const pMax = el.prismaticMax ?? 2;
          const pDir = el.prismaticDirection ?? "extend";
          return {
            ...el,
            type,
            minLimit: 0,
            maxLimit: pMax,
            variableValue: pDir === "retract" ? pMax : 0,
            prismaticMax: pMax,
            prismaticDirection: pDir,
          };
        }
        return {
          ...el,
          type,
          minLimit: -Math.PI,
          maxLimit: Math.PI,
          variableValue: 0,
          prismaticMax: undefined,
          prismaticDirection: undefined,
        };
      });
      return { elements, kinematics: recompute(elements, state.baseMatrix) };
    });
  },

  updatePrismaticConfig: (id, prismaticMax, prismaticDirection) => {
    set((state) => {
      const elements = state.elements.map((el) => {
        if (el.id !== id || el.type !== "prismatic") return el;
        const clampedValue = Math.min(el.variableValue, prismaticMax);
        return {
          ...el,
          prismaticMax,
          prismaticDirection,
          minLimit: 0,
          maxLimit: prismaticMax,
          variableValue: clampedValue,
        };
      });
      return { elements, kinematics: recompute(elements, state.baseMatrix) };
    });
  },

  updateJointRotationAxis: (id, axis) => {
    set((state) => {
      const elements = state.elements.map((el) =>
        el.id === id ? { ...el, rotationAxis: axis } : el,
      );
      return { elements, kinematics: recompute(elements, state.baseMatrix) };
    });
  },

  updateJointFrameAngle: (id, angle) => {
    set((state) => {
      const elements = state.elements.map((el) =>
        el.id === id ? { ...el, frameAngle: angle } : el,
      );
      return { elements, kinematics: recompute(elements, state.baseMatrix) };
    });
  },

  updateLinkLength: (id, length) => {
    set((state) => {
      const elements = state.elements.map((el) => {
        if (el.id !== id || el.elementKind !== "link") return el;
        const sign = el.dhParams.d >= 0 ? 1 : -1;
        return { ...el, dhParams: { ...el.dhParams, d: sign * Math.abs(length) } };
      });
      return { elements, kinematics: recompute(elements, state.baseMatrix) };
    });
  },

  updateLinkDirection: (id, direction) => {
    set((state) => {
      const { axis, sign } = DIRECTION_MAP[direction];
      const elements = state.elements.map((el) => {
        if (el.id !== id || el.elementKind !== "link") return el;
        const absLength = Math.abs(el.dhParams.d);
        return {
          ...el,
          rotationAxis: axis,
          dhParams: { ...el.dhParams, d: sign * absLength },
        };
      });
      return { elements, kinematics: recompute(elements, state.baseMatrix) };
    });
  },

  updateElementName: (id, name) => {
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? { ...el, name } : el,
      ),
    }));
  },

  setBaseRotation: (rotation) => {
    const baseMat = buildBaseMatrix(rotation);
    set((state) => ({
      baseRotation: rotation,
      baseMatrix: baseMat,
      kinematics: recompute(state.elements, baseMat),
    }));
  },

  importDiagram: (data) => {
    // Rebuild counters from imported names
    jointCounter = 0;
    linkCounter = 0;
    const elements: Joint[] = data.elements.map((el) => {
      if (el.elementKind === "joint") {
        jointCounter++;
      } else {
        linkCounter++;
      }
      return { ...el, id: crypto.randomUUID() };
    });
    const baseMat = buildBaseMatrix(data.baseRotation);
    set({
      elements,
      baseRotation: data.baseRotation,
      baseMatrix: baseMat,
      kinematics: recompute(elements, baseMat),
    });
  },

  clearAll: () => {
    jointCounter = 0;
    linkCounter = 0;
    set({
      elements: [],
      baseRotation: { x: 0, y: 0, z: 0 },
      baseMatrix: identity4(),
      kinematics: {
        individualMatrices: [],
        cumulativeMatrices: [],
        endEffectorTransform: identity4(),
      },
    });
  },
}));

// Auto-save to localStorage on every state change
useRobotStore.subscribe((state) => {
  saveToStorage(state.elements, state.baseRotation);
});
