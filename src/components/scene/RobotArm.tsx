import { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useRobotStore } from "../../store/robotStore";
import {
  matrixToThreeMatrix4,
  getPositionFromMatrix,
  identity4,
} from "../../math/matrixOps";
import type { Matrix4x4 } from "../../core/types/matrix";
import type { Joint } from "../../core/types/robot";
import CoordinateFrame from "./CoordinateFrame";
import JointMesh from "./JointMesh";
import LinkMesh from "./LinkMesh";

interface JointGroupProps {
  matrix: Matrix4x4;
  joint: Joint;
}

function JointGroup({ matrix, joint }: JointGroupProps) {
  const groupRef = useRef<THREE.Group>(null);
  const threeMatrix = useMemo(() => matrixToThreeMatrix4(matrix), [matrix]);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.matrix.copy(threeMatrix);
      groupRef.current.matrixWorldNeedsUpdate = true;
    }
  }, [threeMatrix]);

  return (
    <group ref={groupRef} matrixAutoUpdate={false}>
      <CoordinateFrame size={0.4} showLabels />
      <JointMesh type={joint.type} />
    </group>
  );
}

interface LinkData {
  key: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  index: number;
  effectiveD: number;
  isPrismatic: boolean;
}

function DimensionLabel({ link }: { link: LinkData }) {
  const { start, end, index, effectiveD, isPrismatic } = link;

  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  if (len < 0.001) return null;

  // Midpoint of the link
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  // Offset perpendicular to the link direction so the label doesn't overlap
  const up = new THREE.Vector3(0, 0, 1);
  let perp = new THREE.Vector3().crossVectors(dir.clone().normalize(), up);
  if (perp.length() < 0.01) {
    perp = new THREE.Vector3().crossVectors(dir.clone().normalize(), new THREE.Vector3(1, 0, 0));
  }
  perp.normalize().multiplyScalar(0.15);

  const labelPos = midpoint.clone().add(perp);

  const valueStr = effectiveD.toFixed(2);

  return (
    <Html position={labelPos} center style={{ pointerEvents: "none" }}>
      <div
        style={{
          color: "#fbbf24",
          fontSize: "11px",
          fontFamily: "monospace",
          fontWeight: "bold",
          background: "rgba(0,0,0,0.6)",
          padding: "1px 4px",
          borderRadius: "3px",
          whiteSpace: "nowrap",
          border: "1px solid rgba(251,191,36,0.3)",
        }}
      >
        {isPrismatic ? (
          <>L<sub>{index + 1}</sub>+d = {valueStr}</>
        ) : (
          <>L<sub>{index + 1}</sub> = {valueStr}</>
        )}
      </div>
    </Html>
  );
}

export default function RobotArm() {
  const joints = useRobotStore((s) => s.joints);
  const kinematics = useRobotStore((s) => s.kinematics);

  const links = useMemo(() => {
    const result: LinkData[] = [];
    const baseOrigin = new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < kinematics.cumulativeMatrices.length; i++) {
      const prevPos =
        i === 0
          ? baseOrigin
          : getPositionFromMatrix(kinematics.cumulativeMatrices[i - 1]!);
      const currPos = getPositionFromMatrix(kinematics.cumulativeMatrices[i]!);
      const joint = joints[i];
      if (joint) {
        const effectiveD =
          joint.type === "prismatic"
            ? joint.dhParams.d + joint.variableValue
            : joint.dhParams.d;
        result.push({
          key: `link-${joint.id}`,
          start: prevPos,
          end: currPos,
          index: i,
          effectiveD,
          isPrismatic: joint.type === "prismatic",
        });
      }
    }

    return result;
  }, [joints, kinematics.cumulativeMatrices]);

  // End effector position for the "ghost" frame
  const endEffectorMatrix = kinematics.endEffectorTransform;
  const hasEndEffector =
    joints.length > 0 &&
    endEffectorMatrix !== identity4();

  return (
    <group>
      {/* Joint coordinate frames */}
      {joints.map((joint, i) => {
        const matrix = kinematics.cumulativeMatrices[i];
        if (!matrix) return null;
        return <JointGroup key={joint.id} matrix={matrix} joint={joint} />;
      })}

      {/* Links between joints with dimension labels */}
      {links.map((link) => (
        <group key={link.key}>
          <LinkMesh start={link.start} end={link.end} />
          <DimensionLabel link={link} />
        </group>
      ))}

      {/* End effector indicator */}
      {hasEndEffector && (
        <EndEffectorMarker matrix={endEffectorMatrix} />
      )}
    </group>
  );
}

function EndEffectorMarker({ matrix }: { matrix: Matrix4x4 }) {
  const groupRef = useRef<THREE.Group>(null);
  const threeMatrix = useMemo(() => matrixToThreeMatrix4(matrix), [matrix]);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.matrix.copy(threeMatrix);
      groupRef.current.matrixWorldNeedsUpdate = true;
    }
  }, [threeMatrix]);

  return (
    <group ref={groupRef} matrixAutoUpdate={false}>
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}
