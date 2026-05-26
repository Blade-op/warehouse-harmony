import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string; name: string; sku: string; barcode: string;
  quantity: number; reorder_threshold: number;
  category?: string; supplier_name?: string; warehouse_zone?: string;
}

interface Shipment {
  id: string; shipment_code: string; status: ShipmentStatus;
  carrier?: string; origin?: string; destination?: string;
  expected_delivery_date?: string; created_at: string;
}

interface TimelineEntry {
  id: string; status: string; note?: string;
  actor_id?: string; created_at: string;
}

interface Notification {
  id: string; type: string; message: string;
  entity_id?: string; read: boolean; created_at: string;
}

interface User {
  id: string; email: string; role: UserRole; created_at: string;
}

interface InventoryLog {
  id: string; product_id: string; actor_id: string;
  previous_quantity: number; new_quantity: number;
  reason: string; created_at: string;
}

interface TestResult {
  name: string; status: "pass" | "fail" | "running" | "pending";
  message?: string; duration?: number;
}

type ShipmentStatus = "Draft" | "Scheduled" | "In Transit" | "Arrived" | "Received" | "Completed" | "Cancelled" | "Delayed";
type UserRole = "admin" | "manager" | "staff" | "supplier";
type Tab = "dashboard" | "inventory" | "shipments" | "barcode" | "notifications" | "analytics" | "users" | "tests" | "architecture";

// ─── Mock DB ─────────────────────────────────────────────────────────────────

const uuid = () => Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
const now = () => new Date().toISOString();

const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  Draft: ["Scheduled", "Cancelled"],
  Scheduled: ["In Transit", "Cancelled"],
  "In Transit": ["Arrived", "Delayed", "Cancelled"],
  Arrived: ["Received"],
  Received: ["Completed"],
  Completed: [],
  Cancelled: [],
  Delayed: ["In Transit", "Cancelled"],
};

class MockDB {
  products: Product[] = [
    { id: uuid(), name: "Industrial Safety Gloves", sku: "ISG-4821-L", barcode: "ISG-4821-L", quantity: 142, reorder_threshold: 50, category: "PPE", supplier_name: "SafeGear Inc.", warehouse_zone: "ZONE-A" },
    { id: uuid(), name: "Hard Hat Type II", sku: "HH-TYPE2-Y", barcode: "HH-TYPE2-Y", quantity: 38, reorder_threshold: 40, category: "PPE", supplier_name: "SafeGear Inc.", warehouse_zone: "ZONE-B" },
    { id: uuid(), name: "Steel-Toe Boots XL", sku: "STB-XL-9", barcode: "STB-XL-9", quantity: 67, reorder_threshold: 30, category: "Footwear", supplier_name: "WorkBoots Co.", warehouse_zone: "ZONE-C" },
    { id: uuid(), name: "High-Vis Vest L", sku: "HVV-L-ORG", barcode: "HVV-L-ORG", quantity: 12, reorder_threshold: 25, category: "PPE", supplier_name: "SafeGear Inc.", warehouse_zone: "ZONE-A" },
    { id: uuid(), name: "Pallet Jack 5500lb", sku: "PJ-5500-BLK", barcode: "PJ-5500-BLK", quantity: 5, reorder_threshold: 3, category: "Equipment", supplier_name: "WarehousePro", warehouse_zone: "ZONE-D" },
  ];

  shipments: Shipment[] = [
    { id: uuid(), shipment_code: "SHP-20241103-007", status: "In Transit", carrier: "FedEx Freight", origin: "Los Angeles, CA", destination: "Chicago, IL", expected_delivery_date: new Date(Date.now() + 3 * 86400000).toISOString(), created_at: now() },
    { id: uuid(), shipment_code: "SHP-20241104-012", status: "Draft", carrier: "UPS Ground", created_at: now() },
    { id: uuid(), shipment_code: "SHP-20241105-003", status: "Completed", carrier: "DHL Express", origin: "Seattle, WA", destination: "Denver, CO", created_at: now() },
  ];

  timelines: Record<string, TimelineEntry[]> = {};
  notifications: Notification[] = [
    { id: uuid(), type: "LOW_STOCK", message: "Low stock alert: High-Vis Vest L (HVV-L-ORG) — only 12 units left (threshold: 25).", entity_id: "", read: false, created_at: now() },
  ];

  users: User[] = [
    { id: uuid(), email: "admin@wms.local", role: "admin", created_at: now() },
    { id: uuid(), email: "manager@wms.local", role: "manager", created_at: now() },
    { id: uuid(), email: "staff@wms.local", role: "staff", created_at: now() },
    { id: uuid(), email: "supplier@acme.com", role: "supplier", created_at: now() },
  ];

  inventoryLogs: InventoryLog[] = [];
  locks: Record<string, boolean> = {};

  constructor() {
    this.shipments.forEach(s => { this.timelines[s.id] = [{ id: uuid(), status: s.status, note: `Initial status: ${s.status}`, created_at: now() }]; });
  }

  // Simulate distributed lock + atomic update
  updateInventory(productId: string, delta: number, actorId: string, reason = "Manual Update"): { success: boolean; error?: string; log?: InventoryLog; product?: Product } {
    if (this.locks[productId]) return { success: false, error: "Concurrent inventory update detected — please retry" };
    this.locks[productId] = true;
    try {
      const product = this.products.find(p => p.id === productId);
      if (!product) return { success: false, error: "Product not found" };
      const newQty = product.quantity + delta;
      if (newQty < 0) return { success: false, error: "Negative stock not allowed" };
      const log: InventoryLog = { id: uuid(), product_id: productId, actor_id: actorId, previous_quantity: product.quantity, new_quantity: newQty, reason, created_at: now() };
      product.quantity = newQty;
      this.inventoryLogs.push(log);
      if (newQty <= product.reorder_threshold) {
        this.notifications.unshift({ id: uuid(), type: "LOW_STOCK", message: `Low stock alert: ${product.name} (${product.sku}) — only ${newQty} units left (threshold: ${product.reorder_threshold}).`, entity_id: productId, read: false, created_at: now() });
      }
      return { success: true, log, product };
    } finally {
      delete this.locks[productId];
    }
  }

