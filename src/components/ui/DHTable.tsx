import { useState, useRef, useEffect } from "react";
import { useRobotStore } from "../../store/robotStore";
import type { DHParameters } from "../../core/types/robot";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

interface EditableCellProps {
  value: number;
  isDegrees: boolean;
  isVariable: boolean;
  variableColor: string;
  onCommit: (value: number) => void;
}

function EditableCell({ value, isDegrees, isVariable, variableColor, onCommit }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = isDegrees ? (value * RAD_TO_DEG).toFixed(1) : value.toFixed(2);

  function startEdit() {
    setDraft(isDegrees ? (value * RAD_TO_DEG).toFixed(1) : value.toFixed(2));
    setEditing(true);
  }

  function commit() {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      const storeValue = isDegrees ? parsed * DEG_TO_RAD : parsed;
      onCommit(storeValue);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      commit();
    } else if (e.key === "Escape") {
      setEditing(false);
    }
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <td className="py-1 px-1.5">
        <input
          ref={inputRef}
          type="number"
          step="any"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="w-full bg-gray-800 border border-indigo-500 rounded px-1.5 py-0.5 text-xs font-mono text-gray-200 text-right focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
        />
      </td>
    );
  }

  return (
    <td
      onClick={startEdit}
      className={`py-2 px-2.5 text-right font-mono text-xs cursor-pointer hover:bg-gray-700/40 rounded transition-colors ${
        isVariable ? `${variableColor} font-bold` : "text-gray-400"
      }`}
      title="Click to edit"
    >
      {displayValue}
    </td>
  );
}

export default function DHTable() {
  const joints = useRobotStore((s) => s.joints);
  const removeJoint = useRobotStore((s) => s.removeJoint);
  const updateJointDHParam = useRobotStore((s) => s.updateJointDHParam);
  const updateJointType = useRobotStore((s) => s.updateJointType);

  if (joints.length === 0) {
    return (
      <div className="text-gray-600 text-xs text-center py-4">
        No joints added yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800/50 text-[11px] text-gray-500 uppercase tracking-wider">
            <th className="text-left py-2 px-2.5 font-medium">#</th>
            <th className="text-left py-2 px-2.5 font-medium">Type</th>
            <th className="text-right py-2 px-2.5 font-medium">theta</th>
            <th className="text-right py-2 px-2.5 font-medium">L</th>
            <th className="text-right py-2 px-2.5 font-medium">a</th>
            <th className="text-right py-2 px-2.5 font-medium">alpha</th>
            <th className="py-2 px-2 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {joints.map((joint, i) => (
            <tr
              key={joint.id}
              className="group hover:bg-gray-800/30 transition-colors"
            >
              <td className="py-2 px-2.5 text-gray-500 font-mono text-xs">
                {i + 1}
              </td>
              <td className="py-2 px-2.5">
                <button
                  onClick={() =>
                    updateJointType(
                      joint.id,
                      joint.type === "revolute" ? "prismatic" : "revolute",
                    )
                  }
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    joint.type === "revolute"
                      ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                      : "bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25"
                  }`}
                  title="Click to toggle type"
                >
                  {joint.type === "revolute" ? "R" : "P"}
                </button>
              </td>
              <EditableCell
                value={joint.dhParams.theta}
                isDegrees={true}
                isVariable={joint.type === "revolute"}
                variableColor="text-amber-400"
                onCommit={(v) => updateJointDHParam(joint.id, "theta" satisfies keyof DHParameters, v)}
              />
              <EditableCell
                value={joint.dhParams.d}
                isDegrees={false}
                isVariable={joint.type === "prismatic"}
                variableColor="text-cyan-400"
                onCommit={(v) => updateJointDHParam(joint.id, "d" satisfies keyof DHParameters, v)}
              />
              <EditableCell
                value={joint.dhParams.a}
                isDegrees={false}
                isVariable={false}
                variableColor=""
                onCommit={(v) => updateJointDHParam(joint.id, "a" satisfies keyof DHParameters, v)}
              />
              <EditableCell
                value={joint.dhParams.alpha}
                isDegrees={true}
                isVariable={false}
                variableColor=""
                onCommit={(v) => updateJointDHParam(joint.id, "alpha" satisfies keyof DHParameters, v)}
              />
              <td className="py-2 px-2 text-center">
                <button
                  onClick={() => removeJoint(joint.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 text-xs transition-all p-0.5 rounded hover:bg-red-400/10"
                  title="Remove joint"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
