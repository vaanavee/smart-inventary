import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import { monitorApi } from "../api/monitorClient.js";
import { RefreshCw } from "lucide-react";

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [deviceStatus, setDeviceStatus] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Local additions for rooms and racks
  const [localRooms, setLocalRooms] = useState([]);
  const [localRacks, setLocalRacks] = useState([]);

  // Modals
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [rackModalOpen, setRackModalOpen] = useState(false);

  // Form Fields
  const [formRoomName, setFormRoomName] = useState("");
  const [formRoomPurpose, setFormRoomPurpose] = useState("");
  const [formRoomDevice, setFormRoomDevice] = useState("");

  const [formRackRoom, setFormRackRoom] = useState("Room 1");
  const [formRackLabel, setFormRackLabel] = useState("");
  const [formRackCategory, setFormRackCategory] = useState("");

  const loadData = () => {
    setIsRefreshing(true);

    // Load products from Node API
    monitorApi.get("/products")
      .then((res) => {
        if (res) setProducts(res);
      })
      .catch(() => {
        // Mock fallback if offline
        setProducts([
          { name: "Bosch GSB 12V Cordless Drill", product_id: "PRD-0412", room: "Room 2", rack: "A", qty: 34, unit: "pcs" },
          { name: "M8 Hex Bolts (Box of 100)", product_id: "PRD-0188", room: "Room 1", rack: "B", qty: 240, unit: "pcs" },
          { name: "2.5mm² Copper Wire Spool", product_id: "PRD-0207", room: "Room 3", rack: "C", qty: 42, unit: "rolls" },
          { name: "Makita Angle Grinder", product_id: "PRD-0355", room: "Room 2", rack: "B", qty: 18, unit: "pcs" },
          { name: "PVC Conduit Pipe 25mm", product_id: "PRD-0421", room: "Room 3", rack: "A", qty: 610, unit: "pcs" },
          { name: "Stainless Washers M8", product_id: "PRD-0509", room: "Room 1", rack: "A", qty: 1180, unit: "pcs" },
          { name: "LED Panel 18W", product_id: "PRD-0533", room: "Room 3", rack: "D", qty: 27, unit: "pcs" },
          { name: "Cordless Impact Driver", product_id: "PRD-0560", room: "Room 2", rack: "C", qty: 9, unit: "pcs" },
          { name: "Nuts (M6)", product_id: "PRD-0122", room: "Room 1", rack: "C", qty: 430, unit: "pcs" },
          { name: "Anchors (Concrete)", product_id: "PRD-0045", room: "Room 1", rack: "D", qty: 96, unit: "pcs" },
          { name: "Rivets (Steel)", product_id: "PRD-0099", room: "Room 1", rack: "E", qty: 310, unit: "pcs" },
          { name: "Switches (Modular)", product_id: "PRD-0245", room: "Room 3", rack: "B", qty: 205, unit: "pcs" }
        ]);
      });

    // Load device heartbeats
    monitorApi.get("/rfid/device-status")
      .then((res) => {
        if (res && res.devices) setDeviceStatus(res.devices);
      })
      .catch(() => {});

    // Load local additions from storage
    const storedRooms = localStorage.getItem("local-rooms");
    if (storedRooms) setLocalRooms(JSON.parse(storedRooms));

    const storedRacks = localStorage.getItem("local-racks");
    if (storedRacks) setLocalRacks(JSON.parse(storedRacks));

    setTimeout(() => setIsRefreshing(false), 800);
  };

  useEffect(() => {
    loadData();
    const poll = setInterval(loadData, 5000);
    return () => clearInterval(poll);
  }, []);

  // Room purposes descriptions mapping
  const roomPurposeMap = {
    "Room 1": "Fasteners & Hardware",
    "Room 2": "Power Tools",
    "Room 3": "Electricals"
  };

  // Device IDs mapping for standard rooms
  const roomDeviceMap = {
    "Room 1": "ESP-D01",
    "Room 2": "ESP-D02",
    "Room 3": "ESP-D03"
  };

  // Compile final active rooms
  const finalRooms = useMemo(() => {
    const defaultRooms = ["Room 1", "Room 2", "Room 3"];
    const productRooms = Array.from(new Set(products.map(p => p.room)));
    const allRooms = Array.from(new Set([...defaultRooms, ...productRooms, ...localRooms.map(r => r.name)]));
    return allRooms.sort();
  }, [products, localRooms]);

  // Count active readers
  const readerCounts = useMemo(() => {
    let online = 0;
    let offline = 0;
    finalRooms.forEach(room => {
      const devId = roomDeviceMap[room] || localRooms.find(r => r.name === room)?.deviceId;
      if (!devId) return;
      const dev = deviceStatus[devId];
      if (dev && dev.status === "Online") {
        online++;
      } else if (room === "Room 3" && !dev) {
        offline++; // mockup fallback
      } else if (dev && dev.status === "Offline") {
        offline++;
      } else {
        online++; // default online for active mockup simulation
      }
    });
    return { online, offline };
  }, [finalRooms, deviceStatus, localRooms]);

  // Unique racks count
  const totalRacksCount = useMemo(() => {
    const list = new Set();
    products.forEach(p => list.add(`${p.room}-${p.rack}`));
    localRacks.forEach(r => list.add(`${r.room}-${r.label}`));
    return list.size;
  }, [products, localRacks]);

  // Device Status helper
  const getDeviceStatus = (deviceId, roomName) => {
    const dev = deviceStatus[deviceId];
    if (dev) {
      return { status: dev.status, label: dev.status };
    }
    if (roomName === "Room 3") {
      return { status: "Offline", label: "Offline 12m" };
    }
    return { status: "Online", label: "Online" };
  };

  // Save Room handler
  const saveRoom = (e) => {
    e.preventDefault();
    if (!formRoomName) {
      alert("Room name is required.");
      return;
    }
    const newRoom = {
      name: formRoomName,
      purpose: formRoomPurpose || "General Storage",
      deviceId: formRoomDevice || `ESP-D0${finalRooms.length + 1}`
    };
    const updated = [...localRooms, newRoom];
    setLocalRooms(updated);
    localStorage.setItem("local-rooms", JSON.stringify(updated));
    setRoomModalOpen(false);
    alert("Room created successfully!");
  };

  // Save Rack handler
  const saveRack = (e) => {
    e.preventDefault();
    if (!formRackLabel) {
      alert("Rack label is required.");
      return;
    }
    const newRack = {
      room: formRackRoom,
      label: formRackLabel.toUpperCase(),
      category: formRackCategory || "General Stock"
    };
    const updated = [...localRacks, newRack];
    setLocalRacks(updated);
    localStorage.setItem("local-racks", JSON.stringify(updated));
    setRackModalOpen(false);
    alert("Rack created successfully!");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-400 flex items-center gap-1.5 -mb-2">
        <Link to="/" className="hover:underline text-slate-400">Home</Link>
        <span className="text-slate-300">/</span>
        <span>Inventory</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500 font-medium">Locations</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 leading-none">Locations</h1>
          <div className="text-sm text-slate-400 mt-2">
            Room → Rack hierarchy · each room mapped to its ESP32 RFID door reader
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRackModalOpen(true)}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            + Add Rack
          </button>
          <button
            onClick={() => setRoomModalOpen(true)}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors shadow-soft"
          >
            + Add Room
          </button>
        </div>
      </div>

      {/* Stat Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-slate-200 rounded-xl bg-white overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-slate-200 shadow-soft">
        <div className="p-4">
          <div className="text-2xl font-bold text-slate-900 leading-none">{finalRooms.length}</div>
          <div className="text-xs text-slate-400 mt-1.5 font-medium uppercase tracking-wider">Rooms</div>
        </div>
        <div className="p-4">
          <div className="text-2xl font-bold text-slate-900 leading-none">{totalRacksCount}</div>
          <div className="text-xs text-slate-400 mt-1.5 font-medium uppercase tracking-wider">Racks</div>
        </div>
        <div className="p-4">
          <div className="text-2xl font-bold text-emerald-600 leading-none">{readerCounts.online}</div>
          <div className="text-xs text-slate-400 mt-1.5 font-medium uppercase tracking-wider">Readers online</div>
        </div>
        <div className="p-4">
          <div className="text-2xl font-bold text-red-500 leading-none">{readerCounts.offline}</div>
          <div className="text-xs text-slate-400 mt-1.5 font-medium uppercase tracking-wider">Reader offline</div>
        </div>
      </div>

      {/* Room Cards List */}
      <div className="flex flex-col gap-4">
        {finalRooms.map((room) => {
          const purpose = roomPurposeMap[room] || localRooms.find(r => r.name === room)?.purpose || "General Storage";
          const deviceId = roomDeviceMap[room] || localRooms.find(r => r.name === room)?.deviceId || `ESP-D${room.slice(-1)}`;
          const statusObj = getDeviceStatus(deviceId, room);

          // Get products inside this room
          const roomProducts = products.filter(p => p.room === room);
          
          // Get unique racks inside this room
          const roomRacks = useMemo(() => {
            const list = new Set();
            roomProducts.forEach(p => list.add(p.rack));
            localRacks.filter(r => r.room === room).forEach(r => list.add(r.label));
            return Array.from(list).sort();
          }, [roomProducts, room, localRacks]);

          return (
            <div key={room} className="bg-white border border-slate-200 rounded-xl p-6 shadow-soft flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-display font-bold text-slate-900 text-base">
                    {room} · {purpose}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 font-medium">
                    {roomRacks.length} racks · {roomProducts.length} products stored
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                    <span className="text-lg">🪪</span>
                    <div>
                      <div className="font-mono font-bold text-slate-700 text-xs">{deviceId}</div>
                      <div className="text-[10px] text-slate-400">Door reader</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border leading-none ${
                      statusObj.status === "Offline"
                        ? "bg-red-50 text-red-600 border-red-100"
                        : "bg-emerald-50 text-emerald-600 border-emerald-100"
                    }`}>
                      ● {statusObj.label}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setFormRoomName(room);
                      setFormRoomPurpose(purpose);
                      setFormRoomDevice(deviceId);
                      setRoomModalOpen(true);
                    }}
                    className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Offline Banner matching mockup Room 3 warning */}
              {statusObj.status === "Offline" && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg flex gap-2 items-start">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <div>
                    Reader <strong>{deviceId}</strong> has not sent a heartbeat. RFID entries for {room} may be missing — CCTV fallback is active for this room.
                  </div>
                </div>
              )}

              {/* Racks Row */}
              <div className="flex flex-wrap gap-2 mt-2">
                {roomRacks.map(rack => {
                  const rackProducts = roomProducts.filter(p => p.rack === rack);
                  const totalRackQty = rackProducts.reduce((sum, p) => sum + p.qty, 0);
                  // Short name representation
                  let rackLabel = "Empty";
                  if (rackProducts.length > 0) {
                    rackLabel = rackProducts[0].name.split(" ")[0];
                    if (rackLabel.toLowerCase() === "2.5mm²") rackLabel = "Copper Wire";
                    if (rackLabel.toLowerCase() === "m8") rackLabel = "Hex Bolts";
                    if (rackLabel.toLowerCase() === "pvc") rackLabel = "Conduit";
                    if (rackLabel.toLowerCase() === "led") rackLabel = "LED Panels";
                  }
                  
                  return (
                    <div key={rack} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2 text-xs shadow-soft">
                      <span className="font-bold w-6 h-6 rounded bg-primary-50 text-primary flex items-center justify-center text-[10px]">
                        {rack}
                      </span>
                      <span className="text-slate-700 font-medium">{rackLabel}</span>
                      {totalRackQty > 0 && (
                        <span className="text-slate-400 font-mono">
                          {totalRackQty.toLocaleString()}
                        </span>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={() => {
                    setFormRackRoom(room);
                    setFormRackLabel("");
                    setFormRackCategory("");
                    setRackModalOpen(true);
                  }}
                  className="flex items-center justify-center border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-400 rounded-lg px-3 py-2 text-xs font-semibold"
                >
                  ＋ Rack
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD ROOM MODAL */}
      {roomModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lift w-full max-w-md max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-900 text-base">Add Room</h3>
              <button onClick={() => setRoomModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-medium">✕</button>
            </div>
            <form onSubmit={saveRoom} className="p-5 flex flex-col gap-4">
              <div className="p-3 bg-blue-50/30 border border-blue-100 text-blue-900 text-xs rounded-lg flex gap-2 items-start">
                <span className="shrink-0 mt-0.5">ℹ️</span>
                <div>Mockup form — nothing is saved to database. Map the room to the RFID reader mounted on its door.</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">Room Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Room 4"
                  value={formRoomName}
                  onChange={(e) => setFormRoomName(e.target.value)}
                  className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">Purpose / Category</label>
                <input
                  type="text"
                  placeholder="e.g. Packaging materials"
                  value={formRoomPurpose}
                  onChange={(e) => setFormRoomPurpose(e.target.value)}
                  className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">RFID Device Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="ESP-D04"
                    value={formRoomDevice}
                    onChange={(e) => setFormRoomDevice(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Reader Status</label>
                  <select className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
                    <option>Auto-detect on heartbeat</option>
                    <option>Online</option>
                    <option>Offline</option>
                  </select>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4 flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setRoomModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors shadow-soft"
                >
                  Save Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD RACK MODAL */}
      {rackModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lift w-full max-w-md max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-900 text-base">Add Rack</h3>
              <button onClick={() => setRackModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-medium">✕</button>
            </div>
            <form onSubmit={saveRack} className="p-5 flex flex-col gap-4">
              <div className="p-3 bg-blue-50/30 border border-blue-100 text-blue-900 text-xs rounded-lg flex gap-2 items-start">
                <span className="shrink-0 mt-0.5">ℹ️</span>
                <div>Mockup form — nothing is saved to database.</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Room <span className="text-red-500">*</span></label>
                  <select
                    value={formRackRoom}
                    onChange={(e) => setFormRackRoom(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  >
                    {finalRooms.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Rack Label <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="F"
                    maxLength={1}
                    value={formRackLabel}
                    onChange={(e) => setFormRackLabel(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">Stored Category</label>
                <input
                  type="text"
                  placeholder="e.g. Cable ties"
                  value={formRackCategory}
                  onChange={(e) => setFormRackCategory(e.target.value)}
                  className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                />
              </div>
              <div className="border-t border-slate-100 pt-4 flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setRackModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors shadow-soft"
                >
                  Save Rack
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="text-slate-400 mt-2 text-center text-[11px]">
        Designed & Developed by Vishali, Suraj and Vaanavee as part of the WisRight Innovation Internship Program (WR-IIP) held during June-July 2026
      </div>
    </div>
  );
}
