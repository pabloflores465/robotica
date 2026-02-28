import { useMemo } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import type { RotationAxis } from "../../core/types/robot";

interface LinkLengthLabelProps {
  length: number;
  linkIndex: number;
  rotationAxis: RotationAxis;
}

const labelStyle: React.CSSProperties = {
  color: "#2dd4bf",
  fontSize: "11px",
  fontFamily: "monospace",
  fontWeight: "bold",
  background: "rgba(0,0,0,0.6)",
  padding: "1px 4px",
  borderRadius: "3px",
  whiteSpace: "nowrap",
  border: "1px solid rgba(45,212,191,0.3)",
  pointerEvents: "none",
};

const OFFSET = 0.12;

function getAxisVector(axis: RotationAxis): [number, number, number] {
  switch (axis) {
    case "x": return [1, 0, 0];
    case "y": return [0, 1, 0];
    case "z": return [0, 0, 1];
  }
}

function getPerpendicularOffset(axis: RotationAxis): [number, number, number] {
  switch (axis) {
    case "x": return [0, OFFSET, 0];
    case "y": return [0, 0, OFFSET];
    case "z": return [OFFSET, 0, 0];
  }
}

export default function LinkLengthLabel({ length, linkIndex, rotationAxis }: LinkLengthLabelProps) {
  if (Math.abs(length) < 0.001) return null;

  const axisVec = getAxisVector(rotationAxis);
  const offsetVec = getPerpendicularOffset(rotationAxis);

  const linePoints = useMemo(
    (): [number, number, number][] => [
      [offsetVec[0], offsetVec[1], offsetVec[2]],
      [
        offsetVec[0] + axisVec[0] * length,
        offsetVec[1] + axisVec[1] * length,
        offsetVec[2] + axisVec[2] * length,
      ],
    ],
    [length, axisVec, offsetVec],
  );

  const labelPosition = useMemo(() => {
    const labelOff = getPerpendicularOffset(rotationAxis);
    return new THREE.Vector3(
      labelOff[0] + axisVec[0] * length / 2 + (rotationAxis !== "x" ? 0.1 : 0),
      labelOff[1] + axisVec[1] * length / 2 + (rotationAxis === "x" ? 0.1 : 0),
      labelOff[2] + axisVec[2] * length / 2,
    );
  }, [length, axisVec, rotationAxis]);

  const arrowTip = useMemo(
    () => new THREE.Vector3(
      offsetVec[0] + axisVec[0] * length,
      offsetVec[1] + axisVec[1] * length,
      offsetVec[2] + axisVec[2] * length,
    ),
    [length, axisVec, offsetVec],
  );

  const arrowBase = useMemo(
    () => new THREE.Vector3(offsetVec[0], offsetVec[1], offsetVec[2]),
    [offsetVec],
  );

  const axisDir = useMemo(() => new THREE.Vector3(...axisVec), [axisVec]);

  const tipQuaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    const dir = length > 0 ? axisDir.clone() : axisDir.clone().negate();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return q;
  }, [length, axisDir]);

  const baseQuaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    const dir = length > 0 ? axisDir.clone().negate() : axisDir.clone();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return q;
  }, [length, axisDir]);

  return (
    <group>
      <Line
        points={linePoints}
        color="#2dd4bf"
        lineWidth={1.5}
        dashed
        dashSize={0.05}
        gapSize={0.03}
      />
      <mesh position={arrowTip} quaternion={tipQuaternion}>
        <coneGeometry args={[0.02, 0.06, 8]} />
        <meshBasicMaterial color="#2dd4bf" />
      </mesh>
      <mesh position={arrowBase} quaternion={baseQuaternion}>
        <coneGeometry args={[0.02, 0.06, 8]} />
        <meshBasicMaterial color="#2dd4bf" />
      </mesh>
      <Html position={labelPosition} center style={{ pointerEvents: "none" }}>
        <div style={labelStyle}>
          L<sub>{linkIndex + 1}</sub> = {Math.abs(length).toFixed(2)}
        </div>
      </Html>
    </group>
  );
}
