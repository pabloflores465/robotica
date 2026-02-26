import { useMemo } from "react";
import * as THREE from "three";

interface CoordinateFrameProps {
  size?: number;
  opacity?: number;
}

const ORIGIN = new THREE.Vector3(0, 0, 0);
const X_DIR = new THREE.Vector3(1, 0, 0);
const Y_DIR = new THREE.Vector3(0, 1, 0);
const Z_DIR = new THREE.Vector3(0, 0, 1);

const RED = new THREE.Color(0xff0000);
const GREEN = new THREE.Color(0x00cc00);
const BLUE = new THREE.Color(0x0066ff);

export default function CoordinateFrame({
  size = 0.5,
  opacity = 1,
}: CoordinateFrameProps) {
  const arrows = useMemo(() => {
    const headLength = size * 0.2;
    const headWidth = size * 0.08;

    return [
      { dir: X_DIR, color: RED, label: "X" },
      { dir: Y_DIR, color: GREEN, label: "Y" },
      { dir: Z_DIR, color: BLUE, label: "Z" },
    ].map(({ dir, color, label }) => ({
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

  return (
    <group>
      {arrows.map((arrow) => (
        <arrowHelper key={arrow.key} args={arrow.args} />
      ))}
    </group>
  );
}
