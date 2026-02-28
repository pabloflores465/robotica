import { useMemo } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import type { RotationAxis } from "../../core/types/robot";

interface ThetaArcProps {
  angle: number;
  jointIndex: number;
  rotationAxis?: RotationAxis;
  radius?: number;
}

const RAD_TO_DEG = 180 / Math.PI;

const labelStyle: React.CSSProperties = {
  color: "#fbbf24",
  fontSize: "11px",
  fontFamily: "monospace",
  fontWeight: "bold",
  background: "rgba(0,0,0,0.6)",
  padding: "1px 4px",
  borderRadius: "3px",
  whiteSpace: "nowrap",
  border: "1px solid rgba(251,191,36,0.3)",
  pointerEvents: "none",
};

/**
 * Maps a 2D point (cos, sin) to a 3D point based on the rotation axis.
 * x-axis rotation: arc in YZ plane
 * y-axis rotation: arc in XZ plane
 * z-axis rotation: arc in XY plane
 */
function toPoint3D(
  c: number,
  s: number,
  axis: RotationAxis,
): [number, number, number] {
  if (axis === "x") return [0, c, s];
  if (axis === "y") return [c, 0, s];
  return [c, s, 0];
}

function toVector3(c: number, s: number, axis: RotationAxis): THREE.Vector3 {
  if (axis === "x") return new THREE.Vector3(0, c, s);
  if (axis === "y") return new THREE.Vector3(c, 0, s);
  return new THREE.Vector3(c, s, 0);
}

export default function ThetaArc({
  angle,
  jointIndex,
  rotationAxis = "z",
  radius = 0.25,
}: ThetaArcProps) {
  if (Math.abs(angle) < 0.01) return null;

  const segments = 32;

  const arcPoints = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * angle;
      pts.push(
        toPoint3D(radius * Math.cos(t), radius * Math.sin(t), rotationAxis),
      );
    }
    return pts;
  }, [angle, radius, rotationAxis]);

  const labelPosition = useMemo(() => {
    const midAngle = angle / 2;
    const labelR = radius + 0.12;
    return toVector3(
      labelR * Math.cos(midAngle),
      labelR * Math.sin(midAngle),
      rotationAxis,
    );
  }, [angle, radius, rotationAxis]);

  const arrowhead = useMemo(() => {
    const endAngle = angle;
    const tipPos = toVector3(
      radius * Math.cos(endAngle),
      radius * Math.sin(endAngle),
      rotationAxis,
    );

    const sign = angle > 0 ? 1 : -1;
    const tangent = toVector3(
      -Math.sin(endAngle) * sign,
      Math.cos(endAngle) * sign,
      rotationAxis,
    ).normalize();

    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);

    return { position: tipPos, quaternion };
  }, [angle, radius, rotationAxis]);

  return (
    <group>
      <Line points={arcPoints} color="#fbbf24" lineWidth={2} />
      <mesh position={arrowhead.position} quaternion={arrowhead.quaternion}>
        <coneGeometry args={[0.03, 0.08, 8]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
      <Html position={labelPosition} center style={{ pointerEvents: "none" }}>
        <div style={labelStyle}>
          <span style={{ fontFamily: "serif", fontStyle: "italic" }}>
            &#952;
          </span>
          <sub>{jointIndex + 1}</sub> = {(angle * RAD_TO_DEG).toFixed(1)}
          &#176;
        </div>
      </Html>
    </group>
  );
}
