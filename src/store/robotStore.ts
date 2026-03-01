import { create } from "zustand";
import type {
  Joint,
  JointType,
  DHParameters,
  RotationAxis,
  LinkDirection,
  DHAutoResult,
  FrameSelection,
} from "../core/types/robot";
import {
  computeForwardKinematics,
  type ForwardKinematicsResult,
} from "../math/forwardKinematics";
import { identity4, rotationAroundAxis, multiplyMatrices, extractFrameAxes } from "../math/matrixOps";
import type { Matrix4x4 } from "../core/types/matrix";
import { extractWorldJointInfo, assignDHFrames } from "../math/dhFrameAssignment";
import { dot, negate } from "../math/vec3";
import type { Vec3 } from "../math/vec3";

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

/**
 * Compute link DH params that produce a displacement in the auto DH frame's
 * direction, expressed in the manual chain's local frame.
 *
 * Uses the theta + frameAngle cancellation trick:
 *   Rz(theta) * Tz(d) * Tx(a) * Rx(0)  with frameAngle = -theta
 * produces a pure translation of (a*cos(theta), a*sin(theta), d) with no rotation.
 */
function computeAutoLinkParams(
  direction: LinkDirection,
  length: number,
  autoFrame: Matrix4x4,
  manualFrame: Matrix4x4,
): { dhParams: DHParameters; frameAngle: number; rotationAxis: RotationAxis } {
  const { axis, sign } = DIRECTION_MAP[direction];

  // Desired world-space unit direction from the auto DH frame
  const autoAxes = extractFrameAxes(autoFrame);
  let worldDir: Vec3;
  if (axis === "x") worldDir = autoAxes.x;
  else if (axis === "y") worldDir = autoAxes.y;
  else worldDir = autoAxes.z;
  if (sign < 0) worldDir = negate(worldDir);

  // Express in manual frame local coordinates
  const manualAxes = extractFrameAxes(manualFrame);
  const lx = dot(worldDir, manualAxes.x);
  const ly = dot(worldDir, manualAxes.y);
  const lz = dot(worldDir, manualAxes.z);

  // theta + frameAngle cancellation for pure translation (lx, ly, lz) * length
  const xyMag = Math.sqrt(lx * lx + ly * ly);
  const theta = xyMag > 1e-9 ? Math.atan2(ly, lx) : 0;

  return {
    dhParams: {
      theta,
      d: lz * length,
      a: xyMag * length,
      alpha: 0,
    },
    frameAngle: -theta,
    rotationAxis: "z",
  };
}

/**
 * Get the auto DH frame at the position of a link in the manual chain.
 * Counts manual joints before `linkIndex` and uses the corresponding auto FK frame.
 */
function getAutoFrameForLink(
  linkIndex: number,
  elements: Joint[],
  autoKinematics: ForwardKinematicsResult,
  autoBaseFrame: Matrix4x4,
): Matrix4x4 {
  let jointCount = 0;
  for (let i = 0; i < linkIndex; i++) {
    if (elements[i]!.elementKind === "joint") jointCount++;
  }

  if (jointCount === 0) {
    return autoBaseFrame;
  }

  // The auto element at index (jointCount - 1) is the last joint before the link
  const autoIdx = jointCount - 1;
  if (autoIdx < autoKinematics.cumulativeMatrices.length) {
    return autoKinematics.cumulativeMatrices[autoIdx]!;
  }

  return autoKinematics.endEffectorTransform;
}

interface RobotState {
  elements: Joint[];
  kinematics: ForwardKinematicsResult;
  baseRotation: BaseRotation;
  /** Base matrix computed from baseRotation (cached) */
  baseMatrix: Matrix4x4;

  /** Auto-DH mode state */
  autoDHMode: boolean;
  /** Auto-DH computation result (null when not in auto mode or no joints) */
  autoResult: DHAutoResult | null;
  /** Auto-DH elements used for FK/rendering (empty when not in auto mode) */
  autoElements: Joint[];
  /** Auto-DH FK result (uses autoElements) */
  autoKinematics: ForwardKinematicsResult;
  /** Auto-DH base frame matrix (world-space position + orientation of frame 0) */
  autoBaseFrame: Matrix4x4;
  /** Per-frame user selections for non-locked frames */
  frameSelections: Record<number, FrameSelection>;

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
  resetAllJoints: () => void;
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

