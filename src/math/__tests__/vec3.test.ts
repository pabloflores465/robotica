import { describe, it, expect } from "vitest";
import {
  dot,
  cross,
  normalize,
  length,
  add,
  subtract,
  scale,
  isParallel,
  isNearZero,
  isClose,
  closestPointsBetweenLines,
  lineLineIntersection,
  signedAngle,
  projectOntoPlane,
  perpendicularTo,
  rotateAboutAxis,
  vec3,
  UNIT_X,
  UNIT_Y,
  UNIT_Z,
} from "../vec3";

describe("vec3 basic operations", () => {
  it("dot product", () => {
    expect(dot(UNIT_X, UNIT_Y)).toBeCloseTo(0);
    expect(dot(UNIT_X, UNIT_X)).toBeCloseTo(1);
    expect(dot(vec3(1, 2, 3), vec3(4, 5, 6))).toBeCloseTo(32);
  });

  it("cross product", () => {
    const r = cross(UNIT_X, UNIT_Y);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
    expect(r.z).toBeCloseTo(1);

    const r2 = cross(UNIT_Y, UNIT_X);
    expect(r2.z).toBeCloseTo(-1);
  });

  it("normalize", () => {
    const v = normalize(vec3(3, 4, 0));
    expect(v.x).toBeCloseTo(0.6);
    expect(v.y).toBeCloseTo(0.8);
    expect(length(v)).toBeCloseTo(1);
  });

  it("normalize zero vector returns zero", () => {
    const v = normalize(vec3(0, 0, 0));
    expect(length(v)).toBeCloseTo(0);
  });

  it("add and subtract", () => {
    const a = vec3(1, 2, 3);
    const b = vec3(4, 5, 6);
    const sum = add(a, b);
    expect(sum.x).toBeCloseTo(5);
    expect(sum.y).toBeCloseTo(7);
    expect(sum.z).toBeCloseTo(9);

    const diff = subtract(sum, b);
    expect(diff.x).toBeCloseTo(1);
    expect(diff.y).toBeCloseTo(2);
    expect(diff.z).toBeCloseTo(3);
  });

  it("scale", () => {
    const v = scale(vec3(1, 2, 3), 2);
    expect(v.x).toBeCloseTo(2);
    expect(v.y).toBeCloseTo(4);
    expect(v.z).toBeCloseTo(6);
  });
});

describe("tolerance utilities", () => {
  it("isNearZero", () => {
    expect(isNearZero(0)).toBe(true);
    expect(isNearZero(1e-11)).toBe(true);
    expect(isNearZero(1e-9)).toBe(false);
    expect(isNearZero(1)).toBe(false);
  });

  it("isClose", () => {
    expect(isClose(1.0, 1.0 + 1e-12)).toBe(true);
    expect(isClose(1.0, 1.1)).toBe(false);
    expect(isClose(1000, 1000.000001)).toBe(true);
    // Relative tolerance: 1e-8 * 1000 = 1e-5
    expect(isClose(1000, 1000.0001)).toBe(false);
  });
});

describe("isParallel", () => {
  it("parallel vectors", () => {
    expect(isParallel(UNIT_X, UNIT_X)).toBe(true);
    expect(isParallel(UNIT_X, scale(UNIT_X, 5))).toBe(true);
  });

  it("anti-parallel vectors", () => {
    expect(isParallel(UNIT_X, scale(UNIT_X, -1))).toBe(true);
    expect(isParallel(UNIT_Z, vec3(0, 0, -3))).toBe(true);
  });

  it("non-parallel vectors", () => {
    expect(isParallel(UNIT_X, UNIT_Y)).toBe(false);
    expect(isParallel(vec3(1, 0, 0), vec3(1, 1, 0))).toBe(false);
  });

  it("nearly parallel vectors within tolerance", () => {
    const slight = vec3(1, 1e-12, 0);
    expect(isParallel(UNIT_X, slight)).toBe(true);
  });
});

describe("closestPointsBetweenLines", () => {
  it("perpendicular skew lines", () => {
    // Line 1: along X through origin
    // Line 2: along Y through (0, 0, 1)
    const result = closestPointsBetweenLines(
      vec3(0, 0, 0), UNIT_X,
      vec3(0, 0, 1), UNIT_Y,
    );
    expect(result.distance).toBeCloseTo(1);
    expect(result.point1.x).toBeCloseTo(0);
    expect(result.point1.y).toBeCloseTo(0);
    expect(result.point1.z).toBeCloseTo(0);
    expect(result.point2.x).toBeCloseTo(0);
    expect(result.point2.y).toBeCloseTo(0);
    expect(result.point2.z).toBeCloseTo(1);
  });

  it("offset skew lines", () => {
    // Line 1: along X through (0,0,0)
    // Line 2: along Z through (2,3,0)
    const result = closestPointsBetweenLines(
      vec3(0, 0, 0), UNIT_X,
      vec3(2, 3, 0), UNIT_Z,
    );
    expect(result.distance).toBeCloseTo(3);
    expect(result.point1.x).toBeCloseTo(2);
    expect(result.point2.y).toBeCloseTo(3);
  });

  it("parallel lines", () => {
    // Line 1: along Z through (0,0,0)
    // Line 2: along Z through (1,0,0)
    const result = closestPointsBetweenLines(
      vec3(0, 0, 0), UNIT_Z,
      vec3(1, 0, 0), UNIT_Z,
    );
    expect(result.distance).toBeCloseTo(1);
  });
});

