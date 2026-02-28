import { Grid } from "@react-three/drei";
import CoordinateFrame from "./CoordinateFrame";

export default function GroundGrid() {
  return (
    <group>
      {/* Fine sub-grid: 0.1 unit cells */}
      <Grid
        infiniteGrid
        cellSize={0.1}
        cellColor="#222222"
        cellThickness={0.4}
        sectionSize={0.5}
        sectionColor="#333333"
        sectionThickness={0.6}
        fadeDistance={10}
        fadeStrength={2}
        position={[0, 0, -0.002]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      {/* Main grid: 1 unit cells, 5 unit sections */}
      <Grid
        infiniteGrid
        cellSize={1}
        cellColor="#444444"
        cellThickness={0.8}
        sectionSize={5}
        sectionColor="#777777"
        sectionThickness={1.5}
        fadeDistance={50}
        fadeStrength={1.5}
        position={[0, 0, -0.001]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <CoordinateFrame size={1} showSignedLabels />
    </group>
  );
}
