import { useRobotStore } from "../../store/robotStore";
import BaseFrameControls from "./BaseFrameControls";
import DHParameterForm from "./DHParameterForm";
import DHTable from "./DHTable";
import JointSliders from "./JointSliders";
import TransformPanel from "./TransformPanel";

export default function Sidebar() {
  const joints = useRobotStore((s) => s.joints);
  const clearJoints = useRobotStore((s) => s.clearJoints);

  return (
    <aside className="w-[400px] h-screen flex flex-col bg-gray-950 text-gray-100 border-r border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <h1 className="text-base font-bold text-white tracking-tight">
          DH Kinematics
        </h1>
        {joints.length > 0 && (
          <button
            onClick={clearJoints}
            className="text-xs text-red-400/80 hover:text-red-300 px-2 py-1 rounded hover:bg-red-400/10 transition-all"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
        <Section title="Base Frame">
          <BaseFrameControls />
        </Section>

        <Section title="Add Joint" defaultOpen>
          <DHParameterForm />
        </Section>

        <Section title="Parameters" defaultOpen badge={joints.length > 0 ? `${joints.length}` : undefined}>
          <DHTable />
        </Section>

        {joints.length > 0 && (
          <Section title="Joint Controls" defaultOpen>
            <JointSliders />
          </Section>
        )}

        {joints.length > 0 && (
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
