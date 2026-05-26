# Warehouse Management System (WMS) — Production-Grade Engineering Prompt

---

# Context and Role

As a Full-Stack Engineer specializing in enterprise-grade supply chain systems and real-time inventory platforms, you are responsible for designing and implementing a production-grade Warehouse Management System (WMS). The system must provide accurate, real-time inventory tracking, role-based access, barcode/QR operations, shipment management, and analytics dashboards while ensuring scalability, security, and observability.

The system should help warehouse administrators, managers, staff, and suppliers manage inventory, track shipments, receive alerts, and generate actionable analytics through a modern, responsive interface.

---

# Objective

Develop a complete, production-ready Warehouse Management System that:

* Ingests and manages inventory records (products, SKUs, barcodes, quantities)
* Supports real-time inventory synchronization via WebSockets
* Provides role-based dashboards for admins, managers, staff, and suppliers
* Maintains shipment lifecycle tracking with timeline and alerts
* Generates and scans barcodes and QR codes for products and shipments
* Streams live updates to connected clients without server overload
* Supports scalable deployment for high-concurrency warehouse environments
* Includes monitoring, observability, and evaluation pipelines

---

# Critical Output Requirement

Generate complete, working, production-ready code organized into modular files.

Each file must serve a single responsibility.

Provide every file needed to run the system end to end.

Do not provide architecture descriptions alone — actual implementable code is required for every component described.

---

# Required Project Structure

```text id="s6pz1m"
project-root/
├── frontend/
│   ├── components/
│   │   ├── dashboard/
│   │   ├── inventory/
│   │   ├── shipments/
│   │   ├── barcode/
│   │   └── notifications/
│   ├── pages/
│   ├── hooks/
│   ├── store/
│   └── utils/
├── backend/
│   ├── api/
│   │   ├── routes/
│   │   └── middleware/
│   ├── inventory/
│   ├── shipments/
│   ├── barcode/
│   ├── notifications/
│   ├── auth/
│   └── monitoring/
├── database/
│   └── schema/
├── deployment/
│   ├── docker/
│   └── kubernetes/
├── evaluation/
└── docs/
```

---

# Test Case and Sample Data

Use the following as a concrete test scenario throughout all implementation examples.

## Sample Product

* Product: Industrial Safety Gloves
* SKU: `ISG-4821-L`
* Supplier: SafeGear Inc.
* Category: PPE
* Stock: 142 units
* Reorder Threshold: 50 units

---

# Sample Workflow

Warehouse staff scans barcode `ISG-4821-L` during inbound shipment `SHP-20241103-007`.

The system must:

1. Validate the scanned barcode
2. Update inventory count atomically in the database
3. Change shipment status to `Received`
4. Emit a WebSocket event to subscribed dashboard clients
5. Log warehouse activity
6. Trigger low-stock evaluation
7. Send in-app and email notifications if stock falls below threshold

All API examples, workflow demonstrations, and implementation examples must reference this test case.

---

# Core System Requirements

# 1. Inventory Management Pipeline

The system must support:

* Product creation
* SKU generation
* Barcode generation
* Supplier association
* Inventory CRUD operations
* Inventory history tracking
* Bulk CSV/Excel import and export
* Duplicate SKU and barcode detection
* Optimistic locking or transactional quantity updates
* Automated low-stock alerts
* Asynchronous bulk processing using Bull or BullMQ
* Retry mechanisms with maximum 3 retries

---

# Product Schema Requirements

Each product must include:

* name
* SKU
* barcode
* category
* quantity
* unit
* reorder_threshold
* expiration_date
* product_images
* supplier_association
* creation_timestamp
* last_updated_by
* warehouse_zone
* stock_history_log

---

# Inventory Integrity Requirements

The system must:

* Prevent negative inventory values
* Reject zero-SKU writes
* Maintain immutable inventory logs
* Track actor identity for every inventory mutation
* Prevent concurrent write conflicts
* Validate all quantity updates atomically

