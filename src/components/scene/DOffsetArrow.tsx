import { useMemo } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";

interface DOffsetArrowProps {
  dValue: number;
  jointIndex: number;
}

const labelStyle: React.CSSProperties = {
  color: "#67e8f9",
  fontSize: "11px",
  fontFamily: "monospace",
  fontWeight: "bold",
  background: "rgba(0,0,0,0.6)",
  padding: "1px 4px",
  borderRadius: "3px",
  whiteSpace: "nowrap",
  border: "1px solid rgba(103,232,249,0.3)",
  pointerEvents: "none",
};

const OFFSET_X = 0.12;

export default function DOffsetArrow({ dValue, jointIndex }: DOffsetArrowProps) {
  if (Math.abs(dValue) < 0.001) return null;

  const linePoints = useMemo(
    (): [number, number, number][] => [
      [OFFSET_X, 0, 0],
      [OFFSET_X, 0, dValue],
    ],
    [dValue],
  );

  const labelPosition = useMemo(
    () => new THREE.Vector3(OFFSET_X + 0.1, 0, dValue / 2),
    [dValue],
  );

  const arrowTip = useMemo(
    () => new THREE.Vector3(OFFSET_X, 0, dValue),
    [dValue],
  );

  const arrowBase = useMemo(
    () => new THREE.Vector3(OFFSET_X, 0, 0),
    [dValue],
  );

  // Cone rotation: default cone points along +Y, rotate to +Z or -Z
  const tipQuaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    const dir = dValue > 0 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 0, -1);
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return q;
  }, [dValue]);

  const baseQuaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    const dir = dValue > 0 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 1);
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return q;
  }, [dValue]);

  return (
    <group>
      <Line
        points={linePoints}
        color="#67e8f9"
        lineWidth={1.5}
        dashed
        dashSize={0.05}
        gapSize={0.03}
      />
      {/* Arrow at end */}
      <mesh position={arrowTip} quaternion={tipQuaternion}>
        <coneGeometry args={[0.02, 0.06, 8]} />
        <meshBasicMaterial color="#67e8f9" />
      </mesh>
      {/* Arrow at start */}
      <mesh position={arrowBase} quaternion={baseQuaternion}>
        <coneGeometry args={[0.02, 0.06, 8]} />
        <meshBasicMaterial color="#67e8f9" />
      </mesh>
      <Html position={labelPosition} center style={{ pointerEvents: "none" }}>
        <div style={labelStyle}>
          L<sub>{jointIndex + 1}</sub> = {dValue.toFixed(2)}
        </div>
      </Html>
    </group>
  );
}
