import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardData } from "@/lib/wms.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Package, Truck, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

type ShipmentItem = { id: string; expected_quantity: number; received_quantity: number; products: { sku: string; name: string } | null };
type Shipment = { id: string; reference: string; supplier: string; status: string; created_at: string; shipment_items: ShipmentItem[] };
type Product = { id: string; sku: string; name: string; supplier: string; quantity: number; reorder_threshold: number };
type Log = { id: string; action: string; delta: number; quantity_after: number; created_at: string; products: { sku: string; name: string } | null };

function DashboardPage() {
  const { ready, email } = useAuthGuard();
  const fetchData = useServerFn(getDashboardData);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchData(),
    enabled: ready,
  });

  useEffect(() => {
    if (!ready) return;
    const channel = supabase
      .channel("wms-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () =>
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "shipments" }, () =>
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "shipment_items" }, () =>
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_logs" }, () =>
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ready, queryClient]);

  if (!ready) return null;

  const products = (data?.products ?? []) as Product[];
  const shipments = (data?.shipments ?? []) as Shipment[];
  const logs = (data?.logs ?? []) as Log[];
  const lowStock = products.filter((p) => p.quantity <= p.reorder_threshold);
  const activeShipments = shipments.filter((s) => s.status !== "Received" && s.status !== "Cancelled");

  return (
    <AppShell email={email}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live inventory and inbound shipments.</p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Realtime
        </Badge>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Package className="h-4 w-4" />} label="SKUs tracked" value={products.length} />
        <StatCard icon={<Truck className="h-4 w-4" />} label="Active shipments" value={activeShipments.length} />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Low stock"
          value={lowStock.length}
          accent={lowStock.length > 0 ? "destructive" : undefined}
        />
        <StatCard icon={<Activity className="h-4 w-4" />} label="Recent events" value={logs.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Inventory</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <SkeletonRows /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Reorder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => {
                    const low = p.quantity <= p.reorder_threshold;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                        <TableCell>{p.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className={low ? "text-destructive font-semibold" : ""}>{p.quantity}</span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">{p.reorder_threshold}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Shipments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {shipments.map((s) => {
              const total = s.shipment_items.reduce((a, i) => a + i.expected_quantity, 0);
              const received = s.shipment_items.reduce((a, i) => a + i.received_quantity, 0);
              const pct = total ? Math.round((received / total) * 100) : 0;
              return (
                <div key={s.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs">{s.reference}</p>
                      <p className="text-sm text-muted-foreground">{s.supplier}</p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">{received} / {total} received</p>
                </div>
              );
            })}
            {shipments.length === 0 && <p className="text-sm text-muted-foreground">No shipments.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">Audit log</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Delta</TableHead>
                <TableHead className="text-right">New qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{l.action}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{l.products?.sku ?? "—"}</TableCell>
                  <TableCell className={`text-right tabular-nums ${l.delta > 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {l.delta > 0 ? "+" : ""}{l.delta}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{l.quantity_after}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No events yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: "destructive" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        <p className={`mt-2 text-2xl font-semibold tabular-nums ${accent === "destructive" && value > 0 ? "text-destructive" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: "bg-muted text-muted-foreground",
    "In Transit": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    Receiving: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    Received: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    Cancelled: "bg-destructive/10 text-destructive",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? ""}`}>{status}</span>;
}

function SkeletonRows() {
  return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-muted" />)}</div>;
}
