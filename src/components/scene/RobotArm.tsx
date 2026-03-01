import { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useRobotStore } from "../../store/robotStore";
import {
  matrixToThreeMatrix4,
  getPositionFromMatrix,
  extractFrameAxes,
  buildFrameMatrix,
  getPositionVec3,
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

  // In auto mode, use auto-computed elements and kinematics for everything
  const activeElements = autoDHMode && autoElements.length > 0 ? autoElements : elements;
  const activeKinematics = autoDHMode && autoElements.length > 0 ? autoKinematics : kinematics;
  const activeBaseMatrix = autoDHMode && autoElements.length > 0 ? autoBaseFrame : baseMatrix;

  // Tubes: in auto DH mode, walk the manual element chain and transform
  // link positions using the auto-to-manual joint transform so links follow
  // the stepped physical path AND move correctly with joint sliders.
  const links = useMemo(() => {
    const result: LinkData[] = [];
    const isAuto = autoDHMode && autoElements.length > 0;

    if (!isAuto) {
      // Manual mode: straightforward
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
    }

    // Auto DH mode: for each manual element, compute its world position
    // by transforming its manual FK position through the auto-to-manual
    // joint transform: T = autoFK(joint) * inverse(manualFK(joint))
    // This makes link sub-segments move with the arm when joints actuate.
    let autoJointIdx = -1;
    let currentTransform: THREE.Matrix4 | null = null;

    // Base transform: autoBase * inverse(manualBase)
    const autoBaseM4 = matrixToThreeMatrix4(autoBaseFrame);
    const manualBaseM4 = matrixToThreeMatrix4(baseMatrix);
    currentTransform = autoBaseM4.clone().multiply(manualBaseM4.clone().invert());

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]!;

      if (el.elementKind === "joint") {
        autoJointIdx++;
        // Update transform: T = autoFK(this joint) * inverse(manualFK(this joint))
        const autoM4 = matrixToThreeMatrix4(autoKinematics.cumulativeMatrices[autoJointIdx]!);
        const manualM4 = matrixToThreeMatrix4(kinematics.cumulativeMatrices[i]!);
        currentTransform = autoM4.clone().multiply(manualM4.clone().invert());
      }

      // Get manual FK positions for this element
      const manualStart = i === 0
        ? getPositionFromMatrix(baseMatrix)
        : getPositionFromMatrix(kinematics.cumulativeMatrices[i - 1]!);
      const manualEnd = getPositionFromMatrix(kinematics.cumulativeMatrices[i]!);

      // Transform through current joint transform
      const start = manualStart.clone().applyMatrix4(currentTransform!);
      const end = manualEnd.clone().applyMatrix4(currentTransform!);

      result.push({ key: `link-${el.id}`, start, end });
    }

    return result;
  }, [elements, kinematics.cumulativeMatrices, baseMatrix, autoDHMode, autoElements, autoKinematics.cumulativeMatrices, autoBaseFrame]);

  // End effector
  const endEffectorMatrix = activeKinematics.endEffectorTransform;
  const hasEndEffector =
    activeElements.length > 0 &&
    endEffectorMatrix !== identity4();

  return (
    <group>
      {/* Joint frames + meshes -- same pattern in both modes */}
      {activeElements.map((element, i) => {
        if (element.elementKind !== "joint") return null;
        const matrix = activeKinematics.cumulativeMatrices[i];
        if (!matrix) return null;
        return <JointGroup key={element.id} matrix={matrix} joint={element} />;
      })}

      {/* DH parameter annotations -- only for joints */}
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

      {/* Link length labels -- iterate manual elements, position using auto DH info */}
      {elements.map((element, idx) => {
        if (element.elementKind !== "link") return null;

        let labelMatrix: Matrix4x4;
        let labelLength: number;
        let labelAxis: RotationAxis;

        if (autoDHMode && autoElements.length > 0) {
          let jointCount = 0;
          for (let j = 0; j < idx; j++) {
            if (elements[j]!.elementKind === "joint") jointCount++;
          }
          const autoFrame = jointCount === 0
            ? autoBaseFrame
            : (jointCount - 1) < autoKinematics.cumulativeMatrices.length
              ? autoKinematics.cumulativeMatrices[jointCount - 1]!
              : autoKinematics.endEffectorTransform;

          const manualStart = idx === 0
            ? baseMatrix
            : kinematics.cumulativeMatrices[idx - 1]!;
          const manualEnd = kinematics.cumulativeMatrices[idx]!;
          const startPos = getPositionVec3(manualStart);

          const autoAxes = extractFrameAxes(autoFrame);
          labelMatrix = buildFrameMatrix(autoAxes.x, autoAxes.y, autoAxes.z, startPos);

          const endPos = getPositionVec3(manualEnd);
          const dx = endPos.x - startPos.x;
          const dy = endPos.y - startPos.y;
          const dz = endPos.z - startPos.z;
          const projX = dx * autoAxes.x.x + dy * autoAxes.x.y + dz * autoAxes.x.z;
          const projY = dx * autoAxes.y.x + dy * autoAxes.y.y + dz * autoAxes.y.z;
          const projZ = dx * autoAxes.z.x + dy * autoAxes.z.y + dz * autoAxes.z.z;

          if (element.intendedDirection) {
            labelAxis = element.intendedDirection.charAt(1) as RotationAxis;
            const sign = element.intendedDirection.charAt(0) === "+" ? 1 : -1;
            const totalLength = Math.sqrt(
              element.dhParams.d * element.dhParams.d +
              element.dhParams.a * element.dhParams.a,
            );
            labelLength = sign * totalLength;
          } else {
            const absDots = [Math.abs(projX), Math.abs(projY), Math.abs(projZ)];
            const maxVal = Math.max(absDots[0]!, absDots[1]!, absDots[2]!);
            const maxDotIdx = absDots.indexOf(maxVal);
            const axisNames: RotationAxis[] = ["x", "y", "z"];
            labelAxis = axisNames[maxDotIdx]!;
            labelLength = [projX, projY, projZ][maxDotIdx]!;
          }
        } else {
          labelMatrix = idx === 0 ? baseMatrix : kinematics.cumulativeMatrices[idx - 1]!;
          labelLength = element.dhParams.d;
          labelAxis = element.rotationAxis;
        }

        return (
          <LinkAnnotationGroup
            key={`link-ann-${element.id}`}
            matrix={labelMatrix}
            length={labelLength}
            linkIndex={idx}
            rotationAxis={labelAxis}
          />
        );
      })}

      {/* Tubes between elements */}
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
