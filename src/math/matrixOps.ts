import * as THREE from "three";
import type { Matrix4x4 } from "../core/types/matrix";
import type { RotationAxis } from "../core/types/robot";
import type { Vec3 } from "./vec3";

/** Returns the 4x4 identity matrix. */
export function identity4(): Matrix4x4 {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

/** Standard 4x4 row-by-column matrix multiplication. */
export function multiplyMatrices(a: Matrix4x4, b: Matrix4x4): Matrix4x4 {
  const result: Matrix4x4 = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += (a[i]?.[k] ?? 0) * (b[k]?.[j] ?? 0);
      }
      result[i]![j] = sum;
    }
  }

  return result;
}

/**
 * Converts our row-major Matrix4x4 to a Three.js Matrix4.
 * Three.js Matrix4.set() accepts values in row-major order.
 */
export function matrixToThreeMatrix4(m: Matrix4x4): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    m[0]![0]!, m[0]![1]!, m[0]![2]!, m[0]![3]!,
    m[1]![0]!, m[1]![1]!, m[1]![2]!, m[1]![3]!,
    m[2]![0]!, m[2]![1]!, m[2]![2]!, m[2]![3]!,
    m[3]![0]!, m[3]![1]!, m[3]![2]!, m[3]![3]!,
  );
}

/**
 * Extracts the position (translation) from a 4x4 matrix as a THREE.Vector3.
 */
export function getPositionFromMatrix(m: Matrix4x4): THREE.Vector3 {
  return new THREE.Vector3(m[0]![3]!, m[1]![3]!, m[2]![3]!);
}

/**
 * Creates a 4x4 rotation matrix around the given axis by angle (radians).
 */
export function rotationAroundAxis(axis: RotationAxis, angle: number): Matrix4x4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  if (axis === "x") {
    return [
      [1, 0, 0, 0],
      [0, c, -s, 0],
      [0, s, c, 0],
      [0, 0, 0, 1],
    ];
  }

  if (axis === "y") {
    return [
      [c, 0, s, 0],
      [0, 1, 0, 0],
      [-s, 0, c, 0],
      [0, 0, 0, 1],
    ];
  }

  // z
  return [
    [c, -s, 0, 0],
    [s, c, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

/**
 * Formats a matrix element for display.
 * Values very close to zero display as "0.0000".
 */
export function formatMatrixElement(
  value: number,
  precision: number = 4,
): string {
  if (Math.abs(value) < 1e-10) {
    return (0).toFixed(precision);
  }
  return value.toFixed(precision);
}

/**
 * Extracts the frame axes (x, y, z columns of the rotation sub-matrix)
 * and position from a 4x4 homogeneous transform.
 */
export function extractFrameAxes(m: Matrix4x4): { x: Vec3; y: Vec3; z: Vec3 } {
  return {
    x: { x: m[0]![0]!, y: m[1]![0]!, z: m[2]![0]! },
    y: { x: m[0]![1]!, y: m[1]![1]!, z: m[2]![1]! },
    z: { x: m[0]![2]!, y: m[1]![2]!, z: m[2]![2]! },
  };
}

/**
 * Extracts the position (translation column) from a 4x4 matrix as a Vec3.
 */
export function getPositionVec3(m: Matrix4x4): Vec3 {
  return { x: m[0]![3]!, y: m[1]![3]!, z: m[2]![3]! };
}

/**
 * Builds a 4x4 homogeneous transform from frame axes and origin.
 * Columns of the rotation sub-matrix are x, y, z axes.
 * Translation column is the origin.
 */
export function buildFrameMatrix(
  x: Vec3,
  y: Vec3,
  z: Vec3,
  origin: Vec3,
): Matrix4x4 {
  return [
    [x.x, y.x, z.x, origin.x],
    [x.y, y.y, z.y, origin.y],
    [x.z, y.z, z.z, origin.z],
    [0, 0, 0, 1],
  ];
}
