import { useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import RobotArm from "./RobotArm";
import GroundGrid from "./GroundGrid";
import type { CameraApi } from "../ui/RotationOrb";

const Z_UP = new THREE.Vector3(0, 0, 1);

function SceneControls({
  cameraApiRef,
}: {
  cameraApiRef: React.RefObject<CameraApi>;
}) {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const canvas = controls.domElement;

    // Track whether the real Ctrl key is physically held down.
    // Browser pinch-to-zoom also sets ctrlKey=true on wheel events,
    // but it does NOT fire keydown, so realCtrl stays false for pinch.
    let realCtrl = false;
    let realShift = false;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Control") realCtrl = true;
      if (e.key === "Shift") realShift = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Control") realCtrl = false;
      if (e.key === "Shift") realShift = false;
    }

    // Z-up orbit: reusable spherical coordinate math (Y<->Z swap)
    function orbitCamera(deltaX: number, deltaY: number, speed: number) {
      const camera = controls.object as THREE.PerspectiveCamera;
      const offset = camera.position.clone().sub(controls.target);

      // Swap Y<->Z for THREE.Spherical (assumes Y-up), we use Z-up
      const swapped = new THREE.Vector3(offset.x, offset.z, offset.y);
      const spherical = new THREE.Spherical().setFromVector3(swapped);

      spherical.theta -= deltaX * speed;
      spherical.phi += deltaY * speed;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

      swapped.setFromSpherical(spherical);
      offset.set(swapped.x, swapped.z, swapped.y);

      camera.position.copy(controls.target).add(offset);
      camera.lookAt(controls.target);
      controls.update();
    }

    // Snap animation id for cancellation
    let snapAnimId = 0;

    function snapOrbit(direction: "left" | "right" | "up" | "down") {
      snapAnimId++;
      const myId = snapAnimId;

      const camera = controls.object as THREE.PerspectiveCamera;
      const offset = camera.position.clone().sub(controls.target);
      const swapped = new THREE.Vector3(offset.x, offset.z, offset.y);
      const start = new THREE.Spherical().setFromVector3(swapped);

      const HALF_PI = Math.PI / 2;
      let targetTheta = start.theta;
      let targetPhi = start.phi;

      switch (direction) {
        case "left":
          targetTheta += HALF_PI;
          break;
        case "right":
          targetTheta -= HALF_PI;
          break;
        case "up":
          targetPhi = Math.max(0.1, targetPhi - HALF_PI);
          break;
        case "down":
          targetPhi = Math.min(Math.PI - 0.1, targetPhi + HALF_PI);
          break;
      }

      const startTheta = start.theta;
      const startPhi = start.phi;
      const radius = start.radius;
      const duration = 300;
      const startTime = performance.now();

      function animate() {
        if (myId !== snapAnimId) return;
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, elapsed / duration);
        const eased = t * (2 - t); // ease-out quadratic

        const theta = startTheta + (targetTheta - startTheta) * eased;
        const phi = startPhi + (targetPhi - startPhi) * eased;

        const s = new THREE.Spherical(radius, phi, theta);
        const v = new THREE.Vector3().setFromSpherical(s);
        const newOffset = new THREE.Vector3(v.x, v.z, v.y);

        camera.position.copy(controls.target).add(newOffset);
        camera.lookAt(controls.target);
        controls.update();

        if (t < 1) requestAnimationFrame(animate);
      }

      requestAnimationFrame(animate);
    }

    // Expose camera API for the RotationOrb
    cameraApiRef.current.orbit = (dx: number, dy: number) => {
      snapAnimId++; // cancel any running snap
      orbitCamera(dx, dy, 0.005);
    };
    cameraApiRef.current.snapOrbit = snapOrbit;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const camera = controls.object as THREE.PerspectiveCamera;

      if (realShift) {
        // Shift + scroll up/down = zoom
        const factor = 1 + e.deltaY * 0.005;
        const offset = camera.position.clone().sub(controls.target);
        offset.multiplyScalar(factor);
        camera.position.copy(controls.target).add(offset);
        controls.update();
      } else if (realCtrl) {
        // Real Ctrl + trackpad scroll = orbit/rotate
        orbitCamera(e.deltaX, e.deltaY, 0.003);
      } else if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom: browser sets ctrlKey=true but realCtrl is false
        const factor = 1 + e.deltaY * 0.01;
        const offset = camera.position.clone().sub(controls.target);
        offset.multiplyScalar(factor);
        camera.position.copy(controls.target).add(offset);
        controls.update();
      } else {
        // Normal trackpad scroll = pan on XY ground plane (Z stays constant)
        const distance = camera.position.distanceTo(controls.target);
        const panSpeed = 0.001 * distance;

        // Get camera right vector, project onto XY plane
        const right = new THREE.Vector3().setFromMatrixColumn(
          camera.matrix,
          0,
        );
        right.z = 0;
        right.normalize();

        // Forward direction on XY plane (for vertical scroll)
        const forward = new THREE.Vector3().setFromMatrixColumn(
          camera.matrix,
          1,
        );
        forward.z = 0;
        forward.normalize();

        const panOffset = new THREE.Vector3()
          .addScaledVector(right, -e.deltaX * panSpeed)
          .addScaledVector(forward, e.deltaY * panSpeed);

        camera.position.add(panOffset);
        controls.target.add(panOffset);
        controls.update();
      }
    }

    function onContextMenu(e: Event) {
      e.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [cameraApiRef]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      up={Z_UP}
      enableZoom={false}
      enableRotate={false}
      enablePan
      screenSpacePanning
      mouseButtons={{
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
    />
  );
}

export default function RobotScene({
  cameraApiRef,
}: {
  cameraApiRef: React.RefObject<CameraApi>;
}) {
  return (
    <Canvas
      camera={{ position: [4, 3, 4], fov: 50, up: [0, 0, 1] }}
      style={{ background: "#111111" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />
      <RobotArm />
      <GroundGrid />
      <SceneControls cameraApiRef={cameraApiRef} />
    </Canvas>
  );
}
