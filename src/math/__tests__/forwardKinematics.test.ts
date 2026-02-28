import { describe, it, expect } from "vitest";
import { computeForwardKinematics } from "../forwardKinematics";
import type { Joint, RotationAxis } from "../../core/types/robot";

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
    elementKind: "joint",
    type: "revolute",
    dhParams: { theta, d, a, alpha },
    rotationAxis: "z",
    frameAngle: 0,
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
    elementKind: "joint",
    type: "prismatic",
    dhParams: { theta: 0, d, a, alpha },
    rotationAxis: "z",
    frameAngle: 0,
    variableValue,
    minLimit: -5,
    maxLimit: 5,
  };
}

function makeLinkElement(
  direction: "+x" | "-x" | "+y" | "-y" | "+z" | "-z",
  length: number,
): Joint {
  const map: Record<string, { axis: RotationAxis; sign: 1 | -1 }> = {
    "+x": { axis: "x", sign: 1 },
    "-x": { axis: "x", sign: -1 },
    "+y": { axis: "y", sign: 1 },
    "-y": { axis: "y", sign: -1 },
    "+z": { axis: "z", sign: 1 },
    "-z": { axis: "z", sign: -1 },
  };
  const { axis, sign } = map[direction]!;
  return {
    id: crypto.randomUUID(),
    name: "Link",
    elementKind: "link",
    type: "revolute",
    dhParams: { theta: 0, d: sign * length, a: 0, alpha: 0 },
    rotationAxis: axis,
    frameAngle: 0,
    variableValue: 0,
    minLimit: 0,
    maxLimit: 0,
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
    expect(ee[0]![3]).toBeCloseTo(1); // x
    expect(ee[1]![3]).toBeCloseTo(1); // y
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

  it("link +X produces pure translation along x", () => {
    const result = computeForwardKinematics([makeLinkElement("+x", 1.5)]);
    const ee = result.endEffectorTransform;
    expect(ee[0]![3]).toBeCloseTo(1.5);
    expect(ee[1]![3]).toBeCloseTo(0);
    expect(ee[2]![3]).toBeCloseTo(0);
    // Rotation block should be identity
    expect(ee[0]![0]).toBeCloseTo(1);
    expect(ee[1]![1]).toBeCloseTo(1);
    expect(ee[2]![2]).toBeCloseTo(1);
  });

  it("link -Z produces pure translation along -z", () => {
    const result = computeForwardKinematics([makeLinkElement("-z", 0.5)]);
    const ee = result.endEffectorTransform;
    expect(ee[0]![3]).toBeCloseTo(0);
    expect(ee[1]![3]).toBeCloseTo(0);
    expect(ee[2]![3]).toBeCloseTo(-0.5);
  });

  it("mixed chain: joint rotation + link translation works correctly", () => {
    const elements = [
      makeRevoluteJoint(0, 0, 0, 0, Math.PI / 2), // rotate 90deg about z
      makeLinkElement("+x", 1.0), // translate +X by 1 (in rotated frame)
    ];
    const result = computeForwardKinematics(elements);
    const ee = result.endEffectorTransform;
    // After 90deg z-rotation, local +X becomes global +Y
    expect(ee[0]![3]).toBeCloseTo(0);
    expect(ee[1]![3]).toBeCloseTo(1.0);
    expect(ee[2]![3]).toBeCloseTo(0);
  });
});