---

# 2. Barcode and QR Code Strategy

## Required Technologies

| Component       | Technology        |
| --------------- | ----------------- |
| Barcode Format  | Code-128          |
| QR Generator    | qrcode            |
| Browser Scanner | QuaggaJS or ZXing |

---

# Barcode System Requirements

Implement:

* Barcode generation module
* QR code generation module
* Browser-based barcode scanner
* Shipment barcode tracker
* Barcode collision prevention
* Mobile-compatible scanning support

---

# 3. Real-Time Synchronization Pipeline

Implement a WebSocket-based synchronization architecture using Socket.io.

---

# Real-Time Requirements

The system must support:

* Live inventory synchronization
* Shipment status broadcasting
* Dynamic dashboard updates
* Room-based subscriptions
* Warehouse-specific channels
* Debounced event batching
* High-concurrency client synchronization

---

# WebSocket Constraints

| Requirement            | Value |
| ---------------------- | ----- |
| Debounce Window        | 300ms |
| Concurrent Connections | 500+  |

---

# Real-Time Modules

Implement:

* Socket.io server
* Event emitter service
* Client-side socket hooks
* Subscription room manager
* Event batching utilities
* Real-time orchestration layer

---

# 4. Shipment Management

Implement complete shipment lifecycle tracking.

---

# Shipment Status Flow

```text id="x2r7vb"
Draft → Scheduled → In Transit → Arrived → Received → Completed
```

Additional statuses:

* Cancelled
* Delayed

---

# Shipment Schema Requirements

Each shipment must include:

* shipment_id
* origin
* destination
* carrier
* expected_delivery_date
* associated_products
* product_quantities
* assigned_staff_member
* timeline_entries
* status_history

---

# Shipment Features

Implement:

* Shipment timeline builder
* Status transition service
* Delayed shipment alerts
* Carrier analytics
* Transit-time analytics
* WebSocket shipment broadcasting

---

# Notification Strategy

The system must generate concise, actionable notifications.

Each notification must include:

* affected entity
* current status
* recommended action

If event data is insufficient, return:

```text id="m8u4yf"
Insufficient event data to generate notification.
```

---

# Notification Constraints

| Notification Type | Max Length           |
| ----------------- | -------------------- |
| SMS               | 160 characters       |
| In-App            | 300 characters       |
| Email Digest      | 10 aggregated events |

---

# 5. Hallucination-Free Data Integrity and Safety

The system must implement:

* Inventory write validation
* Distributed lock protection
* Barcode collision prevention
* Bulk import row-level validation
* Input sanitization
* File upload validation
* Immutable audit logging

---

# File Upload Constraints

| File Type  | Max Size |
| ---------- | -------- |
| CSV/Excel  | 10MB     |
| Images/PDF | 5MB      |

---

# Security Validation Requirements

Protect against:

* SQL injection
* XSS attacks
* Malicious uploads
* Unauthorized API access
* Concurrent inventory conflicts
* Brute-force login attempts

Use:

* Parameterized queries
* MIME-type validation
* JWT middleware
* Redis-backed distributed locks
* Output encoding

---

# 6. Frontend Requirements

## Frontend Stack

Use:

* Next.js (App Router)
* Tailwind CSS
* Redux Toolkit
* Framer Motion

---

# Required Dashboards

## Admin Dashboard

Must include:

* Inventory summary cards
* Live shipment monitor
* Low-stock alerts
* Supplier activity feed
* User management table

---

## Staff Dashboard

Must include:

* Assigned tasks
* Inventory scanner interface
* Shipment handling status
* Product update forms

---

# Required Frontend Components

Implement:

* Inventory tables
* Search and filter controls
* CRUD modals
* Barcode and QR display panels
* Shipment timeline views
* Analytics charts
* Notification center
* Dark mode provider
* Responsive layouts
* Accessibility support
* Framer Motion transitions

---

