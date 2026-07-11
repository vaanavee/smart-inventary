import { CctvTab } from "./Monitoring.jsx";

export default function Home() {
  return (
    <div className="flex flex-col gap-6 font-display">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 leading-none">Live Video Feed</h1>
        <div className="text-sm text-slate-400 mt-2">
          Real-time visual monitoring powered by RT-DETRv2 (Product Counting) and employee door cross-checking
        </div>
      </div>

      <CctvTab />
    </div>
  );
}
