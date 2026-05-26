#!/usr/bin/env python3
"""
Golden Response - Production-Grade Warehouse Management System (WMS)
Executable Python script that generates the complete WMS project structure,
all source files, configs, and deployment manifests.

Run with:  python golden_response.py
"""

import os
import sys
import json
import textwrap
from pathlib import Path

# ─────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────

ROOT = Path("wms-project")

def write(rel_path: str, content: str) -> None:
    """Create a file (and any missing parent dirs) under ROOT."""
    target = ROOT / rel_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(textwrap.dedent(content).lstrip("\n"))
    print(f"  ✔  {rel_path}")


# ─────────────────────────────────────────────
#  FILE DEFINITIONS
# ─────────────────────────────────────────────

FILES: dict[str, str] = {}

# ── .env.example ──────────────────────────────────────────────────────────────
FILES[".env.example"] = """
# ── Application ──────────────────────────────
NODE_ENV=development
PORT=5000

# ── JWT ──────────────────────────────────────
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ── Database ─────────────────────────────────
DATABASE_URL=postgresql://admin:password@localhost:5432/wms

# ── Redis ────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── AWS S3 (optional) ────────────────────────
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=

# ── Email ────────────────────────────────────
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# ── Frontend ─────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_WS_URL=ws://localhost:5000
"""

# ── backend/package.json ──────────────────────────────────────────────────────
FILES["backend/package.json"] = """
{
  "name": "wms-backend",
  "version": "1.0.0",
  "description": "Production-Grade WMS Backend",
  "scripts": {
    "dev": "nodemon src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "worker": "node dist/queues/worker.js",
    "test": "jest --forceExit"
  },
  "dependencies": {
    "express": "^4.19.2",
    "socket.io": "^4.7.5",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "ioredis": "^5.4.1",
    "bullmq": "^5.7.8",
    "pg": "^8.11.5",
    "zod": "^3.23.8",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "multer": "^1.4.5",
    "express-rate-limit": "^7.3.1",
    "rate-limit-redis": "^4.2.0",
    "prom-client": "^15.1.2",
    "pino": "^9.3.2",
    "pino-http": "^10.2.0",
    "qrcode": "^1.5.3",
    "bwip-js": "^4.5.0",
    "uuid": "^9.0.1",
    "nodemailer": "^6.9.13",
    "csv-parse": "^5.5.6",
    "csv-stringify": "^6.4.6",
    "@opentelemetry/sdk-node": "^0.52.0",
    "@opentelemetry/auto-instrumentations-node": "^0.46.1"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "nodemon": "^3.1.0",
    "ts-node": "^10.9.2",
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.7",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/bcryptjs": "^2.4.6",
    "@types/multer": "^1.4.11",
    "@types/nodemailer": "^6.4.15",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.4",
    "@types/jest": "^29.5.12"
  }
}
"""

# ── backend/tsconfig.json ─────────────────────────────────────────────────────
FILES["backend/tsconfig.json"] = """
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
"""

# ── backend/src/server.ts ─────────────────────────────────────────────────────
FILES["backend/src/server.ts"] = """
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';

import inventoryRoutes from './api/routes/inventory.routes';
import shipmentRoutes from './api/routes/shipment.routes';
import barcodeRoutes from './api/routes/barcode.routes';
import authRoutes from './api/routes/auth.routes';
import notificationRoutes from './api/routes/notification.routes';
import analyticsRoutes from './api/routes/analytics.routes';
import userRoutes from './api/routes/user.routes';
import metricsRoutes from './monitoring/metrics.routes';

import { setupWebSocket } from './websocket/socket.server';
import { apiLimiter, loginLimiter } from './api/middleware/rateLimiter.middleware';

const app = express();
const server = http.createServer(app);

// Socket.io
const io = new Server(server, { cors: { origin: '*' } });
setupWebSocket(io);

// Core middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(helmet());
app.use(pinoHttp());

// Rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/barcode', barcodeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/metrics', metricsRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`WMS Server running on port ${PORT}`);
});

export { io };
"""

# ── backend/src/websocket/socket.server.ts ───────────────────────────────────
FILES["backend/src/websocket/socket.server.ts"] = """
import { Server, Socket } from 'socket.io';

const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export function setupWebSocket(io: Server): void {
  io.on('connection', (socket: Socket) => {

    console.log(`[WS] Client connected: ${socket.id}`);

    // Room subscription
    socket.on('join-room', (room: string) => {
      socket.join(room);
      console.log(`[WS] ${socket.id} joined room: ${room}`);
    });

    socket.on('leave-room', (room: string) => {
      socket.leave(room);
    });

    // Debounced inventory update broadcast (300ms window)
    socket.on('inventory-update', (payload: unknown) => {
      const key = 'inventory-changed';
      clearTimeout(debounceTimers[key]);
      debounceTimers[key] = setTimeout(() => {
        io.to('admin-room').emit('inventory-changed', payload);
        io.to('manager-room').emit('inventory-changed', payload);
      }, 300);
    });

    // Shipment status broadcast
    socket.on('shipment-update', (payload: unknown) => {
      io.emit('shipment-changed', payload);
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });
}

/** Emit from any backend service */
export function emitToRoom(
  io: Server,
  room: string,
  event: string,
  payload: unknown
): void {
  io.to(room).emit(event, payload);
}
"""

