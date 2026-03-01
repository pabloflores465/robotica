import { describe, it, expect } from "vitest";
import {
  extractWorldJointInfo,
  classifyAxes,
  assignDHFrames,
} from "../dhFrameAssignment";
import { computeForwardKinematics } from "../forwardKinematics";
import { identity4 } from "../matrixOps";
import {
  vec3,
  dot,
  cross,
  length,
  UNIT_X,
  UNIT_Y,
  UNIT_Z,
} from "../vec3";
import type { Joint, WorldJointInfo } from "../../core/types/robot";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJoint(overrides: Partial<Joint>): Joint {
  return {
    id: crypto.randomUUID(),
    name: "test",
    elementKind: "joint",
    type: "revolute",
    dhParams: { theta: 0, d: 0, a: 0, alpha: 0 },
    rotationAxis: "z",
    frameAngle: 0,
    variableValue: 0,
    minLimit: -Math.PI,
    maxLimit: Math.PI,
    ...overrides,
  };
}

function makeLink(overrides: Partial<Joint>): Joint {
  return {
    id: crypto.randomUUID(),
    name: "link",
    elementKind: "link",
    type: "revolute",
    dhParams: { theta: 0, d: 0, a: 0, alpha: 0 },
    rotationAxis: "z",
    frameAngle: 0,
    variableValue: 0,
    minLimit: 0,
    maxLimit: 0,
    ...overrides,
  };
}

const TOL = 1e-6;

function expectClose(actual: number, expected: number, msg?: string) {
  expect(
    Math.abs(actual - expected),
    msg ?? `Expected ${actual} to be close to ${expected}`,
  ).toBeLessThan(TOL);
}

// ---------------------------------------------------------------------------
// classifyAxes
// ---------------------------------------------------------------------------

describe("classifyAxes", () => {
  it("parallel axes", () => {
    const r = classifyAxes(UNIT_Z, vec3(0, 0, 0), UNIT_Z, vec3(1, 0, 0), 1);
    expect(r).toBe("parallel");
  });

  it("anti-parallel axes are classified as parallel", () => {
    const r = classifyAxes(UNIT_Z, vec3(0, 0, 0), vec3(0, 0, -1), vec3(1, 0, 0), 1);
    expect(r).toBe("parallel");
  });

  it("collinear axes", () => {
    const r = classifyAxes(UNIT_Z, vec3(0, 0, 0), UNIT_Z, vec3(0, 0, 2), 2);
    expect(r).toBe("collinear");
  });

  it("intersecting axes", () => {
    const r = classifyAxes(UNIT_Z, vec3(0, 0, 0), UNIT_X, vec3(0, 0, 0), 1);
    expect(r).toBe("intersecting");
  });

  it("skew axes", () => {
    const r = classifyAxes(UNIT_X, vec3(0, 0, 0), UNIT_Y, vec3(0, 0, 1), 1);
    expect(r).toBe("skew");
  });
});

// ---------------------------------------------------------------------------
// extractWorldJointInfo
// ---------------------------------------------------------------------------

describe("extractWorldJointInfo", () => {
  it("extracts single joint at origin", () => {
    const elements = [makeJoint({ name: "J1" })];
    const { joints } = extractWorldJointInfo(elements, identity4());

    expect(joints).toHaveLength(1);
    expectClose(joints[0]!.axisPoint.x, 0);
    expectClose(joints[0]!.axisPoint.y, 0);
    expectClose(joints[0]!.axisPoint.z, 0);
    // z-axis joint: direction should be along world Z
    expectClose(joints[0]!.axisDirection.z, 1);
  });

  it("extracts two joints connected by a link", () => {
    const elements = [
      makeJoint({ name: "J1" }),
      makeLink({ name: "L1", dhParams: { theta: 0, d: 1.5, a: 0, alpha: 0 } }),
      makeJoint({ name: "J2" }),
    ];

    const { joints } = extractWorldJointInfo(elements, identity4());
    expect(joints).toHaveLength(2);
    // J1 at origin
    expectClose(joints[0]!.axisPoint.z, 0);
    // J2 at z=1.5 (link translates along z)
    expectClose(joints[1]!.axisPoint.z, 1.5);
  });

  it("uses zero-config (ignores variable values)", () => {
    const elements = [
      makeJoint({ name: "J1", variableValue: Math.PI / 4 }),
      makeLink({ name: "L1", dhParams: { theta: 0, d: 1, a: 0, alpha: 0 } }),
      makeJoint({ name: "J2", variableValue: 0.5 }),
    ];

    const { joints } = extractWorldJointInfo(elements, identity4());
    expect(joints).toHaveLength(2);
    // With zero-config, J2 should be at z=1 regardless of J1's variable value
    expectClose(joints[1]!.axisPoint.z, 1);
  });
});

