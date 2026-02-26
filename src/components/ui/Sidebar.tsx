import { useRobotStore } from "../../store/robotStore";
import DHParameterForm from "./DHParameterForm";
import DHTable from "./DHTable";
import JointSliders from "./JointSliders";
import TransformPanel from "./TransformPanel";

export default function Sidebar() {
  const joints = useRobotStore((s) => s.joints);
  const clearJoints = useRobotStore((s) => s.clearJoints);

  return (
    <div className="w-[420px] h-screen overflow-y-auto bg-gray-900 text-gray-100 p-4 space-y-6 border-r border-gray-700">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">
          DH Kinematics
        </h1>
        {joints.length > 0 && (
          <button
            onClick={clearJoints}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      <DHParameterForm />

      <div className="border-t border-gray-700 pt-4">
        <DHTable />
      </div>

      <div className="border-t border-gray-700 pt-4">
        <JointSliders />
      </div>

      <div className="border-t border-gray-700 pt-4">
        <TransformPanel />
      </div>
    </div>
  );
}