# ── backend/src/inventory/inventory.service.ts ────────────────────────────────
FILES["backend/src/inventory/inventory.service.ts"] = """
import Redis from 'ioredis';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { inventoryLatency } from '../monitoring/prometheus';

const redis = new Redis(process.env.REDIS_URL!);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Create Product ─────────────────────────────────────────────────────────
export async function createProduct(data: {
  name: string;
  sku: string;
  barcode: string;
  quantity: number;
  reorder_threshold: number;
  supplier_name?: string;
  warehouse_zone?: string;
  category?: string;
}) {
  const result = await pool.query(
    `INSERT INTO products
       (id, name, sku, barcode, quantity, reorder_threshold, supplier_name, warehouse_zone, category)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      uuidv4(), data.name, data.sku, data.barcode,
      data.quantity, data.reorder_threshold,
      data.supplier_name ?? null, data.warehouse_zone ?? null,
      data.category ?? null,
    ]
  );
  return result.rows[0];
}

// ── List Products ──────────────────────────────────────────────────────────
export async function listProducts(filters: {
  category?: string;
  low_stock?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.search) {
    conditions.push(`(name ILIKE $${idx} OR sku ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }
  if (filters.category) {
    conditions.push(`category = $${idx++}`);
    params.push(filters.category);
  }
  if (filters.low_stock) {
    conditions.push(`quantity <= reorder_threshold`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  params.push(limit, offset);

  const result = await pool.query(
    `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  );
  return result.rows;
}

// ── Atomic Inventory Update with Distributed Lock ──────────────────────────
export async function updateInventory(
  productId: string,
  delta: number,
  actorId: string,
  reason = 'Manual Update'
) {
  const end = inventoryLatency.startTimer();
  const lockKey = `lock:inventory:${productId}`;

  // Acquire Redis distributed lock (500ms TTL)
  const acquired = await redis.set(lockKey, 'locked', 'PX', 500, 'NX');
  if (!acquired) throw new Error('Concurrent inventory update detected — please retry');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM products WHERE id = $1 FOR UPDATE`,
      [productId]
    );
    const product = rows[0];
    if (!product) throw new Error('Product not found');

    const newQuantity = product.quantity + delta;
    if (newQuantity < 0) throw new Error('Negative stock not allowed');

    await client.query(
      `UPDATE products SET quantity = $1, version = version + 1 WHERE id = $2`,
      [newQuantity, productId]
    );

    await client.query(
      `INSERT INTO inventory_logs
         (id, product_id, actor_id, previous_quantity, new_quantity, reason)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [uuidv4(), productId, actorId, product.quantity, newQuantity, reason]
    );

    await client.query('COMMIT');

    return {
      status: 'success',
      previousQuantity: product.quantity,
      updatedQuantity: newQuantity,
      lowStock: newQuantity <= product.reorder_threshold,
      product,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await redis.del(lockKey);
    end();
  }
}

// ── Bulk Import (queued) ───────────────────────────────────────────────────
export async function bulkImportProducts(rows: Record<string, string>[]) {
  const results: { success: number; failed: number; errors: string[] } = {
    success: 0, failed: 0, errors: [],
  };

  for (const [i, row] of rows.entries()) {
    try {
      if (!row.sku || !row.name || !row.barcode) {
        throw new Error(`Row ${i + 1}: missing required field (sku/name/barcode)`);
      }
      await createProduct({
        name: row.name,
        sku: row.sku,
        barcode: row.barcode,
        quantity: Number(row.quantity ?? 0),
        reorder_threshold: Number(row.reorder_threshold ?? 0),
        supplier_name: row.supplier_name,
        warehouse_zone: row.warehouse_zone,
        category: row.category,
      });
      results.success++;
    } catch (err: unknown) {
      results.failed++;
      results.errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return results;
}
"""

# ── backend/src/shipments/shipment.service.ts ─────────────────────────────────
FILES["backend/src/shipments/shipment.service.ts"] = """
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

type ShipmentStatus =
  | 'Draft' | 'Scheduled' | 'In Transit'
  | 'Arrived' | 'Received' | 'Completed'
  | 'Cancelled' | 'Delayed';

const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  Draft:       ['Scheduled', 'Cancelled'],
  Scheduled:   ['In Transit', 'Cancelled'],
  'In Transit':['Arrived', 'Delayed', 'Cancelled'],
  Arrived:     ['Received'],
  Received:    ['Completed'],
  Completed:   [],
  Cancelled:   [],
  Delayed:     ['In Transit', 'Cancelled'],
};

export async function createShipment(data: {
  shipment_code: string;
  origin?: string;
  destination?: string;
  carrier?: string;
  expected_delivery_date?: string;
}) {
  const result = await pool.query(
    `INSERT INTO shipments
       (id, shipment_code, status, origin, destination, carrier, expected_delivery_date)
     VALUES ($1,$2,'Draft',$3,$4,$5,$6) RETURNING *`,
    [
      uuidv4(), data.shipment_code, data.origin ?? null,
      data.destination ?? null, data.carrier ?? null,
      data.expected_delivery_date ?? null,
    ]
  );
  return result.rows[0];
}

export async function transitionStatus(
  shipmentId: string,
  newStatus: ShipmentStatus,
  actorId: string
) {
  const { rows } = await pool.query(
    `SELECT * FROM shipments WHERE id = $1`,
    [shipmentId]
  );
  const shipment = rows[0];
  if (!shipment) throw new Error('Shipment not found');

  const allowed = VALID_TRANSITIONS[shipment.status as ShipmentStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Invalid transition: ${shipment.status} → ${newStatus}`
    );
  }

  await pool.query(
    `UPDATE shipments SET status = $1 WHERE id = $2`,
    [newStatus, shipmentId]
  );

  // Timeline entry
  await pool.query(
    `INSERT INTO shipment_timeline
       (id, shipment_id, status, actor_id, note, created_at)
     VALUES ($1,$2,$3,$4,$5,NOW())`,
    [
      uuidv4(), shipmentId, newStatus, actorId,
      `Status changed to ${newStatus}`,
    ]
  );

  return { shipmentId, previousStatus: shipment.status, newStatus };
}

export async function listShipments(filters: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const params: unknown[] = [];
  let where = '';
  if (filters.status) {
    where = 'WHERE status = $1';
    params.push(filters.status);
  }
  params.push(filters.limit ?? 50, filters.offset ?? 0);
  const idx = params.length;
  const result = await pool.query(
    `SELECT * FROM shipments ${where} ORDER BY created_at DESC
     LIMIT $${idx - 1} OFFSET $${idx}`,
    params
  );
  return result.rows;
}

export async function getShipmentTimeline(shipmentId: string) {
  const result = await pool.query(
    `SELECT * FROM shipment_timeline WHERE shipment_id = $1 ORDER BY created_at ASC`,
    [shipmentId]
  );
  return result.rows;
}
"""

# ── backend/src/barcode/barcode.service.ts ────────────────────────────────────
FILES["backend/src/barcode/barcode.service.ts"] = """
import bwipjs from 'bwip-js';
import QRCode from 'qrcode';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function generateBarcode(sku: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: sku,
    scale: 3,
    height: 10,
    includetext: true,
  });
}

export async function generateQRCode(data: string): Promise<string> {
  return QRCode.toDataURL(data);
}

export async function validateBarcode(barcode: string): Promise<{
  valid: boolean;
  product?: Record<string, unknown>;
}> {
  const result = await pool.query(
    `SELECT * FROM products WHERE barcode = $1 OR sku = $1 LIMIT 1`,
    [barcode]
  );
  if (result.rows.length === 0) return { valid: false };
  return { valid: true, product: result.rows[0] };
}

export async function isBarcodeUnique(barcode: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT id FROM products WHERE barcode = $1 LIMIT 1`,
    [barcode]
  );
  return result.rows.length === 0;
}
"""

# ── backend/src/auth/auth.service.ts ─────────────────────────────────────────
FILES["backend/src/auth/auth.service.ts"] = """
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ACCESS_EXPIRES  = '15m';
const REFRESH_EXPIRES = '7d';

export async function register(data: {
  email: string;
  password: string;
  role?: string;
}) {
  const hash = await bcrypt.hash(data.password, 10);
  const result = await pool.query(
    `INSERT INTO users (id, email, password_hash, role)
     VALUES ($1,$2,$3,$4) RETURNING id, email, role, created_at`,
    [uuidv4(), data.email, hash, data.role ?? 'staff']
  );
  return result.rows[0];
}

export async function login(email: string, password: string) {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );
  const user = rows[0];
  if (!user) throw new Error('Invalid credentials');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error('Invalid credentials');

  const payload = { id: user.id, email: user.email, role: user.role };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: ACCESS_EXPIRES,
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: REFRESH_EXPIRES,
  });

  return { accessToken, refreshToken, user: payload };
}

export function verifyToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET!);
}
"""

