import { useState } from "react";
import Sidebar from "./components/ui/Sidebar";
import RobotScene from "./components/scene/RobotScene";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rotateMode, setRotateMode] = useState(false);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden">
      {/* Mobile toggle button - hidden when sidebar is open */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden fixed top-3 left-3 z-50 bg-gray-900/90 backdrop-blur text-gray-300 rounded-lg p-2.5 border border-gray-700 shadow-lg"
          title="Open panel"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
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

      {/* Mobile rotate toggle */}
      {!sidebarOpen && (
        <button
          onClick={() => setRotateMode((r) => !r)}
          className={`md:hidden fixed top-3 left-14 z-50 backdrop-blur rounded-lg p-2.5 border shadow-lg transition-colors ${
            rotateMode
              ? "bg-indigo-600/90 text-white border-indigo-500"
              : "bg-gray-900/90 text-gray-300 border-gray-700"
          }`}
          title={rotateMode ? "Rotate mode on" : "Rotate mode off"}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}

      {/* 3D Scene */}
      <div className="flex-1 h-screen min-h-0 isolate overflow-hidden">
        <RobotScene touchRotate={rotateMode} />
      </div>
    </div>
  );
}
