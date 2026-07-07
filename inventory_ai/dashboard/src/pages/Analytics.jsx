import { useEffect, useState } from "react";
import { TrendingUp, Target, Award, Activity } from "lucide-react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";
import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import { api } from "../api/client.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Filler, Tooltip, Legend);

const gridColor = "rgba(128,134,146,0.15)";
const tickColor = "#6B7280";
const font = { family: "Poppins", size: 11 };

const baseOptions = {
  responsive: true,
  plugins: { legend: { labels: { color: tickColor, font } } },
  scales: {
    x: { ticks: { color: tickColor, font }, grid: { display: false } },
    y: { ticks: { color: tickColor, font }, grid: { color: gridColor } },
  },
};

export default function Analytics() {
  const [daily, setDaily] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [stockMovement, setStockMovement] = useState([]);
  const [accuracy, setAccuracy] = useState(null);
  const [mismatch, setMismatch] = useState(null);

  useEffect(() => {
    api.get("/analytics/daily-verifications").then(setDaily).catch(() => {});
    api.get("/analytics/top-products").then(setTopProducts).catch(() => {});
    api.get("/analytics/status-breakdown").then(setStatusBreakdown).catch(() => {});
    api.get("/analytics/stock-movement").then(setStockMovement).catch(() => {});
    api.get("/analytics/accuracy").then(setAccuracy).catch(() => {});
    api.get("/analytics/mismatch-percentage").then(setMismatch).catch(() => {});
  }, []);

  const dailyData = {
    labels: daily.map((d) => d.date),
    datasets: [
      {
        label: "Verifications",
        data: daily.map((d) => d.count),
        borderColor: "#FF6B00",
        backgroundColor: "rgba(255,107,0,0.12)",
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  };

  const topProductsData = {
    labels: topProducts.map((p) => p.product),
    datasets: [
      {
        label: "Frequency",
        data: topProducts.map((p) => p.count),
        backgroundColor: "#FF6B00",
        borderRadius: 8,
        maxBarThickness: 28,
      },
    ],
  };

  const pieColors = ["#22C55E", "#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6", "#FF6B00"];
  const statusData = {
    labels: statusBreakdown.map((s) => s.status.replace(/_/g, " ")),
    datasets: [{ data: statusBreakdown.map((s) => s.count), backgroundColor: pieColors, borderWidth: 0 }],
  };

  const stockData = {
    labels: stockMovement.map((s) => s.product),
    datasets: [
      {
        label: "Current Stock",
        data: stockMovement.map((s) => s.current_stock),
        backgroundColor: "#8B5CF6",
        borderRadius: 8,
        maxBarThickness: 28,
      },
    ],
  };

  const mostVerified = topProducts[0]?.product ?? "—";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Analytics" subtitle="Verification performance and inventory trends" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 stagger">
        <StatCard icon={Target} tone="primary" label="Accuracy" value={accuracy ? `${accuracy.accuracy_percent}%` : "—"} />
        <StatCard
          icon={TrendingUp}
          tone="success"
          label="Verification Success Rate"
          value={accuracy ? `${(100 - (mismatch?.mismatch_percent ?? 0)).toFixed(1)}%` : "—"}
        />
        <StatCard icon={Activity} tone="warning" label="Mismatch Rate" value={mismatch ? `${mismatch.mismatch_percent}%` : "—"} />
        <StatCard icon={Award} tone="violet" label="Most Verified Product" value={mostVerified} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-semibold text-ink mb-4">Daily Verifications</h3>
          <Line data={dailyData} options={baseOptions} />
        </div>
        <div className="card p-6">
          <h3 className="font-semibold text-ink mb-4">Verification Status Breakdown</h3>
          <Pie
            data={statusData}
            options={{ responsive: true, plugins: { legend: { position: "bottom", labels: { color: tickColor, font, boxWidth: 10, padding: 14 } } } }}
          />
        </div>
        <div className="card p-6">
          <h3 className="font-semibold text-ink mb-4">Top Products (Frequency)</h3>
          <Bar data={topProductsData} options={baseOptions} />
        </div>
        <div className="card p-6">
          <h3 className="font-semibold text-ink mb-4">Lowest Stock Movement</h3>
          <Bar data={stockData} options={baseOptions} />
        </div>
      </div>
    </div>
  );
}