# ── backend/src/api/middleware/auth.middleware.ts ─────────────────────────────
FILES["backend/src/api/middleware/auth.middleware.ts"] = """
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../../auth/auth.service';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: string };
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

  try {
    req.user = verifyToken(token) as { id: string; email: string; role: string };
    next();
  } catch {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
  }
}
"""

# ── backend/src/api/middleware/rbac.middleware.ts ─────────────────────────────
FILES["backend/src/api/middleware/rbac.middleware.ts"] = """
import { Request, Response, NextFunction } from 'express';

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }
    next();
  };
}
"""

# ── backend/src/api/middleware/rateLimiter.middleware.ts ─────────────────────
FILES["backend/src/api/middleware/rateLimiter.middleware.ts"] = """
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 20,                   // 20 req / min / user
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests — slow down.' },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                    // 5 attempts / 15 min / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many login attempts — try again later.' },
});
"""

# ── backend/src/api/middleware/validate.middleware.ts ────────────────────────
FILES["backend/src/api/middleware/validate.middleware.ts"] = """
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: result.error.errors,
      });
    }
    req.body = result.data;
    next();
  };
}
"""

# ── backend/src/api/routes/auth.routes.ts ────────────────────────────────────
FILES["backend/src/api/routes/auth.routes.ts"] = """
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { register, login } from '../../auth/auth.service';
import { validate } from '../middleware/validate.middleware';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin','manager','staff','supplier']).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/register', validate(RegisterSchema), async (req: Request, res: Response) => {
  try {
    const user = await register(req.body);
    res.status(201).json({
      status: 'success', data: user, message: 'User registered',
      timestamp: new Date().toISOString(), request_id: uuidv4(),
    });
  } catch (err: unknown) {
    res.status(400).json({ status: 'error', message: (err as Error).message });
  }
});

router.post('/login', validate(LoginSchema), async (req: Request, res: Response) => {
  try {
    const tokens = await login(req.body.email, req.body.password);
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 3600 * 1000,
    });
    res.json({
      status: 'success', data: { accessToken: tokens.accessToken, user: tokens.user },
      message: 'Login successful', timestamp: new Date().toISOString(), request_id: uuidv4(),
    });
  } catch (err: unknown) {
    res.status(401).json({ status: 'error', message: (err as Error).message });
  }
});

export default router;
"""

# ── backend/src/api/routes/inventory.routes.ts ───────────────────────────────
FILES["backend/src/api/routes/inventory.routes.ts"] = """
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';

import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createProduct, listProducts,
  updateInventory, bulkImportProducts,
} from '../../inventory/inventory.service';
import { importQueue } from '../../queues/import.queue';

const router = Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

const ProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  reorder_threshold: z.number().int().nonnegative(),
  supplier_name: z.string().optional(),
  warehouse_zone: z.string().optional(),
  category: z.string().optional(),
});

router.use(authenticate);

router.post('/', authorize('admin','manager'), validate(ProductSchema), async (req, res) => {
  try {
    const product = await createProduct(req.body);
    res.status(201).json({
      status: 'success', data: product, message: 'Product created',
      timestamp: new Date().toISOString(), request_id: uuidv4(),
    });
  } catch (err: unknown) {
    res.status(400).json({ status: 'error', message: (err as Error).message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  const products = await listProducts({
    search: req.query.search as string | undefined,
    category: req.query.category as string | undefined,
    low_stock: req.query.low_stock === 'true',
    limit: req.query.limit ? Number(req.query.limit) : 50,
    offset: req.query.offset ? Number(req.query.offset) : 0,
  });
  res.json({
    status: 'success', data: products, message: 'OK',
    timestamp: new Date().toISOString(), request_id: uuidv4(),
  });
});

router.put('/:id/quantity', authorize('admin','manager','staff'), async (req: Request, res: Response) => {
  try {
    const result = await updateInventory(
      req.params.id, req.body.delta, req.user!.id, req.body.reason
    );
    res.json({
      status: 'success', data: result, message: 'Inventory updated',
      timestamp: new Date().toISOString(), request_id: uuidv4(),
    });
  } catch (err: unknown) {
    res.status(400).json({ status: 'error', message: (err as Error).message });
  }
});

router.post('/bulk-import', authorize('admin','manager'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ status: 'error', message: 'No file provided' });
  const rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true });
  const job = await importQueue.add('bulk-import', { rows });
  res.json({
    status: 'success', data: { jobId: job.id }, message: 'Bulk import queued',
    timestamp: new Date().toISOString(), request_id: uuidv4(),
  });
});

export default router;
"""

# ── backend/src/api/routes/shipment.routes.ts ────────────────────────────────
FILES["backend/src/api/routes/shipment.routes.ts"] = """
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import {
  createShipment, listShipments, transitionStatus, getShipmentTimeline,
} from '../../shipments/shipment.service';

const router = Router();
router.use(authenticate);

router.post('/', authorize('admin','manager'), async (req: Request, res: Response) => {
  try {
    const shipment = await createShipment(req.body);
    res.status(201).json({
      status: 'success', data: shipment, message: 'Shipment created',
      timestamp: new Date().toISOString(), request_id: uuidv4(),
    });
  } catch (err: unknown) {
    res.status(400).json({ status: 'error', message: (err as Error).message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  const shipments = await listShipments({
    status: req.query.status as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : 50,
    offset: req.query.offset ? Number(req.query.offset) : 0,
  });
  res.json({
    status: 'success', data: shipments, message: 'OK',
    timestamp: new Date().toISOString(), request_id: uuidv4(),
  });
});

router.put('/:id/status', authorize('admin','manager','staff'), async (req: Request, res: Response) => {
  try {
    const result = await transitionStatus(req.params.id, req.body.status, req.user!.id);
    res.json({
      status: 'success', data: result, message: 'Status updated',
      timestamp: new Date().toISOString(), request_id: uuidv4(),
    });
  } catch (err: unknown) {
    res.status(400).json({ status: 'error', message: (err as Error).message });
  }
});

router.get('/:id/timeline', async (req: Request, res: Response) => {
  const timeline = await getShipmentTimeline(req.params.id);
  res.json({
    status: 'success', data: timeline, message: 'OK',
    timestamp: new Date().toISOString(), request_id: uuidv4(),
  });
});

export default router;
"""

# ── backend/src/api/routes/barcode.routes.ts ─────────────────────────────────
FILES["backend/src/api/routes/barcode.routes.ts"] = """
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.middleware';
import { generateBarcode, generateQRCode, validateBarcode } from '../../barcode/barcode.service';

const router = Router();
router.use(authenticate);

router.post('/generate', async (req: Request, res: Response) => {
  const { sku } = req.body;
  if (!sku) return res.status(400).json({ status: 'error', message: 'SKU required' });
  const buffer = await generateBarcode(sku);
  res.set('Content-Type', 'image/png');
  res.send(buffer);
});

router.get('/:sku/image', async (req: Request, res: Response) => {
  const buffer = await generateBarcode(req.params.sku);
  res.set('Content-Type', 'image/png');
  res.send(buffer);
});

router.post('/scan', async (req: Request, res: Response) => {
  const { barcode } = req.body;
  if (!barcode) return res.status(400).json({ status: 'error', message: 'Barcode required' });
  const result = await validateBarcode(barcode);
  res.json({
    status: 'success', data: result, message: result.valid ? 'Valid barcode' : 'Barcode not found',
    timestamp: new Date().toISOString(), request_id: uuidv4(),
  });
});

export default router;
"""

