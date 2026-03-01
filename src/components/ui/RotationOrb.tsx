import { useRef, useCallback } from "react";

export interface CameraApi {
  orbit: (deltaX: number, deltaY: number) => void;
  snapOrbit: (direction: "left" | "right" | "up" | "down") => void;
}

interface RotationOrbProps {
  cameraApiRef: React.RefObject<CameraApi>;
}

export default function RotationOrb({ cameraApiRef }: RotationOrbProps) {
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      cameraApiRef.current.orbit(dx, dy);
      e.preventDefault();
      e.stopPropagation();
    },
    [cameraApiRef],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const snap = useCallback(
    (dir: "left" | "right" | "up" | "down") => {
      cameraApiRef.current.snapOrbit(dir);
    },
    [cameraApiRef],
  );

  return (
    <div className="md:hidden fixed bottom-6 right-6 z-50 select-none touch-none">
      <div className="relative w-36 h-36">
        {/* Up */}
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            snap("up");
          }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-gray-800/70 backdrop-blur border border-gray-700 text-gray-400 active:text-white active:bg-gray-700/90 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 15l7-7 7 7"
            />
          </svg>
        </button>

        {/* Down */}
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            snap("down");
          }}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-gray-800/70 backdrop-blur border border-gray-700 text-gray-400 active:text-white active:bg-gray-700/90 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Left */}
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            snap("left");
          }}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-gray-800/70 backdrop-blur border border-gray-700 text-gray-400 active:text-white active:bg-gray-700/90 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Right */}
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            snap("right");
          }}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-gray-800/70 backdrop-blur border border-gray-700 text-gray-400 active:text-white active:bg-gray-700/90 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        {/* Center draggable orb */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] rounded-full bg-gray-800/80 backdrop-blur border border-gray-600 shadow-lg cursor-grab active:cursor-grabbing flex items-center justify-center"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="w-3 h-3 rounded-full bg-gray-500/80" />
        </div>
      </div>
    </div>
  );
}
