import { useState, useRef, useEffect, useCallback } from "react";
import { useRobotStore } from "../../store/robotStore";
import type { DHParameters, Joint, LinkDirection, DHFrameAssignment } from "../../core/types/robot";

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

function getLinkDirection(element: Joint, useIntended = false): LinkDirection {
  if (useIntended && element.intendedDirection) return element.intendedDirection;
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

interface EditableLengthCellProps {
  value: number;
  onCommit: (value: number) => void;
  compact?: boolean;
}

function EditableLengthCell({ value, onCommit, compact }: EditableLengthCellProps) {
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

  if (compact) {
    if (editing) {
      return (
        <input
          ref={inputRef}
          type="number"
          step="any"
          min="0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="w-16 bg-gray-800 border border-teal-500 rounded px-1.5 py-0.5 text-xs font-mono text-gray-200 text-right focus:outline-none focus:ring-1 focus:ring-teal-500/30"
        />
      );
    }
    return (
      <button
        onClick={startEdit}
        className="font-mono text-xs text-teal-400 cursor-pointer hover:bg-gray-700/40 rounded px-1 py-0.5 transition-colors"
        title="Click to edit length"
      >
        {Math.abs(value).toFixed(2)}
      </button>
    );
  }

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
// Read-only cell for auto-DH mode
// ---------------------------------------------------------------------------

function ReadOnlyCell({
  value,
  isDegrees,
  isVariable,
  isInvariant,
}: {
  value: number;
  isDegrees: boolean;
  isVariable: boolean;
  isInvariant: boolean;
}) {
  const displayValue = isDegrees ? (value * RAD_TO_DEG).toFixed(1) : value.toFixed(2);

  const colorClass = isVariable
    ? "text-indigo-400 font-bold"
    : isInvariant
      ? "text-gray-500"
      : "text-gray-400";

  return (
    <td
      className={`py-2 px-2.5 text-right font-mono text-xs ${colorClass}`}
      title={
        isVariable
          ? "Variable (offset)"
          : isInvariant
            ? "Invariant across frame options"
            : "Auto-computed"
      }
    >
      <span className="flex items-center justify-end gap-1">
        {isInvariant && (
          <svg className="w-2.5 h-2.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        )}
        {displayValue}
      </span>
    </td>
  );
}

// ---------------------------------------------------------------------------
// Auto-DH table
// ---------------------------------------------------------------------------

function AutoDHTable() {
  const autoResult = useRobotStore((s) => s.autoResult);
  const selectFrameOption = useRobotStore((s) => s.selectFrameOption);

  if (!autoResult || autoResult.assignments.length === 0) {
    return (
      <div className="text-gray-600 text-xs text-center py-4">
        No joints to assign frames to.
      </div>
    );
  }

  const { assignments, toolTransform } = autoResult;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50 text-[11px] text-gray-500 uppercase tracking-wider">
              <th className="text-left py-2 px-2.5 font-medium">Frame</th>
              <th className="text-left py-2 px-2.5 font-medium">Axes</th>
              <th className="text-right py-2 px-2.5 font-medium">theta</th>
              <th className="text-right py-2 px-2.5 font-medium">d</th>
              <th className="text-right py-2 px-2.5 font-medium">a</th>
              <th className="text-right py-2 px-2.5 font-medium">alpha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {assignments.map((assignment, i) => (
              <AutoDHRow
                key={i}
                index={i}
                assignment={assignment}
                isEndEffector={assignment.isEndEffector ?? false}
                onSelectOption={(optionId) => selectFrameOption(i, optionId)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Tool transform info */}
      {!toolTransform.isDHCompatible && (
        <div className="text-[10px] text-amber-400/80 bg-amber-500/10 rounded px-2.5 py-1.5 border border-amber-500/20">
          End-effector has a non-DH y-component ({toolTransform.localDisplacement.y.toFixed(3)}m).
          Tool transform shown separately.
        </div>
      )}
    </div>
  );
}

function AutoDHRow({
  index,
  assignment,
  isEndEffector,
  onSelectOption,
}: {
  index: number;
  assignment: DHFrameAssignment;
  isEndEffector: boolean;
  onSelectOption: (optionId: string) => void;
}) {
  const { dhParams, axisRelation, frameLocked, options, selectedOptionId } = assignment;

  const relationLabel: Record<string, string> = {
    skew: "Skew",
    parallel: "Par",
    intersecting: "Int",
    collinear: "Col",
  };

  const relationColor: Record<string, string> = {
    skew: "bg-purple-500/15 text-purple-400",
    parallel: "bg-blue-500/15 text-blue-400",
    intersecting: "bg-orange-500/15 text-orange-400",
    collinear: "bg-teal-500/15 text-teal-400",
  };

  // Determine invariants from first option (all options share the same invariants)
  const inv = options.length > 0
    ? options[0]!.invariants
    : { aConstant: true, alphaConstant: true, dVaries: false, thetaVaries: false };

  // The variable param is theta for revolute, d for prismatic
  // In auto-DH mode, the synthesized elements determine which is variable
  const autoElements = useRobotStore((s) => s.autoElements);
  const autoEl = autoElements[index];
  const isRevolute = autoEl ? autoEl.type === "revolute" : true;

  return (
    <>
      <tr className="group hover:bg-gray-800/30 transition-colors">
        {/* Frame label */}
        <td className="py-2 px-2.5 text-xs text-gray-400">
          <span className="font-medium">
            {isEndEffector ? "EE" : `${index}`}
          </span>
        </td>

        {/* Axis relation badge */}
        <td className="py-2 px-2.5">
          <div className="flex items-center gap-1">
            {index > 0 && !isEndEffector && (
              <span
                className={`text-[9px] font-bold px-1 py-0.5 rounded ${relationColor[axisRelation] ?? ""}`}
                title={assignment.ruleDescription}
              >
                {relationLabel[axisRelation] ?? axisRelation}
              </span>
            )}
            {frameLocked && !isEndEffector && index > 0 && (
              <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            )}
          </div>
        </td>

        {/* DH parameters */}
        <ReadOnlyCell
          value={dhParams.theta}
          isDegrees={true}
          isVariable={isRevolute}
          isInvariant={!inv.thetaVaries && !isRevolute}
        />
        <ReadOnlyCell
          value={dhParams.d}
          isDegrees={false}
          isVariable={!isRevolute}
          isInvariant={!inv.dVaries && isRevolute}
        />
        <ReadOnlyCell
          value={dhParams.a}
          isDegrees={false}
          isVariable={false}
          isInvariant={inv.aConstant}
        />
        <ReadOnlyCell
          value={dhParams.alpha}
          isDegrees={true}
          isVariable={false}
          isInvariant={inv.alphaConstant}
        />
      </tr>

      {/* Option selector row (only if frame is not locked and has options) */}
      {!frameLocked && options.length > 1 && !isEndEffector && (
        <tr className="bg-gray-900/30">
          <td colSpan={6} className="py-1.5 px-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-gray-600 mr-0.5">x_{index}:</span>
              {options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onSelectOption(opt.id)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    selectedOptionId === opt.id
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                      : "text-gray-500 hover:text-gray-300 hover:bg-gray-800 border border-transparent"
                  }`}
                  title={opt.description}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Simplified elements list for auto mode (shows name, type, delete button)
// ---------------------------------------------------------------------------

function ElementsList() {
  const elements = useRobotStore((s) => s.elements);
  const removeElement = useRobotStore((s) => s.removeElement);
  const updateElementName = useRobotStore((s) => s.updateElementName);
  const updateLinkLength = useRobotStore((s) => s.updateLinkLength);
  const updateLinkDirection = useRobotStore((s) => s.updateLinkDirection);

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
            <th className="text-right py-2 px-2.5 font-medium">Value</th>
            <th className="py-2 px-2 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {elements.map((element) => (
            <ElementRow
              key={element.id}
              element={element}
              onRemove={() => removeElement(element.id)}
              onUpdateName={updateElementName}
              onUpdateLength={updateLinkLength}
              onUpdateDirection={updateLinkDirection}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ElementRow({
  element,
  onRemove,
  onUpdateName,
  onUpdateLength,
  onUpdateDirection,
}: {
  element: Joint;
  onRemove: () => void;
  onUpdateName: (id: string, name: string) => void;
  onUpdateLength: (id: string, length: number) => void;
  onUpdateDirection: (id: string, direction: LinkDirection) => void;
}) {
  const isLink = element.elementKind === "link";
  const isRevolute = element.type === "revolute";
  const direction = isLink ? getLinkDirection(element, true) : null;
  const dirAxis = direction ? (direction.charAt(1) as "x" | "y" | "z") : null;

  return (
    <tr className="group hover:bg-gray-800/30 transition-colors">
      <EditableNameCell
        name={element.name}
        onCommit={(name) => onUpdateName(element.id, name)}
      />
      <td className="py-2 px-2.5">
        <div className="flex items-center gap-1">
          {isLink ? (
            <>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400">
                L
              </span>
              {direction && dirAxis && (
                <button
                  onClick={() => {
                    const currentIdx = DIRECTION_CYCLE.indexOf(direction);
                    const nextIdx = (currentIdx + 1) % DIRECTION_CYCLE.length;
                    onUpdateDirection(element.id, DIRECTION_CYCLE[nextIdx]!);
                  }}
                  className={`text-[9px] font-bold px-1 py-0.5 rounded cursor-pointer transition-colors ${
                    dirAxis === "x" ? "bg-red-500/15 text-red-400 hover:bg-red-500/25" :
                    dirAxis === "y" ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" :
                    "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
                  }`}
                  title={`Direction: ${direction.toUpperCase()} (click to cycle)`}
                >
                  {direction.toUpperCase()}
                </button>
              )}
            </>
          ) : (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                isRevolute
                  ? "bg-amber-500/15 text-amber-400"
                  : "bg-cyan-500/15 text-cyan-400"
              }`}
            >
              {isRevolute ? "R" : "P"}
            </span>
          )}
        </div>
      </td>
      <td className="py-2 px-2.5 text-right">
        {isLink ? (
          <EditableLengthCell
            value={element.intendedDirection
              ? Math.sqrt(element.dhParams.d * element.dhParams.d + element.dhParams.a * element.dhParams.a)
              : element.dhParams.d}
            onCommit={(v) => onUpdateLength(element.id, v)}
            compact
          />
        ) : (
          <span className="text-[10px] text-gray-600 font-mono">--</span>
        )}
      </td>
      <td className="py-2 px-2 text-center">
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 text-xs transition-all p-0.5 rounded hover:bg-red-400/10"
          title="Remove element"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main DHTable component (switches between manual and auto)
// ---------------------------------------------------------------------------

export default function DHTable() {
  const autoDHMode = useRobotStore((s) => s.autoDHMode);

  if (autoDHMode) {
    return (
      <div className="space-y-3">
        <ElementsList />
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1.5">
            Auto-DH Frames
          </div>
          <AutoDHTable />
        </div>
      </div>
    );
  }

  return <ManualDHTable />;
}

function ManualDHTable() {
  const elements = useRobotStore((s) => s.elements);
  const removeElement = useRobotStore((s) => s.removeElement);
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
              ? <LinkRow key={element.id} element={element} onRemove={() => removeElement(element.id)} onUpdateLength={updateLinkLength} onUpdateDirection={updateLinkDirection} onUpdateName={updateElementName} />
              : <JointRow key={element.id} element={element} onRemove={() => removeElement(element.id)} onUpdateDHParam={updateJointDHParam} onUpdateType={updateJointType} onUpdateRotationAxis={updateJointRotationAxis} onUpdateFrameAngle={updateJointFrameAngle} onUpdateName={updateElementName} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface JointRowProps {
  element: Joint;
  onRemove: () => void;
  onUpdateDHParam: (id: string, param: keyof DHParameters, value: number) => void;
  onUpdateType: (id: string, type: "revolute" | "prismatic") => void;
  onUpdateRotationAxis: (id: string, axis: "x" | "y" | "z") => void;
  onUpdateFrameAngle: (id: string, angle: number) => void;
  onUpdateName: (id: string, name: string) => void;
}

function JointRow({ element, onRemove, onUpdateDHParam, onUpdateType, onUpdateRotationAxis, onUpdateFrameAngle, onUpdateName }: JointRowProps) {
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
              title={`Rotation axis: ${element.rotationAxis.toUpperCase()} (click to cycle)`}
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
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 text-xs transition-all p-0.5 rounded hover:bg-red-400/10"
          title="Remove element"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

interface LinkRowProps {
  element: Joint;
  onRemove: () => void;
  onUpdateLength: (id: string, length: number) => void;
  onUpdateDirection: (id: string, direction: LinkDirection) => void;
  onUpdateName: (id: string, name: string) => void;
}

function LinkRow({ element, onRemove, onUpdateLength, onUpdateDirection, onUpdateName }: LinkRowProps) {
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
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 text-xs transition-all p-0.5 rounded hover:bg-red-400/10"
          title="Remove element"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
