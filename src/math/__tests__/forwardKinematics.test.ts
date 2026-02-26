import { describe, it, expect } from "vitest";
import { computeForwardKinematics } from "../forwardKinematics";
import type { Joint } from "../../core/types/robot";

function makeRevoluteJoint(
  a: number,
  theta: number = 0,
  d: number = 0,
  alpha: number = 0,
  variableValue: number = 0,
): Joint {
  return {
    id: crypto.randomUUID(),
    name: "Joint",
    type: "revolute",
    dhParams: { theta, d, a, alpha },
    variableValue,
    minLimit: -Math.PI,
    maxLimit: Math.PI,
  };
}

function makePrismaticJoint(
  d: number = 0,
  a: number = 0,
  alpha: number = 0,
  variableValue: number = 0,
): Joint {
  return {
    id: crypto.randomUUID(),
    name: "Joint",
    type: "prismatic",
    dhParams: { theta: 0, d, a, alpha },
    variableValue,
    minLimit: -5,
    maxLimit: 5,
  };
}

describe("computeForwardKinematics", () => {
  it("returns identity for empty joints", () => {
    const result = computeForwardKinematics([]);
    expect(result.individualMatrices).toHaveLength(0);
    expect(result.cumulativeMatrices).toHaveLength(0);
    const ee = result.endEffectorTransform;
    expect(ee[0]![0]).toBe(1);
    expect(ee[3]![3]).toBe(1);
  });

  it("2-link planar arm at theta=0: end effector at (2, 0, 0)", () => {
    const joints = [makeRevoluteJoint(1), makeRevoluteJoint(1)];
    const result = computeForwardKinematics(joints);
    const ee = result.endEffectorTransform;
    expect(ee[0]![3]).toBeCloseTo(2); // x = a1 + a2 = 1 + 1
    expect(ee[1]![3]).toBeCloseTo(0); // y = 0
    expect(ee[2]![3]).toBeCloseTo(0); // z = 0
  });

  it("2-link planar arm with theta1=90deg: end effector at (0, 2, 0)", () => {
    const joints = [
      makeRevoluteJoint(1, 0, 0, 0, Math.PI / 2), // theta variable = 90deg
      makeRevoluteJoint(1),
    ];
    const result = computeForwardKinematics(joints);
    const ee = result.endEffectorTransform;
    // Joint 1 rotates 90deg: places joint 2 origin at (0, 1, 0)
    // Joint 2 has a=1, inheriting the rotation, extends to (0, 2, 0)
    expect(ee[0]![3]).toBeCloseTo(0); // x
    expect(ee[1]![3]).toBeCloseTo(2); // y
    expect(ee[2]![3]).toBeCloseTo(0); // z
  });

  it("2-link planar arm with theta1=0, theta2=90deg: end effector at (1, 1, 0)", () => {
    const joints = [
      makeRevoluteJoint(1),
      makeRevoluteJoint(1, 0, 0, 0, Math.PI / 2), // theta variable = 90deg
    ];
    const result = computeForwardKinematics(joints);
    const ee = result.endEffectorTransform;
    expect(ee[0]![3]).toBeCloseTo(1); // x = a1*cos(0) + a2*cos(90) = 1 + 0
    expect(ee[1]![3]).toBeCloseTo(1); // y = a1*sin(0) + a2*sin(90) = 0 + 1
    expect(ee[2]![3]).toBeCloseTo(0); // z
  });

  it("prismatic joint: translates along z", () => {
    const joints = [makePrismaticJoint(0, 0, 0, 1.5)];
    const result = computeForwardKinematics(joints);
    const ee = result.endEffectorTransform;
    expect(ee[0]![3]).toBeCloseTo(0); // x
    expect(ee[1]![3]).toBeCloseTo(0); // y
    expect(ee[2]![3]).toBeCloseTo(1.5); // z = d
  });

  it("90-degree twist rotates next frame z-axis", () => {
    const joints = [makeRevoluteJoint(1, 0, 0, Math.PI / 2)];
    const result = computeForwardKinematics(joints);
    const ee = result.endEffectorTransform;
    // After alpha=90deg twist:
    // Column 2 (z-axis of frame 1) should be [0, -1, 0] in base frame?
    // Actually: Row 2 of DH matrix with alpha=90: [0, sin(alpha), cos(alpha), d]
    // = [0, 1, 0, 0]
    // The z-axis of the new frame (column 2) should reflect the twist
    expect(ee[2]![1]).toBeCloseTo(1); // sin(alpha)
    expect(ee[2]![2]).toBeCloseTo(0); // cos(alpha)
  });

  it("returns correct number of individual and cumulative matrices", () => {
    const joints = [
      makeRevoluteJoint(1),
      makeRevoluteJoint(1),
      makePrismaticJoint(0, 0.5, 0, 0),
    ];
    const result = computeForwardKinematics(joints);
    expect(result.individualMatrices).toHaveLength(3);
    expect(result.cumulativeMatrices).toHaveLength(3);
  });
});
