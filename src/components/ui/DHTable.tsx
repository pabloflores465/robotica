import { useRobotStore } from "../../store/robotStore";

const RAD_TO_DEG = 180 / Math.PI;

export default function DHTable() {
  const joints = useRobotStore((s) => s.joints);
  const removeJoint = useRobotStore((s) => s.removeJoint);

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
            <th className="text-right py-2 px-2.5 font-medium">d</th>
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
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    joint.type === "revolute"
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-cyan-500/15 text-cyan-400"
                  }`}
                >
                  {joint.type === "revolute" ? "R" : "P"}
                </span>
              </td>
              <td
                className={`py-2 px-2.5 text-right font-mono text-xs ${
                  joint.type === "revolute"
                    ? "text-amber-400 font-bold"
                    : "text-gray-400"
                }`}
              >
                {(joint.dhParams.theta * RAD_TO_DEG).toFixed(1)}
              </td>
              <td
                className={`py-2 px-2.5 text-right font-mono text-xs ${
                  joint.type === "prismatic"
                    ? "text-cyan-400 font-bold"
                    : "text-gray-400"
                }`}
              >
                {joint.dhParams.d.toFixed(2)}
              </td>
              <td className="py-2 px-2.5 text-right font-mono text-xs text-gray-400">
                {joint.dhParams.a.toFixed(2)}
              </td>
              <td className="py-2 px-2.5 text-right font-mono text-xs text-gray-400">
                {(joint.dhParams.alpha * RAD_TO_DEG).toFixed(1)}
              </td>
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