# Accessibility Requirements

The frontend must support:

* Semantic HTML
* ARIA labels
* Keyboard navigation
* WCAG accessibility compliance

---

# 7. Backend Requirements

## Backend Stack

Use:

* Node.js
* Express.js
* Socket.io
* JWT Authentication
* Bull or BullMQ

---

# Backend Responsibilities

Implement:

* Inventory CRUD APIs
* Shipment lifecycle APIs
* Barcode generation and validation
* JWT authentication
* RBAC middleware
* WebSocket broadcasting
* Background job processing
* Email notification dispatch
* Rate limiting

---

# Rate Limiting Constraints

| Rule           | Limit                    |
| -------------- | ------------------------ |
| API Requests   | 20 requests/minute/user  |
| Login Attempts | 5 attempts/15 minutes/IP |

---

# 8. Database and Storage

## Database Technologies

| Layer            | Technology              |
| ---------------- | ----------------------- |
| Primary Database | PostgreSQL              |
| Cache and Locks  | Redis                   |
| File Storage     | Local Storage or AWS S3 |

---

# Required Database Tables

Implement schemas for:

* users
* products
* inventory_logs
* shipments
* shipment_items
* notifications
* warehouse_activity

---

# Redis Responsibilities

Use Redis for:

* Session storage
* Distributed locking
* Job queues
* Rate limiting
* Cache storage

---

# 9. API Design Requirements

## Authentication APIs

```text id="n1q6dx"
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
```

---

# Inventory APIs

```text id="d9p2jw"
POST   /api/inventory
GET    /api/inventory
GET    /api/inventory/:id
PUT    /api/inventory/:id
DELETE /api/inventory/:id
POST   /api/inventory/bulk-import
GET    /api/inventory/export
```

---

# Shipment APIs

```text id="q8m4cl"
POST   /api/shipments
GET    /api/shipments
GET    /api/shipments/:id
PUT    /api/shipments/:id/status
DELETE /api/shipments/:id
```

---

# Barcode APIs

```text id="u4t7be"
POST   /api/barcode/generate
POST   /api/barcode/scan
GET    /api/barcode/:sku/image
```

---

# Notification APIs

```text id="z3r1yv"
GET    /api/notifications
PUT    /api/notifications/:id/read
DELETE /api/notifications/clear
```

---

# Analytics APIs

```text id="j7c8kx"
GET    /api/analytics/inventory
GET    /api/analytics/shipments
GET    /api/analytics/warehouse
```

---

# User Management APIs

```text id="p5f2hw"
GET    /api/users
PUT    /api/users/:id/role
DELETE /api/users/:id
```

---

# API Response Format

All APIs must return responses using the following structure:

```json id="y8v2sd"
{
  "status": "success",
  "data": {},
  "message": "string",
  "timestamp": "ISO8601",
  "request_id": "uuid"
}
```

---

# 10. Authentication and Security

Implement JWT authentication with refresh-token rotation.

---

# Token Configuration

| Token Type    | Expiry     |
| ------------- | ---------- |
| Access Token  | 15 minutes |
| Refresh Token | 7 days     |

Store refresh tokens in HttpOnly cookies.

---

# RBAC Roles

| Role     | Permissions                     |
| -------- | ------------------------------- |
| admin    | Full system access              |
| manager  | Inventory + shipment management |
| staff    | Operational workflows           |
| supplier | Read-only supplier access       |

---

# 11. Monitoring and Observability

Use:

* Prometheus
* Grafana
* OpenTelemetry

---

# Performance Thresholds

| Metric                         | Threshold |
| ------------------------------ | --------- |
| p95 inventory update latency   | < 200ms   |
| p95 WebSocket delivery latency | < 100ms   |
| p95 API latency                | < 500ms   |
| Failed inventory write rate    | < 1%      |
| Failed bulk import rows        | < 5%      |
| Low-stock alert delivery rate  | > 99%     |

---

