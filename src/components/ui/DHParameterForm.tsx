import { useState } from "react";
import { useRobotStore } from "../../store/robotStore";
import type { JointType } from "../../core/types/robot";

const DEG_TO_RAD = Math.PI / 180;

type DirectionPreset = "along-x" | "along-z" | "elbow-up" | "elbow-down" | "custom";

interface PresetConfig {
  label: string;
  description: string;
  thetaDeg: number;
  d: number;
  a: number;
  alphaDeg: number;
}

const DIRECTION_PRESETS: Record<Exclude<DirectionPreset, "custom">, PresetConfig> = {
  "along-x": {
    label: "Forward (X)",
    description: "a=1, extends along X",
    thetaDeg: 0,
    d: 0,
    a: 1,
    alphaDeg: 0,
  },
  "along-z": {
    label: "Up (Z)",
    description: "d=1, extends along Z",
    thetaDeg: 0,
    d: 1,
    a: 0,
    alphaDeg: 0,
  },
  "elbow-up": {
    label: "Elbow Up",
    description: "a=1, alpha=-90",
    thetaDeg: 0,
    d: 0,
    a: 1,
    alphaDeg: -90,
  },
  "elbow-down": {
    label: "Elbow Down",
    description: "a=1, alpha=90",
    thetaDeg: 0,
    d: 0,
    a: 1,
    alphaDeg: 90,
  },
};

export default function DHParameterForm() {
  const addJoint = useRobotStore((s) => s.addJoint);

  const [type, setType] = useState<JointType>("revolute");
  const [direction, setDirection] = useState<DirectionPreset>("along-x");
  const [thetaDeg, setThetaDeg] = useState(0);
  const [d, setD] = useState(0);
  const [a, setA] = useState(1);
  const [alphaDeg, setAlphaDeg] = useState(0);

  function applyPreset(preset: Exclude<DirectionPreset, "custom">) {
    const config = DIRECTION_PRESETS[preset];
    setDirection(preset);
    setThetaDeg(config.thetaDeg);
    setD(config.d);
    setA(config.a);
    setAlphaDeg(config.alphaDeg);
  }

  function handleManualChange(setter: (v: number) => void, value: number) {
    setter(value);
    setDirection("custom");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addJoint(type, {
      theta: thetaDeg * DEG_TO_RAD,
      d,
      a,
      alpha: alphaDeg * DEG_TO_RAD,
    });
  }

  const isVariable = (param: string) => {
    if (type === "revolute" && param === "theta") return true;
    if (type === "prismatic" && param === "d") return true;
    return false;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
        Add Joint
      </h3>

      {/* Joint type selector */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType("revolute")}
          className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            type === "revolute"
              ? "bg-amber-600 text-white"
              : "bg-gray-700 text-gray-400 hover:bg-gray-600"
          }`}
        >
          Revolute
        </button>
        <button
          type="button"
          onClick={() => setType("prismatic")}
          className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            type === "prismatic"
              ? "bg-cyan-600 text-white"
              : "bg-gray-700 text-gray-400 hover:bg-gray-600"
          }`}
        >
          Prismatic
        </button>
      </div>

      {/* Direction presets */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Direction</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.entries(DIRECTION_PRESETS) as [Exclude<DirectionPreset, "custom">, PresetConfig][]).map(
            ([key, config]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={`px-2 py-1.5 rounded text-xs font-medium transition-colors text-left ${
                  direction === key
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                }`}
                title={config.description}
              >
                {config.label}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => setDirection("custom")}
            className={`col-span-2 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              direction === "custom"
                ? "bg-indigo-600 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {/* DH Parameters */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            theta (deg){isVariable("theta") && (
              <span className="text-amber-400 ml-1">var</span>
            )}
          </label>
          <input
            type="number"
            step="any"
            value={thetaDeg}
            onChange={(e) => handleManualChange(setThetaDeg, Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            d (offset){isVariable("d") && (
              <span className="text-cyan-400 ml-1">var</span>
            )}
          </label>
          <input
            type="number"
            step="any"
            value={d}
            onChange={(e) => handleManualChange(setD, Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            a (length)
          </label>
          <input
            type="number"
            step="any"
            value={a}
            onChange={(e) => handleManualChange(setA, Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            alpha (deg)
          </label>
          <input
            type="number"
            step="any"
            value={alphaDeg}
            onChange={(e) => handleManualChange(setAlphaDeg, Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded text-sm transition-colors"
      >
        Add Joint
      </button>
    </form>
  );
}
