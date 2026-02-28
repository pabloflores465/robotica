import { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useRobotStore } from "../../store/robotStore";
import {
  matrixToThreeMatrix4,
  getPositionFromMatrix,
  identity4,
} from "../../math/matrixOps";
import { getEffectiveDHParams } from "../../math/dhTransform";
import type { Matrix4x4 } from "../../core/types/matrix";
import type { Joint, RotationAxis } from "../../core/types/robot";
import CoordinateFrame from "./CoordinateFrame";
import JointMesh from "./JointMesh";
import LinkMesh from "./LinkMesh";
import ThetaArc from "./ThetaArc";
import DOffsetArrow from "./DOffsetArrow";

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
      <JointMesh type={joint.type} rotationAxis={joint.rotationAxis} />
    </group>
  );
}

interface DHAnnotationGroupProps {
  matrix: Matrix4x4;
  theta: number;
  d: number;
  jointIndex: number;
  rotationAxis: RotationAxis;
}

function DHAnnotationGroup({ matrix, theta, d, jointIndex, rotationAxis }: DHAnnotationGroupProps) {
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
      <ThetaArc angle={theta} jointIndex={jointIndex} rotationAxis={rotationAxis} />
      <DOffsetArrow dValue={d} jointIndex={jointIndex} />
    </group>
  );
}

interface LinkData {
  key: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
}


export default function RobotArm() {
  const joints = useRobotStore((s) => s.joints);
  const kinematics = useRobotStore((s) => s.kinematics);
  const baseMatrix = useRobotStore((s) => s.baseMatrix);

  const links = useMemo(() => {
    const result: LinkData[] = [];
    const baseOrigin = getPositionFromMatrix(baseMatrix);

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

      {/* DH parameter annotations (theta arcs and d arrows) */}
      {joints.map((joint, i) => {
        const prevMatrix = i === 0 ? baseMatrix : kinematics.cumulativeMatrices[i - 1]!;
        const effective = getEffectiveDHParams(joint);
        return (
          <DHAnnotationGroup
            key={`dh-ann-${joint.id}`}
            matrix={prevMatrix}
            theta={effective.theta}
            d={effective.d}
            jointIndex={i}
            rotationAxis={joint.rotationAxis}
          />
        );
      })}

      {/* Links between joints */}
      {links.map((link) => (
        <group key={link.key}>
          <LinkMesh start={link.start} end={link.end} />
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
