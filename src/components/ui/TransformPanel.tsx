import { useState } from "react";
import { useRobotStore } from "../../store/robotStore";
import MatrixDisplay from "./MatrixDisplay";

export default function TransformPanel() {
  const joints = useRobotStore((s) => s.joints);
  const kinematics = useRobotStore((s) => s.kinematics);
  const [showIndividual, setShowIndividual] = useState(true);
  const [showCumulative, setShowCumulative] = useState(false);

  if (joints.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* End Effector -- always shown */}
      <MatrixDisplay
        matrix={kinematics.endEffectorTransform}
        label={`T_0^${joints.length} (End Effector)`}
        highlight
      />

      {/* Individual A_i matrices */}
      <CollapsibleGroup
        title="Individual Matrices (A_i)"
        open={showIndividual}
        onToggle={() => setShowIndividual(!showIndividual)}
        count={kinematics.individualMatrices.length}
      >
        <div className="space-y-2">
          {kinematics.individualMatrices.map((matrix, i) => (
            <MatrixDisplay
              key={joints[i]?.id ?? i}
              matrix={matrix}
              label={`A_${i + 1} (${joints[i]?.name ?? `Joint ${i + 1}`})`}
            />
          ))}
        </div>
      </CollapsibleGroup>

      {/* Cumulative T_0^i matrices */}
      <CollapsibleGroup
        title="Cumulative Matrices (T_0^i)"
        open={showCumulative}
        onToggle={() => setShowCumulative(!showCumulative)}
        count={kinematics.cumulativeMatrices.length}
      >
        <div className="space-y-2">
          {kinematics.cumulativeMatrices.map((matrix, i) => (
            <MatrixDisplay
              key={joints[i]?.id ?? i}
              matrix={matrix}
              label={`T_0^${i + 1}`}
            />
          ))}
        </div>
      </CollapsibleGroup>
    </div>
  );
}

interface CollapsibleGroupProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  count: number;
  children: React.ReactNode;
}

function CollapsibleGroup({ title, open, onToggle, count, children }: CollapsibleGroupProps) {
  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-3 py-2 bg-gray-800/30 hover:bg-gray-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3 h-3 text-gray-500 transition-transform ${open ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs text-gray-400 font-medium">{title}</span>
        </div>
        <span className="text-[10px] text-gray-600 font-mono">{count}</span>
      </button>
      {open && <div className="p-2 space-y-2">{children}</div>}
    </div>
  );
}
