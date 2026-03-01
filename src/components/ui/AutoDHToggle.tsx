import { useRobotStore } from "../../store/robotStore";

export default function AutoDHToggle() {
  const autoDHMode = useRobotStore((s) => s.autoDHMode);
  const setAutoDHMode = useRobotStore((s) => s.setAutoDHMode);
  const elements = useRobotStore((s) => s.elements);
  const hasJoints = elements.some((el) => el.elementKind === "joint");

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-300 font-medium">Auto DH</span>
        <span className="text-[10px] text-gray-600">
          {autoDHMode ? "Standard frames" : "Manual mode"}
        </span>
      </div>
      <button
        onClick={() => setAutoDHMode(!autoDHMode)}
        disabled={!hasJoints && !autoDHMode}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
          autoDHMode ? "bg-indigo-500" : "bg-gray-700"
        }`}
        role="switch"
        aria-checked={autoDHMode}
        title={autoDHMode ? "Switch to manual DH parameters" : "Auto-assign standard DH frames"}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            autoDHMode ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
