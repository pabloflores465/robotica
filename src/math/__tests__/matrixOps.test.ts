import { describe, it, expect } from "vitest";
import { identity4, multiplyMatrices, formatMatrixElement } from "../matrixOps";
import type { Matrix4x4 } from "../../core/types/matrix";

describe("identity4", () => {
  it("returns a 4x4 identity matrix", () => {
    const id = identity4();
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        expect(id[i]![j]).toBe(i === j ? 1 : 0);
      }
    }
  });
});

describe("multiplyMatrices", () => {
  it("identity * identity = identity", () => {
    const result = multiplyMatrices(identity4(), identity4());
    const id = identity4();
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        expect(result[i]![j]).toBeCloseTo(id[i]![j]!);
      }
    }
  });

  it("identity * A = A", () => {
    const a: Matrix4x4 = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
      [0, 0, 0, 1],
    ];
    const result = multiplyMatrices(identity4(), a);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        expect(result[i]![j]).toBeCloseTo(a[i]![j]!);
      }
    }
  });

  it("multiplies two known matrices correctly", () => {
    const a: Matrix4x4 = [
      [1, 0, 0, 1],
      [0, 1, 0, 2],
      [0, 0, 1, 3],
      [0, 0, 0, 1],
    ];
    const b: Matrix4x4 = [
      [1, 0, 0, 4],
      [0, 1, 0, 5],
      [0, 0, 1, 6],
      [0, 0, 0, 1],
    ];
    // Two translations should add
    const result = multiplyMatrices(a, b);
    expect(result[0]![3]).toBeCloseTo(5); // 1 + 4
    expect(result[1]![3]).toBeCloseTo(7); // 2 + 5
    expect(result[2]![3]).toBeCloseTo(9); // 3 + 6
  });
});

describe("formatMatrixElement", () => {
  it("formats zero correctly", () => {
    expect(formatMatrixElement(0)).toBe("0.0000");
  });

  it("formats near-zero as zero", () => {
    expect(formatMatrixElement(1e-15)).toBe("0.0000");
    expect(formatMatrixElement(-6.123e-17)).toBe("0.0000");
  });

  it("formats normal numbers with 4 decimal places", () => {
    expect(formatMatrixElement(1.23456789)).toBe("1.2346");
    expect(formatMatrixElement(-0.5)).toBe("-0.5000");
  });

  it("respects custom precision", () => {
    expect(formatMatrixElement(1.23456789, 2)).toBe("1.23");
  });
});