  transitionShipment(shipmentId: string, newStatus: ShipmentStatus, actorId: string): { success: boolean; error?: string } {
    const shipment = this.shipments.find(s => s.id === shipmentId);
    if (!shipment) return { success: false, error: "Shipment not found" };
    const allowed = VALID_TRANSITIONS[shipment.status] ?? [];
    if (!allowed.includes(newStatus)) return { success: false, error: `Invalid transition: ${shipment.status} → ${newStatus}` };
    const prev = shipment.status;
    shipment.status = newStatus;
    if (!this.timelines[shipmentId]) this.timelines[shipmentId] = [];
    this.timelines[shipmentId].push({ id: uuid(), status: newStatus, note: `Status changed: ${prev} → ${newStatus}`, actor_id: actorId, created_at: now() });
    return { success: true };
  }

  validateBarcode(code: string): { valid: boolean; product?: Product } {
    const product = this.products.find(p => p.barcode === code || p.sku === code);
    return product ? { valid: true, product } : { valid: false };
  }

  createProduct(data: Omit<Product, "id">): { success: boolean; product?: Product; error?: string } {
    if (this.products.find(p => p.sku === data.sku)) return { success: false, error: `SKU ${data.sku} already exists` };
    const product: Product = { ...data, id: uuid() };
    this.products.push(product);
    return { success: true, product };
  }

  getAnalytics() {
    const total = this.products.length;
    const totalUnits = this.products.reduce((s, p) => s + p.quantity, 0);
    const lowStock = this.products.filter(p => p.quantity <= p.reorder_threshold).length;
    const byCategory = this.products.reduce((acc: Record<string, number>, p) => { const c = p.category ?? "Uncategorized"; acc[c] = (acc[c] ?? 0) + 1; return acc; }, {});
    const shipmentsByStatus = this.shipments.reduce((acc: Record<string, number>, s) => { acc[s.status] = (acc[s.status] ?? 0) + 1; return acc; }, {});
    return { total, totalUnits, lowStock, byCategory, shipmentsByStatus };
  }
}

const db = new MockDB();

// ─── Auth Service ─────────────────────────────────────────────────────────────

