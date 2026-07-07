import { useEffect, useState } from "react";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Camera,
  UserCheck,
  Box,
} from "lucide-react";
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line, Pie } from "react-chartjs-2";
import StatCard from "../components/StatCard.jsx";
import Badge from "../components/Badge.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { api } from "../api/client.js";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, ArcElement, Tooltip, Legend);

const lineOptions = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: "#6B7280", font: { family: "Poppins" } }, grid: { display: false } },
    y: { ticks: { color: "#6B7280", font: { family: "Poppins" } }, grid: { color: "rgba(128,134,146,0.15)" } },
  },
};

const pieOptions = {
  responsive: true,
  plugins: { legend: { position: "bottom", labels: { color: "#6B7280", font: { family: "Poppins" }, boxWidth: 10, padding: 16 } } },
};

const STATUS_TONE = {
  VERIFIED: "success",
  WRONG_PRODUCT: "danger",
  MISSING_PRODUCT: "warning",
  EXTRA_PRODUCT: "info",
  UNEXPECTED_PRODUCT: "violet",
  MIXED_PRODUCTS: "violet",
};

export default function Home() {
  const [accuracy, setAccuracy] = useState(null);
  const [mismatch, setMismatch] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [recent, setRecent] = useState([]);
  const [cameraStatus, setCameraStatus] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [daily, setDaily] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    api.get("/analytics/accuracy").then(setAccuracy).catch(() => {});
    api.get("/analytics/mismatch-percentage").then(setMismatch).catch(() => {});
    api.get("/inventory/low-stock").then(setLowStock).catch(() => {});
    api.get("/alerts?resolved=false&limit=10").then(setAlerts).catch(() => {});
    api.get("/history?limit=8").then(setRecent).catch(() => {});
    api.get("/live/status").then(setCameraStatus).catch(() => {});
    api.get("/workers").then(setWorkers).catch(() => {});
    api.get("/analytics/daily-verifications").then(setDaily).catch(() => {});
    api.get("/analytics/status-breakdown").then(setStatusBreakdown).catch(() => {});
    api.get("/analytics/top-products").then(setTopProducts).catch(() => {});
  }, []);

  const dailyData = {
    labels: daily.map((d) => d.date),
    datasets: [
      {
        label: "Verifications",
        data: daily.map((d) => d.count),
        borderColor: "#FF6B00",
        backgroundColor: "rgba(255,107,0,0.08)",
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  };

  const pieColors = ["#22C55E", "#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6", "#FF6B00"];
  const pieData = {
    labels: statusBreakdown.map((s) => s.status.replace(/_/g, " ")),
    datasets: [{ data: statusBreakdown.map((s) => s.count), backgroundColor: pieColors, borderWidth: 0 }],
  };

  const maxTopProduct = Math.max(1, ...topProducts.map((p) => p.count));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Overview" subtitle="Real-time inventory verification at a glance" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5 stagger">
        <StatCard
          icon={ClipboardCheck}
          tone="primary"
          label="Total Verifications"
          value={accuracy?.total ?? "—"}
          trend={accuracy ? accuracy.accuracy_percent - 90 : null}
        />
        <StatCard
          icon={CheckCircle2}
          tone="success"
          label="Verified"
          value={accuracy?.verified ?? "—"}
          sub={accuracy ? `${accuracy.accuracy_percent}% accuracy` : ""}
        />
        <StatCard
          icon={AlertTriangle}
          tone="warning"
          label="Mismatches"
          value={mismatch?.mismatches ?? "—"}
          sub={mismatch ? `${mismatch.mismatch_percent}% of total` : ""}
        />
        <StatCard
          icon={Camera}
          tone="violet"
          label="Camera Status"
          value={cameraStatus?.connected ? "Online" : "Offline"}
          sub={cameraStatus ? `${cameraStatus.fps} FPS` : ""}
        />
        <StatCard
          icon={UserCheck}
          tone="info"
          label="Today's Workers"
          value={workers.length || "—"}
          sub="Active this shift"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink">Low Stock</h3>
            <Badge tone="warning">{lowStock.length} items</Badge>
          </div>

          {lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-primary/10 flex items-center justify-center mb-3">
                <Box size={32} className="text-primary" strokeWidth={1.5} />
              </div>
              <p className="text-sm text-muted">All stock levels are healthy.</p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline/[0.05]">
              {lowStock.slice(0, 6).map((p) => (
                <li key={p.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Box size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                      <p className="text-xs text-muted">Box {p.box_number}</p>
                    </div>
                  </div>
                  <Badge tone="warning">
                    {p.current_stock}/{p.minimum_stock}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink">Active Alerts</h3>
            <Badge tone="danger">{alerts.length} open</Badge>
          </div>

          {alerts.length === 0 ? (
            <p className="text-sm text-muted py-10 text-center">No active alerts. Everything looks great.</p>
          ) : (
            <ul className="flex flex-col gap-4 relative">
              {alerts.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                        a.severity === "critical" ? "bg-danger" : "bg-warning"
                      }`}
                    />
                    <span className="w-px flex-1 bg-hairline/[0.06] mt-1" />
                  </div>
                  <div className="pb-1">
                    <p className="text-sm text-ink">{a.message}</p>
                    <p className="text-xs text-muted mt-0.5 capitalize">{a.severity}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-semibold text-ink mb-4">Daily Verifications</h3>
          <Line data={dailyData} options={lineOptions} height={90} />
        </div>
        <div className="card p-6">
          <h3 className="font-semibold text-ink mb-4">Verification Breakdown</h3>
          <Pie data={pieData} options={pieOptions} />
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-ink mb-5">Top Products</h3>
        <div className="flex flex-col gap-4">
          {topProducts.slice(0, 6).map((p) => (
            <div key={p.product}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-ink font-medium">{p.product}</span>
                <span className="text-muted">{p.count}</span>
              </div>
              <ProgressBar value={p.count} max={maxTopProduct} />
            </div>
          ))}
          {topProducts.length === 0 && <p className="text-sm text-muted">No product data yet.</p>}
        </div>
      </div>

      <div className="card p-6 overflow-x-auto">
        <h3 className="font-semibold text-ink mb-4">Recent Transactions</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted text-xs uppercase tracking-wide">
              <th className="pb-3 font-medium">ID</th>
              <th className="pb-3 font-medium">Product</th>
              <th className="pb-3 font-medium">Expected</th>
              <th className="pb-3 font-medium">Detected</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((t) => (
              <tr key={t.id} className="border-t border-hairline/[0.05] hover:bg-hairline/[0.02] transition-colors">
                <td className="py-3 text-muted">#{t.id}</td>
                <td className="py-3 text-ink font-medium">{t.product_id}</td>
                <td className="py-3">{t.expected_quantity}</td>
                <td className="py-3">{t.detected_quantity}</td>
                <td className="py-3">
                  <Badge tone={STATUS_TONE[t.verification_status] || "neutral"}>
                    {t.verification_status.replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="py-3 text-muted">{(t.confidence_score * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