# ── backend/src/api/routes/notification.routes.ts ────────────────────────────
FILES["backend/src/api/routes/notification.routes.ts"] = """
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.user!.id]
  );
  res.json({ status: 'success', data: rows, message: 'OK',
    timestamp: new Date().toISOString(), request_id: uuidv4() });
});

router.put('/:id/read', async (req: Request, res: Response) => {
  await pool.query(`UPDATE notifications SET read = true WHERE id = $1`, [req.params.id]);
  res.json({ status: 'success', data: null, message: 'Marked as read',
    timestamp: new Date().toISOString(), request_id: uuidv4() });
});

router.delete('/clear', async (req: Request, res: Response) => {
  await pool.query(`DELETE FROM notifications WHERE user_id = $1`, [req.user!.id]);
  res.json({ status: 'success', data: null, message: 'Cleared',
    timestamp: new Date().toISOString(), request_id: uuidv4() });
});

export default router;
"""

# ── backend/src/api/routes/analytics.routes.ts ───────────────────────────────
FILES["backend/src/api/routes/analytics.routes.ts"] = """
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.use(authenticate, authorize('admin', 'manager'));

router.get('/inventory', async (_req: Request, res: Response) => {
  const [total, lowStock, categories] = await Promise.all([
    pool.query(`SELECT COUNT(*) as total, SUM(quantity) as total_units FROM products`),
    pool.query(`SELECT COUNT(*) as count FROM products WHERE quantity <= reorder_threshold`),
    pool.query(`SELECT category, COUNT(*) as count FROM products GROUP BY category`),
  ]);
  res.json({
    status: 'success',
    data: {
      total_products: Number(total.rows[0].total),
      total_units: Number(total.rows[0].total_units),
      low_stock_count: Number(lowStock.rows[0].count),
      by_category: categories.rows,
    },
    message: 'OK', timestamp: new Date().toISOString(), request_id: uuidv4(),
  });
});

router.get('/shipments', async (_req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT status, COUNT(*) as count FROM shipments GROUP BY status`
  );
  res.json({
    status: 'success', data: result.rows, message: 'OK',
    timestamp: new Date().toISOString(), request_id: uuidv4(),
  });
});

export default router;
"""

# ── backend/src/api/routes/user.routes.ts ────────────────────────────────────
FILES["backend/src/api/routes/user.routes.ts"] = """
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.use(authenticate, authorize('admin'));

router.get('/', async (_req: Request, res: Response) => {
  const { rows } = await pool.query(`SELECT id, email, role, created_at FROM users ORDER BY created_at DESC`);
  res.json({ status: 'success', data: rows, message: 'OK',
    timestamp: new Date().toISOString(), request_id: uuidv4() });
});

router.put('/:id/role', async (req: Request, res: Response) => {
  const { role } = req.body;
  const allowed = ['admin','manager','staff','supplier'];
  if (!allowed.includes(role)) return res.status(400).json({ status: 'error', message: 'Invalid role' });
  await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, req.params.id]);
  res.json({ status: 'success', data: null, message: 'Role updated',
    timestamp: new Date().toISOString(), request_id: uuidv4() });
});

router.delete('/:id', async (req: Request, res: Response) => {
  await pool.query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
  res.json({ status: 'success', data: null, message: 'User deleted',
    timestamp: new Date().toISOString(), request_id: uuidv4() });
});

export default router;
"""

# ── backend/src/queues/import.queue.ts ───────────────────────────────────────
FILES["backend/src/queues/import.queue.ts"] = """
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { bulkImportProducts } from '../inventory/inventory.service';

const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export const importQueue = new Queue('inventory-import', { connection });

new Worker(
  'inventory-import',
  async (job) => {
    console.log(`[Queue] Processing import job ${job.id}`);
    const result = await bulkImportProducts(job.data.rows);
    console.log(`[Queue] Import done — success:${result.success} failed:${result.failed}`);
    return result;
  },
  {
    connection,
    concurrency: 2,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    },
  }
);
"""

# ── backend/src/notifications/notification.service.ts ────────────────────────
FILES["backend/src/notifications/notification.service.ts"] = """
import nodemailer from 'nodemailer';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendLowStockNotification(product: {
  id: string; name: string; sku: string; quantity: number; reorder_threshold: number;
}) {
  // In-app
  const message = `Low stock alert: ${product.name} (${product.sku}) — only ${product.quantity} units left (threshold: ${product.reorder_threshold}).`.slice(0, 300);

  await pool.query(
    `INSERT INTO notifications (id, type, message, entity_id, created_at)
     VALUES ($1,'LOW_STOCK',$2,$3,NOW())`,
    [uuidv4(), message, product.id]
  );

  // Email
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.ALERT_EMAIL ?? process.env.SMTP_USER,
    subject: `[WMS] Low Stock: ${product.name}`,
    text: message,
  }).catch(err => console.error('[Email] Failed to send:', err));
}
"""

# ── backend/src/monitoring/prometheus.ts ─────────────────────────────────────
FILES["backend/src/monitoring/prometheus.ts"] = """
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const inventoryLatency = new client.Histogram({
  name: 'inventory_update_latency_ms',
  help: 'Latency of atomic inventory updates',
  buckets: [50, 100, 200, 500, 1000],
  registers: [register],
});

export const apiLatency = new client.Histogram({
  name: 'api_request_latency_ms',
  help: 'API endpoint request latency',
  labelNames: ['method', 'route', 'status'],
  buckets: [50, 100, 200, 500, 1000, 2000],
  registers: [register],
});

export const wsConnections = new client.Gauge({
  name: 'websocket_connections_total',
  help: 'Current WebSocket connections',
  registers: [register],
});

export const notificationsSent = new client.Counter({
  name: 'notifications_sent_total',
  help: 'Total notifications dispatched',
  labelNames: ['type'],
  registers: [register],
});

export { register };
"""

# ── backend/src/monitoring/metrics.routes.ts ─────────────────────────────────
FILES["backend/src/monitoring/metrics.routes.ts"] = """
import { Router } from 'express';
import { register } from './prometheus';

const router = Router();

router.get('/', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export default router;
"""

