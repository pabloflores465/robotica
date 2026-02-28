import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";

interface CoordinateFrameProps {
  size?: number;
  opacity?: number;
  showLabels?: boolean;
}

const ORIGIN = new THREE.Vector3(0, 0, 0);
const X_DIR = new THREE.Vector3(1, 0, 0);
const Y_DIR = new THREE.Vector3(0, 1, 0);
const Z_DIR = new THREE.Vector3(0, 0, 1);

const RED = new THREE.Color(0xff0000);
const GREEN = new THREE.Color(0x00cc00);
const BLUE = new THREE.Color(0x0066ff);

const AXES = [
  { dir: X_DIR, color: RED, label: "X", hexColor: "#ff0000" },
  { dir: Y_DIR, color: GREEN, label: "Y", hexColor: "#00cc00" },
  { dir: Z_DIR, color: BLUE, label: "Z", hexColor: "#0066ff" },
] as const;

export default function CoordinateFrame({
  size = 0.5,
  opacity = 1,
  showLabels = false,
}: CoordinateFrameProps) {
  const arrows = useMemo(() => {
    const headLength = size * 0.2;
    const headWidth = size * 0.08;

    return AXES.map(({ dir, color, label }) => ({
      key: label,
      args: [dir, ORIGIN, size, color, headLength, headWidth] as [
        THREE.Vector3,
        THREE.Vector3,
        number,
        THREE.Color,
        number,
        number,
      ],
      opacity,
    }));
  }, [size, opacity]);

  const labelOffset = size * 1.15;

  return (
    <group>
      {arrows.map((arrow) => (
        <arrowHelper key={arrow.key} args={arrow.args} />
      ))}
      {showLabels &&
        AXES.map(({ dir, label, hexColor }) => (
          <Html
            key={`label-${label}`}
            position={[
              dir.x * labelOffset,
              dir.y * labelOffset,
              dir.z * labelOffset,
            ]}
            center
            style={{
              color: hexColor,
              fontSize: `${Math.round(size * 14)}px`,
              fontWeight: "bold",
              fontFamily: "monospace",
              userSelect: "none",
              pointerEvents: "none",
            }}
          >
            {label}
          </Html>
        ))}
    </group>
  );
}
