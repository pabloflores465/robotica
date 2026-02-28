import { useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import RobotArm from "./RobotArm";
import GroundGrid from "./GroundGrid";

const Z_UP = new THREE.Vector3(0, 0, 1);

function SceneControls() {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const canvas = controls.domElement;

    // Track if a pinch gesture is active (ctrlKey from browser pinch)
    let isPinching = false;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const camera = controls.object as THREE.PerspectiveCamera;

      // Browser sends ctrlKey=true for trackpad pinch-to-zoom
      // Distinguish real Ctrl key from pinch by tracking keydown
      if (e.ctrlKey && !isPinching && !e.metaKey) {
        // Real Ctrl + trackpad scroll = orbit/rotate
        const speed = 0.003;
        const offset = camera.position.clone().sub(controls.target);

        // Swap Y<->Z for THREE.Spherical (assumes Y-up), we use Z-up
        const swapped = new THREE.Vector3(offset.x, offset.z, offset.y);
        const spherical = new THREE.Spherical().setFromVector3(swapped);

        spherical.theta -= e.deltaX * speed;
        spherical.phi += e.deltaY * speed;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

        swapped.setFromSpherical(spherical);
        offset.set(swapped.x, swapped.z, swapped.y);

        camera.position.copy(controls.target).add(offset);
        camera.lookAt(controls.target);
        controls.update();
      } else if (isPinching || e.metaKey) {
        // Pinch-to-zoom (browser sets ctrlKey for pinch, we detect via isPinching)
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

    // Detect pinch gestures: gesturestart/gestureend (Safari) or
    // pointerdown with multiple touches
    function onGestureStart() {
      isPinching = true;
    }
    function onGestureEnd() {
      isPinching = false;
    }

    function onContextMenu(e: Event) {
      e.preventDefault();
    }

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("gesturestart", onGestureStart);
    canvas.addEventListener("gestureend", onGestureEnd);
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("gesturestart", onGestureStart);
      canvas.removeEventListener("gestureend", onGestureEnd);
    };
  }, []);

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
    />
  );
}

export default function RobotScene() {
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
      <SceneControls />
    </Canvas>
  );
}
