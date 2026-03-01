import { useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import RobotArm from "./RobotArm";
import GroundGrid from "./GroundGrid";

const Z_UP = new THREE.Vector3(0, 0, 1);

function SceneControls({ touchRotate = false }: { touchRotate?: boolean }) {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const touchRotateRef = useRef(touchRotate);

  // Keep ref in sync with prop
  useEffect(() => {
    touchRotateRef.current = touchRotate;
  }, [touchRotate]);

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
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        right.z = 0;
        right.normalize();

        // Forward direction on XY plane (for vertical scroll)
        const forward = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
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

    // Custom touch rotation for mobile (Z-up aware)
    let touchStartX = 0;
    let touchStartY = 0;
    let isSingleTouch = false;

    function onTouchStart(e: TouchEvent) {
      if (!touchRotateRef.current) return;
      if (e.touches.length === 1) {
        isSingleTouch = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        e.preventDefault();
      } else {
        isSingleTouch = false;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!touchRotateRef.current || !isSingleTouch) return;
      if (e.touches.length !== 1) {
        isSingleTouch = false;
        return;
      }
      e.preventDefault();

      const deltaX = e.touches[0].clientX - touchStartX;
      const deltaY = e.touches[0].clientY - touchStartY;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;

      orbitCamera(deltaX, deltaY, 0.005);
    }

    function onTouchEnd() {
      isSingleTouch = false;
    }

    function onContextMenu(e: Event) {
      e.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, []);

  // Imperatively sync touch mode: disable OrbitControls' built-in touch handling
  // when custom rotation is active
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    // Always disable OrbitControls' built-in rotate - we handle it ourselves
    controls.enableRotate = false;
    controls.enablePan = !touchRotate;
    controls.touches = touchRotate
      ? { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
      : { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.update();
  }, [touchRotate]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      up={Z_UP}
      enableZoom={false}
      enableRotate={false}
      enablePan={!touchRotate}
      screenSpacePanning
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI - 0.1}
      mouseButtons={{
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={
        touchRotate
          ? { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
          : { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }
      }
    />
  );
}

export default function RobotScene({ touchRotate = false }: { touchRotate?: boolean }) {
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
      <SceneControls touchRotate={touchRotate} />
    </Canvas>
  );
}
