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

function FrameGroup({ matrix }: { matrix: Matrix4x4 }) {
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
    </group>
  );
}

function JointMeshGroup({ matrix, joint }: { matrix: Matrix4x4; joint: Joint }) {
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

  // Always use manual FK for tube rendering so the physical path follows
  // through each link segment (e.g. L5 -Z then L6 +X) instead of drawing
  // a single straight line between joints in auto DH mode.
  const links = useMemo(() => {
    const result: LinkData[] = [];
    const baseOrigin = getPositionFromMatrix(baseMatrix);

    for (let i = 0; i < kinematics.cumulativeMatrices.length; i++) {
      const prevPos =
        i === 0
          ? baseOrigin
          : getPositionFromMatrix(kinematics.cumulativeMatrices[i - 1]!);
      const currPos = getPositionFromMatrix(kinematics.cumulativeMatrices[i]!);
      const element = elements[i];
      if (element) {
        result.push({
          key: `link-${element.id}`,
          start: prevPos,
          end: currPos,
        });
      }
    }

    return result;
  }, [elements, kinematics.cumulativeMatrices, baseMatrix]);

  // End effector position for the "ghost" frame
  const endEffectorMatrix = activeKinematics.endEffectorTransform;
  const hasEndEffector =
    activeElements.length > 0 &&
    endEffectorMatrix !== identity4();

  return (
    <group>
      {/* Coordinate frames at auto DH positions (or manual in manual mode) */}
      {activeElements.map((element, i) => {
        if (element.elementKind !== "joint") return null;
        const matrix = activeKinematics.cumulativeMatrices[i];
        if (!matrix) return null;
        return <FrameGroup key={`frame-${element.id}`} matrix={matrix} />;
      })}

      {/* Joint meshes at physical positions (manual FK) */}
      {elements.map((element, i) => {
        if (element.elementKind !== "joint") return null;
        const matrix = kinematics.cumulativeMatrices[i];
        if (!matrix) return null;
        return <JointMeshGroup key={`mesh-${element.id}`} matrix={matrix} joint={element} />;
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

      {/* Link length annotations -- for link elements in both modes */}
      {elements.map((element, idx) => {
        if (element.elementKind !== "link") return null;

        let labelMatrix: Matrix4x4;
        let labelLength: number;
        let labelAxis: RotationAxis;

        if (autoDHMode && autoElements.length > 0) {
          // In auto DH mode, use the auto DH frame rotation but position
          // the label at the link's manual FK start position so consecutive
          // links between two joints each get their own label position.
          let jointCount = 0;
          for (let j = 0; j < idx; j++) {
            if (elements[j]!.elementKind === "joint") jointCount++;
          }
          const autoFrame = jointCount === 0
            ? autoBaseFrame
            : (jointCount - 1) < autoKinematics.cumulativeMatrices.length
              ? autoKinematics.cumulativeMatrices[jointCount - 1]!
              : autoKinematics.endEffectorTransform;

          // Get the manual FK start position for this specific link
          const manualStart = idx === 0
            ? baseMatrix
            : kinematics.cumulativeMatrices[idx - 1]!;
          const manualEnd = kinematics.cumulativeMatrices[idx]!;
          const startPos = getPositionVec3(manualStart);

          // Build label matrix: auto DH frame rotation + manual FK start position
          const autoAxes = extractFrameAxes(autoFrame);
          labelMatrix = buildFrameMatrix(autoAxes.x, autoAxes.y, autoAxes.z, startPos);

          // Compute direction and length by projecting displacement onto auto DH axes
          const endPos = getPositionVec3(manualEnd);
          const dx = endPos.x - startPos.x;
          const dy = endPos.y - startPos.y;
          const dz = endPos.z - startPos.z;
          const projX = dx * autoAxes.x.x + dy * autoAxes.x.y + dz * autoAxes.x.z;
          const projY = dx * autoAxes.y.x + dy * autoAxes.y.y + dz * autoAxes.y.z;
          const projZ = dx * autoAxes.z.x + dy * autoAxes.z.y + dz * autoAxes.z.z;

          if (element.intendedDirection) {
            // Link created in auto DH mode: use the stored intended direction
            labelAxis = element.intendedDirection.charAt(1) as RotationAxis;
            const sign = element.intendedDirection.charAt(0) === "+" ? 1 : -1;
            const totalLength = Math.sqrt(
              element.dhParams.d * element.dhParams.d +
              element.dhParams.a * element.dhParams.a,
            );
            labelLength = sign * totalLength;
          } else {
            // Legacy link: use dominant axis from projection
            const absDots = [Math.abs(projX), Math.abs(projY), Math.abs(projZ)];
            const maxVal = Math.max(absDots[0]!, absDots[1]!, absDots[2]!);
            const maxDotIdx = absDots.indexOf(maxVal);
            const axisNames: RotationAxis[] = ["x", "y", "z"];
            labelAxis = axisNames[maxDotIdx]!;
            labelLength = [projX, projY, projZ][maxDotIdx]!;
          }
        } else {
          // Manual mode: use manual FK
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
