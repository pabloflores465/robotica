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
import type { Joint, JointType, RotationAxis } from "../../core/types/robot";
import CoordinateFrame from "./CoordinateFrame";
import JointMesh from "./JointMesh";
import LinkMesh from "./LinkMesh";
import ThetaArc from "./ThetaArc";
import DOffsetArrow from "./DOffsetArrow";
import LinkLengthLabel from "./LinkLengthLabel";

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
  jointType: JointType;
}

function DHAnnotationGroup({ matrix, theta, d, jointIndex, rotationAxis, jointType }: DHAnnotationGroupProps) {
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
      <DOffsetArrow dValue={d} jointIndex={jointIndex} rotationAxis={rotationAxis} jointType={jointType} />
    </group>
  );
}

interface LinkAnnotationGroupProps {
  matrix: Matrix4x4;
  length: number;
  linkIndex: number;
  rotationAxis: RotationAxis;
}

function LinkAnnotationGroup({ matrix, length, linkIndex, rotationAxis }: LinkAnnotationGroupProps) {
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
      <LinkLengthLabel length={length} linkIndex={linkIndex} rotationAxis={rotationAxis} />
    </group>
  );
}

interface LinkData {
  key: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
}


export default function RobotArm() {
  const elements = useRobotStore((s) => s.elements);
  const kinematics = useRobotStore((s) => s.kinematics);
  const baseMatrix = useRobotStore((s) => s.baseMatrix);
  const autoDH = useRobotStore((s) => s.autoDH);
  const dhFrames = useRobotStore((s) => s.dhFrames);

  const links = useMemo(() => {
    const result: LinkData[] = [];
    const baseOrigin = getPositionFromMatrix(baseMatrix);

    for (let i = 0; i < kinematics.cumulativeMatrices.length; i++) {
      const prevPos = i === 0
        ? baseOrigin
        : getPositionFromMatrix(kinematics.cumulativeMatrices[i - 1]!);
      const currPos = getPositionFromMatrix(kinematics.cumulativeMatrices[i]!);
      const el = elements[i];
      if (el) {
        result.push({ key: `link-${el.id}`, start: prevPos, end: currPos });
      }
    }

    return result;
  }, [elements, kinematics.cumulativeMatrices, baseMatrix]);

  const endEffectorMatrix = kinematics.endEffectorTransform;
  const hasEndEffector =
    elements.length > 0 &&
    endEffectorMatrix !== identity4();

  return (
    <group>
      {/* Joint frames + meshes */}
      {elements.map((element, i) => {
        if (element.elementKind !== "joint") return null;
        // When Auto DH is on, use DH-oriented frame for display
        const matrix = (autoDH && dhFrames[i]) ? dhFrames[i] : kinematics.cumulativeMatrices[i];
        if (!matrix) return null;
        return <JointGroup key={element.id} matrix={matrix} joint={element} />;
      })}

      {/* DH annotations */}
      {elements.map((element, i) => {
        if (element.elementKind !== "joint") return null;
        const prevMatrix = i === 0 ? baseMatrix : kinematics.cumulativeMatrices[i - 1]!;
        const effective = getEffectiveDHParams(element);
        return (
          <DHAnnotationGroup
            key={`dh-ann-${element.id}`}
            matrix={prevMatrix}
            theta={effective.theta}
            d={effective.d}
            jointIndex={i}
            rotationAxis={element.rotationAxis}
            jointType={element.type}
          />
        );
      })}

      {/* Link length labels */}
      {elements.map((element, idx) => {
        if (element.elementKind !== "link") return null;
        const labelMatrix = idx === 0 ? baseMatrix : kinematics.cumulativeMatrices[idx - 1]!;
        return (
          <LinkAnnotationGroup
            key={`link-ann-${element.id}`}
            matrix={labelMatrix}
            length={element.dhParams.d}
            linkIndex={idx}
            rotationAxis={element.rotationAxis}
          />
        );
      })}

      {/* Tubes */}
      {links.map((link) => (
        <group key={link.key}>
          <LinkMesh start={link.start} end={link.end} />
        </group>
      ))}

      {/* End effector */}
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
