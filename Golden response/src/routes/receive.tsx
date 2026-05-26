import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { receiveScan } from "@/lib/wms.functions";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, ScanLine, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/receive")({
  component: ReceivePage,
});

type ScanResult = {
  ok: boolean;
  sku: string;
  quantity_before: number;
  quantity_after: number;
  shipment_ref: string;
  log_id: string;
  low_stock: boolean;
};

function ReceivePage() {
  const { ready, email } = useAuthGuard();
  const scanFn = useServerFn(receiveScan);
  const [shipmentRef, setShipmentRef] = useState("SHP-20241103-007");
  const [sku, setSku] = useState("ISG-4821-L");
  const [quantity, setQuantity] = useState(1);
  const [history, setHistory] = useState<ScanResult[]>([]);

  const mutation = useMutation({
    mutationFn: (data: { shipmentRef: string; sku: string; quantity: number }) => scanFn({ data }),
    onSuccess: (result) => {
      setHistory((h) => [result, ...h].slice(0, 10));
      toast.success(`Scanned ${result.sku}: ${result.quantity_before} → ${result.quantity_after}`, {
        description: result.low_stock ? "⚠ Low stock — reorder recommended." : undefined,
      });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Scan failed"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipmentRef.trim() || !sku.trim() || quantity < 1) return;
    mutation.mutate({ shipmentRef: shipmentRef.trim(), sku: sku.trim().toUpperCase(), quantity });
  };

  if (!ready) return null;

  return (
    <AppShell email={email}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Inbound Receiving</h1>
        <p className="text-sm text-muted-foreground">
          Scan or manually enter a SKU to receive units against an open shipment.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanLine className="h-4 w-4" /> Scan / Manual entry
            </CardTitle>
            <CardDescription>
              Each scan acquires a per-SKU lock, runs an ACID transaction, updates stock, writes an immutable audit log, and broadcasts the change.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ship">Shipment reference</Label>
                <Input id="ship" value={shipmentRef} onChange={(e) => setShipmentRef(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sku">SKU / barcode</Label>
                <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} className="font-mono" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qty">Quantity</Label>
                <Input id="qty" type="number" min={1} max={10000} value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending ? "Processing…" : "Receive"}
              </Button>
            </form>
            <div className="mt-4 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Test scenario</p>
              <p className="mt-1">SHP-20241103-007 expects 24 × ISG-4821-L from SafeGear Inc. Initial stock 142, reorder threshold 50.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent scans</CardTitle>
            <CardDescription>This session.</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scans yet.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((r) => (
                  <li key={r.log_id} className="flex items-start gap-3 rounded-md border p-3">
                    {r.low_stock
                      ? <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
                      : <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-xs truncate">{r.sku}</p>
                        <Badge variant="outline" className="font-mono text-[10px]">{r.shipment_ref}</Badge>
                      </div>
                      <p className="text-sm tabular-nums">
                        {r.quantity_before} → <span className="font-semibold">{r.quantity_after}</span>
                        {r.low_stock && <span className="ml-2 text-amber-600 text-xs">low stock</span>}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
