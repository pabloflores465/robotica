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
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
        Transformation Matrices
      </h3>

      {/* End Effector -- always shown */}
      <MatrixDisplay
        matrix={kinematics.endEffectorTransform}
        label={`T_0^${joints.length} (End Effector)`}
      />

      {/* Individual A_i matrices */}
      <div>
        <button
          onClick={() => setShowIndividual(!showIndividual)}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          {showIndividual ? "[-]" : "[+]"} Individual Matrices (A_i)
        </button>
        {showIndividual && (
          <div className="mt-2 space-y-2">
            {kinematics.individualMatrices.map((matrix, i) => (
              <MatrixDisplay
                key={joints[i]?.id ?? i}
                matrix={matrix}
                label={`A_${i + 1} (${joints[i]?.name ?? `Joint ${i + 1}`})`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cumulative T_0^i matrices */}
      <div>
        <button
          onClick={() => setShowCumulative(!showCumulative)}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          {showCumulative ? "[-]" : "[+]"} Cumulative Matrices (T_0^i)
        </button>
        {showCumulative && (
          <div className="mt-2 space-y-2">
            {kinematics.cumulativeMatrices.map((matrix, i) => (
              <MatrixDisplay
                key={joints[i]?.id ?? i}
                matrix={matrix}
                label={`T_0^${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
