import type { JointType, RotationAxis } from "../../core/types/robot";

interface JointMeshProps {
  type: JointType;
  rotationAxis?: RotationAxis;
}

/** Cylinder rotation to align Three.js default Y-axis with the joint's rotation axis */
const AXIS_ROTATIONS: Record<RotationAxis, [number, number, number]> = {
  x: [0, 0, -Math.PI / 2],
  y: [0, 0, 0],
  z: [Math.PI / 2, 0, 0],
};

export default function JointMesh({
  type,
  rotationAxis = "z",
}: JointMeshProps) {
  if (type === "revolute") {
    return (
      <mesh rotation={AXIS_ROTATIONS[rotationAxis]}>
        <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} />
        <meshStandardMaterial
          color="#f59e0b"
          transparent
          opacity={0.8}
        />
      </mesh>
    );
  }

  // Prismatic joint: box shape
  return (
    <mesh>
      <boxGeometry args={[0.12, 0.2, 0.12]} />
      <meshStandardMaterial
        color="#06b6d4"
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}
