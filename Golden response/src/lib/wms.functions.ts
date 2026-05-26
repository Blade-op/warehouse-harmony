import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const scanSchema = z.object({
  shipmentRef: z.string().trim().min(1).max(64),
  sku: z.string().trim().min(1).max(64),
  quantity: z.number().int().positive().max(10000),
});

export const receiveScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => scanSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc("receive_shipment_item", {
      p_shipment_ref: data.shipmentRef,
      p_sku: data.sku,
      p_quantity: data.quantity,
    });
    if (error) {
      throw new Error(error.message);
    }
    return result as {
      ok: boolean;
      sku: string;
      quantity_before: number;
      quantity_after: number;
      shipment_ref: string;
      log_id: string;
      low_stock: boolean;
    };
  });

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [products, shipments, logs] = await Promise.all([
      supabase.from("products").select("*").order("sku"),
      supabase
        .from("shipments")
        .select("*, shipment_items(*, products(sku, name))")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("inventory_logs")
        .select("*, products(sku, name)")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    if (products.error) throw new Error(products.error.message);
    if (shipments.error) throw new Error(shipments.error.message);
    if (logs.error) throw new Error(logs.error.message);
    return {
      products: products.data ?? [],
      shipments: shipments.data ?? [],
      logs: logs.data ?? [],
    };
  });
