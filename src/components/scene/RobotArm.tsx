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

  const isAuto = autoDHMode && autoElements.length > 0;

  // Tubes: always from manual FK (same as manual mode)
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

  // End effector from manual FK
  const endEffectorMatrix = kinematics.endEffectorTransform;
  const hasEndEffector =
    elements.length > 0 &&
    endEffectorMatrix !== identity4();

  // In auto DH mode, build a map from manual joint index -> auto DH rotation
  const autoFrameRotations = useMemo(() => {
    if (!isAuto) return null;
    const map = new Map<number, { x: { x: number; y: number; z: number }; y: { x: number; y: number; z: number }; z: { x: number; y: number; z: number } }>();
    let autoIdx = 0;
    for (let i = 0; i < elements.length; i++) {
      if (elements[i]!.elementKind === "joint") {
        const autoMatrix = autoIdx < autoKinematics.cumulativeMatrices.length
          ? autoKinematics.cumulativeMatrices[autoIdx]!
          : autoKinematics.endEffectorTransform;
        map.set(i, extractFrameAxes(autoMatrix));
        autoIdx++;
      }
    }
    return map;
  }, [isAuto, elements, autoKinematics.cumulativeMatrices, autoKinematics.endEffectorTransform]);

  return (
    <group>
      {/* Joint frames + meshes: manual FK position, auto DH orientation when active */}
      {elements.map((element, i) => {
        if (element.elementKind !== "joint") return null;
        const manualMatrix = kinematics.cumulativeMatrices[i];
        if (!manualMatrix) return null;

        let frameMatrix: Matrix4x4;
        if (isAuto && autoFrameRotations) {
          // Manual FK position + auto DH orientation
          const axes = autoFrameRotations.get(i);
          if (axes) {
            const pos = getPositionVec3(manualMatrix);
            frameMatrix = buildFrameMatrix(axes.x, axes.y, axes.z, pos);
          } else {
            frameMatrix = manualMatrix;
          }
        } else {
          frameMatrix = manualMatrix;
        }

        return <JointGroup key={element.id} matrix={frameMatrix} joint={element} />;
      })}

      {/* DH annotations: use auto DH data when active, manual otherwise */}
      {isAuto
        ? autoElements.map((element, i) => {
            if (element.elementKind !== "joint") return null;
            const prevMatrix = i === 0 ? autoBaseFrame : autoKinematics.cumulativeMatrices[i - 1]!;
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
          })
        : elements.map((element, i) => {
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
          })
      }

      {/* Link length labels */}
      {elements.map((element, idx) => {
        if (element.elementKind !== "link") return null;

        let labelMatrix: Matrix4x4;
        let labelLength: number;
        let labelAxis: RotationAxis;

        if (isAuto) {
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
