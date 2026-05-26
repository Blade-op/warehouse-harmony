# Warehouse Management System (WMS)

## Project Overview

The Warehouse Management System (WMS) is a production-grade, enterprise-scale inventory and shipment management platform designed for high-concurrency warehouse environments. The system provides real-time inventory synchronization, barcode and QR-based product tracking, shipment lifecycle management, analytics dashboards, and role-based operational workflows.

This platform is built using a modern distributed architecture with scalability, observability, security, and operational reliability as first-class concerns.

### Key Features

* Real-time inventory synchronization using Socket.io
* Barcode and QR code generation and scanning
* Shipment lifecycle management with timeline tracking
* Role-Based Access Control (RBAC)
* Distributed locking using Redis
* PostgreSQL ACID-compliant inventory transactions
* BullMQ-powered asynchronous job processing
* Analytics dashboards and reporting
* Prometheus and OpenTelemetry observability
* Docker and Kubernetes deployment support
* CI/CD pipeline using GitHub Actions

### Supported Roles

| Role     | Permissions                                            |
| -------- | ------------------------------------------------------ |
| Admin    | Full system access, analytics, user management         |
| Manager  | Inventory + shipment management + analytics            |
| Staff    | Barcode scanning, inventory updates, shipment handling |
| Supplier | Read-only access to assigned products and shipments    |

---

# Repository Structure

```txt id="uwl04j"
project-root/
├── frontend/
│   ├── app/
│   ├── components/
│   │   ├── dashboard/
│   │   ├── inventory/
│   │   ├── shipments/
│   │   ├── barcode/
│   │   ├── analytics/
│   │   └── notifications/
│   ├── hooks/
│   ├── providers/
│   ├── services/
│   ├── store/
│   ├── styles/
│   └── utils/
│
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   └── controllers/
│   │   ├── auth/
│   │   ├── inventory/
│   │   ├── shipments/
│   │   ├── barcode/
│   │   ├── notifications/
│   │   ├── websocket/
│   │   ├── analytics/
│   │   ├── queues/
│   │   ├── monitoring/
│   │   ├── config/
│   │   └── utils/
│
├── database/
│   ├── schema/
│   ├── migrations/
│   └── seeds/
│
├── deployment/
│   ├── docker/
│   ├── kubernetes/
│   ├── nginx/
│   └── github-actions/
│
├── evaluation/
│   ├── k6/
│   ├── websocket-tests/
│   ├── benchmark-datasets/
│   └── reports/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── deployment/
│   └── troubleshooting/
│
├── .env.example
├── docker-compose.yml
├── package.json
└── README.md
```

---

# Running the Project

## Prerequisites

Install the following:

* Node.js >= 20
* Docker & Docker Compose
* PostgreSQL >= 15
* Redis >= 7
* Kubernetes (optional for production deployment)

---

# Local Development Setup

## 1. Clone Repository

```bash id="t8xtus"
git clone https://github.com/company/wms.git
cd wms
```

---

## 2. Configure Environment Variables

Copy the example environment file:

```bash id="sw7ryx"
cp .env.example .env
```

Update values inside `.env`.

---

## 3. Install Dependencies

### Backend

```bash id="7s2d2d"
cd backend
npm install
```

### Frontend

```bash id="d31l06"
cd ../frontend
npm install
```

---

## 4. Run Using Docker Compose

From project root:

```bash id="yd9lq9"
docker-compose up --build
```

This starts:

* Frontend
* Backend API
* PostgreSQL
* Redis
* BullMQ Worker
* Nginx Reverse Proxy

---

# Access Services

| Service     | URL                   |
| ----------- | --------------------- |
| Frontend    | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| Prometheus  | http://localhost:9090 |
| Grafana     | http://localhost:3001 |

---

# Running Tests

## Backend Unit Tests

```bash id="1bbnww"
cd backend
npm test
```

---

## Frontend Tests

```bash id="hdt6uk"
cd frontend
npm test
```

---

## Load Testing with k6

```bash id="y7g9oq"
cd evaluation/k6
k6 run inventory-load-test.js
```

---

## WebSocket Benchmark Testing

```bash id="gr7tbf"
node evaluation/websocket-tests/socket-latency-test.js
```

---

# Production Deployment

## Kubernetes Deployment

Apply manifests:

```bash id="jlwmte"
kubectl apply -f deployment/kubernetes/
```

---

## Horizontal Pod Autoscaling

The backend autoscaler automatically scales between:

* Minimum Replicas: 2
* Maximum Replicas: 10

Based on:

* CPU usage > 60%
* WebSocket traffic load

---

# Core System Workflow

## Inventory Update Flow

Example test case:

### Product

* SKU: ISG-4821-L
* Product: Industrial Safety Gloves

### Shipment

* SHP-20241103-007

### Execution Pipeline

1. Warehouse staff scans barcode
2. Barcode validated using Code-128 scanner
3. Redis distributed lock acquired
4. PostgreSQL transaction begins
5. Inventory updated atomically
6. Audit log generated
7. Shipment timeline updated
8. Socket.io event broadcasted
9. Dashboard refresh triggered
10. Low-stock check executed
11. Notification queued
12. Email alert dispatched

---

# Evaluation Methodology

The project includes a comprehensive evaluation framework to validate correctness, scalability, and operational reliability.

## Evaluation Categories

| Category              | Goal                                |
| --------------------- | ----------------------------------- |
| Inventory Correctness | Validate atomic stock updates       |
| WebSocket Accuracy    | Measure real-time delivery latency  |
| Barcode Reliability   | Validate scan success rate          |
| Notification SLA      | Measure notification delivery speed |
| API Latency           | Validate p95 response targets       |
| Concurrent Stability  | Test 500 simultaneous clients       |

---

# Evaluation Metrics

| Metric                        | Target  |
| ----------------------------- | ------- |
| p95 API Latency               | < 500ms |
| p95 Inventory Update Latency  | < 200ms |
| p95 WebSocket Delivery        | < 100ms |
| Failed Inventory Writes       | < 1%    |
| Notification Delivery Success | > 99%   |
| Concurrent WebSocket Clients  | 500+    |

---

# Load Testing Strategy

The evaluation framework uses:

* k6 for API load testing
* Socket.io benchmarking scripts
* Concurrent inventory write simulations
* Redis lock validation scenarios
* Barcode scan reliability datasets
* Notification SLA measurement

---

# Monitoring & Observability

Integrated observability stack:

* Prometheus metrics collection
* Grafana dashboards
* OpenTelemetry distributed tracing
* Structured logging using Pino
* Queue monitoring
* WebSocket connection monitoring

---

# Troubleshooting

## Common Issues

### WebSocket Disconnects

Ensure Nginx WebSocket upgrade headers are enabled.

### Redis Lock Timeout

Reduce transaction duration or increase Redis lock TTL.

### Barcode Scanner Failure

Verify browser camera permissions are granted.

### JWT Authentication Errors

Check token expiry and refresh token rotation settings.

### Bulk Import Failures

Validate CSV schema and required columns.

---

# License

This project is licensed under the MIT License.

---

# Contributors

* Full-Stack Engineering Team
* DevOps Team
* Platform Reliability Engineering Team
* Warehouse Operations Domain Experts