describe("lineLineIntersection", () => {
  it("intersecting lines", () => {
    // Line 1: along X through origin
    // Line 2: along Y through origin
    const pt = lineLineIntersection(
      vec3(0, 0, 0), UNIT_X,
      vec3(0, 0, 0), UNIT_Y,
      1.0,
    );
    expect(pt).not.toBeNull();
    expect(pt!.x).toBeCloseTo(0);
    expect(pt!.y).toBeCloseTo(0);
    expect(pt!.z).toBeCloseTo(0);
  });

  it("intersecting lines at offset point", () => {
    // Line 1: along X through (0,0,2)
    // Line 2: along Y through (3,0,2)
    const pt = lineLineIntersection(
      vec3(0, 0, 2), UNIT_X,
      vec3(3, 0, 2), UNIT_Y,
      5.0,
    );
    expect(pt).not.toBeNull();
    expect(pt!.x).toBeCloseTo(3);
    expect(pt!.y).toBeCloseTo(0);
    expect(pt!.z).toBeCloseTo(2);
  });

  it("non-intersecting skew lines return null", () => {
    const pt = lineLineIntersection(
      vec3(0, 0, 0), UNIT_X,
      vec3(0, 0, 1), UNIT_Y,
      1.0,
    );
    expect(pt).toBeNull();
  });
});

describe("signedAngle", () => {
  it("0 degrees", () => {
    expect(signedAngle(UNIT_X, UNIT_X, UNIT_Z)).toBeCloseTo(0);
  });

  it("90 degrees CCW about Z", () => {
    expect(signedAngle(UNIT_X, UNIT_Y, UNIT_Z)).toBeCloseTo(Math.PI / 2);
  });

  it("-90 degrees (CW) about Z", () => {
    expect(signedAngle(UNIT_Y, UNIT_X, UNIT_Z)).toBeCloseTo(-Math.PI / 2);
  });

  it("180 degrees", () => {
    const angle = signedAngle(UNIT_X, scale(UNIT_X, -1), UNIT_Z);
    expect(Math.abs(angle)).toBeCloseTo(Math.PI);
  });
});

describe("projectOntoPlane", () => {
  it("project X onto XY plane (normal = Z)", () => {
    const p = projectOntoPlane(UNIT_X, UNIT_Z);
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(0);
  });

  it("project Z onto XY plane (normal = Z)", () => {
    const p = projectOntoPlane(UNIT_Z, UNIT_Z);
    expect(length(p)).toBeCloseTo(0);
  });

  it("project diagonal onto XY plane", () => {
    const p = projectOntoPlane(vec3(1, 1, 1), UNIT_Z);
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(1);
    expect(p.z).toBeCloseTo(0);
  });
});

describe("perpendicularTo", () => {
  it("perpendicular to X", () => {
    const p = perpendicularTo(UNIT_X);
    expect(length(p)).toBeCloseTo(1);
    expect(Math.abs(dot(p, UNIT_X))).toBeLessThan(1e-10);
  });

  it("perpendicular to Z", () => {
    const p = perpendicularTo(UNIT_Z);
    expect(length(p)).toBeCloseTo(1);
    expect(Math.abs(dot(p, UNIT_Z))).toBeLessThan(1e-10);
  });

  it("perpendicular to arbitrary direction", () => {
    const dir = normalize(vec3(1, 2, 3));
    const p = perpendicularTo(dir);
    expect(length(p)).toBeCloseTo(1);
    expect(Math.abs(dot(p, dir))).toBeLessThan(1e-10);
  });
});

describe("rotateAboutAxis", () => {
  it("rotate X about Z by 90 degrees gives Y", () => {
    const r = rotateAboutAxis(UNIT_X, UNIT_Z, Math.PI / 2);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(1);
    expect(r.z).toBeCloseTo(0);
  });

  it("rotate X about Z by 180 degrees gives -X", () => {
    const r = rotateAboutAxis(UNIT_X, UNIT_Z, Math.PI);
    expect(r.x).toBeCloseTo(-1);
    expect(r.y).toBeCloseTo(0);
    expect(r.z).toBeCloseTo(0);
  });

  it("rotate about own axis preserves vector", () => {
    const r = rotateAboutAxis(UNIT_Z, UNIT_Z, 1.23);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
    expect(r.z).toBeCloseTo(1);
  });
});
