import { useRobotStore } from "../../store/robotStore";

const RAD_TO_DEG = 180 / Math.PI;

export default function JointSliders() {
  const joints = useRobotStore((s) => s.joints);
  const updateJointVariable = useRobotStore((s) => s.updateJointVariable);

  if (joints.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
        Joint Controls
      </h3>
      {joints.map((joint, i) => {
        const isRevolute = joint.type === "revolute";
        const displayValue = isRevolute
          ? joint.variableValue * RAD_TO_DEG
          : joint.variableValue;
        const unit = isRevolute ? "deg" : "m";

        return (
          <div key={joint.id} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">
                Joint {i + 1}{" "}
                <span
                  className={
                    isRevolute ? "text-amber-400" : "text-cyan-400"
                  }
                >
                  ({isRevolute ? "theta" : "d"})
                </span>
              </span>
              <span className="text-gray-300 font-mono">
                {displayValue.toFixed(1)}{unit}
              </span>
            </div>
            <input
              type="range"
              min={joint.minLimit}
              max={joint.maxLimit}
              step={isRevolute ? 0.01 : 0.01}
              value={joint.variableValue}
              onInput={(e) =>
                updateJointVariable(
                  joint.id,
                  Number((e.target as HTMLInputElement).value),
                )
              }
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        );
      })}
    </div>
  );
}
