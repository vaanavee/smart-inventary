// Shared QR payload format so the admin generator and employee scanner
// stay in sync. The QR is self-contained JSON — the scanner decodes and
// displays it directly, no backend lookup needed.

export const QR_TYPE = "wisright-product";

// p = a product (from /api/products) plus { src, dst, moveQty, ts }.
export function encodeProductQR(p) {
  return JSON.stringify({
    t: QR_TYPE,
    v: 1,
    name: p.name,
    sku: p.sku,
    box: p.box_number,
    category: p.category,
    rack: p.rack,
    qty: p.moveQty ?? p.current_stock,
    min: p.minimum_stock,
    max: p.maximum_stock,
    src: p.src,
    dst: p.dst,
    ts: p.ts,
  });
}

// Manual entry: admin types origin, product name, and stock qty directly
// (no catalog lookup) - e.g. for a newly arrived box that isn't in the
// catalog yet. Uses the same payload shape so the scanner needs no changes.
export function encodeManualQR({ name, origin, qty, category }) {
  return JSON.stringify({
    t: QR_TYPE,
    v: 1,
    name,
    sku: "MANUAL",
    box: "-",
    category: category || "Manual Entry",
    rack: origin,
    qty: Number(qty) || 0,
    min: null,
    max: null,
    src: origin,
    dst: "",
    ts: new Date().toISOString(),
  });
}

// Returns the decoded object, or throws if the text is not a WisRight product QR.
export function decodeProductQR(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Not a WisRight product QR");
  }
  if (!data || data.t !== QR_TYPE) {
    throw new Error("Not a WisRight product QR");
  }
  return data;
}