# ── database/schema/schema.sql ────────────────────────────────────────────────
FILES["database/schema/schema.sql"] = """
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'staff'
                CHECK (role IN ('admin','manager','staff','supplier')),
  created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Products / Inventory
CREATE TABLE IF NOT EXISTS products (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  sku               VARCHAR(120) UNIQUE NOT NULL,
  barcode           VARCHAR(120) UNIQUE NOT NULL,
  category          VARCHAR(100),
  quantity          INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit              VARCHAR(50) DEFAULT 'unit',
  reorder_threshold INTEGER     NOT NULL DEFAULT 0 CHECK (reorder_threshold >= 0),
  expiration_date   DATE,
  supplier_name     VARCHAR(255),
  warehouse_zone    VARCHAR(50),
  version           INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Inventory mutation log (immutable)
CREATE TABLE IF NOT EXISTS inventory_logs (
  id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID      REFERENCES products(id) ON DELETE SET NULL,
  actor_id          UUID      REFERENCES users(id) ON DELETE SET NULL,
  previous_quantity INTEGER,
  new_quantity      INTEGER,
  reason            TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Shipments
CREATE TABLE IF NOT EXISTS shipments (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_code         VARCHAR(120) UNIQUE NOT NULL,
  status                VARCHAR(50) NOT NULL DEFAULT 'Draft'
                        CHECK (status IN (
                          'Draft','Scheduled','In Transit','Arrived',
                          'Received','Completed','Cancelled','Delayed'
                        )),
  origin                VARCHAR(255),
  destination           VARCHAR(255),
  carrier               VARCHAR(255),
  expected_delivery_date TIMESTAMP,
  assigned_staff_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Shipment timeline entries
CREATE TABLE IF NOT EXISTS shipment_timeline (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID      REFERENCES shipments(id) ON DELETE CASCADE,
  status      VARCHAR(50),
  actor_id    UUID      REFERENCES users(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Shipment items
CREATE TABLE IF NOT EXISTS shipment_items (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID    REFERENCES shipments(id) ON DELETE CASCADE,
  product_id  UUID    REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL CHECK (quantity > 0)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID      REFERENCES users(id) ON DELETE CASCADE,
  entity_id   UUID,
  type        VARCHAR(50),
  message     TEXT,
  read        BOOLEAN   NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Warehouse activity log
CREATE TABLE IF NOT EXISTS warehouse_activity (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID      REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT,
  entity_type VARCHAR(50),
  entity_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_products_sku       ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode   ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_pid ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status   ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_notifications_uid  ON notifications(user_id);
"""

# ── database/seeds/seed.sql ───────────────────────────────────────────────────
FILES["database/seeds/seed.sql"] = """
-- Seed: Admin user (password = 'admin1234')
INSERT INTO users (email, password_hash, role) VALUES
  ('admin@wms.local',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'admin')
ON CONFLICT DO NOTHING;

-- Seed: Sample product (Industrial Safety Gloves)
INSERT INTO products
  (name, sku, barcode, category, quantity, reorder_threshold, supplier_name, warehouse_zone)
VALUES
  ('Industrial Safety Gloves', 'ISG-4821-L', 'ISG-4821-L',
   'PPE', 142, 50, 'SafeGear Inc.', 'ZONE-A')
ON CONFLICT DO NOTHING;

-- Seed: Sample shipment
INSERT INTO shipments (shipment_code, status, carrier, expected_delivery_date)
VALUES ('SHP-20241103-007', 'In Transit', 'FedEx Freight', NOW() + INTERVAL '3 days')
ON CONFLICT DO NOTHING;
"""

# ── frontend/package.json ─────────────────────────────────────────────────────
FILES["frontend/package.json"] = """
{
  "name": "wms-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@reduxjs/toolkit": "^2.2.3",
    "react-redux": "^9.1.2",
    "framer-motion": "^11.2.4",
    "socket.io-client": "^4.7.5",
    "axios": "^1.7.2",
    "recharts": "^2.12.7",
    "quagga": "^0.12.1",
    "qrcode": "^1.5.3",
    "react-hot-toast": "^2.4.1",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/react": "^18.3.3",
    "@types/node": "^20.12.7",
    "tailwindcss": "^3.4.3",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "eslint": "^8.57.0"
  }
}
"""

# ── frontend/app/layout.tsx ───────────────────────────────────────────────────
FILES["frontend/app/layout.tsx"] = """
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '../providers/Providers';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WMS — Warehouse Management System',
  description: 'Production-Grade Warehouse Management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <Toaster position="top-right" />
          {children}
        </Providers>
      </body>
    </html>
  );
}
"""

# ── frontend/app/globals.css ──────────────────────────────────────────────────
FILES["frontend/app/globals.css"] = """
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground: 0 0% 98%;
  --background: 222.2 84% 4.9%;
}

body {
  @apply bg-slate-950 text-slate-100;
}
"""

# ── frontend/providers/Providers.tsx ─────────────────────────────────────────
FILES["frontend/providers/Providers.tsx"] = """
'use client';

import { Provider } from 'react-redux';
import { store } from '../store';

export function Providers({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
"""

# ── frontend/store/index.ts ───────────────────────────────────────────────────
FILES["frontend/store/index.ts"] = """
import { configureStore } from '@reduxjs/toolkit';
import inventoryReducer from './inventorySlice';
import shipmentsReducer from './shipmentsSlice';
import notificationsReducer from './notificationsSlice';

export const store = configureStore({
  reducer: {
    inventory: inventoryReducer,
    shipments: shipmentsReducer,
    notifications: notificationsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
"""

# ── frontend/store/inventorySlice.ts ─────────────────────────────────────────
FILES["frontend/store/inventorySlice.ts"] = """
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Product {
  id: string; name: string; sku: string; barcode: string;
  quantity: number; reorder_threshold: number; category?: string;
  supplier_name?: string; warehouse_zone?: string;
}

interface InventoryState {
  products: Product[];
  loading: boolean;
  error: string | null;
}

const initialState: InventoryState = { products: [], loading: false, error: null };

export const fetchProducts = createAsyncThunk('inventory/fetch', async (_, { getState }: any) => {
  const token = getState().auth?.token;
  const res = await axios.get(`${API}/api/inventory`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.data as Product[];
});

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    updateProductLocally(state, action: PayloadAction<{ id: string; quantity: number }>) {
      const p = state.products.find(x => x.id === action.payload.id);
      if (p) p.quantity = action.payload.quantity;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchProducts.fulfilled, (state, action) => { state.loading = false; state.products = action.payload; })
      .addCase(fetchProducts.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Error'; });
  },
});

export const { updateProductLocally } = inventorySlice.actions;
export default inventorySlice.reducer;
"""

# ── frontend/store/shipmentsSlice.ts ─────────────────────────────────────────
FILES["frontend/store/shipmentsSlice.ts"] = """
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL;

export const fetchShipments = createAsyncThunk('shipments/fetch', async (_, { getState }: any) => {
  const token = getState().auth?.token;
  const res = await axios.get(`${API}/api/shipments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.data;
});

const shipmentsSlice = createSlice({
  name: 'shipments',
  initialState: { shipments: [] as any[], loading: false, error: null as string | null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchShipments.pending, (state) => { state.loading = true; })
      .addCase(fetchShipments.fulfilled, (state, action) => { state.loading = false; state.shipments = action.payload; })
      .addCase(fetchShipments.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Error'; });
  },
});

export default shipmentsSlice.reducer;
"""

