import { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
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

export default function RobotArm() {
  const joints = useRobotStore((s) => s.joints);
  const kinematics = useRobotStore((s) => s.kinematics);

  const links = useMemo(() => {
    const result: Array<{ key: string; start: THREE.Vector3; end: THREE.Vector3 }> = [];
    const baseOrigin = new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < kinematics.cumulativeMatrices.length; i++) {
      const prevPos =
        i === 0
          ? baseOrigin
          : getPositionFromMatrix(kinematics.cumulativeMatrices[i - 1]!);
      const currPos = getPositionFromMatrix(kinematics.cumulativeMatrices[i]!);
      const joint = joints[i];
      if (joint) {
        result.push({
          key: `link-${joint.id}`,
          start: prevPos,
          end: currPos,
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

      {/* Links between joints */}
      {links.map((link) => (
        <LinkMesh key={link.key} start={link.start} end={link.end} />
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
