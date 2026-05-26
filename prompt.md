You are developing a full-stack web application for a logistics company to optimize warehouse inventory tracking and shipment receiving processes.

Context and Role
As a Full-Stack Developer working on enterprise-grade logistics systems, you are responsible for designing and implementing a concurrent-safe Warehouse Management System (WMS). The system must process real-time barcode scans, update inventory atomically, and maintain high consistency under high concurrency.

Objective
Develop a complete, production-ready full-stack application that provides real-time operations dashboards, inbound shipment processing, secure role-based access, and transactional safety.

Input Data
1. Products (Table Schema):
   - id: UUID (Primary Key)
   - sku: TEXT (Unique, Indexed)
   - name: TEXT
   - supplier: TEXT
   - category: TEXT
   - quantity: INTEGER (CHECK >= 0)
   - reorder_threshold: INTEGER (CHECK >= 0)
2. Shipments (Table Schema):
   - id: UUID (Primary Key)
   - reference: TEXT (Unique)
   - supplier: TEXT
   - status: ENUM ('Pending', 'In Transit', 'Receiving', 'Received', 'Cancelled')
   - expected_at: TIMESTAMPTZ
   - received_at: TIMESTAMPTZ
3. Shipment Items (Table Schema):
   - id: UUID (Primary Key)
   - shipment_id: UUID (References shipments)
   - product_id: UUID (References products)
   - expected_quantity: INTEGER (CHECK > 0)
   - received_quantity: INTEGER (CHECK >= 0)
   - Unique Constraint: (shipment_id, product_id)
4. Inventory Logs (Table Schema):
   - id: UUID (Primary Key)
   - product_id: UUID (References products)
   - shipment_id: UUID (References shipments)
   - user_id: UUID (References auth.users)
   - action: TEXT
   - delta: INTEGER
   - quantity_before: INTEGER
   - quantity_after: INTEGER
   - metadata: JSONB
   - created_at: TIMESTAMPTZ
5. User Roles (Table Schema):
   - id: UUID (Primary Key)
   - user_id: UUID (References auth.users)
   - role: ENUM ('admin', 'manager', 'staff', 'supplier')
6. Notifications (Table Schema):
   - id: UUID (Primary Key)
   - user_id: UUID (References auth.users)
   - kind: TEXT
   - title: TEXT
   - body: TEXT
   - read_at: TIMESTAMPTZ

*Test Scenario & Seed Data:*
- Product: Industrial Safety Gloves (SKU: ISG-4821-L, Supplier: SafeGear Inc., Category: PPE, Threshold: 50, Quantity: 142)
- Shipment: Reference SHP-20241103-007 expecting 24 units of ISG-4821-L

Data Processing Requirements
- Enable Row Level Security (RLS) on all database tables. Allow authenticated users to read records, and restrict roles accordingly.
- Set up a database trigger on new user registrations to auto-assign a default 'staff' role in the user_roles table.
- Configure real-time publication (supabase_realtime) for products, shipments, shipment_items, inventory_logs, and notifications to stream changes dynamically.

Model Requirements
- Implement a transactional Postgres RPC function receive_shipment_item(p_shipment_ref, p_sku, p_quantity):
  - Verify user authorization (must have 'staff', 'manager', or 'admin' role).
  - Acquire a transaction-scoped advisory lock for the SKU.
  - Query the product and shipment records inside a FOR UPDATE lock.
  - Assert that scanning the item does not exceed the remaining expected quantity.
  - Update product stock and shipment item counts atomically.
  - Progress shipment status to 'Receiving', or 'Received' when all expected items are complete.
  - Append an entry to the immutable inventory_logs table.
  - If stock falls at or below reorder_threshold, create a system notification.
- Expose server functions (RPC endpoints):
  - receiveScan: Validates incoming scanned SKU/shipment arguments with Zod, checks session claims, and executes receive_shipment_item.
  - getDashboardData: Queries products, recent shipments with nested shipment items, and recent inventory logs.

Output Requirements
- Develop a responsive web interface consisting of:
  - App Shell: Main header navigation (Dashboard, Receive), sign-out button, and active user profile indicator.
  - Operations Dashboard (/):
    - Stat cards for total SKUs, active shipments, low-stock count, and recent logs.
    - Live inventory data grid (SKUs and stock level).
    - Inbound shipments list displaying progress bars of received/expected quantities.
    - Audit logs grid showing chronological stock mutations.
  - Receiving Page (/receive):
    - Form to submit scan updates (Shipment Reference, SKU, quantity).
    - Recent scan history listing the updates processed during the session.
    - Detailed summary of the current test case scenario.
  - Login Page (/login):
    - Email/password authentication form.
    - Google OAuth authentication entry point.

Error Handling and Documentation
- Implement atomic rollbacks for all database changes if validation constraints fail.
- Catch SSR and catastrophic rendering failures with customized, styled fallback HTML pages.
- Handle authentication state transitions cleanly, redirecting unauthenticated users to /login.
- Document all core code functions, database locks, and routing procedures.

Performance and Scalability
- Configure indexes on frequently queried fields (sku, shipment_id, user_id).
- Ensure concurrent safety for up to 500 simultaneous scan interactions.
- Maintain a p95 update latency of less than 200ms.

Tools and Libraries
Use the following stack:
- TanStack Start (React 19 framework with SSR support)
- TanStack Router (File-system based client routing)
- TanStack Query (React Query for server state management)
- Supabase JS client (Database connection, Auth, and Real-time subscriptions)
- Tailwind CSS (v4 color and spacing theme definitions)
- lucide-react (vector icons)
- date-fns (date formatting)
- sonner (toast messaging)
- zod (schema assertion)
