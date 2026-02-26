import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import RobotArm from "./RobotArm";
import GroundGrid from "./GroundGrid";

export default function RobotScene() {
  return (
    <Canvas
      camera={{ position: [4, 3, 4], fov: 50 }}
      style={{ background: "#1a1a2e" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />
      <RobotArm />
      <GroundGrid />
      <OrbitControls makeDefault />
    </Canvas>
  );
}
