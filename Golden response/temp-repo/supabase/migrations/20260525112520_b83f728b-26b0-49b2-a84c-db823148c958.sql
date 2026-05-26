
-- Roles enum + table (separate from profiles to prevent privilege escalation)
create type public.app_role as enum ('admin', 'manager', 'staff', 'supplier');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users read own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());
create policy "admins manage roles" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  supplier text not null,
  category text not null,
  quantity integer not null default 0 check (quantity >= 0),
  reorder_threshold integer not null default 0 check (reorder_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products (sku);
alter table public.products enable row level security;
create policy "auth read products" on public.products
  for select to authenticated using (true);

-- Shipments
create type public.shipment_status as enum ('Pending', 'In Transit', 'Receiving', 'Received', 'Cancelled');

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  supplier text not null,
  status public.shipment_status not null default 'Pending',
  expected_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shipments enable row level security;
create policy "auth read shipments" on public.shipments
  for select to authenticated using (true);

create table public.shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  product_id uuid not null references public.products(id),
  expected_quantity integer not null check (expected_quantity > 0),
  received_quantity integer not null default 0 check (received_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shipment_id, product_id)
);
create index on public.shipment_items (shipment_id);
alter table public.shipment_items enable row level security;
create policy "auth read shipment_items" on public.shipment_items
  for select to authenticated using (true);

-- Immutable audit log
create table public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  shipment_id uuid references public.shipments(id),
  user_id uuid references auth.users(id),
  action text not null,
  delta integer not null,
  quantity_before integer not null,
  quantity_after integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.inventory_logs (product_id, created_at desc);
alter table public.inventory_logs enable row level security;
create policy "auth read logs" on public.inventory_logs
  for select to authenticated using (true);

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "auth read notifications" on public.notifications
  for select to authenticated using (user_id is null or user_id = auth.uid());

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger shipments_touch before update on public.shipments
  for each row execute function public.touch_updated_at();
create trigger shipment_items_touch before update on public.shipment_items
  for each row execute function public.touch_updated_at();

-- Auto-create staff role on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'staff')
    on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Core: receive a scanned shipment item atomically
-- Per-SKU advisory lock + SELECT FOR UPDATE ensures concurrent scans are safe.
create or replace function public.receive_shipment_item(
  p_shipment_ref text,
  p_sku text,
  p_quantity integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_product products%rowtype;
  v_shipment shipments%rowtype;
  v_item shipment_items%rowtype;
  v_qty_before integer;
  v_qty_after integer;
  v_log_id uuid;
  v_remaining integer;
  v_low_stock boolean := false;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not (public.has_role(v_user, 'staff')
       or public.has_role(v_user, 'manager')
       or public.has_role(v_user, 'admin')) then
    raise exception 'Insufficient role' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  -- Distributed lock per SKU (xact-scoped, auto-released on commit/rollback)
  perform pg_advisory_xact_lock(hashtext('sku:' || p_sku));

  select * into v_product from public.products where sku = p_sku for update;
  if not found then
    raise exception 'Unknown SKU %', p_sku;
  end if;

  select * into v_shipment from public.shipments where reference = p_shipment_ref for update;
  if not found then
    raise exception 'Unknown shipment %', p_shipment_ref;
  end if;
  if v_shipment.status = 'Received' or v_shipment.status = 'Cancelled' then
    raise exception 'Shipment % is %', p_shipment_ref, v_shipment.status;
  end if;

  select * into v_item from public.shipment_items
    where shipment_id = v_shipment.id and product_id = v_product.id for update;
  if not found then
    raise exception 'SKU % is not part of shipment %', p_sku, p_shipment_ref;
  end if;

  v_remaining := v_item.expected_quantity - v_item.received_quantity;
  if p_quantity > v_remaining then
    raise exception 'Scanning % exceeds remaining % for SKU %', p_quantity, v_remaining, p_sku;
  end if;

  v_qty_before := v_product.quantity;
  v_qty_after := v_qty_before + p_quantity;

  update public.products set quantity = v_qty_after where id = v_product.id;
  update public.shipment_items set received_quantity = received_quantity + p_quantity
    where id = v_item.id;

  -- Move shipment to Receiving, or Received if fully complete
  if v_shipment.status = 'Pending' or v_shipment.status = 'In Transit' then
    update public.shipments set status = 'Receiving' where id = v_shipment.id;
  end if;

  if not exists (
    select 1 from public.shipment_items
    where shipment_id = v_shipment.id
      and received_quantity < expected_quantity
  ) then
    update public.shipments
      set status = 'Received', received_at = now()
      where id = v_shipment.id;
  end if;

  insert into public.inventory_logs
    (product_id, shipment_id, user_id, action, delta, quantity_before, quantity_after, metadata)
  values
    (v_product.id, v_shipment.id, v_user, 'receive_scan', p_quantity, v_qty_before, v_qty_after,
     jsonb_build_object('sku', p_sku, 'shipment_ref', p_shipment_ref))
  returning id into v_log_id;

  if v_qty_after <= v_product.reorder_threshold then
    v_low_stock := true;
    insert into public.notifications (user_id, kind, title, body, metadata)
    values (null, 'low_stock',
            'Low stock: ' || v_product.sku,
            v_product.name || ' is at ' || v_qty_after || ' (threshold ' || v_product.reorder_threshold || '). Reorder recommended.',
            jsonb_build_object('sku', v_product.sku, 'quantity', v_qty_after));
  end if;

  return jsonb_build_object(
    'ok', true,
    'sku', v_product.sku,
    'quantity_before', v_qty_before,
    'quantity_after', v_qty_after,
    'shipment_ref', p_shipment_ref,
    'log_id', v_log_id,
    'low_stock', v_low_stock
  );
end $$;

revoke all on function public.receive_shipment_item(text, text, integer) from public;
grant execute on function public.receive_shipment_item(text, text, integer) to authenticated;

-- Realtime
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.shipments;
alter publication supabase_realtime add table public.shipment_items;
alter publication supabase_realtime add table public.inventory_logs;
alter publication supabase_realtime add table public.notifications;
alter table public.products replica identity full;
alter table public.shipments replica identity full;
alter table public.shipment_items replica identity full;

-- Seed the mandatory test case
insert into public.products (sku, name, supplier, category, quantity, reorder_threshold)
values ('ISG-4821-L', 'Industrial Safety Gloves', 'SafeGear Inc.', 'PPE', 142, 50);

with s as (
  insert into public.shipments (reference, supplier, status, expected_at)
  values ('SHP-20241103-007', 'SafeGear Inc.', 'In Transit', now() + interval '1 day')
  returning id
)
insert into public.shipment_items (shipment_id, product_id, expected_quantity)
select s.id, p.id, 24
from s, public.products p where p.sku = 'ISG-4821-L';
