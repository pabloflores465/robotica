import { useState, useRef } from "react";
import Sidebar from "./components/ui/Sidebar";
import RobotScene from "./components/scene/RobotScene";
import RotationOrb from "./components/ui/RotationOrb";
import type { CameraApi } from "./components/ui/RotationOrb";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const cameraApiRef = useRef<CameraApi>({
    orbit: () => {},
    snapOrbit: () => {},
  });

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
          md:static md:translate-x-0 md:z-auto
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Backdrop on mobile */}
        <div
          className={`absolute inset-0 bg-black/50 md:hidden ${sidebarOpen ? "block" : "hidden"}`}
          onClick={() => setSidebarOpen(false)}
        />
        <div className="relative h-full" style={{ zIndex: 100 }}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
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