# Monitoring Requirements

Implement:

* Metrics instrumentation
* Distributed tracing
* API latency tracking
* WebSocket monitoring
* Import-failure monitoring

---

# 12. Evaluation Framework

Design evaluation pipelines measuring:

* Inventory correctness
* Real-time synchronization accuracy
* Barcode scan reliability
* Notification delivery success
* API latency
* Concurrent-user stability

---

# Evaluation Constraints

| Evaluation Type        | Requirement  |
| ---------------------- | ------------ |
| Concurrent Write Tests | 50 scenarios |
| WebSocket Sync Tests   | 100 events   |
| Barcode Scan Tests     | 200 scans    |
| Concurrent Connections | 500 users    |

---

# Evaluation Deliverables

Provide:

* Benchmark datasets
* Metrics calculators
* Evaluation runner scripts
* Load-testing configurations

Use:

* k6
* Artillery

---

# 13. Deployment Requirements

Provide deployment architecture using:

* Docker
* Docker Compose
* Kubernetes
* GitHub Actions
* Nginx

---

# Containerized Services

The deployment must include:

* Frontend container
* Backend container
* PostgreSQL container
* Redis container
* Bull worker container
* Nginx reverse proxy

---

# Kubernetes Constraints

| Setting                  | Value     |
| ------------------------ | --------- |
| Minimum Backend Replicas | 2         |
| Maximum Backend Replicas | 10        |
| Scale Trigger            | CPU > 60% |

---

# Deployment Deliverables

Provide:

* docker-compose.yml
* Kubernetes manifests
* HPA configuration
* CI/CD workflow
* Nginx configuration
* .env.example

---

# Documentation Requirements

Provide:

* Folder structure explanations
* Local setup guide
* Production deployment guide
* Environment variable guide
* API documentation
* Architecture data-flow explanation
* Troubleshooting section

---

# Troubleshooting Coverage

The troubleshooting guide must include:

* WebSocket disconnect handling
* Redis lock timeout handling
* JWT expiration handling
* Bulk import validation failures
* Barcode scanner permission issues

---

# Performance and Scalability Requirements

The system must:

* Support 10,000+ inventory items
* Handle 500+ WebSocket clients
* Minimize redundant database operations
* Optimize memory usage
* Support future system extensions
* Maintain reproducible deployments

---

# Technical Constraints

## Frontend Technologies

* Next.js
* Tailwind CSS
* Redux Toolkit
* Framer Motion

---

# Backend Technologies

* Node.js
* Express.js
* Socket.io
* JWT
* Bull/BullMQ

---

# Infrastructure Technologies

* PostgreSQL
* Redis
* Docker
* Kubernetes

Do not replace required technologies with alternatives.

---

# Final Output Checklist

The final response must include:

1. Complete modular folder structure
2. Inventory CRUD pipeline
3. SKU and barcode generation modules
4. Browser barcode scanner
5. WebSocket synchronization pipeline
6. Shipment lifecycle management
7. Shipment timeline builder
8. Delayed shipment alert jobs
9. Redis distributed locking
10. Low-stock alert triggers
11. Bulk import/export handlers
12. Activity audit logger
13. Input sanitizer
14. File upload validator
15. Admin dashboard
16. Staff dashboard
17. Inventory management UI
18. Shipment tracking UI
19. Analytics dashboard
20. Notification center
21. Framer Motion configuration
22. Dark mode provider
23. Express backend APIs
24. PostgreSQL schemas
25. Redis session management
26. JWT authentication middleware
27. RBAC middleware
28. Rate limiting middleware
29. Prometheus instrumentation
30. OpenTelemetry instrumentation
31. Bull job workers
32. Email notification service
33. Evaluation runner scripts
34. Load-testing configuration
35. docker-compose.yml
36. Kubernetes manifests
37. HPA configuration
38. GitHub Actions workflow
39. Nginx configuration
40. .env.example
41. Complete README and setup guide