# ── frontend/store/notificationsSlice.ts ──────────────────────────────────────
FILES["frontend/store/notificationsSlice.ts"] = """
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Notification { id: string; message: string; type: string; read: boolean; created_at: string; }

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: { items: [] as Notification[] },
  reducers: {
    addNotification(state, action: PayloadAction<Notification>) {
      state.items.unshift(action.payload);
    },
    markRead(state, action: PayloadAction<string>) {
      const n = state.items.find(x => x.id === action.payload);
      if (n) n.read = true;
    },
    clearAll(state) { state.items = []; },
  },
});

export const { addNotification, markRead, clearAll } = notificationsSlice.actions;
export default notificationsSlice.reducer;
"""

# ── frontend/hooks/useSocket.ts ───────────────────────────────────────────────
FILES["frontend/hooks/useSocket.ts"] = """
'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useDispatch } from 'react-redux';
import { updateProductLocally } from '../store/inventorySlice';
import { addNotification } from '../store/notificationsSlice';

export function useSocket(room: string) {
  const socketRef = useRef<Socket | null>(null);
  const dispatch = useDispatch();

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL!);
    socketRef.current = socket;

    socket.emit('join-room', room);

    socket.on('inventory-changed', (payload: { id: string; updatedQuantity: number }) => {
      dispatch(updateProductLocally({ id: payload.id, quantity: payload.updatedQuantity }));
    });

    socket.on('notification', (notif: any) => {
      dispatch(addNotification(notif));
    });

    return () => { socket.disconnect(); };
  }, [room, dispatch]);

  return socketRef;
}
"""

# ── frontend/components/dashboard/AdminDashboard.tsx ─────────────────────────
FILES["frontend/components/dashboard/AdminDashboard.tsx"] = """
'use client';

import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface StatCard { title: string; value: string | number; icon: string; color: string; }

function StatCard({ title, value, icon, color }: StatCard) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl p-5 ${color} text-white shadow-xl`}
      role="region"
      aria-label={title}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-3xl">{icon}</span>
      </div>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="text-4xl font-bold mt-1">{value}</p>
    </motion.div>
  );
}

export default function AdminDashboard() {
  const products  = useSelector((s: RootState) => s.inventory.products);
  const shipments = useSelector((s: RootState) => s.shipments.shipments);
  const notifs    = useSelector((s: RootState) => s.notifications.items);

  const lowStockCount = products.filter(p => p.quantity <= p.reorder_threshold).length;

  const stats: StatCard[] = [
    { title: 'Total Products',  value: products.length,  icon: '📦', color: 'bg-blue-600' },
    { title: 'Active Shipments',value: shipments.filter(s => s.status === 'In Transit').length, icon: '🚛', color: 'bg-emerald-600' },
    { title: 'Low Stock Items', value: lowStockCount,    icon: '⚠️', color: 'bg-amber-600'  },
    { title: 'Notifications',   value: notifs.filter(n => !n.read).length, icon: '🔔', color: 'bg-purple-600' },
  ];

  return (
    <section className="p-6 space-y-8" aria-label="Admin Dashboard">
      <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map(s => <StatCard key={s.title} {...s} />)}
      </div>
    </section>
  );
}
"""

# ── frontend/components/inventory/InventoryTable.tsx ─────────────────────────
FILES["frontend/components/inventory/InventoryTable.tsx"] = """
'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { RootState, AppDispatch } from '../../store';
import { fetchProducts } from '../../store/inventorySlice';

export default function InventoryTable() {
  const dispatch = useDispatch<AppDispatch>();
  const { products, loading } = useSelector((s: RootState) => s.inventory);
  const [search, setSearch] = useState('');

  useEffect(() => { dispatch(fetchProducts()); }, [dispatch]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="search"
          placeholder="Search by name or SKU…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search inventory"
          className="flex-1 bg-slate-800 text-white rounded-xl px-4 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm" aria-label="Inventory table">
            <thead>
              <tr className="bg-slate-800 text-slate-300">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Threshold</th>
                <th className="px-4 py-3 text-left">Zone</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map(p => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="border-t border-slate-800 hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{p.sku}</td>
                    <td className="px-4 py-3 text-slate-400">{p.category ?? '—'}</td>
                    <td className="px-4 py-3 text-right">{p.quantity}</td>
                    <td className="px-4 py-3 text-right">{p.reorder_threshold}</td>
                    <td className="px-4 py-3 text-slate-400">{(p as any).warehouse_zone ?? '—'}</td>
                    <td className="px-4 py-3">
                      {p.quantity <= p.reorder_threshold ? (
                        <span className="bg-amber-600 text-white text-xs px-2 py-1 rounded-full">Low Stock</span>
                      ) : (
                        <span className="bg-emerald-700 text-white text-xs px-2 py-1 rounded-full">In Stock</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
"""

# ── frontend/components/barcode/Scanner.tsx ──────────────────────────────────
FILES["frontend/components/barcode/Scanner.tsx"] = """
'use client';

import { useEffect } from 'react';

// @ts-ignore — QuaggaJS has no official types package
import Quagga from 'quagga';

interface ScannerProps {
  onDetected: (code: string) => void;
}

export default function Scanner({ onDetected }: ScannerProps) {
  useEffect(() => {
    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: document.querySelector('#barcode-scanner'),
          constraints: { facingMode: 'environment' },
        },
        decoder: { readers: ['code_128_reader'] },
      },
      (err: Error | null) => {
        if (err) { console.error('[Scanner] Init error:', err); return; }
        Quagga.start();
      }
    );

    Quagga.onDetected((data: { codeResult: { code: string } }) => {
      onDetected(data.codeResult.code);
      Quagga.stop();
    });

    return () => { try { Quagga.stop(); } catch {} };
  }, [onDetected]);

  return (
    <div
      id="barcode-scanner"
      role="img"
      aria-label="Barcode scanner viewport"
      className="w-full h-96 rounded-xl overflow-hidden bg-black"
    />
  );
}
"""

# ── frontend/components/shipments/ShipmentTimeline.tsx ───────────────────────
FILES["frontend/components/shipments/ShipmentTimeline.tsx"] = """
'use client';

import { motion } from 'framer-motion';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-slate-600',
  Scheduled: 'bg-blue-600',
  'In Transit': 'bg-amber-600',
  Arrived: 'bg-teal-600',
  Received: 'bg-indigo-600',
  Completed: 'bg-emerald-600',
  Cancelled: 'bg-red-600',
  Delayed: 'bg-orange-600',
};

interface TimelineEntry {
  id: string;
  status: string;
  note?: string;
  created_at: string;
}

export default function ShipmentTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative border-l border-slate-700 ml-4 space-y-6" aria-label="Shipment timeline">
      {entries.map((entry, i) => (
        <motion.li
          key={entry.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="ml-6"
        >
          <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-slate-950 ${STATUS_COLORS[entry.status] ?? 'bg-slate-500'}`} />
          <p className="text-sm font-semibold text-white">{entry.status}</p>
          {entry.note && <p className="text-xs text-slate-400 mt-0.5">{entry.note}</p>}
          <time className="text-xs text-slate-500">
            {new Date(entry.created_at).toLocaleString()}
          </time>
        </motion.li>
      ))}
    </ol>
  );
}
"""

