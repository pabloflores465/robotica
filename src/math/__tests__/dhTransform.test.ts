import { describe, it, expect } from "vitest";
import { computeDHMatrix, getEffectiveDHParams } from "../dhTransform";
import type { Joint } from "../../core/types/robot";

describe("computeDHMatrix", () => {
  it("returns identity-like matrix for all-zero params except a=0", () => {
    const m = computeDHMatrix({ theta: 0, d: 0, a: 0, alpha: 0 });
    // Should be identity
    expect(m[0]![0]).toBeCloseTo(1);
    expect(m[1]![1]).toBeCloseTo(1);
    expect(m[2]![2]).toBeCloseTo(1);
    expect(m[3]![3]).toBeCloseTo(1);
    expect(m[0]![3]).toBeCloseTo(0); // translation x
    expect(m[1]![3]).toBeCloseTo(0); // translation y
    expect(m[2]![3]).toBeCloseTo(0); // translation z
  });

  it("produces correct matrix for theta=90deg, a=1", () => {
    const theta = Math.PI / 2;
    const m = computeDHMatrix({ theta, d: 0, a: 1, alpha: 0 });
    // cos(90) ~ 0, sin(90) ~ 1
    expect(m[0]![0]).toBeCloseTo(0); // cos(theta)
    expect(m[1]![0]).toBeCloseTo(1); // sin(theta)
    expect(m[0]![3]).toBeCloseTo(0); // a*cos(theta) = 1*0 = 0
    expect(m[1]![3]).toBeCloseTo(1); // a*sin(theta) = 1*1 = 1
  });

  it("produces correct translation for d parameter", () => {
    const m = computeDHMatrix({ theta: 0, d: 1.5, a: 0, alpha: 0 });
    // d goes into position [2][3]
    expect(m[2]![3]).toBeCloseTo(1.5);
    // No x/y translation
    expect(m[0]![3]).toBeCloseTo(0);
    expect(m[1]![3]).toBeCloseTo(0);
  });

  it("produces correct twist for alpha=90deg", () => {
    const alpha = Math.PI / 2;
    const m = computeDHMatrix({ theta: 0, d: 0, a: 1, alpha });
    // Row 2: [0, sin(alpha), cos(alpha), d] = [0, 1, 0, 0]
    expect(m[2]![1]).toBeCloseTo(1); // sin(alpha)
    expect(m[2]![2]).toBeCloseTo(0); // cos(alpha)
  });

  it("produces correct matrix for a=2 with theta=0", () => {
    const m = computeDHMatrix({ theta: 0, d: 0, a: 2, alpha: 0 });
    expect(m[0]![3]).toBeCloseTo(2); // a*cos(0) = 2
    expect(m[1]![3]).toBeCloseTo(0); // a*sin(0) = 0
  });
});

describe("getEffectiveDHParams", () => {
  it("adds variable to theta for revolute joint", () => {
    const joint: Joint = {
      id: "test",
      name: "Test",
      type: "revolute",
      dhParams: { theta: 0, d: 0, a: 1, alpha: 0 },
      variableValue: Math.PI / 4,
      minLimit: -Math.PI,
      maxLimit: Math.PI,
    };
    const params = getEffectiveDHParams(joint);
    expect(params.theta).toBeCloseTo(Math.PI / 4);
    expect(params.d).toBe(0);
  });

  it("adds variable to d for prismatic joint", () => {
    const joint: Joint = {
      id: "test",
      name: "Test",
      type: "prismatic",
      dhParams: { theta: 0, d: 0.5, a: 1, alpha: 0 },
      variableValue: 1.0,
      minLimit: -2,
      maxLimit: 2,
    };
    const params = getEffectiveDHParams(joint);
    expect(params.theta).toBe(0);
    expect(params.d).toBeCloseTo(1.5); // 0.5 + 1.0
  });
});
