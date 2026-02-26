import { useState } from "react";
import { useRobotStore } from "../../store/robotStore";
import type { JointType } from "../../core/types/robot";

const DEG_TO_RAD = Math.PI / 180;

export default function DHParameterForm() {
  const addJoint = useRobotStore((s) => s.addJoint);

  const [type, setType] = useState<JointType>("revolute");
  const [thetaDeg, setThetaDeg] = useState(0);
  const [d, setD] = useState(0);
  const [a, setA] = useState(1);
  const [alphaDeg, setAlphaDeg] = useState(0);

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
            onChange={(e) => setThetaDeg(Number(e.target.value))}
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
            onChange={(e) => setD(Number(e.target.value))}
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
            onChange={(e) => setA(Number(e.target.value))}
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
            onChange={(e) => setAlphaDeg(Number(e.target.value))}
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
