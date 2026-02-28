import { useRobotStore } from "../../store/robotStore";

const RAD_TO_DEG = 180 / Math.PI;

export default function JointSliders() {
  const joints = useRobotStore((s) => s.joints);
  const updateJointVariable = useRobotStore((s) => s.updateJointVariable);

  if (joints.length === 0) return null;

  return (
    <div className="space-y-3">
      {joints.map((joint, i) => {
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
                  Joint {i + 1}
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  ({paramName})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-200 font-mono tabular-nums">
                  {displayValue.toFixed(1)}
                </span>
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
