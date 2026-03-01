import { useState, useRef, useEffect, useCallback } from "react";
import { useRobotStore } from "../../store/robotStore";
import type { DHParameters, Joint, LinkDirection } from "../../core/types/robot";

interface EditableNameCellProps {
  name: string;
  onCommit: (name: string) => void;
}

function EditableNameCell({ name, onCommit }: EditableNameCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setDraft(name);
    setEditing(true);
  }, [name]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) {
      onCommit(trimmed);
    }
    setEditing(false);
  }, [draft, name, onCommit]);

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
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500"
        />
      </td>
    );
  }

  return (
    <td
      onClick={startEdit}
      className="py-2 px-2.5 text-gray-400 text-xs cursor-pointer hover:bg-gray-700/40 rounded transition-colors truncate max-w-[80px]"
      title={`${name} (click to rename)`}
    >
      {name}
    </td>
  );
}

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

const DIRECTION_CYCLE: LinkDirection[] = ["+x", "-x", "+y", "-y", "+z", "-z"];

function getLinkDirection(element: Joint): LinkDirection {
  const sign = element.dhParams.d >= 0 ? "+" : "-";
  return `${sign}${element.rotationAxis}` as LinkDirection;
}

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

function EditableLengthCell({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(Math.abs(value).toFixed(2));
    setEditing(true);
  }

  function commit() {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      onCommit(parsed);
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
      <td colSpan={4} className="py-1 px-1.5">
        <input
          ref={inputRef}
          type="number"
          step="any"
          min="0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="w-24 bg-gray-800 border border-teal-500 rounded px-1.5 py-0.5 text-xs font-mono text-gray-200 text-right focus:outline-none focus:ring-1 focus:ring-teal-500/30"
        />
      </td>
    );
  }

  return (
    <td
      colSpan={4}
      onClick={startEdit}
      className="py-2 px-2.5 text-right font-mono text-xs text-teal-400 cursor-pointer hover:bg-gray-700/40 rounded transition-colors"
      title="Click to edit length"
    >
      {Math.abs(value).toFixed(2)}
    </td>
  );
}

// ---------------------------------------------------------------------------
// Main DHTable component
// ---------------------------------------------------------------------------

