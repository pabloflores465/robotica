import { Grid } from "@react-three/drei";
import CoordinateFrame from "./CoordinateFrame";

export default function GroundGrid() {
  return (
    <group>
      <Grid
        args={[20, 20]}
        cellSize={1}
        cellColor="#444444"
        sectionSize={5}
        sectionColor="#aaaaaa"
        fadeDistance={25}
        position={[0, 0, -0.001]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <CoordinateFrame size={1} showLabels />
    </group>
  );
}
