import { useMemo } from "react";
import * as THREE from "three";

interface LinkMeshProps {
  start: THREE.Vector3;
  end: THREE.Vector3;
}

export default function LinkMesh({ start, end }: LinkMeshProps) {
  const { position, quaternion, length } = useMemo(() => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const len = direction.length();

    if (len < 0.001) {
      return {
        position: start.clone(),
        quaternion: new THREE.Quaternion(),
        length: 0,
      };
    }

    const midpoint = new THREE.Vector3()
      .addVectors(start, end)
      .multiplyScalar(0.5);

    // CylinderGeometry extends along Y by default.
    // Rotate from Y-up to the direction vector.
    const yAxis = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      yAxis,
      direction.clone().normalize(),
    );

    return { position: midpoint, quaternion: quat, length: len };
  }, [start, end]);

  if (length < 0.001) return null;

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[0.03, 0.03, length, 8]} />
      <meshStandardMaterial color="#9ca3af" />
    </mesh>
  );
}
