import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import RobotArm from "./RobotArm";
import GroundGrid from "./GroundGrid";

const Z_UP = new THREE.Vector3(0, 0, 1);

export default function RobotScene() {
  return (
    <Canvas
      camera={{ position: [4, 3, 4], fov: 50, up: [0, 0, 1] }}
      style={{ background: "#111111" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />
      <RobotArm />
      <GroundGrid />
      <OrbitControls makeDefault up={Z_UP} />
    </Canvas>
  );
}
