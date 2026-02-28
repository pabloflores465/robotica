import { useState } from "react";
import { useRobotStore } from "../../store/robotStore";
import type { LinkDirection } from "../../core/types/robot";

const AXIS_COLORS: Record<string, { active: string; inactive: string }> = {
  x: { active: "bg-red-600 text-white ring-1 ring-red-400", inactive: "bg-gray-800/80 text-red-400 hover:bg-gray-700" },
  y: { active: "bg-green-600 text-white ring-1 ring-green-400", inactive: "bg-gray-800/80 text-green-400 hover:bg-gray-700" },
  z: { active: "bg-blue-600 text-white ring-1 ring-blue-400", inactive: "bg-gray-800/80 text-blue-400 hover:bg-gray-700" },
};

const DIRECTIONS: { key: LinkDirection; label: string; axis: "x" | "y" | "z" }[] = [
  { key: "+x", label: "+X", axis: "x" },
  { key: "-x", label: "-X", axis: "x" },
  { key: "+y", label: "+Y", axis: "y" },
  { key: "-y", label: "-Y", axis: "y" },
  { key: "+z", label: "+Z", axis: "z" },
  { key: "-z", label: "-Z", axis: "z" },
];

export default function LinkForm() {
  const addLink = useRobotStore((s) => s.addLink);
  const [direction, setDirection] = useState<LinkDirection>("+z");
  const [length, setLength] = useState(1);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addLink(direction, length);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Direction preset grid */}
      <div>
        <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
          Direction
        </label>
        <div className="grid grid-cols-3 gap-1">
          {DIRECTIONS.map(({ key, label, axis }) => {
            const colors = AXIS_COLORS[axis];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDirection(key)}
                className={`px-2 py-1.5 rounded-md text-xs font-bold transition-all text-center ${
                  direction === key ? colors?.active : colors?.inactive
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Length input */}
      <div>
        <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
          Length
        </label>
        <input
          type="number"
          step="any"
          min="0"
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="w-full bg-gray-800/80 border border-gray-700 rounded-md px-2.5 py-1.5 text-sm text-gray-200 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-medium py-2.5 rounded-lg text-sm transition-all shadow-sm shadow-teal-500/20"
      >
        Add Link
      </button>
    </form>
  );
}
