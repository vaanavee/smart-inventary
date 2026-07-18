import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Download, Plus, Users, Radio, Cpu, Contact } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import { api } from "../api/client.js";
import { monitorApi } from "../api/monitorClient.js";

const TABS = [
  { id: "directory", label: "Directory", icon: Users },
  { id: "employee360", label: "Employee 360", icon: Contact },
  { id: "rfid", label: "RFID Activity", icon: Radio },
  { id: "device", label: "Device Admin", icon: Cpu },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function initials(name) {
  if (!name || typeof name !== "string") return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [tab, setTab] = useState("directory");

  // Selection for Employee 360
  const [selectedEmpId, setSelectedEmpId] = useState("EMP-101");
  const [emp360Tab, setEmp360Tab] = useState("p-move");

  // Device admin states
  const [deviceIp, setDeviceIp] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState("offline");

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null); // null if adding

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formEmpId, setFormEmpId] = useState("");
  const [formRfid, setFormRfid] = useState("");
  const [formRole, setFormRole] = useState("Picker");
  const [formRoom, setFormRoom] = useState("Room 1");
  const [formStatus, setFormStatus] = useState("Active");

  // Fetch / combine workers
  const loadWorkers = () => {
    // Attempt load from monitor node API
    monitorApi.get("/employees")
      .then((res) => {
        let localList = [];
        try {
          const stored = localStorage.getItem("local-employees");
          localList = stored ? JSON.parse(stored) : [];
          if (!Array.isArray(localList)) localList = [];
        } catch (e) {
          console.error("Error parsing local-employees:", e);
        }
        
        // Map database list to uniform employee object
        const combined = Array.isArray(res)
          ? res.map(e => ({
              name: e.name || "Unknown Employee",
              emp_id: e.emp_id || "UNKNOWN",
              rfid_tag: e.rfid_tag || "UNKNOWN",
              department: e.department || "Staff",
              room: e.shift || "Room 1", // use shift as Home Room
              status: "Active"
            }))
          : [];

        localList.forEach((localItem) => {
          if (localItem && localItem.emp_id && !combined.some(w => w.emp_id === localItem.emp_id)) {
            combined.push({
              name: localItem.name || "Unknown Employee",
              emp_id: localItem.emp_id,
              rfid_tag: localItem.rfid_tag || "UNKNOWN",
              department: localItem.department || "Staff",
              room: localItem.room || "Room 1",
              status: localItem.status || "Active"
            });
          }
        });

        setWorkers(combined);
      })
      .catch((err) => {
        console.error("Error loading employees:", err);
        // Fallback mockup list if offline or database empty
        const defaultMock = [
          { name: "Vishali Nair", emp_id: "EMP-101", rfid_tag: "4E500E06", department: "Picker", room: "Room 1", status: "Active" },
          { name: "Suraj Menon", emp_id: "EMP-102", rfid_tag: "CC392B1F", department: "Picker", room: "Room 2", status: "Active" },
          { name: "Vishal Kumar", emp_id: "EMP-103", rfid_tag: "B3122A22", department: "Loader", room: "Room 1", status: "Active" },
          { name: "Vaanavee R.", emp_id: "EMP-104", rfid_tag: "0EB46F06", department: "Supervisor", room: "Room 3", status: "Active" },
          { name: "Arjun Das", emp_id: "EMP-105", rfid_tag: "7A2F1C09", department: "Picker", room: "Room 2", status: "Active" },
          { name: "Meena Iyer", emp_id: "EMP-106", rfid_tag: "1B9E4D22", department: "Picker", room: "Room 3", status: "Inactive" }
        ];

        let localList = [];
        try {
          const stored = localStorage.getItem("local-employees");
          localList = stored ? JSON.parse(stored) : [];
          if (!Array.isArray(localList)) localList = [];
        } catch (e) {
          console.error("Error parsing local-employees in fallback:", e);
        }

        const combined = [...defaultMock];
        localList.forEach((localItem) => {
          if (localItem && localItem.emp_id && !combined.some(w => w.emp_id === localItem.emp_id)) {
            combined.push({
              name: localItem.name || "Unknown Employee",
              emp_id: localItem.emp_id,
              rfid_tag: localItem.rfid_tag || "UNKNOWN",
              department: localItem.department || "Staff",
              room: localItem.room || "Room 1",
              status: localItem.status || "Active"
            });
          }
        });
        setWorkers(combined);
      });
  };

  useEffect(() => {
    loadWorkers();

    const fetchStatus = () => {
      fetch("/monitor-api/rfid/device-status")
        .then((res) => res.json())
        .then((data) => {
          if (data && data.devices && data.devices["Entrance Unit"]) {
            const dev = data.devices["Entrance Unit"];
            setDeviceIp(dev.ip);
            setDeviceStatus(dev.status.toLowerCase());
          }
        })
        .catch(() => {});
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // Filtered list
  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      const matchesSearch =
        w.name.toLowerCase().includes(query.toLowerCase()) ||
        w.emp_id.toLowerCase().includes(query.toLowerCase());
      const matchesStatus =
        statusFilter === "All" || w.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [workers, query, statusFilter]);

  // Export CSV handler
  const exportCsv = () => {
    const headers = "Employee,Emp ID,RFID Card,Role,Home Room,Status\n";
    const rows = workers.map(w => `"${w.name}","${w.emp_id}","${w.rfid_tag}","${w.department}","${w.room}","${w.status}"`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees_directory.csv";
    a.click();
  };

  // Open Add/Edit Modal
  const openModal = (workerToEdit = null) => {
    if (workerToEdit) {
      setEditingWorker(workerToEdit);
      setFormName(workerToEdit.name);
      setFormEmpId(workerToEdit.emp_id);
      setFormRfid(workerToEdit.rfid_tag);
      setFormRole(workerToEdit.department);
      setFormRoom(workerToEdit.room);
      setFormStatus(workerToEdit.status);
    } else {
      setEditingWorker(null);
      setFormName("");
      setFormEmpId(`EMP-${Math.floor(107 + Math.random() * 900)}`);
      setFormRfid("");
      setFormRole("Picker");
      setFormRoom("Room 1");
      setFormStatus("Active");
    }
    setModalOpen(true);
  };

  // Save worker handler
  const saveWorker = (e) => {
    e.preventDefault();
    if (!formName || !formEmpId || !formRfid) {
      alert("Name, Employee ID, and RFID card number are required.");
      return;
    }

    const updatedWorker = {
      name: formName,
      emp_id: formEmpId,
      rfid_tag: formRfid,
      department: formRole,
      room: formRoom,
      status: formStatus
    };

    const stored = localStorage.getItem("local-employees");
    let localList = stored ? JSON.parse(stored) : [];

    if (editingWorker) {
      // Edit mode
      localList = localList.map(w => w.emp_id === editingWorker.emp_id ? updatedWorker : w);
      if (!localList.some(w => w.emp_id === updatedWorker.emp_id)) {
        localList.push(updatedWorker);
      }
      localStorage.setItem("local-employees", JSON.stringify(localList));
      loadWorkers();
      alert("Employee updated successfully!");
    } else {
      // Add mode
      if (workers.some(w => w.emp_id === updatedWorker.emp_id)) {
        alert("Employee ID already exists.");
        return;
      }
      localList.push(updatedWorker);
      localStorage.setItem("local-employees", JSON.stringify(localList));
      loadWorkers();
      alert("Employee added successfully!");
    }
    setModalOpen(false);
  };

  // Pick worker details for Employee 360
  const selectedWorker = useMemo(() => {
    return workers.find(w => w.emp_id === selectedEmpId) || null;
  }, [workers, selectedEmpId]);

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-400 flex items-center gap-1.5 -mb-2">
        <Link to="/" className="hover:underline text-slate-400">Home</Link>
        <span className="text-slate-300">/</span>
        <span>People</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500 font-medium">Employees</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 leading-none">Employees</h1>
          <div className="text-sm text-slate-400 mt-2">
            {workers.length} registered · each mapped to a physical RFID card number
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            Export CSV
          </button>
          <button
            onClick={() => openModal()}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors shadow-soft"
          >
            + Add Employee
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-hairline/10 mb-5 overflow-x-auto w-full">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 -mb-px text-sm font-medium border-b-2 bg-transparent transition-all hover:text-ink ${
                active
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted"
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: DIRECTORY */}
      {tab === "directory" && (
        <div className="flex flex-col gap-6 animate-fadeIn">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input-field pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 bg-white"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            </div>

            <div className="flex gap-1.5">
              {["All", "Active", "Inactive"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                    statusFilter === s
                      ? "bg-primary-50 border-primary text-primary font-semibold"
                      : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Directory Card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-soft overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">Directory</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                {filteredWorkers.length} of {workers.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-5 py-3 hidden sm:table-cell">Emp ID</th>
                    <th className="px-5 py-3 hidden md:table-cell">RFID Card</th>
                    <th className="px-5 py-3 hidden sm:table-cell">Role</th>
                    <th className="px-5 py-3 hidden md:table-cell">Home Room</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWorkers.map((w) => (
                    <tr key={w.emp_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                            {initials(w.name)}
                          </span>
                          <span className="text-slate-900 font-medium">{w.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500 hidden sm:table-cell">{w.emp_id}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500 hidden md:table-cell">{w.rfid_tag}</td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs hidden sm:table-cell">{w.department}</td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs hidden md:table-cell">{w.room}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border leading-none ${
                          w.status === "Active"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : "bg-slate-50 text-slate-500 border-slate-100"
                        }`}>
                          {w.status === "Active" ? "● Active" : "○ Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedEmpId(w.emp_id);
                            setTab("employee360");
                          }}
                          className="px-2 py-1 text-xs font-semibold text-primary hover:underline bg-transparent border-0"
                        >
                          View
                        </button>
                        <button
                          onClick={() => openModal(w)}
                          className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded transition-colors ml-2"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredWorkers.length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-5 py-8 text-center text-xs text-slate-400">
                        No employees match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: EMPLOYEE 360 */}
      {tab === "employee360" && (
        <div className="flex flex-col gap-6 animate-fadeIn">
          {selectedWorker ? (
            <>
              {/* Profile Head Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-soft">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                    <span className="w-16 h-16 rounded-full bg-primary-50 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                      {initials(selectedWorker.name)}
                    </span>
                    <div>
                      <h2 className="font-display font-bold text-slate-900 text-lg leading-tight">
                        {selectedWorker.name}
                      </h2>
                      <div className="text-xs text-slate-400 mt-1">
                        {selectedWorker.emp_id} · {selectedWorker.department} · Home: {selectedWorker.room} · RFID card <span className="font-mono text-slate-500">{selectedWorker.rfid_tag}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full border leading-none text-center w-full sm:w-auto ${
                      selectedWorker.status === "Active"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : "bg-slate-50 text-slate-500 border-slate-100"
                    }`}>
                      ● {selectedWorker.status} · in {selectedWorker.room} now
                    </span>
                    <button
                      onClick={() => openModal(selectedWorker)}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded transition-colors w-full sm:w-auto"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              {/* Subtabs for Employee 360 */}
              <div className="flex gap-4 border-b border-slate-100">
                <button
                  onClick={() => setEmp360Tab("p-move")}
                  className={`py-2 px-1 -mb-px text-xs font-semibold border-b-2 bg-transparent transition-all ${
                    emp360Tab === "p-move"
                      ? "border-primary text-primary font-bold"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Recent Movements
                </button>
                <button
                  onClick={() => setEmp360Tab("p-att")}
                  className={`py-2 px-1 -mb-px text-xs font-semibold border-b-2 bg-transparent transition-all ${
                    emp360Tab === "p-att"
                      ? "border-primary text-primary font-bold"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Attendance / RFID
                </button>
                <button
                  onClick={() => setEmp360Tab("p-info")}
                  className={`py-2 px-1 -mb-px text-xs font-semibold border-b-2 bg-transparent transition-all ${
                    emp360Tab === "p-info"
                      ? "border-primary text-primary font-bold"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Profile
                </button>
              </div>

              {/* Subtab Panels */}
              {emp360Tab === "p-move" && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-soft overflow-hidden animate-fadeIn">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                          <th className="px-5 py-3">Product</th>
                          <th className="px-5 py-3">Move</th>
                          <th className="px-5 py-3 hidden sm:table-cell">From → To</th>
                          <th className="px-5 py-3">Time</th>
                          <th className="px-5 py-3 hidden sm:table-cell">Match</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {/* Mock details for Vishali Nair to match mockup screen */}
                        {selectedWorker.emp_id === "EMP-101" ? (
                          <>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-3.5 text-slate-900 font-medium">Bosch GSB 12V Drill <span className="font-mono text-xs text-slate-400">PRD-0412</span></td>
                              <td className="px-5 py-3.5"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-100 leading-none">OUT ×3</span></td>
                              <td className="px-5 py-3.5 text-slate-500 text-xs hidden sm:table-cell">Room 2·A → Dispatch</td>
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-500">10 Jul 09:14</td>
                              <td className="px-5 py-3.5 hidden sm:table-cell"><span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">All ✓</span></td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-3.5 text-slate-900 font-medium">M8 Hex Bolts <span className="font-mono text-xs text-slate-400">PRD-0188</span></td>
                              <td className="px-5 py-3.5"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-600 border-emerald-100 leading-none">IN ×50</span></td>
                              <td className="px-5 py-3.5 text-slate-500 text-xs hidden sm:table-cell">Inbound → Room 1·B</td>
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-500">09 Jul 16:22</td>
                              <td className="px-5 py-3.5 hidden sm:table-cell"><span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">All ✓</span></td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-3.5 text-slate-900 font-medium">Stainless Washers <span className="font-mono text-xs text-slate-400">PRD-0509</span></td>
                              <td className="px-5 py-3.5"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-100 leading-none">Transfer ×100</span></td>
                              <td className="px-5 py-3.5 text-slate-500 text-xs hidden sm:table-cell">Room 1·A → Room 1·C</td>
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-500">09 Jul 11:03</td>
                              <td className="px-5 py-3.5 hidden sm:table-cell"><span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">All ✓</span></td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-3.5 text-slate-900 font-medium">PVC Conduit 25mm <span className="font-mono text-xs text-slate-400">PRD-0421</span></td>
                              <td className="px-5 py-3.5"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-100 leading-none">OUT ×12</span></td>
                              <td className="px-5 py-3.5 text-slate-500 text-xs hidden sm:table-cell">Room 3·A → Dispatch</td>
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-500">08 Jul 14:41</td>
                              <td className="px-5 py-3.5 hidden sm:table-cell"><span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">CCTV ✗</span></td>
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <td colSpan="5" className="px-5 py-8 text-center text-xs text-slate-400">
                              No recent warehouse product movements recorded for this employee.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {emp360Tab === "p-att" && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-soft overflow-hidden animate-fadeIn">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                          <th className="px-5 py-3">Date</th>
                          <th className="px-5 py-3">Room</th>
                          <th className="px-5 py-3">Entry (RFID tap)</th>
                          <th className="px-5 py-3 hidden sm:table-cell">Exit</th>
                          <th className="px-5 py-3 hidden sm:table-cell">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedWorker.emp_id === "EMP-101" ? (
                          <>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-3.5 text-slate-900 font-medium">10 Jul 2026</td>
                              <td className="px-5 py-3.5 text-slate-500 text-xs">Room 1</td>
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-500">09:12</td>
                              <td className="px-5 py-3.5 text-slate-400 text-xs hidden sm:table-cell">— still in —</td>
                              <td className="px-5 py-3.5 text-slate-500 text-xs hidden sm:table-cell">40m</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-3.5 text-slate-900 font-medium">09 Jul 2026</td>
                              <td className="px-5 py-3.5 text-slate-500 text-xs">Room 1</td>
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-500">08:58</td>
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-500 hidden sm:table-cell">17:04</td>
                              <td className="px-5 py-3.5 text-slate-500 text-xs hidden sm:table-cell">8h 06m</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-3.5 text-slate-900 font-medium">08 Jul 2026</td>
                              <td className="px-5 py-3.5 text-slate-500 text-xs">Room 3</td>
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-500">10:20</td>
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-500 hidden sm:table-cell">10:52</td>
                              <td className="px-5 py-3.5 text-slate-500 text-xs hidden sm:table-cell">32m</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-3.5 text-slate-900 font-medium">08 Jul 2026</td>
                              <td className="px-5 py-3.5 text-slate-500 text-xs">Room 1</td>
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-500">09:01</td>
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-500 hidden sm:table-cell">17:10</td>
                              <td className="px-5 py-3.5 text-slate-500 text-xs hidden sm:table-cell">8h 09m</td>
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <td colSpan="5" className="px-5 py-8 text-center text-xs text-slate-400">
                              No RFID door tap logs found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {emp360Tab === "p-info" && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-soft animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                    <div>
                      <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                        <span className="text-slate-400">Full name</span>
                        <span className="font-semibold text-slate-800">{selectedWorker.name}</span>
                      </div>
                      <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                        <span className="text-slate-400">Employee ID</span>
                        <span className="font-mono font-semibold text-slate-800">{selectedWorker.emp_id}</span>
                      </div>
                      <div className="flex justify-between items-center py-2.5 border-b md:border-b-0 border-slate-100 text-sm">
                        <span className="text-slate-400">RFID card</span>
                        <span className="font-mono font-semibold text-slate-800">{selectedWorker.rfid_tag}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                        <span className="text-slate-400">Role</span>
                        <span className="font-semibold text-slate-800">{selectedWorker.department}</span>
                      </div>
                      <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                        <span className="text-slate-400">Home room</span>
                        <span className="font-semibold text-slate-800">{selectedWorker.room}</span>
                      </div>
                      <div className="flex justify-between items-center py-2.5 text-sm">
                        <span className="text-slate-400">Status</span>
                        <span className="font-semibold text-emerald-600">{selectedWorker.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-slate-400 py-10 text-center bg-white border border-slate-200 rounded-xl shadow-soft">
              Please select an employee from the Directory first.
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: RFID ACTIVITY */}
      {tab === "rfid" && <RfidActivityTab />}

      {/* TAB CONTENT: DEVICE ADMIN */}
      {tab === "device" && (
        <div className="card p-0 overflow-hidden h-[600px] border border-hairline/[0.06] rounded-2xl bg-black/5">
          {deviceIp && deviceStatus === "online" ? (
            <iframe
              src={`http://${deviceIp}/`}
              title="Device Administration Console"
              className="w-full h-full border-0"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6 bg-surface">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 animate-pulse">
                <Cpu size={32} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-ink">Entrance Unit Offline</h3>
                <p className="text-muted text-sm max-w-md mt-1">
                  This console loads the device's own admin page directly over your local network, so it
                  only works when you're on the same WiFi as the ESP32. For login/logout and rack activity
                  from anywhere, use the <b>RFID Activity</b> tab instead — it reads from the backend, not
                  the device.
                </p>
              </div>
              {deviceIp ? (
                <div className="text-xs text-muted mt-2">
                  Last known IP: <span className="font-mono bg-hairline/[0.1] px-1.5 py-0.5 rounded">{deviceIp}</span>
                  <a
                    href={`http://${deviceIp}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-primary hover:underline font-medium"
                  >
                    Force Open Console
                  </a>
                </div>
              ) : (
                <div className="text-xs text-muted mt-2">
                  Searching network for device...
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ADD / EDIT EMPLOYEE MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lift w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-900 text-base">
                {editingWorker ? "Edit Employee" : "Add Employee"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-medium">✕</button>
            </div>
            <form onSubmit={saveWorker} className="p-5 flex flex-col gap-4">
              <div className="p-3 bg-blue-50/30 border border-blue-100 text-blue-900 text-xs rounded-lg flex gap-2 items-start">
                <span className="shrink-0 mt-0.5">ℹ️</span>
                <div>Mockup form — nothing is saved to database. Map the employee to their physical RFID card so door taps identify them.</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ravi Shankar"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Employee ID <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    disabled={!!editingWorker}
                    placeholder="EMP-107"
                    value={formEmpId}
                    onChange={(e) => setFormEmpId(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">RFID Card Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 4E500E06"
                    value={formRfid}
                    onChange={(e) => setFormRfid(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  />
                  <div className="text-[10px] text-slate-400">Tap the card on any reader to auto-fill.</div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Department / Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="Picker">Picker</option>
                    <option value="Loader">Loader</option>
                    <option value="Supervisor">Supervisor</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Home Room</label>
                  <select
                    value={formRoom}
                    onChange={(e) => setFormRoom(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="Room 1">Room 1</option>
                    <option value="Room 2">Room 2</option>
                    <option value="Room 3">Room 3</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors shadow-soft"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function RfidActivityTab() {
  const [current, setCurrent] = useState([]);
  const [date, setDate] = useState(todayStr());
  const [history, setHistory] = useState([]);
  const [rackScans, setRackScans] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const refreshCurrent = () => monitorApi.get("/room-entries/current").then(setCurrent).catch((e) => setError(e.message));
    const refreshRacks = () => monitorApi.get("/rfid/rack-scans?limit=20").then(setRackScans).catch((e) => setError(e.message));
    refreshCurrent();
    refreshRacks();
    const poll = setInterval(() => {
      refreshCurrent();
      refreshRacks();
    }, 3000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    monitorApi.get(`/room-entries?date=${date}`).then(setHistory).catch((e) => setError(e.message));
  }, [date]);

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink">Currently Inside</h3>
          <Badge tone="info">{current.length} active</Badge>
        </div>
        <ul className="flex flex-col divide-y divide-hairline/[0.05]">
          {current.map((c) => (
            <li key={c.emp_id} className="py-3 flex items-center justify-between text-sm">
              <div>
                <p className="text-ink font-medium">{c.employee_name}</p>
                <p className="text-xs text-muted">{c.emp_id} • {c.rfid_tag}</p>
              </div>
              <div className="text-right">
                <Badge tone="success">{c.room}</Badge>
                <p className="text-xs text-muted mt-1">In since {c.entry_time}</p>
              </div>
            </li>
          ))}
          {current.length === 0 && <li className="py-3 text-sm text-muted">No one is currently checked in.</li>}
        </ul>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink">Login / Logout History</h3>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input-field w-auto"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted text-xs uppercase tracking-wide border-b border-hairline/[0.05]">
                <th className="pb-3 font-medium">Employee</th>
                <th className="pb-3 font-medium">Room</th>
                <th className="pb-3 font-medium">Login</th>
                <th className="pb-3 font-medium hidden sm:table-cell">Logout</th>
                <th className="pb-3 font-medium hidden sm:table-cell">Duration</th>
                <th className="pb-3 font-medium hidden md:table-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="border-b border-hairline/[0.04] last:border-0">
                  <td className="py-3 text-ink font-medium">{h.employee_name}</td>
                  <td className="py-3 text-muted">{h.room}</td>
                  <td className="py-3 text-muted">{h.entry_time}</td>
                  <td className="py-3 text-muted hidden sm:table-cell">{h.exit_time || "—"}</td>
                  <td className="py-3 text-muted hidden sm:table-cell">{h.duration || "—"}</td>
                  <td className="py-3 hidden md:table-cell">
                    <Badge tone={h.status === "Completed" ? "success" : "info"}>{h.status}</Badge>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted">
                    No login/logout activity for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink">Rack Activity</h3>
          <Badge tone="info">{rackScans.length} recent</Badge>
        </div>
        <p className="text-xs text-muted mb-4">Which worker went to which room and rack, and what's stocked there.</p>
        <ul className="flex flex-col divide-y divide-hairline/[0.05]">
          {rackScans.map((s) => (
            <li key={s.id} className="py-3 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink font-medium">{s.employee_name}</p>
                  <p className="text-xs text-muted">{s.emp_id} • {s.rfid_tag}</p>
                </div>
                <div className="text-right">
                  <Badge tone="success">{s.room} / Rack {s.rack}</Badge>
                  <p className="text-xs text-muted mt-1">{s.date} at {s.time}</p>
                </div>
              </div>
              {s.products?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {s.products.map((p) => (
                    <span key={p.product_id} className="text-xs rounded-full bg-hairline/[0.06] px-3 py-1 text-muted">
                      {p.name} — {p.qty} {p.unit}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
          {rackScans.length === 0 && <li className="py-3 text-sm text-muted">No rack taps recorded yet.</li>}
        </ul>
      </div>
    </div>
  );
}
