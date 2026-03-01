import { useRobotStore } from "../../store/robotStore";
import type { BaseRotation } from "../../store/robotStore";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

interface Preset {
  label: string;
  description: string;
  rotation: BaseRotation;
}

const PRESETS: Preset[] = [
  {
    label: "Default",
    description: "Z-up, X-forward (standard DH)",
    rotation: { x: 0, y: 0, z: 0 },
  },
  {
    label: "Z-up Y-fwd",
    description: "Z-up, Y-forward",
    rotation: { x: 0, y: 0, z: Math.PI / 2 },
  },
  {
    label: "Y-up",
    description: "Y-up, X-forward",
    rotation: { x: -Math.PI / 2, y: 0, z: 0 },
  },
  {
    label: "X-up",
    description: "X-up, Y-forward",
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
  },
];

function isPresetActive(current: BaseRotation, preset: BaseRotation): boolean {
  const eps = 0.001;
  return (
    Math.abs(current.x - preset.x) < eps &&
    Math.abs(current.y - preset.y) < eps &&
    Math.abs(current.z - preset.z) < eps
  );
}

export default function BaseFrameControls() {
  const baseRotation = useRobotStore((s) => s.baseRotation);
  const setBaseRotation = useRobotStore((s) => s.setBaseRotation);
  const revoluteAroundZOnly = useRobotStore((s) => s.revoluteAroundZOnly);
  const setRevoluteAroundZOnly = useRobotStore((s) => s.setRevoluteAroundZOnly);

  function handleAngleChange(axis: keyof BaseRotation, deg: number) {
    setBaseRotation({ ...baseRotation, [axis]: deg * DEG_TO_RAD });
  }

  return (
    <div className="space-y-2.5">
      {/* Presets */}
      <div>
        <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
          Presets
        </label>
        <div className="grid grid-cols-2 gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setBaseRotation(preset.rotation)}
              className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all text-center ${
                isPresetActive(baseRotation, preset.rotation)
                  ? "bg-indigo-600 text-white ring-1 ring-indigo-400"
                  : "bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Manual angles */}
      <div>
        <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
          Rotation (deg)
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {(["x", "y", "z"] as const).map((axis) => {
            const colors = {
              x: "text-red-400",
              y: "text-green-400",
              z: "text-blue-400",
            };
            return (
              <div key={axis}>
                <span className={`text-[11px] font-mono font-bold ${colors[axis]}`}>
                  R{axis.toUpperCase()}
                </span>
                <input
                  type="number"
                  step="any"
                  value={Number((baseRotation[axis] * RAD_TO_DEG).toFixed(1))}
                  onChange={(e) => handleAngleChange(axis, Number(e.target.value))}
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-gray-200 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Revolute axis mode */}
      <div>
        <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
          Revolute Axis Mode
        </label>
        <button
          type="button"
          onClick={() => setRevoluteAroundZOnly(!revoluteAroundZOnly)}
          className={`w-full px-2.5 py-2 rounded-md text-xs font-medium transition-all text-left ${
            revoluteAroundZOnly
              ? "bg-blue-600/20 text-blue-300 ring-1 ring-blue-400/60"
              : "bg-gray-800/80 text-gray-300 hover:bg-gray-700"
          }`}
          title="Reorienta el marco del joint para que Z apunte al eje seleccionado sin cambiar el giro real"
        >
          {revoluteAroundZOnly ? "Z follows selected axis (ON)" : "Use raw axis labels (OFF)"}
        </button>
        <p className="mt-1 text-[10px] text-gray-500 leading-snug">
          ON: el marco se remapea para que Z quede sobre el eje elegido (X/Y/Z), manteniendo el mismo giro del joint.
        </p>
      </div>
    </div>
  );
}