export default function DHTable() {
  const elements = useRobotStore((s) => s.elements);
  const removeElement = useRobotStore((s) => s.removeElement);
  const toggleElementVisibility = useRobotStore((s) => s.toggleElementVisibility);
  const updateJointDHParam = useRobotStore((s) => s.updateJointDHParam);
  const updateJointType = useRobotStore((s) => s.updateJointType);
  const updateJointRotationAxis = useRobotStore((s) => s.updateJointRotationAxis);
  const updateJointFrameAngle = useRobotStore((s) => s.updateJointFrameAngle);
  const updateLinkLength = useRobotStore((s) => s.updateLinkLength);
  const updateLinkDirection = useRobotStore((s) => s.updateLinkDirection);
  const updateElementName = useRobotStore((s) => s.updateElementName);

  if (elements.length === 0) {
    return (
      <div className="text-gray-600 text-xs text-center py-4">
        No elements added yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800/50 text-[11px] text-gray-500 uppercase tracking-wider">
            <th className="text-left py-2 px-2.5 font-medium">Name</th>
            <th className="text-left py-2 px-2.5 font-medium">Type</th>
            <th className="text-right py-2 px-2.5 font-medium">theta</th>
            <th className="text-right py-2 px-2.5 font-medium">d</th>
            <th className="text-right py-2 px-2.5 font-medium">a</th>
            <th className="text-right py-2 px-2.5 font-medium">alpha</th>
            <th className="text-right py-2 px-2.5 font-medium">frame</th>
            <th className="py-2 px-2 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {elements.map((element) => (
            element.elementKind === "link"
              ? <LinkRow key={element.id} element={element} onRemove={() => removeElement(element.id)} onToggleVisibility={() => toggleElementVisibility(element.id)} onUpdateLength={updateLinkLength} onUpdateDirection={updateLinkDirection} onUpdateName={updateElementName} />
              : <JointRow key={element.id} element={element} onRemove={() => removeElement(element.id)} onToggleVisibility={() => toggleElementVisibility(element.id)} onUpdateDHParam={updateJointDHParam} onUpdateType={updateJointType} onUpdateRotationAxis={updateJointRotationAxis} onUpdateFrameAngle={updateJointFrameAngle} onUpdateName={updateElementName} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface JointRowProps {
  element: Joint;
  onRemove: () => void;
  onToggleVisibility: () => void;
  onUpdateDHParam: (id: string, param: keyof DHParameters, value: number) => void;
  onUpdateType: (id: string, type: "revolute" | "prismatic") => void;
  onUpdateRotationAxis: (id: string, axis: "x" | "y" | "z") => void;
  onUpdateFrameAngle: (id: string, angle: number) => void;
  onUpdateName: (id: string, name: string) => void;
}

function JointRow({ element, onRemove, onToggleVisibility, onUpdateDHParam, onUpdateType, onUpdateRotationAxis, onUpdateFrameAngle, onUpdateName }: JointRowProps) {
  const revoluteAroundZOnly = useRobotStore((s) => s.revoluteAroundZOnly);
  const revoluteFrameAxis = useRobotStore((s) => s.revoluteFrameAxis);

  return (
    <tr className="group hover:bg-gray-800/30 transition-colors">
      <EditableNameCell
        name={element.name}
        onCommit={(name) => onUpdateName(element.id, name)}
      />
      <td className="py-2 px-2.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              onUpdateType(
                element.id,
                element.type === "revolute" ? "prismatic" : "revolute",
              )
            }
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
              element.type === "revolute"
                ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                : "bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25"
            }`}
            title="Click to toggle type"
          >
            {element.type === "revolute" ? "R" : "P"}
          </button>
          {element.type === "revolute" && (
            <button
              onClick={() => {
                const next: Record<string, "x" | "y" | "z"> = { x: "y", y: "z", z: "x" };
                onUpdateRotationAxis(element.id, next[element.rotationAxis] ?? "z");
              }}
              className={`text-[9px] font-bold px-1 py-0.5 rounded cursor-pointer transition-colors ${
                element.rotationAxis === "x" ? "bg-red-500/15 text-red-400 hover:bg-red-500/25" :
                element.rotationAxis === "y" ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" :
                "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
              }`}
              title={
                revoluteAroundZOnly
                  ? `Frame ${revoluteFrameAxis.toUpperCase()} aligned to ${element.rotationAxis.toUpperCase()} (same physical rotation)`
                  : `Rotation axis: ${element.rotationAxis.toUpperCase()} (click to cycle)`
              }
            >
              {element.rotationAxis.toUpperCase()}
            </button>
          )}
        </div>
      </td>
      <EditableCell
        value={element.dhParams.theta}
        isDegrees={true}
        isVariable={element.type === "revolute"}
        variableColor="text-amber-400"
        onCommit={(v) => onUpdateDHParam(element.id, "theta" satisfies keyof DHParameters, v)}
      />
      <EditableCell
        value={element.dhParams.d}
        isDegrees={false}
        isVariable={element.type === "prismatic"}
        variableColor="text-cyan-400"
        onCommit={(v) => onUpdateDHParam(element.id, "d" satisfies keyof DHParameters, v)}
      />
      <EditableCell
        value={element.dhParams.a}
        isDegrees={false}
        isVariable={false}
        variableColor=""
        onCommit={(v) => onUpdateDHParam(element.id, "a" satisfies keyof DHParameters, v)}
      />
      <EditableCell
        value={element.dhParams.alpha}
        isDegrees={true}
        isVariable={false}
        variableColor=""
        onCommit={(v) => onUpdateDHParam(element.id, "alpha" satisfies keyof DHParameters, v)}
      />
      <EditableCell
        value={element.frameAngle}
        isDegrees={true}
        isVariable={false}
        variableColor=""
        onCommit={(v) => onUpdateFrameAngle(element.id, v)}
      />
      <td className="py-2 px-2 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <button
            onClick={onToggleVisibility}
            className={`text-xs transition-all p-0.5 rounded ${
              element.hidden
                ? "text-gray-500 hover:text-gray-300 hover:bg-gray-700/40"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/40"
            }`}
            title={element.hidden ? "Show element" : "Hide element"}
          >
            {element.hidden ? <EyeOffIcon /> : <EyeIcon />}
          </button>
          <button
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 text-xs transition-all p-0.5 rounded hover:bg-red-400/10"
            title="Remove element"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

interface LinkRowProps {
  element: Joint;
  onRemove: () => void;
  onToggleVisibility: () => void;
  onUpdateLength: (id: string, length: number) => void;
  onUpdateDirection: (id: string, direction: LinkDirection) => void;
  onUpdateName: (id: string, name: string) => void;
}

function LinkRow({ element, onRemove, onToggleVisibility, onUpdateLength, onUpdateDirection, onUpdateName }: LinkRowProps) {
  const direction = getLinkDirection(element);

  function cycleDirection() {
    const currentIdx = DIRECTION_CYCLE.indexOf(direction);
    const nextIdx = (currentIdx + 1) % DIRECTION_CYCLE.length;
    onUpdateDirection(element.id, DIRECTION_CYCLE[nextIdx]!);
  }

  const dirAxis = element.rotationAxis;
  const dirColorClass =
    dirAxis === "x" ? "bg-red-500/15 text-red-400 hover:bg-red-500/25" :
    dirAxis === "y" ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" :
    "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25";

  return (
    <tr className="group hover:bg-gray-800/30 transition-colors">
      <EditableNameCell
        name={element.name}
        onCommit={(name) => onUpdateName(element.id, name)}
      />
      <td className="py-2 px-2.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400">
            L
          </span>
          <button
            onClick={cycleDirection}
            className={`text-[9px] font-bold px-1 py-0.5 rounded cursor-pointer transition-colors ${dirColorClass}`}
            title={`Direction: ${direction.toUpperCase()} (click to cycle)`}
          >
            {direction.toUpperCase()}
          </button>
        </div>
      </td>
      <EditableLengthCell
        value={element.dhParams.d}
        onCommit={(v) => onUpdateLength(element.id, v)}
      />
      <td className="py-2 px-2.5"></td>
      <td className="py-2 px-2 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <button
            onClick={onToggleVisibility}
            className={`text-xs transition-all p-0.5 rounded ${
              element.hidden
                ? "text-gray-500 hover:text-gray-300 hover:bg-gray-700/40"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/40"
            }`}
            title={element.hidden ? "Show element" : "Hide element"}
          >
            {element.hidden ? <EyeOffIcon /> : <EyeIcon />}
          </button>
          <button
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 text-xs transition-all p-0.5 rounded hover:bg-red-400/10"
            title="Remove element"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

function EyeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.6 6.2A10.4 10.4 0 0 1 12 6c6 0 9.5 6 9.5 6a16.3 16.3 0 0 1-3.2 3.9M6.2 6.2A15.8 15.8 0 0 0 2.5 12s3.5 6 9.5 6c1.4 0 2.7-.3 3.9-.8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
