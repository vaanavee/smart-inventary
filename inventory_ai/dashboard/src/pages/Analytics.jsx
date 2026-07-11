import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";

const PRODUCTS_MAP = {
  "PRD-0412": {
    name: "Bosch GSB 12V Drill · PRD-0412",
    sku: "PRD-0412",
    category: "Power Tools",
    room: "Room 2",
    rack: "A",
    onHand: 34,
    stats: {
      in: 60,
      inReceipts: 3,
      out: 86,
      outPicks: 14,
      transfers: "12 / 12",
      transfersMoves: 4,
      net: -26
    },
    chart: [
      { day: "01", val: 30, isOut: false },
      { day: "02", val: 52, isOut: true },
      { day: "04", val: 70, isOut: false },
      { day: "05", val: 44, isOut: true },
      { day: "07", val: 88, isOut: true },
      { day: "08", val: 36, isOut: true },
      { day: "10", val: 60, isOut: true }
    ],
    whereMoved: [
      { name: "Room 2 · Rack A (home)", badge: "34 on hand", tone: "neutral" },
      { name: "→ Dispatch / Out", badge: "86 out", tone: "danger" },
      { name: "→ Room 1 · Rack D", badge: "12 transfer", tone: "info" },
      { name: "← Inbound receipts", badge: "60 in", tone: "success" }
    ],
    ledger: [
      { time: "10 Jul 09:14", ref: "MOV-004821", type: "OUT", qty: 3, route: "Room 2·A → Dispatch", by: "Vishali Nair", balance: 34 },
      { time: "08 Jul 14:02", ref: "MOV-004790", type: "OUT", qty: 8, route: "Room 2·A → Dispatch", by: "Suraj Menon", balance: 37 },
      { time: "07 Jul 11:20", ref: "MOV-004741", type: "IN", qty: 25, route: "Inbound → Room 2·A", by: "Vishal Kumar", balance: 45 },
      { time: "07 Jul 10:05", ref: "MOV-004738", type: "OUT", qty: 15, route: "Room 2·A → Dispatch", by: "Arjun Das", balance: 20 },
      { time: "05 Jul 15:44", ref: "MOV-004702", type: "Transfer", qty: 12, route: "Room 2·A → Room 1·D", by: "Vaanavee R.", balance: 35 },
      { time: "04 Jul 09:31", ref: "MOV-004660", type: "IN", qty: 35, route: "Inbound → Room 2·A", by: "Vishal Kumar", balance: 47 },
      { time: "02 Jul 16:10", ref: "MOV-004610", type: "OUT", qty: 18, route: "Room 2·A → Dispatch", by: "Vishali Nair", balance: 12 }
    ]
  },
  "PRD-0207": {
    name: "Copper Wire Spool · PRD-0207",
    sku: "PRD-0207",
    category: "Electricals",
    room: "Room 3",
    rack: "C",
    onHand: 42,
    stats: {
      in: 40,
      inReceipts: 2,
      out: 15,
      outPicks: 2,
      transfers: "0 / 0",
      transfersMoves: 0,
      net: 25
    },
    chart: [
      { day: "01", val: 10, isOut: false },
      { day: "02", val: 20, isOut: true },
      { day: "04", val: 50, isOut: false },
      { day: "05", val: 60, isOut: false },
      { day: "07", val: 40, isOut: true },
      { day: "08", val: 20, isOut: false },
      { day: "10", val: 80, isOut: false }
    ],
    whereMoved: [
      { name: "Room 3 · Rack C (home)", badge: "42 on hand", tone: "neutral" },
      { name: "→ Dispatch / Out", badge: "15 out", tone: "danger" },
      { name: "← Inbound receipts", badge: "40 in", tone: "success" }
    ],
    ledger: [
      { time: "10 Jul 11:45", ref: "MOV-004810", type: "OUT", qty: 5, route: "Room 3·C → Dispatch", by: "Vishali Nair", balance: 42 },
      { time: "08 Jul 09:30", ref: "MOV-004780", type: "OUT", qty: 10, route: "Room 3·C → Dispatch", by: "Arjun Das", balance: 47 },
      { time: "07 Jul 15:10", ref: "MOV-004750", type: "IN", qty: 20, route: "Inbound → Room 3·C", by: "Vishal Kumar", balance: 57 },
      { time: "04 Jul 13:40", ref: "MOV-004690", type: "IN", qty: 20, route: "Inbound → Room 3·C", by: "Suraj Menon", balance: 37 }
    ]
  },
  "PRD-0533": {
    name: "LED Panel 18W · PRD-0533",
    sku: "PRD-0533",
    category: "Electricals",
    room: "Room 3",
    rack: "A",
    onHand: 180,
    stats: {
      in: 100,
      inReceipts: 1,
      out: 40,
      outPicks: 2,
      transfers: "20 / 20",
      transfersMoves: 1,
      net: 60
    },
    chart: [
      { day: "01", val: 90, isOut: false },
      { day: "02", val: 40, isOut: true },
      { day: "04", val: 30, isOut: true },
      { day: "05", val: 80, isOut: false },
      { day: "07", val: 70, isOut: false },
      { day: "08", val: 50, isOut: true },
      { day: "10", val: 40, isOut: true }
    ],
    whereMoved: [
      { name: "Room 3 · Rack A (home)", badge: "180 on hand", tone: "neutral" },
      { name: "→ Dispatch / Out", badge: "40 out", tone: "danger" },
      { name: "→ Room 2 · Rack B", badge: "20 transfer", tone: "info" },
      { name: "← Inbound receipts", badge: "100 in", tone: "success" }
    ],
    ledger: [
      { time: "10 Jul 12:14", ref: "MOV-004835", type: "OUT", qty: 6, route: "Room 3·A → Dispatch", by: "Vaanavee R.", balance: 180 },
      { time: "08 Jul 16:50", ref: "MOV-004801", type: "OUT", qty: 34, route: "Room 3·A → Dispatch", by: "Arjun Das", balance: 186 },
      { time: "06 Jul 14:15", ref: "MOV-004722", type: "Transfer", qty: 20, route: "Room 3·A → Room 2·B", by: "Suraj Menon", balance: 220 },
      { time: "05 Jul 10:20", ref: "MOV-004680", type: "IN", qty: 100, route: "Inbound → Room 3·A", by: "Vishal Kumar", balance: 240 }
    ]
  }
};

