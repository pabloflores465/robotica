import { useRobotStore } from "../../store/robotStore";
import type { BaseRotation } from "../../store/robotStore";
import type { RotationAxis } from "../../core/types/robot";

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
  const revoluteFrameAxis = useRobotStore((s) => s.revoluteFrameAxis);
  const setRevoluteAroundZOnly = useRobotStore((s) => s.setRevoluteAroundZOnly);
  const setRevoluteFrameAxis = useRobotStore((s) => s.setRevoluteFrameAxis);
  const useCommonNormalConvention = useRobotStore((s) => s.useCommonNormalConvention);
  const setUseCommonNormalConvention = useRobotStore((s) => s.setUseCommonNormalConvention);

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
        <select
          value={revoluteAroundZOnly ? revoluteFrameAxis : "off"}
          onChange={(e) => {
            const mode = e.target.value as "off" | RotationAxis;
            if (mode === "off") {
              setRevoluteAroundZOnly(false);
              return;
            }
            setRevoluteFrameAxis(mode);
            setRevoluteAroundZOnly(true);
          }}
          className="w-full bg-gray-800/80 border border-gray-700 rounded-md px-2.5 py-2 text-xs text-gray-200 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
          title="Selecciona el eje de referencia del marco remapeado (X/Y/Z) o apaga el modo"
        >
          <option value="off">OFF (raw labels)</option>
          <option value="x">X reference</option>
          <option value="y">Y reference</option>
          <option value="z">Z reference</option>
        </select>
        <p className="mt-1 text-[10px] text-gray-500 leading-snug">
          El eje elegido (X/Y/Z) se remapea al eje real del joint, manteniendo exactamente el mismo giro fisico.
        </p>
      </div>

      {/* Standard DH convention toggle */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={useCommonNormalConvention}
            onChange={(e) => setUseCommonNormalConvention(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500/30 focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium group-hover:text-gray-300 transition-colors">
            Standard DH Convention
          </span>
        </label>
        <p className="mt-1 text-[10px] text-gray-500 leading-snug ml-5.5">
          Apply common-normal rule for X-axis placement (standard textbook convention).
          Affects DH table and PDF only.
        </p>
      </div>
    </div>
  );
}