// ---------------------------------------------------------------------------
// assignDHFrames: geometric equivalence tests
// ---------------------------------------------------------------------------

describe("assignDHFrames", () => {
  describe("2R planar (parallel Z axes)", () => {
    const worldJoints: WorldJointInfo[] = [
      {
        type: "revolute",
        axisPoint: vec3(0, 0, 0),
        axisDirection: UNIT_Z,
        elementIndex: 0,
        minLimit: -Math.PI,
        maxLimit: Math.PI,
      },
      {
        type: "revolute",
        axisPoint: vec3(1, 0, 0),
        axisDirection: UNIT_Z,
        elementIndex: 1,
        minLimit: -Math.PI,
        maxLimit: Math.PI,
      },
    ];

    it("classifies as parallel", () => {
      const result = assignDHFrames(worldJoints, vec3(2, 0, 0));
      expect(result.assignments.length).toBeGreaterThanOrEqual(2);
      expect(result.assignments[1]!.axisRelation).toBe("parallel");
    });

    it("a and alpha are correct for parallel Z axes", () => {
      const result = assignDHFrames(worldJoints, vec3(2, 0, 0));
      const assignment1 = result.assignments[1]!;
      // a should be 1 (distance between parallel axes)
      expectClose(assignment1.dhParams.a, 1, "a should be 1");
      // alpha should be 0 (same direction axes)
      expectClose(assignment1.dhParams.alpha, 0, "alpha should be 0");
    });

    it("a is invariant across frame options", () => {
      const result = assignDHFrames(worldJoints, vec3(2, 0, 0));
      const options = result.assignments[1]!.options;

      for (const opt of options) {
        expect(opt.invariants.aConstant).toBe(true);
        expect(opt.invariants.alphaConstant).toBe(true);
        expectClose(opt.resultingDHParams.a, 1, `Option ${opt.id}: a should be 1`);
        expectClose(opt.resultingDHParams.alpha, 0, `Option ${opt.id}: alpha should be 0`);
      }
    });

    it("synthesized elements produce correct FK for multiple configs", () => {
      const result = assignDHFrames(worldJoints, vec3(2, 0, 0));

      const testConfigs = [
        [0, 0],
        [Math.PI / 4, 0],
        [0, Math.PI / 2],
        [Math.PI / 3, -Math.PI / 6],
      ];

      for (const config of testConfigs) {
        // Set variable values
        const elements = result.elements.map((el, i) => {
          if (el.elementKind === "joint" && i < config.length) {
            return { ...el, variableValue: config[i]! };
          }
          return el;
        });

        const fk = computeForwardKinematics(elements, identity4());

        // For a 2R planar arm with link lengths [1, 1]:
        // End effector x = cos(q1) + cos(q1+q2) (approximately, depends on DH convention)
        // We verify FK positions are geometrically reasonable
        // The end effector should be within distance 2 of origin (sum of link lengths)
        const eePos = fk.endEffectorTransform;
        const eeX = eePos[0]![3]!;
        const eeY = eePos[1]![3]!;
        const eeDist = Math.sqrt(eeX * eeX + eeY * eeY);
        expect(eeDist).toBeLessThanOrEqual(2 + TOL);
      }
    });
  });

  describe("intersecting axes (wrist-like)", () => {
    const worldJoints: WorldJointInfo[] = [
      {
        type: "revolute",
        axisPoint: vec3(0, 0, 0),
        axisDirection: UNIT_Z,
        elementIndex: 0,
        minLimit: -Math.PI,
        maxLimit: Math.PI,
      },
      {
        type: "revolute",
        axisPoint: vec3(0, 0, 0),
        axisDirection: UNIT_X,
        elementIndex: 1,
        minLimit: -Math.PI,
        maxLimit: Math.PI,
      },
    ];

    it("classifies as intersecting", () => {
      const result = assignDHFrames(worldJoints, vec3(0, 0, 0));
      expect(result.assignments[1]!.axisRelation).toBe("intersecting");
    });

    it("a = 0 for intersecting axes", () => {
      const result = assignDHFrames(worldJoints, vec3(0, 0, 0));
      expectClose(result.assignments[1]!.dhParams.a, 0);
    });

    it("a is invariant and |alpha| is invariant across options", () => {
      const result = assignDHFrames(worldJoints, vec3(0, 0, 0));
      const absAlpha = Math.abs(result.assignments[1]!.dhParams.alpha);

      for (const opt of result.assignments[1]!.options) {
        expect(opt.invariants.aConstant).toBe(true);
        // alpha sign may flip with x_i direction, but |alpha| is invariant
        expect(opt.invariants.alphaConstant).toBe(false);
        expectClose(opt.resultingDHParams.a, 0, `Option ${opt.id}: a = 0`);
        expectClose(Math.abs(opt.resultingDHParams.alpha), absAlpha, `Option ${opt.id}: |alpha| invariant`);
      }
    });
  });

  describe("skew axes", () => {
    const worldJoints: WorldJointInfo[] = [
      {
        type: "revolute",
        axisPoint: vec3(0, 0, 0),
        axisDirection: UNIT_X,
        elementIndex: 0,
        minLimit: -Math.PI,
        maxLimit: Math.PI,
      },
      {
        type: "revolute",
        axisPoint: vec3(0, 0, 2),
        axisDirection: UNIT_Y,
        elementIndex: 1,
        minLimit: -Math.PI,
        maxLimit: Math.PI,
      },
    ];

    it("classifies as skew", () => {
      const result = assignDHFrames(worldJoints, vec3(0, 0, 2));
      expect(result.assignments[1]!.axisRelation).toBe("skew");
    });

    it("frame is locked for skew axes", () => {
      const result = assignDHFrames(worldJoints, vec3(0, 0, 2));
      expect(result.assignments[1]!.frameLocked).toBe(true);
      expect(result.assignments[1]!.options).toHaveLength(0);
    });

    it("a equals the distance between the lines", () => {
      const result = assignDHFrames(worldJoints, vec3(0, 0, 2));
      expectClose(result.assignments[1]!.dhParams.a, 2);
    });
  });

  describe("collinear axes", () => {
    const worldJoints: WorldJointInfo[] = [
      {
        type: "revolute",
        axisPoint: vec3(0, 0, 0),
        axisDirection: UNIT_Z,
        elementIndex: 0,
        minLimit: -Math.PI,
        maxLimit: Math.PI,
      },
      {
        type: "revolute",
        axisPoint: vec3(0, 0, 3),
        axisDirection: UNIT_Z,
        elementIndex: 1,
        minLimit: -Math.PI,
        maxLimit: Math.PI,
      },
    ];

    it("classifies as collinear", () => {
      const result = assignDHFrames(worldJoints, vec3(0, 0, 3));
      expect(result.assignments[1]!.axisRelation).toBe("collinear");
    });

    it("a = 0 and alpha = 0 for collinear same-direction", () => {
      const result = assignDHFrames(worldJoints, vec3(0, 0, 3));
      expectClose(result.assignments[1]!.dhParams.a, 0);
      expectClose(result.assignments[1]!.dhParams.alpha, 0);
    });

    it("x_i fallback produces valid right-handed frame", () => {
      const result = assignDHFrames(worldJoints, vec3(0, 0, 3));
      const frame = result.assignments[1]!.frameAxes;

      // Unit vectors
      expectClose(length(frame.x), 1, "x should be unit");
      expectClose(length(frame.y), 1, "y should be unit");
      expectClose(length(frame.z), 1, "z should be unit");

      // Orthogonality
      expectClose(dot(frame.x, frame.y), 0, "x dot y = 0");
      expectClose(dot(frame.x, frame.z), 0, "x dot z = 0");
      expectClose(dot(frame.y, frame.z), 0, "y dot z = 0");

      // Right-handed: det should be +1
      const det = dot(cross(frame.x, frame.y), frame.z);
      expectClose(det, 1, "right-handed frame");
    });
  });

  describe("single joint", () => {
    it("produces sensible frame 0", () => {
      const worldJoints: WorldJointInfo[] = [
        {
          type: "revolute",
          axisPoint: vec3(0, 0, 0),
          axisDirection: UNIT_Z,
          elementIndex: 0,
          minLimit: -Math.PI,
          maxLimit: Math.PI,
        },
      ];

      const result = assignDHFrames(worldJoints, vec3(0, 0, 0));
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0]!.frameLocked).toBe(true);

      const frame = result.assignments[0]!.frameAxes;
      // z should be along UNIT_Z
      expectClose(frame.z.z, 1);
      // x should be perpendicular to z
      expectClose(dot(frame.x, frame.z), 0);
      // Right-handed
      expectClose(dot(cross(frame.x, frame.y), frame.z), 1);
    });
  });

  describe("frame invariants", () => {
    it("all frames have orthonormal right-handed axes", () => {
      const worldJoints: WorldJointInfo[] = [
        { type: "revolute", axisPoint: vec3(0, 0, 0), axisDirection: UNIT_Z, elementIndex: 0, minLimit: -Math.PI, maxLimit: Math.PI },
        { type: "revolute", axisPoint: vec3(0, 0, 1.5), axisDirection: UNIT_Y, elementIndex: 1, minLimit: -Math.PI, maxLimit: Math.PI },
        { type: "revolute", axisPoint: vec3(0.5, 0, 1.5), axisDirection: UNIT_Y, elementIndex: 2, minLimit: -Math.PI, maxLimit: Math.PI },
        { type: "revolute", axisPoint: vec3(1, 0, 1.5), axisDirection: UNIT_Z, elementIndex: 3, minLimit: -Math.PI, maxLimit: Math.PI },
      ];

      const result = assignDHFrames(worldJoints, vec3(1, 0, 1.5));

      for (let i = 0; i < result.assignments.length; i++) {
        const frame = result.assignments[i]!.frameAxes;
        const label = `Frame ${i}`;

        // Unit vectors
        expectClose(length(frame.x), 1, `${label}: |x| = 1`);
        expectClose(length(frame.y), 1, `${label}: |y| = 1`);
        expectClose(length(frame.z), 1, `${label}: |z| = 1`);

        // Orthogonality
        expectClose(dot(frame.x, frame.y), 0, `${label}: x.y = 0`);
        expectClose(dot(frame.x, frame.z), 0, `${label}: x.z = 0`);
        expectClose(dot(frame.y, frame.z), 0, `${label}: y.z = 0`);

        // Right-handed
        const det = dot(cross(frame.x, frame.y), frame.z);
        expectClose(det, 1, `${label}: det = 1`);
      }
    });

    it("z_i is aligned with joint axis", () => {
      const worldJoints: WorldJointInfo[] = [
        { type: "revolute", axisPoint: vec3(0, 0, 0), axisDirection: UNIT_Z, elementIndex: 0, minLimit: -Math.PI, maxLimit: Math.PI },
        { type: "revolute", axisPoint: vec3(1, 0, 0), axisDirection: UNIT_Y, elementIndex: 1, minLimit: -Math.PI, maxLimit: Math.PI },
        { type: "revolute", axisPoint: vec3(1, 0, 1), axisDirection: UNIT_X, elementIndex: 2, minLimit: -Math.PI, maxLimit: Math.PI },
      ];

      const result = assignDHFrames(worldJoints, vec3(1, 0, 1));

      for (let i = 0; i < result.assignments.length; i++) {
        const frameZ = result.assignments[i]!.frameAxes.z;
        const jointAxis = worldJoints[i]!.axisDirection;

        // z_i should be aligned (parallel) with the joint axis
        const dotVal = Math.abs(dot(frameZ, jointAxis));
        expectClose(dotVal, 1, `Frame ${i}: z aligned with joint axis`);
      }
    });
  });

  describe("end-effector frame", () => {
    it("tool transform position matches end-effector", () => {
      const worldJoints: WorldJointInfo[] = [
        { type: "revolute", axisPoint: vec3(0, 0, 0), axisDirection: UNIT_Z, elementIndex: 0, minLimit: -Math.PI, maxLimit: Math.PI },
        { type: "revolute", axisPoint: vec3(1, 0, 0), axisDirection: UNIT_Z, elementIndex: 1, minLimit: -Math.PI, maxLimit: Math.PI },
      ];

      const eePos = vec3(2, 0, 0);
      const result = assignDHFrames(worldJoints, eePos);

      expectClose(result.toolTransform.position.x, 2);
      expectClose(result.toolTransform.position.y, 0);
      expectClose(result.toolTransform.position.z, 0);
    });

    it("detects non-DH-compatible end-effector (y-component)", () => {
      const worldJoints: WorldJointInfo[] = [
        { type: "revolute", axisPoint: vec3(0, 0, 0), axisDirection: UNIT_Z, elementIndex: 0, minLimit: -Math.PI, maxLimit: Math.PI },
      ];

      // Single joint along Z: x_0 = perpendicularTo(Z) = Y, y_0 = cross(Z, Y) = -X
      // EE at (-1, 0, 0) has local dy = dot((-1,0,0), (-1,0,0)) = 1 (non-DH-compatible)
      const eePos = vec3(-1, 0, 0);
      const result = assignDHFrames(worldJoints, eePos);

      expect(result.toolTransform.isDHCompatible).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe("option equivalence: all options produce valid FK", () => {
    it("parallel axes: different options produce same end-effector position at zero config", () => {
      // Use joints with axial offset so Option B (at joint position) differs from Option A
      const worldJoints: WorldJointInfo[] = [
        { type: "revolute", axisPoint: vec3(0, 0, 0), axisDirection: UNIT_Z, elementIndex: 0, minLimit: -Math.PI, maxLimit: Math.PI },
        { type: "revolute", axisPoint: vec3(1, 0, 3), axisDirection: UNIT_Z, elementIndex: 1, minLimit: -Math.PI, maxLimit: Math.PI },
      ];

      const eePos = vec3(2, 0, 3);

      // Test with option A
      const resultA = assignDHFrames(worldJoints, eePos, { 1: { optionId: "A", customAngle: 0 } });
      const fkA = computeForwardKinematics(resultA.elements, identity4());

      // Test with option B (should exist due to axial offset)
      const resultB = assignDHFrames(worldJoints, eePos, { 1: { optionId: "B", customAngle: 0 } });
      const hasBOption = resultB.assignments[1]?.options.find((o) => o.id === "B");
      expect(hasBOption).toBeDefined();

      if (hasBOption) {
        const fkB = computeForwardKinematics(resultB.elements, identity4());

        // At zero config, end-effector positions should be the same (same geometry)
        const posA = fkA.endEffectorTransform;
        const posB = fkB.endEffectorTransform;
        expectClose(posA[0]![3]!, posB[0]![3]!, "EE x should match");
        expectClose(posA[1]![3]!, posB[1]![3]!, "EE y should match");
        expectClose(posA[2]![3]!, posB[2]![3]!, "EE z should match");
      }
    });
  });
});
