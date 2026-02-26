import { useRobotStore } from "../../store/robotStore";

const RAD_TO_DEG = 180 / Math.PI;

export default function DHTable() {
  const joints = useRobotStore((s) => s.joints);
  const removeJoint = useRobotStore((s) => s.removeJoint);

  if (joints.length === 0) {
    return (
      <div className="text-gray-500 text-sm italic">
        No joints added yet. Use the form above to add joints.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
        DH Parameter Table
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-gray-400 text-xs">
              <th className="text-left py-1 px-2">#</th>
              <th className="text-left py-1 px-2">Type</th>
              <th className="text-right py-1 px-2">theta</th>
              <th className="text-right py-1 px-2">d</th>
              <th className="text-right py-1 px-2">a</th>
              <th className="text-right py-1 px-2">alpha</th>
              <th className="py-1 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {joints.map((joint, i) => (
              <tr
                key={joint.id}
                className="border-t border-gray-700 hover:bg-gray-800/50"
              >
                <td className="py-1.5 px-2 text-gray-400">{i + 1}</td>
                <td className="py-1.5 px-2">
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      joint.type === "revolute"
                        ? "bg-amber-900/50 text-amber-400"
                        : "bg-cyan-900/50 text-cyan-400"
                    }`}
                  >
                    {joint.type === "revolute" ? "R" : "P"}
                  </span>
                </td>
                <td
                  className={`py-1.5 px-2 text-right font-mono ${
                    joint.type === "revolute"
                      ? "text-amber-400 font-bold"
                      : "text-gray-300"
                  }`}
                >
                  {(joint.dhParams.theta * RAD_TO_DEG).toFixed(1)}
                </td>
                <td
                  className={`py-1.5 px-2 text-right font-mono ${
                    joint.type === "prismatic"
                      ? "text-cyan-400 font-bold"
                      : "text-gray-300"
                  }`}
                >
                  {joint.dhParams.d.toFixed(2)}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-gray-300">
                  {joint.dhParams.a.toFixed(2)}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-gray-300">
                  {(joint.dhParams.alpha * RAD_TO_DEG).toFixed(1)}
                </td>
                <td className="py-1.5 px-2 text-center">
                  <button
                    onClick={() => removeJoint(joint.id)}
                    className="text-red-400 hover:text-red-300 text-xs"
                    title="Remove joint"
                  >
                    X
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
