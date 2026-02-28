import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";

interface CoordinateFrameProps {
  size?: number;
  opacity?: number;
  showLabels?: boolean;
  showSignedLabels?: boolean;
}

const ORIGIN = new THREE.Vector3(0, 0, 0);
const X_DIR = new THREE.Vector3(1, 0, 0);
const Y_DIR = new THREE.Vector3(0, 1, 0);
const Z_DIR = new THREE.Vector3(0, 0, 1);

const RED = new THREE.Color(0xff0000);
const GREEN = new THREE.Color(0x00cc00);
const BLUE = new THREE.Color(0x0066ff);

const NEG_X_DIR = new THREE.Vector3(-1, 0, 0);
const NEG_Y_DIR = new THREE.Vector3(0, -1, 0);
const NEG_Z_DIR = new THREE.Vector3(0, 0, -1);

const AXES = [
  { dir: X_DIR, color: RED, label: "X", hexColor: "#ff0000" },
  { dir: Y_DIR, color: GREEN, label: "Y", hexColor: "#00cc00" },
  { dir: Z_DIR, color: BLUE, label: "Z", hexColor: "#0066ff" },
] as const;

const NEG_AXES = [
  { dir: NEG_X_DIR, color: RED, label: "X", hexColor: "#ff0000" },
  { dir: NEG_Y_DIR, color: GREEN, label: "Y", hexColor: "#00cc00" },
  { dir: NEG_Z_DIR, color: BLUE, label: "Z", hexColor: "#0066ff" },
] as const;

export default function CoordinateFrame({
  size = 0.5,
  opacity = 1,
  showLabels = false,
  showSignedLabels = false,
}: CoordinateFrameProps) {
  const arrows = useMemo(() => {
    const headLength = size * 0.2;
    const headWidth = size * 0.08;

    const positive = AXES.map(({ dir, color, label }) => ({
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

    const negative = NEG_AXES.map(({ dir, color, label }) => ({
      key: `-${label}`,
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

    return { positive, negative };
  }, [size, opacity]);

  const labelOffset = size * 1.15;
  const fontSize = Math.max(12, Math.round(size * 14));

  const labelStyle = (hex: string, fSize: number): React.CSSProperties => ({
    color: hex,
    fontSize: `${fSize}px`,
    fontWeight: "bold",
    fontFamily: "monospace",
    userSelect: "none",
    pointerEvents: "none",
    whiteSpace: "nowrap",
  });

  return (
    <group>
      {/* Positive arrows */}
      {arrows.positive.map((arrow) => (
        <arrowHelper key={arrow.key} args={arrow.args} />
      ))}

      {/* Negative arrows (only when showSignedLabels) */}
      {showSignedLabels &&
        arrows.negative.map((arrow) => (
          <arrowHelper key={arrow.key} args={arrow.args} />
        ))}

      {/* Positive labels: +X / +Y / +Z (or just X / Y / Z) */}
      {(showLabels || showSignedLabels) &&
        AXES.map(({ dir, label, hexColor }) => (
          <Html
            key={`label-${label}`}
            position={[
              dir.x * labelOffset,
              dir.y * labelOffset,
              dir.z * labelOffset,
            ]}
            center
            style={labelStyle(hexColor, fontSize)}
          >
            {showSignedLabels ? `+${label}` : label}
          </Html>
        ))}

      {/* Negative labels: -X / -Y / -Z at negative arrow tips */}
      {showSignedLabels &&
        AXES.map(({ dir, label, hexColor }) => (
          <Html
            key={`label-neg-${label}`}
            position={[
              -dir.x * labelOffset,
              -dir.y * labelOffset,
              -dir.z * labelOffset,
            ]}
            center
            style={labelStyle(hexColor, fontSize)}
          >
            {`-${label}`}
          </Html>
        ))}
    </group>
  );
}
