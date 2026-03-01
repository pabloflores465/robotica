import { useRef } from "react";
import { useRobotStore } from "../../store/robotStore";
import type { DiagramData } from "../../store/robotStore";
import BaseFrameControls from "./BaseFrameControls";
import DHParameterForm from "./DHParameterForm";
import LinkForm from "./LinkForm";
import DHTable from "./DHTable";
import JointSliders from "./JointSliders";
import TransformPanel from "./TransformPanel";
import logger from "../../core/services/logger";

function exportDiagram(): void {
  const { elements, baseRotation } = useRobotStore.getState();
  const data: DiagramData = {
    version: "1.0.0",
    baseRotation,
    elements: elements.map(({ id: _id, ...rest }) => rest),
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dh-diagram.json";
  a.click();
  URL.revokeObjectURL(url);
}

function validateDiagramData(raw: unknown): DiagramData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.version !== "string") return null;
  if (typeof obj.baseRotation !== "object" || obj.baseRotation === null) return null;
  const br = obj.baseRotation as Record<string, unknown>;
  if (typeof br.x !== "number" || typeof br.y !== "number" || typeof br.z !== "number") return null;
  if (!Array.isArray(obj.elements)) return null;

  for (const el of obj.elements) {
    if (typeof el !== "object" || el === null) return null;
    const e = el as Record<string, unknown>;
    if (typeof e.name !== "string") return null;
    if (e.elementKind !== "joint" && e.elementKind !== "link") return null;
    if (e.type !== "revolute" && e.type !== "prismatic") return null;
    if (typeof e.dhParams !== "object" || e.dhParams === null) return null;
  }

  return raw as DiagramData;
}

export default function Sidebar() {
  const elements = useRobotStore((s) => s.elements);
  const clearAll = useRobotStore((s) => s.clearAll);
  const importDiagram = useRobotStore((s) => s.importDiagram);
  const hasJoints = elements.some((el) => el.elementKind === "joint");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw: unknown = JSON.parse(ev.target?.result as string);
        const data = validateDiagramData(raw);
        if (!data) {
          logger.error("Invalid diagram file format");
          return;
        }
        importDiagram(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        logger.error("Failed to import diagram:", message);
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-imported
    e.target.value = "";
  }

  return (
    <aside className="w-[400px] h-screen flex flex-col bg-gray-950 text-gray-100 border-r border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <h1 className="text-base font-bold text-white tracking-tight">
          DH Kinematics
        </h1>
        <div className="flex items-center gap-1">
          {elements.length > 0 && (
            <button
              onClick={exportDiagram}
              title="Export diagram"
              className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-800 transition-all"
            >
              Export
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Import diagram"
            className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-800 transition-all"
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          {elements.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-red-400/80 hover:text-red-300 px-2 py-1 rounded hover:bg-red-400/10 transition-all"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
        <Section title="Base Frame">
          <BaseFrameControls />
        </Section>

        <Section title="Add Joint" defaultOpen>
          <DHParameterForm />
        </Section>

        <Section title="L" defaultOpen>
          <LinkForm />
        </Section>

        <Section title="Parameters" defaultOpen badge={elements.length > 0 ? `${elements.length}` : undefined}>
          <DHTable />
        </Section>

        {hasJoints && (
          <Section title="Joint Controls" defaultOpen>
            <JointSliders />
          </Section>
        )}

        {elements.length > 0 && (
          <Section title="Transforms">
            <TransformPanel />
          </Section>
        )}
      </div>
    </aside>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

function Section({ title, children, defaultOpen = false, badge }: SectionProps) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex items-center gap-2 py-2.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <svg
          className="w-3.5 h-3.5 text-gray-500 transition-transform group-open:rotate-90"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </span>
        {badge && (
          <span className="text-[10px] font-medium bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </summary>
      <div className="pb-3 pt-1">{children}</div>
    </details>
  );
}
