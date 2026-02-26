import type { JointType } from "../../core/types/robot";

interface JointMeshProps {
  type: JointType;
}

export default function JointMesh({ type }: JointMeshProps) {
  if (type === "revolute") {
    return (
      <mesh>
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