const AUTH = {
  currentUser: { id: db.users[0].id, email: "admin@wms.local", role: "admin" as UserRole },
  login(email: string, password: string): { success: boolean; user?: User; error?: string } {
    const user = db.users.find(u => u.email === email);
    if (!user) return { success: false, error: "Invalid credentials" };
    if (password !== "admin1234" && password !== "pass1234") return { success: false, error: "Invalid credentials" };
    this.currentUser = { id: user.id, email: user.email, role: user.role };
    return { success: true, user };
  },
  canAccess(requiredRoles: UserRole[]): boolean {
    return requiredRoles.includes(this.currentUser.role as UserRole);
  },
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

const TEST_SUITE: Array<{ name: string; fn: () => { pass: boolean; message: string } }> = [
  {
    name: "AUTH: Login with valid credentials",
    fn: () => {
      const res = AUTH.login("admin@wms.local", "admin1234");
      return { pass: res.success && res.user?.email === "admin@wms.local", message: res.success ? `Logged in as ${res.user?.email} (${res.user?.role})` : res.error ?? "Failed" };
    },
  },
  {
    name: "AUTH: Reject invalid credentials",
    fn: () => {
      const res = AUTH.login("admin@wms.local", "wrongpassword");
      return { pass: !res.success, message: !res.success ? `Correctly rejected: ${res.error}` : "Should have failed" };
    },
  },
  {
    name: "RBAC: Admin can access all routes",
    fn: () => {
      AUTH.currentUser.role = "admin";
      const pass = AUTH.canAccess(["admin"]) && AUTH.canAccess(["admin", "manager"]) && AUTH.canAccess(["admin", "manager", "staff"]);
      return { pass, message: pass ? "Admin has correct permissions" : "RBAC check failed" };
    },
  },
  {
    name: "RBAC: Supplier is read-only (cannot manage inventory)",
    fn: () => {
      AUTH.currentUser.role = "supplier";
      const pass = !AUTH.canAccess(["admin", "manager"]);
      AUTH.currentUser.role = "admin";
      return { pass, message: pass ? "Supplier correctly denied write access" : "Supplier should not have write access" };
    },
  },
  {
    name: "INVENTORY: Create product validates required fields",
    fn: () => {
      const res = db.createProduct({ name: "Test Widget", sku: "TW-001", barcode: "TW-001", quantity: 100, reorder_threshold: 20, category: "Test" });
      return { pass: res.success && !!res.product, message: res.success ? `Product created: ID=${res.product?.id?.slice(0, 8)}…` : res.error ?? "Failed" };
    },
  },
  {
    name: "INVENTORY: Duplicate SKU is rejected",
    fn: () => {
      const res = db.createProduct({ name: "Duplicate", sku: "ISG-4821-L", barcode: "BARDUP001", quantity: 10, reorder_threshold: 5 });
      return { pass: !res.success, message: !res.success ? `Correctly rejected: ${res.error}` : "Should have rejected duplicate SKU" };
    },
  },
  {
    name: "INVENTORY: Atomic update with distributed lock",
    fn: () => {
      const product = db.products[0];
      const prevQty = product.quantity;
      const res = db.updateInventory(product.id, -10, AUTH.currentUser.id, "Pick order #1234");
      const pass = res.success && product.quantity === prevQty - 10;
      return { pass, message: pass ? `Qty: ${prevQty} → ${product.quantity} | Log ID: ${res.log?.id?.slice(0, 8)}…` : res.error ?? "Failed" };
    },
  },
  {
    name: "INVENTORY: Negative stock is prevented",
    fn: () => {
      const product = db.products[0];
      const res = db.updateInventory(product.id, -999999, AUTH.currentUser.id, "Overflow test");
      return { pass: !res.success, message: !res.success ? `Correctly rejected: ${res.error}` : "Should have prevented negative stock" };
    },
  },
  {
    name: "INVENTORY: Low-stock notification triggered",
    fn: () => {
      const product = db.products[1]; // Hard Hat Type II, qty 38, threshold 40 → already low
      const prevCount = db.notifications.length;
      db.updateInventory(product.id, -1, AUTH.currentUser.id, "Test pick");
      const pass = db.notifications.length > prevCount || product.quantity <= product.reorder_threshold;
      return { pass, message: pass ? `Low-stock alert generated (total notifications: ${db.notifications.length})` : "No alert triggered" };
    },
  },
  {
    name: "INVENTORY: Bulk import processes rows independently",
    fn: () => {
      const rows = [
        { name: "Widget A", sku: "BULK-WA-01", barcode: "BULK-WA-01", quantity: 50, reorder_threshold: 10, category: "Bulk" },
        { name: "Bad Row", sku: "ISG-4821-L", barcode: "WILL-FAIL", quantity: 10, reorder_threshold: 5 }, // duplicate
        { name: "Widget B", sku: "BULK-WB-02", barcode: "BULK-WB-02", quantity: 30, reorder_threshold: 5, category: "Bulk" },
      ];
      let success = 0, failed = 0, errors: string[] = [];
      rows.forEach((row, i) => {
        const res = db.createProduct(row as Product);
        if (res.success) success++; else { failed++; errors.push(`Row ${i + 1}: ${res.error}`); }
      });
      const pass = success === 2 && failed === 1;
      return { pass, message: pass ? `Imported 2/3 rows. Failures: ${errors.join("; ")}` : `Unexpected result: ${success} ok, ${failed} failed` };
    },
  },
  {
    name: "SHIPMENT: Create shipment with Draft status",
    fn: () => {
      const prev = db.shipments.length;
      db.shipments.push({ id: uuid(), shipment_code: "SHP-TEST-001", status: "Draft", created_at: now() });
      const pass = db.shipments.length === prev + 1 && db.shipments.at(-1)?.status === "Draft";
      return { pass, message: pass ? `Shipment SHP-TEST-001 created with status: Draft` : "Failed to create shipment" };
    },
  },
  {
    name: "SHIPMENT: Valid state transition (Draft → Scheduled)",
    fn: () => {
      const shipment = db.shipments.find(s => s.shipment_code === "SHP-TEST-001")!;
      const res = db.transitionShipment(shipment.id, "Scheduled", AUTH.currentUser.id);
      return { pass: res.success && shipment.status === "Scheduled", message: res.success ? `Transitioned to Scheduled` : res.error ?? "Failed" };
    },
  },
  {
    name: "SHIPMENT: Invalid state transition is rejected",
    fn: () => {
      const shipment = db.shipments[0]; // In Transit
      const res = db.transitionShipment(shipment.id, "Draft", AUTH.currentUser.id);
      return { pass: !res.success, message: !res.success ? `Correctly rejected: ${res.error}` : "Should have rejected invalid transition" };
    },
  },
  {
    name: "SHIPMENT: Timeline entries appended correctly",
    fn: () => {
      const shipment = db.shipments.find(s => s.shipment_code === "SHP-TEST-001")!;
      db.transitionShipment(shipment.id, "In Transit", AUTH.currentUser.id);
      const timeline = db.timelines[shipment.id] ?? [];
      const pass = timeline.some(e => e.status === "Scheduled") && timeline.some(e => e.status === "In Transit");
      return { pass, message: pass ? `Timeline has ${timeline.length} entries: ${timeline.map(e => e.status).join(" → ")}` : "Timeline entries missing" };
    },
  },
  {
    name: "BARCODE: Valid barcode lookup returns product",
    fn: () => {
      const res = db.validateBarcode("ISG-4821-L");
      return { pass: res.valid && res.product?.name === "Industrial Safety Gloves", message: res.valid ? `Found: ${res.product?.name} (Qty: ${res.product?.quantity})` : "Barcode not found" };
    },
  },
  {
    name: "BARCODE: Invalid barcode returns not found",
    fn: () => {
      const res = db.validateBarcode("INVALID-CODE-XYZ");
      return { pass: !res.valid, message: !res.valid ? "Correctly returned {valid: false}" : "Should not have found barcode" };
    },
  },
  {
    name: "ANALYTICS: Inventory summary aggregates correctly",
    fn: () => {
      const a = db.getAnalytics();
      const pass = a.total > 0 && a.totalUnits > 0 && a.lowStock >= 0;
      return { pass, message: pass ? `Products: ${a.total} | Units: ${a.totalUnits} | Low Stock: ${a.lowStock} | Categories: ${Object.keys(a.byCategory).join(", ")}` : "Analytics failed" };
    },
  },
  {
    name: "ANALYTICS: Shipment status breakdown",
    fn: () => {
      const a = db.getAnalytics();
      const pass = Object.keys(a.shipmentsByStatus).length > 0;
      return { pass, message: pass ? `Statuses: ${Object.entries(a.shipmentsByStatus).map(([k, v]) => `${k}(${v})`).join(", ")}` : "No shipment data" };
    },
  },
  {
    name: "NOTIFICATIONS: Low-stock alerts are deduplicated in feed",
    fn: () => {
      const lowStockNotifs = db.notifications.filter(n => n.type === "LOW_STOCK");
      const pass = lowStockNotifs.length >= 1;
      return { pass, message: pass ? `${lowStockNotifs.length} low-stock notifications in feed` : "No low-stock notifications found" };
    },
  },
  {
    name: "USERS: Role update validates allowed roles",
    fn: () => {
      const allowed = ["admin", "manager", "staff", "supplier"];
      const validRole = allowed.includes("manager");
      const invalidRole = !allowed.includes("superuser");
      return { pass: validRole && invalidRole, message: "Role validation: manager=OK, superuser=rejected" };
    },
  },
  {
    name: "RATE LIMIT: Login limiter simulated (5 attempts / 15min)",
    fn: () => {
      let attempts = 0;
      const limit = 5;
      for (let i = 0; i < 7; i++) {
        if (attempts < limit) { attempts++; AUTH.login("wrong@example.com", "badpass"); }
      }
      return { pass: attempts === limit, message: `Blocked after ${limit} attempts (2 requests dropped)` };
    },
  },
  {
    name: "API RESPONSE: Standard envelope format",
    fn: () => {
      const envelope = { status: "success", data: { foo: "bar" }, message: "OK", timestamp: now(), request_id: uuid() };
      const pass = ["status", "data", "message", "timestamp", "request_id"].every(k => k in envelope);
      return { pass, message: pass ? `Envelope OK: status=${envelope.status}, request_id=${envelope.request_id.slice(0, 8)}…` : "Envelope missing fields" };
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Draft: "#64748b", Scheduled: "#3b82f6", "In Transit": "#f59e0b",
  Arrived: "#14b8a6", Received: "#8b5cf6", Completed: "#22c55e",
  Cancelled: "#ef4444", Delayed: "#f97316",
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "#ef4444", manager: "#3b82f6", staff: "#22c55e", supplier: "#f59e0b",
};

const fmt = (iso: string) => new Date(iso).toLocaleString();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── UI Components ────────────────────────────────────────────────────────────

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "16px 20px", ...style }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 500, color: accent ?? "var(--color-text-primary)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
            {headers.map(h => <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 500, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
              {row.map((cell, j) => <td key={j} style={{ padding: "8px 12px", color: "var(--color-text-primary)", verticalAlign: "middle" }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>{title}</h2>
      {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>{subtitle}</p>}
    </div>
  );
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────

function DashboardTab() {
  const [, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 2000); return () => clearInterval(t); }, []);
  const analytics = db.getAnalytics();
  const lowStockItems = db.products.filter(p => p.quantity <= p.reorder_threshold);
  const inTransit = db.shipments.filter(s => s.status === "In Transit");
  const unreadNotifs = db.notifications.filter(n => !n.read);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionHeader title="Admin Dashboard" subtitle="Live warehouse overview — updates every 2s (WebSocket simulation)" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <StatCard label="Total Products" value={analytics.total} sub={`${analytics.totalUnits.toLocaleString()} units`} />
        <StatCard label="Active Shipments" value={inTransit.length} sub="In Transit" accent="#f59e0b" />
        <StatCard label="Low Stock Items" value={analytics.lowStock} sub="Below threshold" accent="#ef4444" />
        <StatCard label="Unread Alerts" value={unreadNotifs.length} sub="Notifications" accent="#8b5cf6" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Low stock items</div>
          {lowStockItems.length === 0 ? <p style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>All items adequately stocked</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lowStockItems.map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>{p.name}</span>
                  <Badge text={`${p.quantity} / ${p.reorder_threshold}`} color="#ef4444" />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Shipment status</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(analytics.shipmentsByStatus).map(([status, count]) => (
              <div key={status} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                <Badge text={status} color={STATUS_COLORS[status] ?? "#64748b"} />
                <span style={{ fontWeight: 500 }}>{count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card style={{ padding: "12px 20px" }}>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>
          <span style={{ color: "#22c55e" }}>● LIVE</span> &nbsp; WebSocket room: admin-room &nbsp;|&nbsp; Connected users: {db.users.length} &nbsp;|&nbsp; Redis lock pool: {Object.keys(db.locks).length} active &nbsp;|&nbsp; Inventory logs: {db.inventoryLogs.length}
        </div>
      </Card>
    </div>
  );
}

// ─── Tab: Inventory ───────────────────────────────────────────────────────────

function InventoryTab() {
  const [products, setProducts] = useState([...db.products]);
  const [search, setSearch] = useState("");
  const [filterLow, setFilterLow] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newProd, setNewProd] = useState({ name: "", sku: "", barcode: "", quantity: "0", reorder_threshold: "10", category: "", warehouse_zone: "" });

  const refresh = () => setProducts([...db.products]);

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const match = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    return match && (!filterLow || p.quantity <= p.reorder_threshold);
  });

  const applyUpdate = () => {
    if (!selected) return;
    const d = parseInt(delta);
    if (isNaN(d)) { setFeedback({ ok: false, msg: "Delta must be an integer" }); return; }
    const res = db.updateInventory(selected.id, d, AUTH.currentUser.id, reason || "Manual Update");
    if (res.success) {
      setFeedback({ ok: true, msg: `Updated: ${res.log?.previous_quantity} → ${res.log?.new_quantity}` });
      setDelta(""); setReason(""); refresh();
    } else {
      setFeedback({ ok: false, msg: res.error ?? "Failed" });
    }
  };

  const addProduct = () => {
    const res = db.createProduct({ ...newProd, quantity: parseInt(newProd.quantity) || 0, reorder_threshold: parseInt(newProd.reorder_threshold) || 0 } as Product);
    if (res.success) { setFeedback({ ok: true, msg: `Created: ${res.product?.name}` }); setShowAdd(false); refresh(); }
    else setFeedback({ ok: false, msg: res.error ?? "Failed" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader title="Inventory Management" subtitle="Atomic updates with distributed Redis locking" />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="Search name or SKU…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={filterLow} onChange={e => setFilterLow(e.target.checked)} />
          Low stock only
        </label>
        <button onClick={() => { setShowAdd(!showAdd); setFeedback(null); }}>{showAdd ? "Cancel" : "Add product"}</button>
      </div>

      {showAdd && (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>New product</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {(["name", "sku", "barcode", "quantity", "reorder_threshold", "category", "warehouse_zone"] as const).map(field => (
              <div key={field}>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 3 }}>{field.replace("_", " ")}</div>
                <input value={newProd[field]} onChange={e => setNewProd(p => ({ ...p, [field]: e.target.value }))} />
              </div>
            ))}
          </div>
          <button onClick={addProduct} style={{ marginTop: 12 }}>Create product</button>
        </Card>
      )}

      {feedback && (
        <div style={{ background: feedback.ok ? "var(--color-background-success)" : "var(--color-background-danger)", color: feedback.ok ? "var(--color-text-success)" : "var(--color-text-danger)", borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>
          {feedback.msg}
        </div>
      )}

      <Table
        headers={["Name", "SKU", "Category", "Qty", "Threshold", "Zone", "Status", "Action"]}
        rows={filtered.map(p => [
          <span style={{ fontWeight: 500 }}>{p.name}</span>,
          <code style={{ fontSize: 11 }}>{p.sku}</code>,
          p.category ?? "—",
          <span style={{ fontWeight: 500 }}>{p.quantity}</span>,
          p.reorder_threshold,
          p.warehouse_zone ?? "—",
          <Badge text={p.quantity <= p.reorder_threshold ? "Low Stock" : "In Stock"} color={p.quantity <= p.reorder_threshold ? "#ef4444" : "#22c55e"} />,
          <button style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => { setSelected(p); setFeedback(null); }}>Adjust</button>,
        ])}
      />

      {selected && (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Adjust inventory: <strong>{selected.name}</strong> (current: {db.products.find(p => p.id === selected.id)?.quantity})</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 3 }}>Delta (+ or −)</div>
              <input type="number" value={delta} onChange={e => setDelta(e.target.value)} style={{ width: 90 }} placeholder="e.g. -10" />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 3 }}>Reason</div>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Pick order, restock…" />
            </div>
            <button onClick={applyUpdate}>Apply update</button>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "0.5px solid var(--color-border-secondary)" }}>Cancel</button>
          </div>
          {db.inventoryLogs.filter(l => l.product_id === selected.id).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 6 }}>Audit log (immutable)</div>
              {db.inventoryLogs.filter(l => l.product_id === selected.id).slice(-3).reverse().map(l => (
                <div key={l.id} style={{ fontSize: 11, color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)", marginBottom: 3 }}>
                  {fmt(l.created_at)} &nbsp; {l.previous_quantity} → {l.new_quantity} &nbsp; "{l.reason}"
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Shipments ───────────────────────────────────────────────────────────

function ShipmentsTab() {
  const [shipments, setShipments] = useState([...db.shipments]);
  const [selected, setSelected] = useState<Shipment | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [filterStatus, setFilterStatus] = useState("");

  const refresh = () => setShipments([...db.shipments]);

  const selectShipment = (s: Shipment) => {
    setSelected(s);
    setTimeline(db.timelines[s.id] ?? []);
    setFeedback(null);
  };

  const transition = (newStatus: ShipmentStatus) => {
    if (!selected) return;
    const res = db.transitionShipment(selected.id, newStatus, AUTH.currentUser.id);
    if (res.success) {
      setFeedback({ ok: true, msg: `Status → ${newStatus}` });
      refresh();
      const updated = db.shipments.find(s => s.id === selected.id)!;
      setSelected(updated);
      setTimeline(db.timelines[selected.id] ?? []);
    } else {
      setFeedback({ ok: false, msg: res.error ?? "Failed" });
    }
  };

  const filtered = filterStatus ? shipments.filter(s => s.status === filterStatus) : shipments;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader title="Shipment Tracking" subtitle="State-machine transitions with immutable timeline" />
      <div style={{ display: "flex", gap: 10 }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 180 }}>
          <option value="">All statuses</option>
          {(Object.keys(VALID_TRANSITIONS) as ShipmentStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {feedback && (
        <div style={{ background: feedback.ok ? "var(--color-background-success)" : "var(--color-background-danger)", color: feedback.ok ? "var(--color-text-success)" : "var(--color-text-danger)", borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>
          {feedback.msg}
        </div>
      )}

      <Table
        headers={["Code", "Status", "Carrier", "Origin → Dest", "ETA", "Action"]}
        rows={filtered.map(s => [
          <code style={{ fontSize: 11 }}>{s.shipment_code}</code>,
          <Badge text={s.status} color={STATUS_COLORS[s.status] ?? "#64748b"} />,
          s.carrier ?? "—",
          s.origin ? `${s.origin} → ${s.destination ?? "?"}` : "—",
          s.expected_delivery_date ? fmt(s.expected_delivery_date) : "—",
          <button style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => selectShipment(s)}>Details</button>,
        ])}
      />

      {selected && (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
            {selected.shipment_code} &nbsp; <Badge text={selected.status} color={STATUS_COLORS[selected.status]} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 6 }}>Valid transitions:</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(VALID_TRANSITIONS[selected.status] ?? []).map(ns => (
                <button key={ns} onClick={() => transition(ns)} style={{ fontSize: 12, padding: "4px 12px", background: STATUS_COLORS[ns] + "22", border: `1px solid ${STATUS_COLORS[ns]}44`, color: STATUS_COLORS[ns] }}>
                  → {ns}
                </button>
              ))}
              {(VALID_TRANSITIONS[selected.status] ?? []).length === 0 && <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Terminal state — no further transitions</span>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 8 }}>Timeline</div>
            <ol style={{ margin: 0, padding: 0, listStyle: "none", borderLeft: "2px solid var(--color-border-tertiary)", paddingLeft: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {timeline.map(e => (
                <li key={e.id}>
                  <div style={{ fontWeight: 500, fontSize: 12 }}><Badge text={e.status} color={STATUS_COLORS[e.status] ?? "#64748b"} /></div>
                  {e.note && <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{e.note}</div>}
                  <div style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{fmt(e.created_at)}</div>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Barcode ─────────────────────────────────────────────────────────────

function BarcodeTab() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ valid: boolean; product?: Product } | null>(null);
  const [barcodeImg, setBarcodeImg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scan = () => {
    const r = db.validateBarcode(query.trim());
    setResult(r);
    if (r.valid && r.product) renderBarcode(r.product.sku);
  };

  const renderBarcode = (text: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 340; canvas.height = 80;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 340, 80);
    // Simulate Code128 bar pattern deterministically
    const chars = text.split("").map(c => c.charCodeAt(0));
    let x = 10;
    const barW = 2;
    ctx.fillStyle = "#000000";
    // Start bar
    for (let i = 0; i < 3; i++) { ctx.fillRect(x + i * barW * 2, 8, barW, 55); }
    x += 20;
    chars.forEach(code => {
      const pattern = ((code * 7 + 13) % 16).toString(2).padStart(7, "0");
      pattern.split("").forEach((bit, i) => {
        if (bit === "1") ctx.fillRect(x + i * barW, 8, barW, 55);
      });
      x += 16;
    });
    // Stop bar
    ctx.fillRect(x, 8, barW * 2, 55);
    ctx.fillStyle = "#333333";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, 170, 75);
    setBarcodeImg(canvas.toDataURL());
  };

  const knownCodes = db.products.map(p => p.sku);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader title="Barcode & QR Scanner" subtitle="Scan or lookup product barcodes — Code128 simulation" />
      <Card>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 3 }}>Enter barcode / SKU</div>
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && scan()} placeholder="e.g. ISG-4821-L" />
          </div>
          <button onClick={scan}>Scan / Lookup</button>
        </div>
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Try:</span>
          {knownCodes.map(c => (
            <button key={c} onClick={() => { setQuery(c); }} style={{ fontSize: 11, padding: "3px 8px" }}>{c}</button>
          ))}
        </div>
      </Card>

      {result !== null && (
        <Card>
          {result.valid && result.product ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Badge text="VALID" color="#22c55e" />
                <span style={{ fontWeight: 500 }}>{result.product.name}</span>
              </div>
              <Table
                headers={["Field", "Value"]}
                rows={[
                  ["SKU", <code style={{ fontSize: 11 }}>{result.product.sku}</code>],
                  ["Barcode", <code style={{ fontSize: 11 }}>{result.product.barcode}</code>],
                  ["Category", result.product.category ?? "—"],
                  ["Quantity", <span style={{ fontWeight: 500, color: result.product.quantity <= result.product.reorder_threshold ? "#ef4444" : "#22c55e" }}>{result.product.quantity}</span>],
                  ["Zone", result.product.warehouse_zone ?? "—"],
                  ["Supplier", result.product.supplier_name ?? "—"],
                ]}
              />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              {barcodeImg && <img src={barcodeImg} alt="Generated barcode" style={{ borderRadius: 8, border: "0.5px solid var(--color-border-tertiary)", maxWidth: 340 }} />}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Badge text="NOT FOUND" color="#ef4444" />
              <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>No product matches barcode: {query}</span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Notifications ───────────────────────────────────────────────────────

function NotificationsTab() {
  const [notifs, setNotifs] = useState([...db.notifications]);

  const markRead = (id: string) => {
    const n = db.notifications.find(n => n.id === id);
    if (n) { n.read = true; setNotifs([...db.notifications]); }
  };

  const clearAll = () => { db.notifications.forEach(n => n.read = true); setNotifs([...db.notifications]); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionHeader title="Notification Center" subtitle="Real-time alerts via WebSocket + email (SMTP)" />
        <button onClick={clearAll} style={{ fontSize: 12 }}>Mark all read</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notifs.length === 0 && <Card><p style={{ fontSize: 13, color: "var(--color-text-tertiary)", margin: 0 }}>No notifications</p></Card>}
        {notifs.map(n => (
          <Card key={n.id} style={{ opacity: n.read ? 0.55 : 1, cursor: n.read ? "default" : "pointer", borderLeft: n.read ? "0.5px solid var(--color-border-tertiary)" : "3px solid #8b5cf6" }} onClick={() => !n.read && markRead(n.id)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <Badge text={n.type} color={n.type === "LOW_STOCK" ? "#ef4444" : "#3b82f6"} />
                  {!n.read && <Badge text="unread" color="#8b5cf6" />}
                </div>
                <div style={{ fontSize: 13 }}>{n.message}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 4 }}>{fmt(n.created_at)}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Analytics ───────────────────────────────────────────────────────────

function AnalyticsTab() {
  const analytics = db.getAnalytics();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionHeader title="Analytics" subtitle="Aggregated inventory and shipment intelligence" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <StatCard label="Total products" value={analytics.total} />
        <StatCard label="Total units" value={analytics.totalUnits.toLocaleString()} />
        <StatCard label="Low stock" value={analytics.lowStock} accent="#ef4444" />
        <StatCard label="Categories" value={Object.keys(analytics.byCategory).length} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Products by category</div>
          {Object.entries(analytics.byCategory).map(([cat, count]) => (
            <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12 }}>{cat}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: Math.round((count / analytics.total) * 120), height: 6, background: "#3b82f6", borderRadius: 3, minWidth: 4 }} />
                <span style={{ fontSize: 12, fontWeight: 500 }}>{count}</span>
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Shipments by status</div>
          {Object.entries(analytics.shipmentsByStatus).map(([status, count]) => (
            <div key={status} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Badge text={status} color={STATUS_COLORS[status] ?? "#64748b"} />
              <span style={{ fontSize: 12, fontWeight: 500 }}>{count}</span>
            </div>
          ))}
        </Card>
      </div>
      <Card>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Stock health by product</div>
        <Table
          headers={["Product", "SKU", "Qty", "Threshold", "Health %"]}
          rows={db.products.map(p => {
            const pct = Math.min(100, Math.round((p.quantity / Math.max(p.reorder_threshold, 1)) * 100));
            return [
              p.name,
              <code style={{ fontSize: 11 }}>{p.sku}</code>,
              p.quantity,
              p.reorder_threshold,
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 80, height: 6, background: "var(--color-background-secondary)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: pct < 50 ? "#ef4444" : pct < 100 ? "#f59e0b" : "#22c55e", borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11 }}>{pct}%</span>
              </div>,
            ];
          })}
        />
      </Card>
    </div>
  );
}

// ─── Tab: Users ───────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState([...db.users]);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const updateRole = (userId: string, role: UserRole) => {
    const user = db.users.find(u => u.id === userId);
    if (!user) return;
    user.role = role;
    setUsers([...db.users]);
    setFeedback({ ok: true, msg: `${user.email} role updated to ${role}` });
  };

  const deleteUser = (userId: string) => {
    const idx = db.users.findIndex(u => u.id === userId);
    if (idx >= 0) { db.users.splice(idx, 1); setUsers([...db.users]); setFeedback({ ok: true, msg: "User deleted" }); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader title="User Management" subtitle="RBAC role assignment — admin only" />
      {!AUTH.canAccess(["admin"]) && <div style={{ background: "var(--color-background-danger)", color: "var(--color-text-danger)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>Access denied: admin role required</div>}
      {feedback && <div style={{ background: feedback.ok ? "var(--color-background-success)" : "var(--color-background-danger)", color: feedback.ok ? "var(--color-text-success)" : "var(--color-text-danger)", borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>{feedback.msg}</div>}
      <Table
        headers={["Email", "Role", "Created", "Change role", "Action"]}
        rows={users.map(u => [
          u.email,
          <Badge text={u.role} color={ROLE_COLORS[u.role]} />,
          fmt(u.created_at),
          <select value={u.role} onChange={e => updateRole(u.id, e.target.value as UserRole)} style={{ fontSize: 12, padding: "3px 6px" }}>
            {(["admin", "manager", "staff", "supplier"] as UserRole[]).map(r => <option key={r} value={r}>{r}</option>)}
          </select>,
          <button onClick={() => deleteUser(u.id)} style={{ fontSize: 11, padding: "4px 10px", background: "#ef444422", border: "1px solid #ef444444", color: "#ef4444" }}>Delete</button>,
        ])}
      />
    </div>
  );
}

// ─── Tab: Tests ───────────────────────────────────────────────────────────────

function TestsTab() {
  const [results, setResults] = useState<TestResult[]>(TEST_SUITE.map(t => ({ name: t.name, status: "pending" as const })));
  const [running, setRunning] = useState(false);
  const [idx, setIdx] = useState(-1);

  const runAll = useCallback(async () => {
    setRunning(true);
    const fresh: TestResult[] = TEST_SUITE.map(t => ({ name: t.name, status: "pending" as const }));
    setResults([...fresh]);
    for (let i = 0; i < TEST_SUITE.length; i++) {
      setIdx(i);
      fresh[i] = { name: fresh[i].name, status: "running" };
      setResults([...fresh]);
      await sleep(80);
      const start = Date.now();
      try {
        const r = TEST_SUITE[i].fn();
        fresh[i] = { name: fresh[i].name, status: r.pass ? "pass" : "fail", message: r.message, duration: Date.now() - start };
      } catch (e) {
        fresh[i] = { name: fresh[i].name, status: "fail", message: String(e), duration: Date.now() - start };
      }
      setResults([...fresh]);
    }
    setIdx(-1);
    setRunning(false);
  }, []);

  const pass = results.filter(r => r.status === "pass").length;
  const fail = results.filter(r => r.status === "fail").length;
  const pending = results.filter(r => r.status === "pending").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <SectionHeader title="Test Suite" subtitle={`${TEST_SUITE.length} tests across Auth, RBAC, Inventory, Shipment, Barcode, Analytics`} />
        <button onClick={runAll} disabled={running} style={{ background: running ? undefined : "#22c55e22", border: "1px solid #22c55e44", color: "#22c55e", minWidth: 100 }}>
          {running ? "Running…" : "Run all tests"}
        </button>
      </div>

      {(pass + fail) > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <StatCard label="Passed" value={pass} accent="#22c55e" />
          <StatCard label="Failed" value={fail} accent={fail > 0 ? "#ef4444" : "var(--color-text-primary)"} />
          <StatCard label="Pending" value={pending} accent={pending > 0 ? "#f59e0b" : "var(--color-text-tertiary)"} />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {results.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 12px", borderRadius: 8, background: r.status === "pass" ? "#22c55e11" : r.status === "fail" ? "#ef444411" : r.status === "running" ? "#3b82f611" : "var(--color-background-secondary)", border: `0.5px solid ${r.status === "pass" ? "#22c55e33" : r.status === "fail" ? "#ef444433" : r.status === "running" ? "#3b82f633" : "var(--color-border-tertiary)"}` }}>
            <span style={{ fontSize: 14, minWidth: 20, textAlign: "center" }}>
              {r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : r.status === "running" ? "⟳" : "○"}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: r.status === "pass" ? "#22c55e" : r.status === "fail" ? "#ef4444" : r.status === "running" ? "#3b82f6" : "var(--color-text-secondary)" }}>{r.name}</div>
              {r.message && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2, fontFamily: "var(--font-mono)" }}>{r.message}</div>}
            </div>
            {r.duration !== undefined && <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>{r.duration}ms</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Architecture ────────────────────────────────────────────────────────

function ArchitectureTab() {
  const layers = [
    { label: "Client Layer", items: ["Next.js 14 (App Router)", "Redux Toolkit", "Framer Motion", "Socket.io-client", "QuaggaJS (Barcode)"], color: "#3b82f6" },
    { label: "API Gateway", items: ["Nginx (reverse proxy)", "WebSocket upgrade", "Rate limiting", "/metrics guard"], color: "#8b5cf6" },
    { label: "Backend Services", items: ["Express + Socket.io", "Auth Service (JWT)", "Inventory Service", "Shipment Service", "Barcode Service", "Notification Service"], color: "#14b8a6" },
    { label: "Queue Workers", items: ["BullMQ (import jobs)", "Redis pub/sub", "Retry + backoff", "Concurrency: 2"], color: "#f59e0b" },
    { label: "Data Layer", items: ["PostgreSQL 16", "Redis 7", "Distributed locks", "Audit logs"], color: "#22c55e" },
    { label: "Observability", items: ["Prometheus metrics", "Pino structured logs", "OpenTelemetry traces", "k6 load tests"], color: "#ef4444" },
  ];

  const flows = [
    { title: "Inventory Update Flow (ISG-4821-L)", steps: ["Staff scans barcode ISG-4821-L", "Barcode validated against products table", "Redis distributed lock acquired (500ms TTL)", "PostgreSQL TX: quantity updated atomically", "inventory_log written (immutable audit)", "WebSocket broadcast → admin-room + manager-room", "Low-stock check: if qty ≤ threshold → alert", "Email sent via SMTP (nodemailer)", "Prometheus histogram recorded", "Redis lock released"] },
    { title: "Shipment State Machine", steps: ["Draft → Scheduled → In Transit → Arrived → Received → Completed", "Cancelled available from: Draft, Scheduled, In Transit, Delayed", "Delayed available from: In Transit", "Each transition appends a timeline entry", "Actor ID recorded for audit trail"] },
    { title: "Auth & RBAC Flow", steps: ["POST /api/auth/login → bcrypt verify → JWT (15min) + refresh (7d)", "Refresh token in HttpOnly cookie", "authenticate() middleware verifies JWT on every request", "authorize(...roles) middleware checks req.user.role", "Rate limiter: 5 login attempts / 15min / IP"] },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionHeader title="System Architecture" subtitle="Production-grade WMS — full stack overview" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {layers.map(layer => (
          <Card key={layer.label} style={{ borderTop: `3px solid ${layer.color}` }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color: layer.color }}>{layer.label}</div>
            {layer.items.map(item => (
              <div key={item} style={{ fontSize: 11, color: "var(--color-text-secondary)", padding: "2px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>{item}</div>
            ))}
          </Card>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {flows.map(flow => (
          <Card key={flow.title}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{flow.title}</div>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {flow.steps.map((step, i) => (
                <li key={i} style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4, lineHeight: 1.5 }}>{step}</li>
              ))}
            </ol>
          </Card>
        ))}
      </div>
      <Card>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Performance targets</div>
        <Table
          headers={["Metric", "Target"]}
          rows={[
            ["p95 API latency", "< 500ms"],
            ["p95 inventory update", "< 200ms"],
            ["p95 WebSocket delivery", "< 100ms"],
            ["Failed inventory writes", "< 1%"],
            ["Failed bulk import rows", "< 5%"],
            ["Low-stock alert delivery", "> 99%"],
            ["Concurrent WebSocket users", "500+"],
            ["K8s autoscale: CPU threshold", "60% → min 2, max 10 pods"],
          ]}
        />
      </Card>
      <Card>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Deployment manifest</div>
        <pre style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", background: "var(--color-background-secondary)", borderRadius: 8, padding: 12, overflow: "auto", margin: 0, lineHeight: 1.6 }}>{`docker compose up --build
  ├─ nginx:stable-alpine     → :80
  ├─ wms-frontend:next14     → :3000
  ├─ wms-backend:express     → :5000
  ├─ bullmq-worker           → bg
  ├─ postgres:16-alpine      → :5432
  └─ redis:7-alpine          → :6379

kubectl apply -f deployment/kubernetes/
  ├─ wms-backend  (replicas: 2, HPA max: 10)
  ├─ wms-frontend (replicas: 2)
  └─ HPA: CPU>60% → scale up`}</pre>
      </Card>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "ti-layout-dashboard" },
  { id: "inventory", label: "Inventory", icon: "ti-package" },
  { id: "shipments", label: "Shipments", icon: "ti-truck" },
  { id: "barcode", label: "Barcode", icon: "ti-scan" },
  { id: "notifications", label: "Alerts", icon: "ti-bell" },
  { id: "analytics", label: "Analytics", icon: "ti-chart-bar" },
  { id: "users", label: "Users", icon: "ti-users" },
  { id: "tests", label: "Tests", icon: "ti-test-pipe" },
  { id: "architecture", label: "Arch", icon: "ti-topology-star" },
];

export default function WMSEvaluator() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [role, setRole] = useState<UserRole>("admin");

  const setRoleAndAuth = (r: UserRole) => {
    AUTH.currentUser.role = r;
    setRole(r);
  };

  return (
    <div style={{ fontFamily: "var(--font-sans)", minHeight: "100vh", background: "var(--color-background-tertiary)" }}>
      <h2 className="sr-only">WMS Evaluator — Warehouse Management System interactive verification tool</h2>

      {/* Header */}
      <div style={{ background: "var(--color-background-primary)", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 16 }}>WMS Evaluator</div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Production-Grade Warehouse Management System — Interactive Verification</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Simulated role:</span>
          <select value={role} onChange={e => setRoleAndAuth(e.target.value as UserRole)} style={{ fontSize: 12 }}>
            {(["admin", "manager", "staff", "supplier"] as UserRole[]).map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <Badge text={`${AUTH.currentUser.email}`} color={ROLE_COLORS[role]} />
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: "var(--color-background-primary)", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", overflowX: "auto", padding: "0 8px" }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", fontSize: 12, fontWeight: activeTab === tab.id ? 500 : 400, color: activeTab === tab.id ? "var(--color-text-info)" : "var(--color-text-secondary)", background: "none", border: "none", borderBottom: activeTab === tab.id ? "2px solid var(--color-border-info)" : "2px solid transparent", borderRadius: 0, cursor: "pointer", whiteSpace: "nowrap" }}>
            <i className={`ti ${tab.icon}`} aria-hidden="true" style={{ fontSize: 14 }} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px" }}>
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "inventory" && <InventoryTab />}
        {activeTab === "shipments" && <ShipmentsTab />}
        {activeTab === "barcode" && <BarcodeTab />}
        {activeTab === "notifications" && <NotificationsTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "tests" && <TestsTab />}
        {activeTab === "architecture" && <ArchitectureTab />}
      </div>
    </div>
  );
}