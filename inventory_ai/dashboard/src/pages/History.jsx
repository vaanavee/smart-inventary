import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { api } from "../api/client.js";

const STATUS_TONE = {
  VERIFIED: "success",
  WRONG_PRODUCT: "danger",
  MISSING_PRODUCT: "warning",
  EXTRA_PRODUCT: "info",
  UNEXPECTED_PRODUCT: "violet",
  MIXED_PRODUCTS: "violet",
};

const STATUSES = [
  "",
  "VERIFIED",
  "WRONG_PRODUCT",
  "MISSING_PRODUCT",
  "EXTRA_PRODUCT",
  "UNEXPECTED_PRODUCT",
  "MIXED_PRODUCTS",
];

export default function History() {
  const [transactions, setTransactions] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const query = status ? `?status=${status}&limit=200` : "?limit=200";
    api.get(`/history${query}`).then(setTransactions).catch(() => {});
  }, [status]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Verification History"
        subtitle={`${transactions.length} records`}
        actions={
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field w-auto">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? s.replace(/_/g, " ") : "All Statuses"}
              </option>
            ))}
          </select>
        }
      />

      <div className="card p-6">
        <ul className="flex flex-col">
          {transactions.map((t, i) => (
            <li key={t.id} className="flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor:
                      { success: "#22C55E", danger: "#EF4444", warning: "#F59E0B", info: "#3B82F6", violet: "#8B5CF6", neutral: "#9CA3AF" }[
                        STATUS_TONE[t.verification_status] || "neutral"
                      ],
                  }}
                />
                {i !== transactions.length - 1 && <span className="w-px flex-1 bg-hairline/[0.06] mt-1" />}
              </div>

              <div className="flex-1 pb-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-ink">Transaction #{t.id}</span>
                    <Badge tone={STATUS_TONE[t.verification_status] || "neutral"}>
                      {t.verification_status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted">{new Date(t.timestamp).toLocaleString()}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2 text-xs text-muted">
                  <span>Worker #{t.worker_id}</span>
                  <span>Product #{t.product_id}</span>
                  <span>Expected {t.expected_quantity}</span>
                  <span>Detected {t.detected_quantity}</span>
                </div>

                <div className="mt-3 max-w-xs flex items-center gap-2">
                  <ProgressBar value={t.confidence_score * 100} max={100} tone="primary" height="h-1.5" />
                  <span className="text-xs text-muted whitespace-nowrap">{(t.confidence_score * 100).toFixed(0)}%</span>
                </div>
              </div>
            </li>
          ))}
          {transactions.length === 0 && <li className="text-sm text-muted py-8 text-center">No records found.</li>}
        </ul>
      </div>
    </div>
  );
}
