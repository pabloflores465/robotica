import { Grid } from "@react-three/drei";
import CoordinateFrame from "./CoordinateFrame";

export default function GroundGrid() {
  return (
    <group>
      <Grid
        args={[20, 20]}
        cellSize={1}
        cellColor="#4a4a4a"
        sectionSize={5}
        sectionColor="#6a6a6a"
        fadeDistance={25}
        position={[0, -0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <CoordinateFrame size={1} />
    </group>
  );
}
