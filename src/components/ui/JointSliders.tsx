import { useState } from "react";
import { useRobotStore } from "../../store/robotStore";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export default function JointSliders() {
  const elements = useRobotStore((s) => s.elements);
  const updateJointVariable = useRobotStore((s) => s.updateJointVariable);

  const jointElements = elements
    .map((el, globalIndex) => ({ element: el, globalIndex }))
    .filter(({ element }) => element.elementKind === "joint");

  if (jointElements.length === 0) return null;

  return (
    <div className="space-y-3">
      {jointElements.map(({ element: joint, globalIndex }) => {
        const isRevolute = joint.type === "revolute";
        const displayValue = isRevolute
          ? joint.variableValue * RAD_TO_DEG
          : joint.variableValue;
        const unit = isRevolute ? "deg" : "m";
        const paramName = isRevolute ? "theta" : "d";

        return (
          <div key={joint.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isRevolute
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-cyan-500/15 text-cyan-400"
                  }`}
                >
                  {isRevolute ? "R" : "P"}
                </span>
                <span className="text-xs text-gray-300 font-medium">
                  {joint.name}
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  ({paramName})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <EditableValue
                  value={displayValue}
                  onChange={(v) => {
                    const raw = isRevolute ? v * DEG_TO_RAD : v;
                    const clamped = Math.max(joint.minLimit, Math.min(joint.maxLimit, raw));
                    updateJointVariable(joint.id, clamped);
                  }}
                />
                <span className="text-[10px] text-gray-500">{unit}</span>
                {joint.variableValue !== 0 && (
                  <button
                    onClick={() => updateJointVariable(joint.id, 0)}
                    className="text-[10px] text-gray-500 hover:text-gray-300 px-1 py-0.5 rounded hover:bg-gray-800 transition-all"
                    title="Reset to 0"
                  >
                    reset
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min={joint.minLimit}
              max={joint.maxLimit}
              step={0.01}
              value={joint.variableValue}
              onInput={(e) =>
                updateJointVariable(
                  joint.id,
                  Number((e.target as HTMLInputElement).value),
                )
              }
              className="w-full"
            />
          </div>
        );
      })}
    </div>
  );
}

function EditableValue({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEdit() {
    setDraft(value.toFixed(1));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  }

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-14 text-xs text-gray-200 font-mono tabular-nums bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-right outline-none focus:border-indigo-500"
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      className="text-xs text-gray-200 font-mono tabular-nums hover:bg-gray-800 rounded px-1 py-0.5 cursor-text transition-colors"
      title="Click to edit"
    >
      {value.toFixed(1)}
    </button>
  );
}