# ── frontend/components/notifications/NotificationCenter.tsx ─────────────────
FILES["frontend/components/notifications/NotificationCenter.tsx"] = """
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { markRead, clearAll } from '../../store/notificationsSlice';

export default function NotificationCenter() {
  const dispatch = useDispatch<AppDispatch>();
  const notifications = useSelector((s: RootState) => s.notifications.items);
  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="p-4 space-y-3 max-w-sm" role="region" aria-label="Notification center">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Notifications
          {unread > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{unread}</span>
          )}
        </h2>
        {notifications.length > 0 && (
          <button
            onClick={() => dispatch(clearAll())}
            className="text-xs text-slate-400 hover:text-white"
            aria-label="Clear all notifications"
          >
            Clear all
          </button>
        )}
      </div>

      <AnimatePresence>
        {notifications.length === 0 && (
          <p className="text-slate-500 text-sm">No notifications</p>
        )}
        {notifications.slice(0, 20).map(n => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`rounded-xl p-3 cursor-pointer transition-colors ${n.read ? 'bg-slate-800' : 'bg-slate-700'}`}
            onClick={() => dispatch(markRead(n.id))}
            role="button"
            aria-label={`Notification: ${n.message}`}
          >
            <p className="text-sm text-white">{n.message}</p>
            <p className="text-xs text-slate-400 mt-1">
              {new Date(n.created_at).toLocaleString()}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
"""

# ── frontend/tailwind.config.ts ───────────────────────────────────────────────
FILES["frontend/tailwind.config.ts"] = """
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './providers/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
};

export default config;
"""

# ── deployment/docker/docker-compose.yml ─────────────────────────────────────
FILES["deployment/docker/docker-compose.yml"] = """
version: '3.9'

services:

  frontend:
    build:
      context: ../../frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:5000
      - NEXT_PUBLIC_WS_URL=ws://localhost:5000
    depends_on:
      - backend

  backend:
    build:
      context: ../../backend
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    env_file:
      - ../../.env.example
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build:
      context: ../../backend
      dockerfile: Dockerfile
    command: npm run worker
    env_file:
      - ../../.env.example
    depends_on:
      - redis
      - postgres

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: wms
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ../../database/schema/schema.sql:/docker-entrypoint-initdb.d/01_schema.sql
      - ../../database/seeds/seed.sql:/docker-entrypoint-initdb.d/02_seed.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d wms"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  nginx:
    image: nginx:stable-alpine
    ports:
      - "80:80"
    volumes:
      - ../nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
  redis_data:
"""

# ── deployment/nginx/nginx.conf ───────────────────────────────────────────────
FILES["deployment/nginx/nginx.conf"] = """
events { worker_connections 1024; }

http {

  upstream frontend_upstream {
    server frontend:3000;
  }

  upstream backend_upstream {
    server backend:5000;
  }

  server {
    listen 80;
    server_name _;

    # API proxy
    location /api/ {
      proxy_pass         http://backend_upstream;
      proxy_http_version 1.1;
      proxy_set_header   Host              $host;
      proxy_set_header   X-Real-IP         $remote_addr;
      proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    }

    # WebSocket proxy
    location /socket.io/ {
      proxy_pass         http://backend_upstream;
      proxy_http_version 1.1;
      proxy_set_header   Upgrade    $http_upgrade;
      proxy_set_header   Connection "Upgrade";
      proxy_set_header   Host       $host;
    }

    # Prometheus metrics (internal only)
    location /metrics {
      proxy_pass   http://backend_upstream;
      allow        127.0.0.1;
      allow        10.0.0.0/8;
      deny         all;
    }

    # Frontend proxy
    location / {
      proxy_pass         http://frontend_upstream;
      proxy_http_version 1.1;
      proxy_set_header   Host              $host;
      proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    }
  }
}
"""

# ── deployment/kubernetes/deployment.yaml ────────────────────────────────────
FILES["deployment/kubernetes/deployment.yaml"] = """
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wms-backend
  labels:
    app: wms-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: wms-backend
  template:
    metadata:
      labels:
        app: wms-backend
    spec:
      containers:
        - name: backend
          image: wms/backend:latest
          ports:
            - containerPort: 5000
          envFrom:
            - secretRef:
                name: wms-secrets
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
          readinessProbe:
            httpGet:
              path: /health
              port: 5000
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 5000
            initialDelaySeconds: 20
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: wms-backend-svc
spec:
  selector:
    app: wms-backend
  ports:
    - protocol: TCP
      port: 5000
      targetPort: 5000
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wms-frontend
  labels:
    app: wms-frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: wms-frontend
  template:
    metadata:
      labels:
        app: wms-frontend
    spec:
      containers:
        - name: frontend
          image: wms/frontend:latest
          ports:
            - containerPort: 3000
          env:
            - name: NEXT_PUBLIC_API_URL
              value: "http://wms-backend-svc:5000"
---
apiVersion: v1
kind: Service
metadata:
  name: wms-frontend-svc
spec:
  selector:
    app: wms-frontend
  ports:
    - protocol: TCP
      port: 3000
      targetPort: 3000
"""

# ── deployment/kubernetes/hpa.yaml ───────────────────────────────────────────
FILES["deployment/kubernetes/hpa.yaml"] = """
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: wms-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: wms-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 75
"""

# ── deployment/github-actions/ci.yml ─────────────────────────────────────────
FILES["deployment/github-actions/ci.yml"] = """
name: WMS CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:

  test-backend:
    name: Backend Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: wms_test
          POSTGRES_USER: admin
          POSTGRES_PASSWORD: password
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 10
      redis:
        image: redis:7
        ports: ["6379:6379"]
        options: --health-cmd "redis-cli ping" --health-interval 5s

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install backend deps
        working-directory: backend
        run: npm ci

      - name: Build backend
        working-directory: backend
        run: npm run build

      - name: Run backend tests
        working-directory: backend
        env:
          DATABASE_URL: postgresql://admin:password@localhost:5432/wms_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test_secret_ci
          NODE_ENV: test
        run: npm test

  test-frontend:
    name: Frontend Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - name: Install frontend deps
        working-directory: frontend
        run: npm ci
      - name: Type check
        working-directory: frontend
        run: npx tsc --noEmit

  build-and-push:
    name: Build & Push Docker Images
    needs: [test-backend, test-frontend]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build & push backend
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ${{ secrets.DOCKER_USERNAME }}/wms-backend:latest

      - name: Build & push frontend
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: ${{ secrets.DOCKER_USERNAME }}/wms-frontend:latest
"""

# ── evaluation/k6/load-test.js ────────────────────────────────────────────────
FILES["evaluation/k6/load-test.js"] = """
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const apiLatency    = new Trend('api_latency_ms');
const errorRate     = new Rate('error_rate');

export const options = {
  stages: [
    { duration: '30s', target: 100 },   // ramp up
    { duration: '60s', target: 500 },   // hold at 500 VUs
    { duration: '30s', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration:      ['p(95)<500'],
    'http_req_duration{name:inventory}': ['p(95)<200'],
    error_rate:             ['rate<0.01'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:5000';
let TOKEN  = '';

export function setup() {
  const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({
    email: 'admin@wms.local', password: 'admin1234',
  }), { headers: { 'Content-Type': 'application/json' } });
  return { token: res.json('data.accessToken') };
}

export default function (data) {
  TOKEN = data.token;

  // GET /api/inventory
  const inv = http.get(`${BASE}/api/inventory`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    tags: { name: 'inventory' },
  });
  apiLatency.add(inv.timings.duration);
  errorRate.add(inv.status !== 200);
  check(inv, { 'inventory 200': r => r.status === 200 });

  // GET /api/shipments
  const sh = http.get(`${BASE}/api/shipments`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    tags: { name: 'shipments' },
  });
  check(sh, { 'shipments 200': r => r.status === 200 });

  sleep(0.5);
}
"""

