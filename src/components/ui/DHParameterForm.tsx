import { useState } from "react";
import { useRobotStore } from "../../store/robotStore";
import type { JointType, RotationAxis } from "../../core/types/robot";

const DEG_TO_RAD = Math.PI / 180;

export default function DHParameterForm() {
  const addJoint = useRobotStore((s) => s.addJoint);

  const [type, setType] = useState<JointType>("revolute");
  const [thetaDeg, setThetaDeg] = useState(0);
  const [alphaDeg, setAlphaDeg] = useState(0);
  const [rotationAxis, setRotationAxis] = useState<RotationAxis>("z");
  const [frameAngleDeg, setFrameAngleDeg] = useState(0);
  const [prismaticMax, setPrismaticMax] = useState(2);
  const [prismaticDirection, setPrismaticDirection] = useState<"extend" | "retract">("extend");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addJoint(
      type,
      {
        theta: thetaDeg * DEG_TO_RAD,
        d: 0,
        a: 0,
        alpha: alphaDeg * DEG_TO_RAD,
      },
      rotationAxis,
      frameAngleDeg * DEG_TO_RAD,
      undefined,
      type === "prismatic" ? prismaticMax : undefined,
      type === "prismatic" ? prismaticDirection : undefined,
    );
  }

  const isVariable = (param: string) => {
    if (type === "revolute" && param === "theta") return true;
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
            onChange={setThetaDeg}
            variable={isVariable("theta")}
            varColor="text-amber-400"
          />
          <ParamInput
            label="alpha"
            unit="deg"
            value={alphaDeg}
            onChange={setAlphaDeg}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-500">axis:</span>
          {(["x", "y", "z"] as const).map((axis) => {
            const colors: Record<string, string> = {
              x: "text-red-400 bg-red-500/15",
              y: "text-green-400 bg-green-500/15",
              z: "text-blue-400 bg-blue-500/15",
            };
            return (
              <button
                key={axis}
                type="button"
                onClick={() => setRotationAxis(axis)}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all ${
                  rotationAxis === axis
                    ? colors[axis]
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {axis.toUpperCase()}
              </button>
            );
          })}
          <span className="text-[10px] text-gray-600 mx-1">|</span>
          <span className="text-[10px] text-gray-500">frame:</span>
          <input
            type="number"
            step="any"
            value={frameAngleDeg}
            onChange={(e) => setFrameAngleDeg(Number(e.target.value))}
            className="w-14 bg-gray-800/80 border border-gray-700 rounded px-1.5 py-0.5 text-[10px] text-gray-200 font-mono focus:outline-none focus:border-indigo-500 transition-all"
          />
          <span className="text-[10px] text-gray-600">deg</span>
        </div>
        {type === "prismatic" && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">variable:</span>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/15 px-1.5 py-0.5 rounded">
                d
              </span>
              <span className="text-[10px] text-gray-600">(0 to max)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">max:</span>
              <input
                type="number"
                step="any"
                min="0.1"
                value={prismaticMax}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v > 0) setPrismaticMax(v);
                }}
                className="w-16 bg-gray-800/80 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 font-mono focus:outline-none focus:border-cyan-500 transition-all"
              />
              <span className="text-[10px] text-gray-600">m</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">mode:</span>
              <button
                type="button"
                onClick={() => setPrismaticDirection("extend")}
                className={`text-[10px] font-medium px-2 py-0.5 rounded transition-all ${
                  prismaticDirection === "extend"
                    ? "bg-cyan-500/15 text-cyan-400"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                Extend
              </button>
              <button
                type="button"
                onClick={() => setPrismaticDirection("retract")}
                className={`text-[10px] font-medium px-2 py-0.5 rounded transition-all ${
                  prismaticDirection === "retract"
                    ? "bg-cyan-500/15 text-cyan-400"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                Retract
              </button>
            </div>
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