  /** Toggle auto-DH mode on/off */
  setAutoDHMode: (enabled: boolean) => void;
  /** Select a frame option for a specific assignment index */
  selectFrameOption: (assignmentIndex: number, optionId: string) => void;
  /** Set custom angle/offset for a specific assignment index */
  setFrameCustomAngle: (assignmentIndex: number, angle: number) => void;
  /** Update a variable value on auto-DH elements (for joint sliders in auto mode) */
  updateAutoJointVariable: (jointIndex: number, value: number) => void;
  /** Update prismatic config on auto-DH elements */
  updateAutoPrismaticConfig: (jointIndex: number, prismaticMax: number, prismaticDirection: "extend" | "retract") => void;
}

/** Serializable snapshot of the entire diagram */
export interface DiagramData {
  version: string;
  baseRotation: BaseRotation;
  elements: Omit<Joint, "id">[];
  autoDHMode?: boolean;
  frameSelections?: Record<number, FrameSelection>;
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

const emptyFK: ForwardKinematicsResult = {
  individualMatrices: [],
  cumulativeMatrices: [],
  endEffectorTransform: identity4(),
};

/** Recompute auto-DH frames from the current manual elements */
function recomputeAutoDH(
  elements: Joint[],
  baseMat: Matrix4x4,
  selections: Record<number, FrameSelection>,
): { autoResult: DHAutoResult | null; autoElements: Joint[]; autoKinematics: ForwardKinematicsResult; autoBaseFrame: Matrix4x4 } {
  const jointElements = elements.filter((el) => el.elementKind === "joint");
  if (jointElements.length === 0) {
    return { autoResult: null, autoElements: [], autoKinematics: emptyFK, autoBaseFrame: identity4() };
  }

  const { joints, endEffectorPosition } = extractWorldJointInfo(elements, baseMat);
  if (joints.length === 0) {
    return { autoResult: null, autoElements: [], autoKinematics: emptyFK, autoBaseFrame: identity4() };
  }

  const autoResult = assignDHFrames(joints, endEffectorPosition, selections);
  const autoElements = autoResult.elements;
  const autoBaseFrame = autoResult.baseFrame;
  const autoKinematics = recompute(autoElements, autoBaseFrame);

  return { autoResult, autoElements, autoKinematics, autoBaseFrame };
}

const STORAGE_KEY = "dh-diagram";

function saveToStorage(
  elements: Joint[],
  baseRotation: BaseRotation,
  autoDHMode: boolean,
  frameSelections: Record<number, FrameSelection>,
): void {
  try {
    const data: DiagramData = {
      version: "1.0.0",
      baseRotation,
      elements: elements.map(({ id: _id, ...rest }) => rest),
      autoDHMode,
      frameSelections,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Silently ignore storage errors (quota, private browsing, etc.)
  }
}

interface PersistedState {
  elements: Joint[];
  baseRotation: BaseRotation;
  autoDHMode: boolean;
  frameSelections: Record<number, FrameSelection>;
}

function loadFromStorage(): PersistedState | null {
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
    return {
      elements,
      baseRotation: obj.baseRotation as BaseRotation,
      autoDHMode: typeof obj.autoDHMode === "boolean" ? obj.autoDHMode : false,
      frameSelections: (typeof obj.frameSelections === "object" && obj.frameSelections !== null
        ? obj.frameSelections
        : {}) as Record<number, FrameSelection>,
    };
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
const initialAutoDHMode = persisted?.autoDHMode ?? false;
const initialFrameSelections = persisted?.frameSelections ?? {};
const initialAuto = initialAutoDHMode
  ? recomputeAutoDH(initialElements, initialBaseMatrix, initialFrameSelections)
  : { autoResult: null, autoElements: [], autoKinematics: emptyFK, autoBaseFrame: identity4() };

export const useRobotStore = create<RobotState>((set, get) => ({
  elements: initialElements,
  kinematics: recompute(initialElements, initialBaseMatrix),
  baseRotation: initialBaseRotation,
  baseMatrix: initialBaseMatrix,
  autoDHMode: initialAutoDHMode,
  autoResult: initialAuto.autoResult,
  autoElements: initialAuto.autoElements,
  autoKinematics: initialAuto.autoKinematics,
  autoBaseFrame: initialAuto.autoBaseFrame,
  frameSelections: initialFrameSelections,

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
    const state = get();
    linkCounter++;

    if (state.autoDHMode && state.autoElements.length > 0) {
      // In auto DH mode, the user sees auto-computed frames.
      // Transform direction from the auto DH frame to the manual chain's frame.
      const autoFrame = getAutoFrameForLink(
        state.elements.length,
        state.elements,
        state.autoKinematics,
        state.autoBaseFrame,
      );
      const manualFrame = state.kinematics.endEffectorTransform;
      const params = computeAutoLinkParams(direction, length, autoFrame, manualFrame);

      const newLink: Joint = {
        id: crypto.randomUUID(),
        name: name ?? `Link ${linkCounter}`,
        elementKind: "link",
        type: "revolute",
        dhParams: params.dhParams,
        rotationAxis: params.rotationAxis,
        frameAngle: params.frameAngle,
        variableValue: 0,
        minLimit: 0,
        maxLimit: 0,
        intendedDirection: direction,
      };
      set((state) => {
        const elements = [...state.elements, newLink];
        return { elements, kinematics: recompute(elements, state.baseMatrix) };
      });
    } else {
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
    }
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

  resetAllJoints: () => {
    set((state) => {
      const elements = state.elements.map((el) => {
        if (el.elementKind !== "joint") return el;
        const resetValue =
          el.type !== "revolute" && el.prismaticDirection === "retract"
            ? (el.prismaticMax ?? el.maxLimit)
            : 0;
        return { ...el, variableValue: resetValue };
      });
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
    const outerState = get();

    if (outerState.autoDHMode && outerState.autoElements.length > 0) {
      set((state) => {
        const elements = state.elements.map((el, idx) => {
          if (el.id !== id || el.elementKind !== "link") return el;
          const dir = el.intendedDirection;
          if (!dir) {
            // Legacy link without intendedDirection: use simple update
            const sign = el.dhParams.d >= 0 ? 1 : -1;
            return { ...el, dhParams: { ...el.dhParams, d: sign * Math.abs(length) } };
          }
          const autoFrame = getAutoFrameForLink(
            idx, state.elements, outerState.autoKinematics, outerState.autoBaseFrame,
          );
          const manualFrame = idx > 0
            ? state.kinematics.cumulativeMatrices[idx - 1]!
            : state.baseMatrix;
          const params = computeAutoLinkParams(dir, length, autoFrame, manualFrame);
          return {
            ...el,
            dhParams: params.dhParams,
            rotationAxis: params.rotationAxis,
            frameAngle: params.frameAngle,
          };
        });
        return { elements, kinematics: recompute(elements, state.baseMatrix) };
      });
    } else {
      set((state) => {
        const elements = state.elements.map((el) => {
          if (el.id !== id || el.elementKind !== "link") return el;
          const sign = el.dhParams.d >= 0 ? 1 : -1;
          return { ...el, dhParams: { ...el.dhParams, d: sign * Math.abs(length) } };
        });
        return { elements, kinematics: recompute(elements, state.baseMatrix) };
      });
    }
  },

  updateLinkDirection: (id, direction) => {
    const outerState = get();

    if (outerState.autoDHMode && outerState.autoElements.length > 0) {
      set((state) => {
        const elements = state.elements.map((el, idx) => {
          if (el.id !== id || el.elementKind !== "link") return el;
          // Recover length from stored DH params
          const currentLength = Math.sqrt(
            el.dhParams.d * el.dhParams.d + el.dhParams.a * el.dhParams.a,
          );
          const length = currentLength > 1e-9 ? currentLength : Math.abs(el.dhParams.d);

          const autoFrame = getAutoFrameForLink(
            idx, state.elements, outerState.autoKinematics, outerState.autoBaseFrame,
          );
          const manualFrame = idx > 0
            ? state.kinematics.cumulativeMatrices[idx - 1]!
            : state.baseMatrix;
          const params = computeAutoLinkParams(direction, length, autoFrame, manualFrame);
          return {
            ...el,
            dhParams: params.dhParams,
            rotationAxis: params.rotationAxis,
            frameAngle: params.frameAngle,
            intendedDirection: direction,
          };
        });
        return { elements, kinematics: recompute(elements, state.baseMatrix) };
      });
    } else {
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
    }
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
    set((state) => {
      const base = {
        baseRotation: rotation,
        baseMatrix: baseMat,
        kinematics: recompute(state.elements, baseMat),
      };
      if (state.autoDHMode) {
        const auto = recomputeAutoDH(state.elements, baseMat, state.frameSelections);
        return { ...base, ...auto };
      }
      return base;
    });
  },

  importDiagram: (data) => {
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
    const autoDHMode = data.autoDHMode ?? false;
    const frameSelections = data.frameSelections ?? {};
    const auto = autoDHMode
      ? recomputeAutoDH(elements, baseMat, frameSelections)
      : { autoResult: null, autoElements: [], autoKinematics: emptyFK };
    set({
      elements,
      baseRotation: data.baseRotation,
      baseMatrix: baseMat,
      kinematics: recompute(elements, baseMat),
      autoDHMode,
      frameSelections,
      ...auto,
    });
  },

  clearAll: () => {
    jointCounter = 0;
    linkCounter = 0;
    set({
      elements: [],
      baseRotation: { x: 0, y: 0, z: 0 },
      baseMatrix: identity4(),
      kinematics: emptyFK,
      autoDHMode: false,
      autoResult: null,
      autoElements: [],
      autoKinematics: emptyFK,
      autoBaseFrame: identity4(),
      frameSelections: {},
    });
  },

  setAutoDHMode: (enabled) => {
    set((state) => {
      if (enabled) {
        const auto = recomputeAutoDH(state.elements, state.baseMatrix, state.frameSelections);
        return { autoDHMode: true, ...auto };
      }
      return {
        autoDHMode: false,
        autoResult: null,
        autoElements: [],
        autoKinematics: emptyFK,
        autoBaseFrame: identity4(),
      };
    });
  },

  selectFrameOption: (assignmentIndex, optionId) => {
    set((state) => {
      const frameSelections = {
        ...state.frameSelections,
        [assignmentIndex]: { optionId, customAngle: state.frameSelections[assignmentIndex]?.customAngle ?? 0 },
      };
      const auto = recomputeAutoDH(state.elements, state.baseMatrix, frameSelections);
      return { frameSelections, ...auto };
    });
  },

  setFrameCustomAngle: (assignmentIndex, angle) => {
    set((state) => {
      const frameSelections = {
        ...state.frameSelections,
        [assignmentIndex]: { optionId: "C", customAngle: angle },
      };
      const auto = recomputeAutoDH(state.elements, state.baseMatrix, frameSelections);
      return { frameSelections, ...auto };
    });
  },

  updateAutoJointVariable: (jointIndex, value) => {
    skipAutoRecompute = true;
    set((state) => {
      const autoElements = state.autoElements.map((el, i) => {
        if (el.elementKind === "joint" && i === jointIndex) {
          return { ...el, variableValue: value };
        }
        return el;
      });

      // Also sync to the corresponding manual joint so manual FK updates
      let jCount = 0;
      const elements = state.elements.map((el) => {
        if (el.elementKind !== "joint") return el;
        if (jCount === jointIndex) {
          jCount++;
          return { ...el, variableValue: value };
        }
        jCount++;
        return el;
      });

      return {
        autoElements,
        autoKinematics: recompute(autoElements, state.autoBaseFrame),
        elements,
        kinematics: recompute(elements, state.baseMatrix),
      };
    });
    skipAutoRecompute = false;
  },

  updateAutoPrismaticConfig: (jointIndex, prismaticMax, prismaticDirection) => {
    set((state) => {
      const autoElements = state.autoElements.map((el, i) => {
        if (el.elementKind !== "joint" || i !== jointIndex || el.type !== "prismatic") return el;
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
      return { autoElements, autoKinematics: recompute(autoElements, state.autoBaseFrame) };
    });
  },
}));

// Flag to skip auto DH recomputation when only variable values changed
let skipAutoRecompute = false;

// Auto-recompute auto-DH when elements change while in auto mode
let prevElements: Joint[] = initialElements;
let prevBaseMatrix: Matrix4x4 = initialBaseMatrix;
useRobotStore.subscribe((state) => {
  // Save to localStorage
  saveToStorage(state.elements, state.baseRotation, state.autoDHMode, state.frameSelections);

  // Auto-recompute DH if elements or base changed while in auto mode
  // Skip if only variable values changed (flagged by updateAutoJointVariable)
  if (state.autoDHMode && !skipAutoRecompute && (state.elements !== prevElements || state.baseMatrix !== prevBaseMatrix)) {
    prevElements = state.elements;
    prevBaseMatrix = state.baseMatrix;
    const auto = recomputeAutoDH(state.elements, state.baseMatrix, state.frameSelections);
    useRobotStore.setState(auto);
  } else {
    prevElements = state.elements;
    prevBaseMatrix = state.baseMatrix;
  }
});
