/**
 * Pure 3D vector math utilities for DH frame assignment.
 * No Three.js dependency - operates on plain {x, y, z} objects.
 */

/** A 3D vector */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ---------------------------------------------------------------------------
// Tolerance constants
// ---------------------------------------------------------------------------

/** Absolute tolerance for near-zero checks */
export const EPS_ABS = 1e-10;

/** Relative tolerance for comparisons */
export const EPS_REL = 1e-8;

// ---------------------------------------------------------------------------
// Tolerance utilities
// ---------------------------------------------------------------------------

/** Check if a scalar value is effectively zero */
export function isNearZero(value: number, eps = EPS_ABS): boolean {
  return Math.abs(value) < eps;
}

/** Check if two scalars are close using relative + absolute tolerance */
export function isClose(
  a: number,
  b: number,
  relTol = EPS_REL,
  absTol = EPS_ABS,
): boolean {
  return (
    Math.abs(a - b) <=
    Math.max(absTol, relTol * Math.max(Math.abs(a), Math.abs(b)))
  );
}

// ---------------------------------------------------------------------------
// Basic vector operations
// ---------------------------------------------------------------------------

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export const ZERO: Vec3 = { x: 0, y: 0, z: 0 };
export const UNIT_X: Vec3 = { x: 1, y: 0, z: 0 };
export const UNIT_Y: Vec3 = { x: 0, y: 1, z: 0 };
export const UNIT_Z: Vec3 = { x: 0, y: 0, z: 1 };

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function negate(v: Vec3): Vec3 {
  return { x: -v.x, y: -v.y, z: -v.z };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function lengthSq(v: Vec3): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

export function length(v: Vec3): number {
  return Math.sqrt(lengthSq(v));
}

export function distance(a: Vec3, b: Vec3): number {
  return length(subtract(a, b));
}

export function normalize(v: Vec3): Vec3 {
  const len = length(v);
  if (len < EPS_ABS) return { x: 0, y: 0, z: 0 };
  return scale(v, 1 / len);
}

// ---------------------------------------------------------------------------
// Geometric utilities
// ---------------------------------------------------------------------------

/** Project vector v onto the plane perpendicular to the given normal */
export function projectOntoPlane(v: Vec3, normal: Vec3): Vec3 {
  const n = normalize(normal);
  const d = dot(v, n);
  return subtract(v, scale(n, d));
}

/** Check if two vectors are parallel (or anti-parallel). Uses relative tolerance. */
export function isParallel(a: Vec3, b: Vec3, eps = EPS_REL): boolean {
  const crossLen = length(cross(a, b));
  const product = length(a) * length(b);
  if (product < EPS_ABS) return true; // degenerate zero-length vectors
  return crossLen / product < eps;
}

/**
 * Signed angle from vector `from` to vector `to`, measured about `axis`.
 * Returns radians in (-pi, pi].
 * Both `from` and `to` should be in the plane perpendicular to `axis`.
 */
export function signedAngle(from: Vec3, to: Vec3, axis: Vec3): number {
  const f = normalize(projectOntoPlane(from, axis));
  const t = normalize(projectOntoPlane(to, axis));

  const fLen = length(f);
  const tLen = length(t);
  if (fLen < EPS_ABS || tLen < EPS_ABS) return 0;

  const c = dot(f, t);
  const s = dot(cross(f, t), normalize(axis));

  return Math.atan2(s, c);
}

// ---------------------------------------------------------------------------
// Line-line geometry
// ---------------------------------------------------------------------------

export interface ClosestPointsResult {
  /** Parameter t on line 1: point1 = p1 + t * d1 */
  t: number;
  /** Parameter s on line 2: point2 = p2 + s * d2 */
  s: number;
  /** Closest point on line 1 */
  point1: Vec3;
  /** Closest point on line 2 */
  point2: Vec3;
  /** Distance between the two closest points */
  distance: number;
}

/**
 * Finds the closest points between two lines in 3D.
 * Line 1: p1 + t * d1
 * Line 2: p2 + s * d2
 *
 * For parallel lines, returns the foot of the perpendicular from p1 to line 2.
 */
export function closestPointsBetweenLines(
  p1: Vec3,
  d1: Vec3,
  p2: Vec3,
  d2: Vec3,
): ClosestPointsResult {
  const w0 = subtract(p1, p2);
  const a = dot(d1, d1);
  const b = dot(d1, d2);
  const c = dot(d2, d2);
  const d = dot(d1, w0);
  const e = dot(d2, w0);

  const denom = a * c - b * b;

  let t: number;
  let s: number;

  if (Math.abs(denom) < EPS_ABS * Math.max(a * c, 1)) {
    // Lines are parallel: project p1 onto line 2
    t = 0;
    s = c > EPS_ABS ? e / c : 0;
  } else {
    t = (b * e - c * d) / denom;
    s = (a * e - b * d) / denom;
  }

  const point1 = add(p1, scale(d1, t));
  const point2 = add(p2, scale(d2, s));

  return {
    t,
    s,
    point1,
    point2,
    distance: distance(point1, point2),
  };
}

/**
 * Attempts to find the intersection point of two lines.
 * Returns the midpoint of the closest-approach segment if the distance
 * is within tolerance, or null if lines don't intersect.
 *
 * @param characteristicLength - scale factor for relative tolerance
 */
export function lineLineIntersection(
  p1: Vec3,
  d1: Vec3,
  p2: Vec3,
  d2: Vec3,
  characteristicLength: number,
  eps = EPS_REL,
): Vec3 | null {
  const result = closestPointsBetweenLines(p1, d1, p2, d2);
  const tol = Math.max(EPS_ABS, eps * characteristicLength);

  if (result.distance < tol) {
    // Lines intersect (or are very close): return midpoint
    return scale(add(result.point1, result.point2), 0.5);
  }
  return null;
}

/**
 * Pick the world axis most perpendicular to the given direction.
 * Prefer X, then Y, then Z as tiebreaker.
 */
export function mostPerpendicularWorldAxis(dir: Vec3): Vec3 {
  const ax = Math.abs(dot(dir, UNIT_X));
  const ay = Math.abs(dot(dir, UNIT_Y));
  const az = Math.abs(dot(dir, UNIT_Z));

  // Pick the axis with smallest |dot| (most perpendicular)
  if (ax <= ay && ax <= az) return UNIT_X;
  if (ay <= az) return UNIT_Y;
  return UNIT_Z;
}

/**
 * Build a unit vector perpendicular to `dir` using the "most perpendicular world axis" heuristic.
 */
export function perpendicularTo(dir: Vec3): Vec3 {
  const ref = mostPerpendicularWorldAxis(dir);
  return normalize(cross(dir, ref));
}

/**
 * Rotate vector `v` about axis `axis` by `angle` radians (Rodrigues' formula).
 * `axis` must be a unit vector.
 */
export function rotateAboutAxis(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = normalize(axis);
  const kDotV = dot(k, v);
  const kCrossV = cross(k, v);

  return add(add(scale(v, c), scale(kCrossV, s)), scale(k, kDotV * (1 - c)));
}