export default function Analytics() {
  const [selectedSku, setSelectedSku] = useState("PRD-0412");
  const [fromDate, setFromDate] = useState("2026-07-01");
  const [toDate, setToDate] = useState("2026-07-10");
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const handleRunReport = () => {
    setFeedbackMsg(`Report updated for ${selectedSku} · ${fromDate} to ${toDate}`);
    setTimeout(() => setFeedbackMsg(""), 3000);
  };

  // Compile active data including any user local-movements
  const activeData = useMemo(() => {
    const raw = PRODUCTS_MAP[selectedSku];
    if (!raw) return null;

    // Fetch user scans from local-movements
    let localMoves = [];
    try {
      const stored = localStorage.getItem("local-movements");
      if (stored) {
        localMoves = JSON.parse(stored);
      }
    } catch {}

    // Filter local moves that belong to this selected SKU
    const matchingLocal = localMoves.filter((m) => m.ref.includes("MOV") && m.product_name.toLowerCase().includes(raw.ledger[0]?.product_name?.toLowerCase() || raw.sku.toLowerCase()));

    // Assemble dynamic ledger
    let dynamicLedger = [...raw.ledger];
    let netDelta = 0;

    matchingLocal.forEach((lm) => {
      // Avoid duplicates
      if (!dynamicLedger.some(dl => dl.ref === lm.ref)) {
        const isOut = lm.action === "OUT";
        const isIn = lm.action === "IN";
        dynamicLedger.unshift({
          time: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " " + lm.rfid_time,
          ref: lm.ref,
          type: lm.action === "Transfer" ? "Transfer" : lm.action,
          qty: lm.quantity,
          route: lm.action === "Transfer" ? `${lm.room} → Transfer` : isOut ? `${lm.room} → Dispatch` : `Inbound → ${lm.room}`,
          by: lm.employee_name,
          balance: raw.onHand // approximate balance
        });
        if (isOut) netDelta -= lm.quantity;
        if (isIn) netDelta += lm.quantity;
      }
    });

    // Recompute stats
    const updatedStats = {
      in: raw.stats.in + (netDelta > 0 ? netDelta : 0),
      inReceipts: raw.stats.inReceipts + (matchingLocal.some(m => m.action === "IN") ? 1 : 0),
      out: raw.stats.out + (netDelta < 0 ? Math.abs(netDelta) : 0),
      outPicks: raw.stats.outPicks + (matchingLocal.some(m => m.action === "OUT") ? 1 : 0),
      transfers: raw.stats.transfers,
      transfersMoves: raw.stats.transfersMoves + (matchingLocal.some(m => m.action === "Transfer") ? 1 : 0),
      net: raw.stats.net + netDelta
    };

    return {
      ...raw,
      stats: updatedStats,
      ledger: dynamicLedger
    };
  }, [selectedSku]);

  // CSV Exporter
  const handleExportCSV = () => {
    if (!activeData) return;
    const headers = "Date / Time,Ref,Type,Qty,From → To,By,Balance\n";
    const rows = activeData.ledger.map(l => `"${l.time}","${l.ref}","${l.type}",${l.qty},"${l.route}","${l.by}",${l.balance}`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movement_report_${selectedSku}.csv`;
    a.click();
  };

  const handlePrint = () => {
    window.print();
  };

  if (!activeData) return null;

  return (
    <div className="flex flex-col gap-6 font-display">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-400 flex items-center gap-1.5 -mb-2">
        <Link to="/" className="hover:underline text-slate-400">Home</Link>
        <span className="text-slate-300">/</span>
        <span>Reports</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500 font-medium">Movement Report</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 leading-none">Product Movement Report</h1>
          <div className="text-sm text-slate-400 mt-2">
            Search a product + date range · every IN / OUT / Transfer with totals
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
          >
            ⬇ Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
          >
            🖨 Print
          </button>
        </div>
      </div>

      {/* Toolbar Filter Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[240px] flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">Product</label>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="input-field px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white font-medium"
            >
              {Object.values(PRODUCTS_MAP).map(p => (
                <option key={p.sku} value={p.sku}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 w-auto">
            <label className="text-xs font-semibold text-slate-700">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input-field px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium"
            />
          </div>
          <div className="flex flex-col gap-1.5 w-auto">
            <label className="text-xs font-semibold text-slate-700">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input-field px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium"
            />
          </div>
          <button
            onClick={handleRunReport}
            className="px-5 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-semibold rounded-lg transition-colors shadow-soft"
          >
            Run report
          </button>
        </div>

        {feedbackMsg && (
          <div className="mt-3 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 p-2 rounded-lg font-medium animate-fadeIn">
            ✓ {feedbackMsg}
          </div>
        )}
      </div>

      {/* KPI Totals Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Material IN</div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">{activeData.stats.in}</div>
          <div className="text-[10px] text-slate-400 font-semibold mt-1">{activeData.stats.inReceipts} receipts</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Material OUT</div>
          <div className="text-3xl font-bold text-red-500 mt-2">{activeData.stats.out}</div>
          <div className="text-[10px] text-slate-400 font-semibold mt-1">{activeData.stats.outPicks} picks</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Transfers (in / out)</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{activeData.stats.transfers}</div>
          <div className="text-[10px] text-slate-400 font-semibold mt-1">{activeData.stats.transfersMoves} moves</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Net change</div>
          <div className={`text-3xl font-bold mt-2 ${activeData.stats.net >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {activeData.stats.net > 0 ? `+${activeData.stats.net}` : activeData.stats.net}
          </div>
          <div className="text-[10px] text-slate-400 font-semibold mt-1">→ {activeData.onHand} on hand</div>
        </div>
      </div>

      {/* Chart and Location Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* IN vs OUT Bar chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-display font-semibold text-slate-900 text-sm">IN vs OUT by day</h2>
            <div className="flex gap-4 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-primary" /> IN
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-indigo-300" /> OUT
              </span>
            </div>
          </div>

          <div className="flex items-end justify-between h-48 border-b border-slate-100 pb-2 px-2 gap-4">
            {activeData.chart.map((c, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                {/* Bar */}
                <div
                  style={{ height: `${c.val}%` }}
                  className={`w-full max-w-[28px] rounded-t-md transition-all group-hover:opacity-90 ${
                    c.isOut ? "bg-indigo-300" : "bg-primary"
                  }`}
                  title={`${c.val}%`}
                />
                <span className="text-[10px] font-semibold text-slate-400">{c.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Where it moved breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft flex flex-col gap-3 min-h-[258px]">
          <h2 className="font-display font-semibold text-slate-900 text-sm border-b border-slate-100 pb-2.5">Where it moved</h2>
          <div className="flex flex-col divide-y divide-slate-100">
            {activeData.whereMoved.map((loc, idx) => (
              <div key={idx} className="flex justify-between items-center py-2.5">
                <span className="text-xs font-medium text-slate-600">{loc.name}</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 border rounded-full leading-none uppercase ${
                  loc.tone === "success"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                    : loc.tone === "danger"
                    ? "bg-red-50 text-red-600 border-red-100"
                    : loc.tone === "info"
                    ? "bg-blue-50 text-blue-600 border-blue-100"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                }`}>
                  {loc.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ledger Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Movement Ledger · {activeData.name.split(" · ")[0]}
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
            {activeData.sku} · {fromDate} to {toDate}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                <th className="px-5 py-3">Date / Time</th>
                <th className="px-5 py-3">Ref</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Qty</th>
                <th className="px-5 py-3">From → To</th>
                <th className="px-5 py-3">By</th>
                <th className="px-5 py-3">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeData.ledger.map((row) => (
                <tr key={row.ref} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{row.time}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-900">{row.ref}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full leading-none uppercase ${
                      row.type === "IN"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : row.type === "OUT"
                        ? "bg-red-50 text-red-600 border-red-100"
                        : "bg-blue-50 text-blue-600 border-blue-100"
                    }`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-900 font-bold">{row.qty}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-500 font-medium">{row.route}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-900 font-medium">{row.by}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{row.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Showing {activeData.ledger.length} of 21 movements</span>
          <div className="flex gap-1">
            <button className="w-7 h-7 border border-slate-200 rounded flex items-center justify-center bg-primary text-white font-medium">1</button>
            <button className="w-7 h-7 border border-slate-200 rounded flex items-center justify-center hover:bg-slate-50 text-slate-600">2</button>
            <button className="w-7 h-7 border border-slate-200 rounded flex items-center justify-center hover:bg-slate-50 text-slate-600">3</button>
            <button className="w-7 h-7 border border-slate-200 rounded flex items-center justify-center hover:bg-slate-50 text-slate-600">›</button>
          </div>
        </div>
      </div>

      <div className="text-slate-400 mt-2 text-center text-[11px]">
        Static mockup fallback loaded when database connection is inactive · Not a real application.
      </div>
    </div>
  );
}
