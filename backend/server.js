/**
 * backend/server.js
 *
 * Complete server entry wired to the models and admin routes provided.
 * - Connects to MongoDB
 * - Exposes /api/admin endpoints with adminAuth protection
 * - Attaches Socket.IO at /socket.io and native ws at /ws
 * - Wire Redis pub/sub for 'broadcast' if REDIS_URL provided
 *
 * Replace or merge into your existing server as needed. This file assumes models live under backend/models.
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || '';
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const REQ_LOG = String(process.env.REQ_LOG || 'false').toLowerCase() === 'true';

async function main() {
  // MongoDB
  if (!MONGODB_URI) {
    console.warn("MONGODB_URI not set. Continue only if using a non-Mongo backend.");
  } else {
    try {
      await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
      console.log("MongoDB connected.");
    } catch (err) {
      console.error("MongoDB connection error:", err && (err.message || err));
      // continue to allow startup for static testing
    }
  }

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // CORS configuration
  const corsOptions = {
    origin: function(origin, callback) {
      if (!origin) return callback(null, true);
      if (CORS_ORIGINS.length === 0) return callback(null, true);
      if (CORS_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
      callback(new Error('CORS policy: origin not allowed'));
    },
    credentials: true,
    exposedHeaders: ['Content-Range', 'X-Total-Count']
  };
  app.use(cors(corsOptions));

  if (REQ_LOG) {
    app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
      next();
    });
  }

  // Health
  app.get('/health', (req, res) => res.json({ ok: true, timestamp: Date.now() }));
  app.get('/', (req, res) => res.send('Backend running'));

  // Auto-mount existing API routes if present (non-destructive)
  try {
    const routesIndex = path.resolve(process.cwd(), 'backend', 'routes', 'index.js');
    if (fs.existsSync(routesIndex)) {
      const routes = require(routesIndex);
      app.use('/api', routes);
      console.log('Mounted existing backend/routes/index.js at /api');
    } else {
      // attempt to mount any files inside backend/routes (except admin.js which we mount later)
      const routesDir = path.resolve(process.cwd(), 'backend', 'routes');
      if (fs.existsSync(routesDir)) {
        const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js') && f !== 'admin.js' && f !== 'index.js');
        files.forEach(f => {
          try {
            const r = require(path.join(routesDir, f));
            if (r && r.use && typeof r.use === 'function') {
              const mountPath = '/api/' + path.basename(f, '.js');
              app.use(mountPath, r);
              console.log(`Mounted ${f} at ${mountPath}`);
            }
          } catch (e) {
            // ignore individual failures
          }
        });
      }
    }
  } catch (e) {
    console.warn('Auto-mount existing routes error:', e && (e.message || e));
  }

  // Mount admin router (this package)
  try {
    const adminRouter = require('./routes/admin');
    app.use('/api/admin', adminRouter);
    console.log('Mounted admin router at /api/admin');
  } catch (e) {
    console.error('Failed to mount admin router:', e && (e.message || e));
  }

  // HTTP server + sockets
  const server = http.createServer(app);

  // Socket.IO
  try {
    const { Server } = require('socket.io');
    const io = new Server(server, {
      path: '/socket.io',
      cors: {
        origin: CORS_ORIGINS.length ? CORS_ORIGINS : true,
        credentials: true
      }
    });
    io.on('connection', (socket) => {
      console.log('Socket.IO client connected', socket.id);
      socket.on('disconnect', () => { });
    });
    global.io = io;
    console.log('Socket.IO attached at /socket.io (global.io)');
  } catch (e) {
    console.warn('Socket.IO not attached:', e && (e.message || e));
  }

  // native ws at /ws
  try {
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ server, path: '/ws' });
    wss.on('connection', (ws) => {
      try { ws.send(JSON.stringify({ type: 'connected', ts: Date.now() })); } catch {}
      ws.on('message', (m) => { /* noop - apps may add handlers elsewhere */ });
    });
    global.wss = wss;
    console.log('Native WebSocket attached at /ws (global.wss)');
  } catch (e) {
    console.warn('ws not available:', e && (e.message || e));
  }

  // Redis subscriber for broadcast channel (if available)
  if (process.env.REDIS_URL) {
    try {
      const IORedis = require('ioredis');
      const sub = new IORedis(process.env.REDIS_URL);
      sub.subscribe('broadcast', (err) => {
        if (err) console.warn('Redis subscribe error:', err && err.message);
        else console.log('Subscribed to Redis channel: broadcast');
      });
      sub.on('message', (channel, message) => {
        if (channel === 'broadcast') {
          try {
            const payload = JSON.parse(message);
            if (global.io && typeof global.io.emit === 'function') {
              global.io.emit('broadcast', payload);
            } else if (global.wss && global.wss.clients) {
              global.wss.clients.forEach(c => {
                try { if (c.readyState === 1) c.send(JSON.stringify(payload)); } catch {}
              });
            }
          } catch (e) {
            console.warn('Invalid broadcast message from Redis:', e && e.message);
          }
        }
      });
    } catch (e) {
      console.warn('Redis setup error:', e && (e.message || e));
    }
  }

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error', err && (err.stack || err.message || err));
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Health endpoint: http://localhost:${PORT}/health`);
  });

  // graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    try {
      if (global.io && typeof global.io.close === 'function') global.io.close();
      if (global.wss && typeof global.wss.close === 'function') global.wss.close();
      server.close(() => {
        if (mongoose && mongoose.connection) {
          mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
          });
        } else {
          process.exit(0);
        }
      });
      setTimeout(() => process.exit(1), 10000).unref();
    } catch (e) {
      console.error('Shutdown error', e && (e.message || e));
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('Fatal startup error:', err && (err.stack || err.message || err));
  process.exit(1);
});