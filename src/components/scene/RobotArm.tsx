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
  const autoDHMode = useRobotStore((s) => s.autoDHMode);
  const autoElements = useRobotStore((s) => s.autoElements);
  const autoKinematics = useRobotStore((s) => s.autoKinematics);
  const autoBaseFrame = useRobotStore((s) => s.autoBaseFrame);

  // In auto mode, render using auto-computed elements and kinematics
  // Auto elements use the auto base frame (frame 0 world-space position + orientation)
  const activeElements = autoDHMode && autoElements.length > 0 ? autoElements : elements;
  const activeKinematics = autoDHMode && autoElements.length > 0 ? autoKinematics : kinematics;
  const activeBaseMatrix = autoDHMode && autoElements.length > 0 ? autoBaseFrame : baseMatrix;

  const links = useMemo(() => {
    const result: LinkData[] = [];
    const baseOrigin = getPositionFromMatrix(activeBaseMatrix);

    for (let i = 0; i < activeKinematics.cumulativeMatrices.length; i++) {
      const prevPos =
        i === 0
          ? baseOrigin
          : getPositionFromMatrix(activeKinematics.cumulativeMatrices[i - 1]!);
      const currPos = getPositionFromMatrix(activeKinematics.cumulativeMatrices[i]!);
      const element = activeElements[i];
      if (element) {
        result.push({
          key: `link-${element.id}`,
          start: prevPos,
          end: currPos,
        });
      }
    }

    return result;
  }, [activeElements, activeKinematics.cumulativeMatrices, activeBaseMatrix]);

  // End effector position for the "ghost" frame
  const endEffectorMatrix = activeKinematics.endEffectorTransform;
  const hasEndEffector =
    activeElements.length > 0 &&
    endEffectorMatrix !== identity4();

  return (
    <group>
      {/* Joint coordinate frames -- only for actual joints, not links */}
      {activeElements.map((element, i) => {
        if (element.elementKind !== "joint") return null;
        const matrix = activeKinematics.cumulativeMatrices[i];
        if (!matrix) return null;
        return <JointGroup key={element.id} matrix={matrix} joint={element} />;
      })}

      {/* DH parameter annotations -- only for actual joints */}
      {activeElements.map((element, i) => {
        if (element.elementKind !== "joint") return null;
        const prevMatrix = i === 0 ? activeBaseMatrix : activeKinematics.cumulativeMatrices[i - 1]!;
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

      {/* Link length annotations -- only for link elements (manual mode only) */}
      {!autoDHMode && activeElements.map((element, i) => {
        if (element.elementKind !== "link") return null;
        const prevMatrix = i === 0 ? activeBaseMatrix : activeKinematics.cumulativeMatrices[i - 1]!;
        return (
          <LinkAnnotationGroup
            key={`link-ann-${element.id}`}
            matrix={prevMatrix}
            length={element.dhParams.d}
            linkIndex={i}
            rotationAxis={element.rotationAxis}
          />
        );
      })}

      {/* Links between all elements */}
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
