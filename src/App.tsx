import Sidebar from "./components/ui/Sidebar";
import RobotScene from "./components/scene/RobotScene";

export default function App() {
  return (
    <div className="flex h-screen w-screen">
      <Sidebar />
      <div className="flex-1 h-screen">
        <RobotScene />
      </div>
    </div>
  );
}