# ── evaluation/k6/websocket-test.js ──────────────────────────────────────────
FILES["evaluation/k6/websocket-test.js"] = """
import ws from 'k6/ws';
import { check, sleep } from 'k6';

export const options = {
  vus: 500,
  duration: '60s',
};

export default function () {
  const url = __ENV.WS_URL || 'ws://localhost:5000';

  const res = ws.connect(url, {}, function (socket) {

    socket.on('open', () => {
      socket.send(JSON.stringify({ event: 'join-room', data: 'admin-room' }));
    });

    socket.on('message', (msg) => {
      check(msg, { 'received message': m => m.length > 0 });
    });

    socket.setTimeout(() => socket.close(), 30000);
  });

  check(res, { 'ws connected': r => r && r.status === 101 });
  sleep(1);
}
"""

# ── README.md ─────────────────────────────────────────────────────────────────
FILES["README.md"] = """
# WMS — Production-Grade Warehouse Management System

## Stack
| Layer      | Technology                                          |
|------------|-----------------------------------------------------|
| Frontend   | Next.js 14 · Tailwind CSS · Redux Toolkit · Framer Motion |
| Backend    | Node.js · Express · Socket.io · BullMQ             |
| Database   | PostgreSQL 16 · Redis 7                            |
| DevOps     | Docker · Kubernetes · GitHub Actions · Nginx       |
| Monitoring | Prometheus · Grafana · OpenTelemetry · Pino        |

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- (Optional) k6 for load testing

### 1 — Clone & install
```bash
git clone <your-repo>
cd wms-project

cd backend  && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2 — Configure environment
```bash
cp .env.example .env
# Edit .env with your secrets
```

### 3 — Start with Docker Compose
```bash
cd deployment/docker
docker compose up --build
```

Services:
- Frontend  → http://localhost:3000
- Backend   → http://localhost:5000
- Metrics   → http://localhost:5000/metrics
- DB        → localhost:5432
- Redis     → localhost:6379

---

## Core Workflow — ISG-4821-L

```
Staff scans barcode ISG-4821-L (shipment SHP-20241103-007)
  → barcode validated
  → Redis distributed lock acquired (500ms TTL)
  → PostgreSQL transaction: quantity updated atomically
  → inventory_log written (immutable)
  → shipment status → Received
  → WebSocket event → admin-room / manager-room
  → low-stock check: if qty ≤ threshold → notification + email
  → Prometheus metric recorded
```

---

## API Reference

| Method | Endpoint                   | Role            |
|--------|---------------------------|-----------------|
| POST   | /api/auth/register         | public          |
| POST   | /api/auth/login            | public          |
| GET    | /api/inventory             | any             |
| POST   | /api/inventory             | admin/manager   |
| PUT    | /api/inventory/:id/quantity| all roles       |
| POST   | /api/inventory/bulk-import | admin/manager   |
| GET    | /api/shipments             | any             |
| PUT    | /api/shipments/:id/status  | all roles       |
| POST   | /api/barcode/generate      | any             |
| POST   | /api/barcode/scan          | any             |
| GET    | /api/analytics/inventory   | admin/manager   |
| GET    | /api/notifications         | any             |
| GET    | /api/users                 | admin           |

All responses follow:
```json
{
  "status": "success",
  "data": {},
  "message": "string",
  "timestamp": "ISO8601",
  "request_id": "uuid"
}
```

---

## RBAC Roles
| Role     | Permissions                     |
|----------|---------------------------------|
| admin    | Full system access              |
| manager  | Inventory + shipment management |
| staff    | Operational workflows           |
| supplier | Read-only supplier access       |

---

## Load Testing
```bash
# Install k6: https://k6.io/docs/getting-started/installation/
k6 run evaluation/k6/load-test.js
k6 run evaluation/k6/websocket-test.js
```

---

## Kubernetes Deployment
```bash
kubectl apply -f deployment/kubernetes/deployment.yaml
kubectl apply -f deployment/kubernetes/hpa.yaml
```

HPA: min 2 → max 10 replicas at CPU > 60 %.

---

## Environment Variables
| Variable            | Description                     |
|---------------------|---------------------------------|
| DATABASE_URL        | PostgreSQL connection string    |
| REDIS_URL           | Redis connection URL            |
| JWT_SECRET          | JWT signing secret              |
| PORT                | Backend server port (5000)      |
| SMTP_HOST/PORT/USER | Email notification settings     |
| AWS_S3_BUCKET       | S3 file storage (optional)      |

---

## Troubleshooting

**WebSocket disconnect**
Socket.io auto-reconnects. Ensure Nginx has `Upgrade` / `Connection` headers set.

**Redis lock timeout**
Lock TTL is 500 ms. If operations take longer, increase TTL in `inventory.service.ts`.

**JWT expiration**
Access tokens expire in 15 min. The frontend should use the `/api/auth/refresh` endpoint
with the `refreshToken` HttpOnly cookie to obtain a new access token.

**Bulk import failures**
Each row is validated independently. Check the `errors[]` array in the job result.
Failed rows do not block successful ones.

**Barcode scanner permissions**
The browser requires camera permission. Ensure the app is served over HTTPS in production.
For Chrome, navigate to Settings → Privacy → Site Settings → Camera.

---

## Performance Targets
| Metric                      | Target    |
|-----------------------------|-----------|
| p95 API latency             | < 500 ms  |
| p95 inventory update        | < 200 ms  |
| p95 WebSocket delivery      | < 100 ms  |
| Failed inventory writes     | < 1 %     |
| Failed bulk import rows     | < 5 %     |
| Low-stock alert delivery    | > 99 %    |
| Concurrent WebSocket users  | 500+      |
"""

# ─────────────────────────────────────────────
#  MAIN GENERATOR
# ─────────────────────────────────────────────

def main() -> None:
    print("\n🚀  Generating WMS project structure...\n")
    ROOT.mkdir(exist_ok=True)

    for rel_path, content in FILES.items():
        write(rel_path, content)

    # Print summary
    file_count = len(FILES)
    dir_count  = len({str(Path(p).parent) for p in FILES})

    print(f"\n{'─' * 50}")
    print(f"  ✅  Done!  {file_count} files across {dir_count} directories")
    print(f"  📁  Output → {ROOT.resolve()}")
    print(f"{'─' * 50}\n")
    print("  Next steps:")
    print("    1. cd wms-project")
    print("    2. cp .env.example .env   (then fill in secrets)")
    print("    3. cd deployment/docker && docker compose up --build")
    print("    4. Open http://localhost:3000\n")


if __name__ == "__main__":
    main()