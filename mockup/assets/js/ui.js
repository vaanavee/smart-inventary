/* ============================================================
   SMS Mockups — UI Interactions + Demo Action Engine
   Every button responds. No business logic, nothing persists.

   Layers (first match wins):
   1. Tabs            .tab[data-tab]  →  .tab-panel#id
   2. Modals          [data-modal-open] / [data-modal-close]
   3. Chip toggles    .chip → single-select within its parent
   4. Pagination      .page-btn → active swap
   5. data-action     explicit override (see ACTIONS map)
   6. Label inference Approve/Reject/Save/Export/… auto-behavior
   7. Fallback        toast "〈label〉 — simulated"
   ============================================================ */

(function () {
  /* ---------------- Toast system ---------------- */
  function host() {
    let h = document.getElementById("toastHost");
    if (!h) { h = document.createElement("div"); h.id = "toastHost"; document.body.appendChild(h); }
    return h;
  }
  const ICONS = { success: "✓", info: "ℹ", warn: "⚠", danger: "✕" };
  window.smsToast = function (msg, kind) {
    kind = kind || "info";
    const t = document.createElement("div");
    t.className = "toast " + kind;
    t.innerHTML = '<span class="t-ic">' + (ICONS[kind] || "ℹ") + "</span><span>" + msg + "</span>";
    host().appendChild(t);
    setTimeout(() => { t.classList.add("hide"); setTimeout(() => t.remove(), 260); }, 2600);
  };

  /* ---------------- Helpers ---------------- */
  const labelOf = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
  const esc = (s) => s.replace(/</g, "&lt;");

  function rowResult(btn, text, kind) {
    const cell = btn.closest("td") || btn.parentElement;
    const tr = btn.closest("tr");
    if (cell && tr) {
      cell.querySelectorAll("button").forEach((b) => { b.style.display = "none"; });
      const badge = document.createElement("span");
      badge.className = "badge badge-" + kind;
      badge.textContent = text;
      cell.appendChild(badge);
    }
    smsToast(text + " — mockup action, nothing persists", kind === "danger" ? "danger" : "success");
  }

  function removeRow(btn) {
    const tr = btn.closest("tr");
    if (tr) { tr.classList.add("row-removing"); setTimeout(() => tr.remove(), 380); }
    smsToast("Removed — mockup action", "warn");
  }

  function markAllRead() {
    document.querySelectorAll(".unread").forEach((el) => el.classList.remove("unread"));
    document.querySelectorAll(".notif-dot").forEach((el) => el.remove());
    smsToast("All notifications marked as read", "success");
  }

  function closeOwnModal(btn) {
    const m = btn.closest(".modal-overlay");
    if (m) m.classList.remove("open");
  }

  /* ---------------- Generic auto-built form modal ----------------
     Any Add/New/Create/Edit/… button WITHOUT its own data-modal-open
     opens a real popup form titled after the button label.        */
  const FORM_VERBS = /^(add|new|create|edit|log|issue|register|book|place|upload|record|schedule)\b/i;

  function genericModal() {
    let m = document.getElementById("genericDemoModal");
    if (m) return m;
    m = document.createElement("div");
    m.className = "modal-overlay";
    m.id = "genericDemoModal";
    m.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header"><h3 id="gdmTitle">Form</h3><button class="modal-close" data-modal-close>✕</button></div>' +
        '<div class="modal-body">' +
          '<div class="form-group"><label class="required" id="gdmLabel">Name</label><input class="input" id="gdmInput"></div>' +
          '<div class="form-group"><label>Notes / Details</label><textarea class="textarea" placeholder="Optional details"></textarea></div>' +
          '<div class="alert alert-info">ℹ️ <div>Mockup form — submitting simulates the action; nothing is saved.</div></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn" data-modal-close>Cancel</button><button class="btn btn-primary" data-modal-close id="gdmSubmit">Save</button></div>' +
      '</div>';
    document.body.appendChild(m);
    return m;
  }

  function openFormModal(cleanLabel, noun) {
    const m = genericModal();
    m.querySelector("#gdmTitle").textContent = cleanLabel;
    m.querySelector("#gdmLabel").textContent = noun.charAt(0).toUpperCase() + noun.slice(1) + " name";
    const inp = m.querySelector("#gdmInput");
    inp.value = "";
    inp.placeholder = "Enter " + noun.toLowerCase() + "…";
    m.querySelector("#gdmSubmit").textContent = cleanLabel;
    m.classList.add("open");
  }

  /* ---------------- Explicit data-action vocabulary ---------------- */
  const ACTIONS = {
    toast:     (b) => smsToast(b.dataset.msg || labelOf(b) + " — simulated", b.dataset.kind || "info"),
    save:      (b) => smsToast("Saved — mockup only, nothing persists", "success"),
    export:    (b) => smsToast("Export generated — file download simulated", "info"),
    notify:    (b) => smsToast("🔔 Notification queued (push / SMS / WhatsApp per preferences)", "info"),
    approve:   (b) => rowResult(b, "✓ Approved", "success"),
    reject:    (b) => rowResult(b, "✗ Rejected", "danger"),
    verify:    (b) => rowResult(b, "✓ Verified", "success"),
    row:       (b) => rowResult(b, b.dataset.result || "✓ Done", b.dataset.kindBadge || "success"),
    remove:    (b) => removeRow(b),
    "mark-read": () => markAllRead(),
  };

  /* ---------------- Label-inference rules (order matters) ---------------- */
  const INFER = [
    [/reject/i,                 (b) => rowResult(b, "✗ Rejected", "danger")],
    [/approve/i,                (b) => rowResult(b, "✓ Approved", "success")],
    [/verif/i,                  (b) => rowResult(b, "✓ Verified", "success")],
    [/resolve/i,                (b) => rowResult(b, "✓ Resolved", "success")],
    [/waive/i,                  (b) => rowResult(b, "Waived", "neutral")],
    [/mark.{0,3}lost/i,         (b) => rowResult(b, "Lost — charge raised", "danger")],
    [/check.?out/i,             (b) => rowResult(b, "Checked out", "neutral")],
    [/check.?in|^✓?\s*return/i, (b) => rowResult(b, "✓ Returned", "success")],
    [/renew/i,                  (b) => rowResult(b, "✓ Renewed", "success")],
    [/mark all read/i,          () => markAllRead()],
    [/delete|remove/i,          (b) => removeRow(b)],
    [/finali[sz]e|publish|lock\b/i, (b) => smsToast(labelOf(b) + " — done. State change simulated", "success")],
    [/save|submit|update|apply\b/i, (b) => smsToast("Saved — mockup only, nothing persists", "success")],
    [/export|download|\bpdf\b|excel|\bcsv\b|print|label/i, (b) => smsToast("⬇ " + labelOf(b) + " — file download simulated", "info")],
    [/notify|remind/i,          (b) => smsToast("🔔 Notification queued (push / SMS / WhatsApp per preferences)", "info")],
    [/\bpay\b|collect/i,        (b) => smsToast("Payment recorded — receipt issued (mockup)", "success")],
    [/generate|create|provision|issue\b/i, (b) => smsToast(labelOf(b) + " — created (mockup)", "success")],
    [/send|broadcast|dispatch/i,(b) => smsToast("Sent — delivery logged for audit (mockup)", "success")],
    [/assign|allocate|book/i,   (b) => smsToast(labelOf(b) + " — assignment recorded (mockup)", "success")],
    [/cancel|discard|reset/i,   (b) => smsToast("Discarded — no changes kept", "warn")],
    [/impersonate/i,            (b) => smsToast("Impersonation session started — recorded in audit log", "warn")],
    [/run|compute|recount|recompute|sync|refresh/i, (b) => smsToast(labelOf(b) + " — job completed (mockup)", "success")],
  ];

  /* ---------------- Master click handler ---------------- */
  document.addEventListener("click", (e) => {
    // 1. Tabs
    const tab = e.target.closest(".tab[data-tab]");
    if (tab) {
      const group = tab.closest(".tabs");
      group.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const scope = group.parentElement;
      scope.querySelectorAll(":scope > .tab-panel").forEach((p) => p.classList.remove("active"));
      const panel = document.getElementById(tab.dataset.tab);
      if (panel) panel.classList.add("active");
      return;
    }

    // 2a. Modal open
    const opener = e.target.closest("[data-modal-open]");
    if (opener) {
      const m = document.getElementById(opener.dataset.modalOpen);
      if (m) m.classList.add("open");
      return;
    }

    // 2b. Modal close — action-styled closers get a confirmation toast
    const closer = e.target.closest("[data-modal-close]");
    if (closer) {
      const m = closer.closest(".modal-overlay");
      if (m) m.classList.remove("open");
      const cls = closer.classList;
      if (cls.contains("btn-primary") || cls.contains("btn-danger") || cls.contains("btn-success")) {
        smsToast(labelOf(closer).replace(/^[^\w]+/, "") + " — done (mockup)", cls.contains("btn-danger") ? "warn" : "success");
      }
      return;
    }
    if (e.target.classList && e.target.classList.contains("modal-overlay")) {
      e.target.classList.remove("open");
      return;
    }

    // 3. Chip toggle (single-select among sibling chips)
    const chip = e.target.closest(".chip");
    if (chip && !chip.closest("a[href]:not([href='#'])")) {
      const siblings = chip.parentElement ? chip.parentElement.querySelectorAll(":scope > .chip") : [];
      if (siblings.length > 1) siblings.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      e.preventDefault();
      return;
    }

    // 4. Pagination
    const pbtn = e.target.closest(".page-btn");
    if (pbtn) {
      const wrap = pbtn.parentElement;
      if (wrap) wrap.querySelectorAll(".page-btn").forEach((p) => p.classList.remove("active"));
      pbtn.classList.add("active");
      return;
    }

    // Dead anchors (#) get the same demo treatment as buttons
    const deadLink = e.target.closest('a[href="#"]');
    if (deadLink) {
      e.preventDefault();
      smsToast(esc(labelOf(deadLink) || "Link") + " — destination simulated", "info");
      return;
    }

    // 5–7. Buttons: explicit action → inference → fallback
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;
    e.preventDefault();

    const act = btn.dataset.action;
    if (act && ACTIONS[act]) { ACTIONS[act](btn); if (btn.closest(".modal")) closeOwnModal(btn); return; }

    const lbl = labelOf(btn);
    const inModal = !!btn.closest(".modal");

    // Generic form popup for Add/New/Create/Edit/… buttons (incl. ＋ prefixed)
    if (!inModal) {
      const clean = lbl.replace(/^[^A-Za-z0-9]+/, "");
      if (FORM_VERBS.test(clean)) {
        const noun = clean.replace(FORM_VERBS, "").trim();
        if (noun) { openFormModal(clean, noun); return; }   // bare verbs ("Issue") fall through to inference
      }
    }

    for (const [re, fn] of INFER) {
      if (re.test(lbl)) {
        if (inModal && /save|submit|confirm|add|create|send|generate|apply|provision|book|issue|collect/i.test(lbl)) {
          smsToast(lbl.replace(/^[^\w]+/, "") + " — done (mockup)", "success");
          closeOwnModal(btn);
        } else {
          fn(btn);
        }
        return;
      }
    }

    // Fallback — every remaining button still responds
    smsToast(esc(lbl || "Action") + " — simulated in this mockup", "info");
  });
})();
