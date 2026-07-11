/* ============================================================
   WisRight Inventory Mockups — App Shell Injector
   Builds the sidebar, topbar and module tab-strip on every page.
   Usage:  <body data-module="products" data-page="Catalog">
   ============================================================ */

const SMS_NAV = [
  { section: "Overview", items: [
    { key: "dashboard", icon: "📊", label: "Dashboard", dir: "01-dashboard", pages: [["dashboard.html", "Overview"]] },
  ]},
  { section: "Inventory", items: [
    { key: "products",  icon: "📦", label: "Products",       dir: "02-products",  pages: [["list.html", "Catalog"], ["qr.html", "QR Codes"]] },
    { key: "locations", icon: "🗺️", label: "Locations",      dir: "03-locations", pages: [["list.html", "Rooms & Racks"]] },
    { key: "search",    icon: "🔎", label: "Product Search", dir: "04-search",    pages: [["search.html", "Find a Product"]] },
  ]},
  { section: "People", items: [
    { key: "employees", icon: "👷", label: "Employees", dir: "05-employees", pages: [["list.html", "Directory"], ["detail.html", "Employee 360"]] },
  ]},
  { section: "Operations", items: [
    { key: "scanner", icon: "📷", label: "QR Scanner", dir: "06-scanner", pages: [["scan.html", "Scan"], ["update.html", "Update Movement"], ["confirmation.html", "Confirmation"]] },
  ]},
  { section: "Monitoring", items: [
    { key: "cctv",       icon: "🎥", label: "CCTV Monitoring", dir: "07-cctv",       pages: [["monitoring.html", "Room Cameras"]] },
    { key: "attendance", icon: "🔗", label: "Attendance Match", dir: "08-attendance", pages: [["match.html", "Reconciliation"]] },
  ]},
  { section: "Reports", items: [
    { key: "reports", icon: "📈", label: "Movement Report", dir: "09-reports", pages: [["movement-report.html", "Product Movement"]] },
  ]},
];

(function buildShell() {
  const body = document.body;
  const moduleKey = body.dataset.module;
  const pageTitle = body.dataset.page || "";
  if (!moduleKey) return; // public pages (e.g. login) opt out

  let activeModule = null;
  for (const sec of SMS_NAV) {
    for (const it of sec.items) if (it.key === moduleKey) activeModule = it;
  }
  const currentFile = location.pathname.split("/").pop();

  // ---- Sidebar ----
  let side = `
  <aside class="sidebar">
    <div class="brand">
      <div class="logo">WR</div>
      <div>
        <div class="name">WisRight Inventory</div>
        <div class="sub">Warehouse Ops · Chennai</div>
      </div>
    </div>
    <div class="nav-section">
      <a class="nav-item" href="../index.html"><span class="ni-icon">⌂</span> All Modules</a>
    </div>`;
  for (const sec of SMS_NAV) {
    side += `<div class="nav-section"><div class="nav-section-title">${sec.section}</div>`;
    for (const it of sec.items) {
      const active = it.key === moduleKey ? " active" : "";
      side += `<a class="nav-item${active}" href="../${it.dir}/${it.pages[0][0]}"><span class="ni-icon">${it.icon}</span> ${it.label}</a>`;
    }
    side += `</div>`;
  }
  side += `<div class="sidebar-footer">WisRight Inventory · Mockup v1<br>Not a real application</div></aside>`;

  // ---- Topbar ----
  const top = `
  <header class="topbar">
    <span class="module-title">${activeModule ? activeModule.icon + " " + activeModule.label : ""}</span>
    <span class="spacer"></span>
    <input class="topbar-search" placeholder="Search products, employees, movements…">
    <button class="icon-btn" title="Notifications">🔔<span class="notif-dot"></span></button>
    <div class="user-chip">
      <div class="avatar">KR</div>
      <div><div class="u-name">Karthik Rajan</div><div class="u-role">Warehouse Supervisor</div></div>
    </div>
  </header>`;

  // ---- Module tab strip ----
  let tabs = "";
  if (activeModule && activeModule.pages.length > 1) {
    tabs = `<nav class="module-tabs">`;
    for (const [file, label] of activeModule.pages) {
      const active = file === currentFile ? " class=\"active\"" : "";
      tabs += `<a href="${file}"${active}>${label}</a>`;
    }
    tabs += `</nav>`;
  }

  // ---- Assemble: wrap existing content ----
  const content = document.createElement("div");
  content.className = "content";
  while (body.firstChild) content.appendChild(body.firstChild);

  const main = document.createElement("div");
  main.className = "main";
  main.innerHTML = top + tabs;
  main.appendChild(content);

  const app = document.createElement("div");
  app.className = "app";
  app.innerHTML = side;
  app.appendChild(main);

  body.appendChild(app);
  if (pageTitle) document.title = pageTitle + " · WisRight Inventory";
})();
