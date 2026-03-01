import { useState, useRef, useCallback, useEffect } from "react";
import Sidebar from "./components/ui/Sidebar";
import RobotScene from "./components/scene/RobotScene";
import RotationOrb from "./components/ui/RotationOrb";
import type { CameraApi } from "./components/ui/RotationOrb";

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 700;
const DEFAULT_SIDEBAR_WIDTH = 400;
const STORAGE_KEY = "sidebar-width";

function loadSidebarWidth(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) return parsed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const isResizing = useRef(false);
  const cameraApiRef = useRef<CameraApi>({
    orbit: () => {},
    snapOrbit: () => {},
  });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isResizing.current) return;
      const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, e.clientX));
      setSidebarWidth(newWidth);
    }

    function handleMouseUp() {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setSidebarWidth((w) => {
        try { localStorage.setItem(STORAGE_KEY, String(w)); } catch { /* ignore */ }
        return w;
      });
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden">
      {/* Mobile toggle button - hidden when sidebar is open */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden fixed top-3 left-3 z-50 bg-gray-900/90 backdrop-blur text-gray-300 rounded-lg p-2.5 border border-gray-700 shadow-lg"
          title="Open panel"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      )}

      {/* Sidebar: slide-over on mobile, fixed on desktop */}
      <div
        className={`
          fixed inset-0 z-40 transition-transform duration-300 ease-in-out
          md:static md:translate-x-0 md:z-auto md:shrink-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ width: undefined }}
      >
        {/* Backdrop on mobile */}
        <div
          className={`absolute inset-0 bg-black/50 md:hidden ${sidebarOpen ? "block" : "hidden"}`}
          onClick={() => setSidebarOpen(false)}
        />
        <div className="relative h-full flex" style={{ zIndex: 100 }}>
          <Sidebar onClose={() => setSidebarOpen(false)} sidebarWidth={sidebarWidth} />
          {/* Resize handle - desktop only */}
          <div
            className="hidden md:flex items-center justify-center w-1.5 cursor-col-resize group hover:bg-indigo-500/20 active:bg-indigo-500/30 transition-colors shrink-0"
            onMouseDown={handleMouseDown}
          >
            <div className="w-0.5 h-8 rounded-full bg-gray-700 group-hover:bg-indigo-400 group-active:bg-indigo-300 transition-colors" />
          </div>
        </div>
      </div>

      {/* 3D Scene */}
      <div className="flex-1 h-screen min-h-0 isolate overflow-hidden">
        <RobotScene cameraApiRef={cameraApiRef} />
      </div>

      {/* Mobile rotation orb */}
      {!sidebarOpen && <RotationOrb cameraApiRef={cameraApiRef} />}
    </div>
  );
}
