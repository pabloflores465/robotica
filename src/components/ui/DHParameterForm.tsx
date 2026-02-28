import { useState } from "react";
import { useRobotStore } from "../../store/robotStore";
import type { JointType } from "../../core/types/robot";

const DEG_TO_RAD = Math.PI / 180;

type DirectionPreset = "+x" | "-x" | "+y" | "-y" | "+z" | "-z" | "custom";

interface PresetConfig {
  label: string;
  description: string;
  axis: "x" | "y" | "z";
  thetaDeg: number;
  d: number;
  a: number;
  alphaDeg: number;
}

const DIRECTION_PRESETS: Record<Exclude<DirectionPreset, "custom">, PresetConfig> = {
  "+x": {
    label: "+X",
    description: "a=1, extends along +X",
    axis: "x",
    thetaDeg: 0,
    d: 0,
    a: 1,
    alphaDeg: 0,
  },
  "-x": {
    label: "-X",
    description: "theta=180, a=1, extends along -X",
    axis: "x",
    thetaDeg: 180,
    d: 0,
    a: 1,
    alphaDeg: 0,
  },
  "+y": {
    label: "+Y",
    description: "theta=90, a=1, extends along +Y",
    axis: "y",
    thetaDeg: 90,
    d: 0,
    a: 1,
    alphaDeg: 0,
  },
  "-y": {
    label: "-Y",
    description: "theta=-90, a=1, extends along -Y",
    axis: "y",
    thetaDeg: -90,
    d: 0,
    a: 1,
    alphaDeg: 0,
  },
  "+z": {
    label: "+Z",
    description: "d=1, extends along +Z",
    axis: "z",
    thetaDeg: 0,
    d: 1,
    a: 0,
    alphaDeg: 0,
  },
  "-z": {
    label: "-Z",
    description: "d=-1, extends along -Z",
    axis: "z",
    thetaDeg: 0,
    d: -1,
    a: 0,
    alphaDeg: 0,
  },
};

const AXIS_COLORS: Record<string, { active: string; inactive: string }> = {
  x: { active: "bg-red-600 text-white ring-1 ring-red-400", inactive: "bg-gray-800/80 text-red-400 hover:bg-gray-700" },
  y: { active: "bg-green-600 text-white ring-1 ring-green-400", inactive: "bg-gray-800/80 text-green-400 hover:bg-gray-700" },
  z: { active: "bg-blue-600 text-white ring-1 ring-blue-400", inactive: "bg-gray-800/80 text-blue-400 hover:bg-gray-700" },
};

export default function DHParameterForm() {
  const addJoint = useRobotStore((s) => s.addJoint);

  const [type, setType] = useState<JointType>("revolute");
  const [direction, setDirection] = useState<DirectionPreset>("+x");
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
      {/* Joint type selector */}
      <div className="flex gap-1.5 bg-gray-800/50 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => setType("revolute")}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
            type === "revolute"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Revolute
        </button>
        <button
          type="button"
          onClick={() => setType("prismatic")}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
            type === "prismatic"
              ? "bg-cyan-600 text-white shadow-sm"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Prismatic
        </button>
      </div>

      {/* Direction presets */}
      <div>
        <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
          Direction
        </label>
        <div className="grid grid-cols-3 gap-1">
          {(Object.entries(DIRECTION_PRESETS) as [Exclude<DirectionPreset, "custom">, PresetConfig][]).map(
            ([key, config]) => {
              const colors = AXIS_COLORS[config.axis];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className={`px-2 py-1.5 rounded-md text-xs font-bold transition-all text-center ${
                    direction === key
                      ? colors?.active
                      : colors?.inactive
                  }`}
                  title={config.description}
                >
                  {config.label}
                </button>
              );
            },
          )}
          <button
            type="button"
            onClick={() => setDirection("custom")}
            className={`col-span-3 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
              direction === "custom"
                ? "bg-indigo-600 text-white ring-1 ring-indigo-400"
                : "bg-gray-800/80 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {/* DH Parameters */}
      <div>
        <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
          DH Parameters
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <ParamInput
            label="theta"
            unit="deg"
            value={thetaDeg}
            onChange={(v) => handleManualChange(setThetaDeg, v)}
            variable={isVariable("theta")}
            varColor="text-amber-400"
          />
          <ParamInput
            label="L"
            unit="length"
            value={d}
            onChange={(v) => handleManualChange(setD, v)}
          />
          <ParamInput
            label="a"
            unit="length"
            value={a}
            onChange={(v) => handleManualChange(setA, v)}
          />
          <ParamInput
            label="alpha"
            unit="deg"
            value={alphaDeg}
            onChange={(v) => handleManualChange(setAlphaDeg, v)}
          />
        </div>
        {type === "prismatic" && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500">variable:</span>
            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/15 px-1.5 py-0.5 rounded">
              d
            </span>
            <span className="text-[10px] text-gray-600">(slider)</span>
          </div>
        )}
      </div>

      <button
        type="submit"
        className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm transition-all shadow-sm shadow-indigo-500/20"
      >
        Add Joint
      </button>
    </form>
  );
}

interface ParamInputProps {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  variable?: boolean;
  varColor?: string;
}

function ParamInput({ label, unit, value, onChange, variable, varColor }: ParamInputProps) {
  return (
    <div className="relative">
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-[11px] text-gray-500 font-mono">{label}</span>
        <span className="text-[10px] text-gray-600">({unit})</span>
        {variable && <span className={`text-[10px] ${varColor} font-semibold`}>var</span>}
      </div>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-gray-800/80 border border-gray-700 rounded-md px-2.5 py-1.5 text-sm text-gray-200 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
      />
    </div>
  );
}
