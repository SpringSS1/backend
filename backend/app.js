/**
 * backend/app.js
 *
 * Main Express application setup.
 *
 * - Connects to MongoDB (if MONGODB_URI present).
 * - Sets up security middlewares (helmet, cors), logging (morgan).
 * - Mounts API routes:
 *    - tries to require existing routers (auth, coin, wallet, trade) if present in your project.
 *    - mounts the admin router created earlier at /api/admin (it already uses adminAuth).
 *    - if a router is missing, provides a safe fallback endpoint so the frontend won't 500.
 *
 * - Exports the Express `app` instance for use by server.js
 *
 * Notes:
 * - Ensure environment variables are set:
 *    - MONGODB_URI
 *    - JWT_SECRET
 *    - CORS_ORIGINS (comma separated) or REACT_APP_FRONTEND_URL for frontend origin
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const jwt = require('jsonwebtoken');

const mongoose = require('mongoose');

const adminRouter = require('./routes/admin'); // our admin router (uses adminAuth internally)

const app = express();

// basic middlewares
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// CORS config
const originsEnv = process.env.CORS_ORIGINS || process.env.REACT_APP_FRONTEND_URL || '';
const allowedOrigins = originsEnv ? originsEnv.split(',').map(s => s.trim()) : [];
const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true); // permissive by default
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

// Connect to MongoDB if configured
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || '';
if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log('MongoDB connected');
    })
    .catch((err) => {
      console.warn('MongoDB connection failed:', err.message || err);
    });
} else {
  console.warn('MONGODB_URI not set — running without DB connection (some admin features will be no-op).');
}

// Lightweight auth helper: attach user if Authorization Bearer token present.
// This is intentionally permissive: if you already have a full auth middleware in your project,
// replace or remove this in favor of your existing auth middleware.
const JWT_SECRET = process.env.JWT_SECRET || process.env.SECRET || 'change_this_secret';
let UserModel = null;
try { UserModel = require('./models/User'); } catch (e) { /* optional */ }

async function attachUserFromToken(req, res, next) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  if (!auth || !auth.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = payload.id || payload._id || payload.sub;
    if (userId && UserModel) {
      try {
        const user = await UserModel.findById(userId).lean();
        req.user = user || null;
        return next();
      } catch (e) {
        req.user = null;
        return next();
      }
    }
    req.user = payload || null;
    return next();
  } catch (e) {
    req.user = null;
    return next();
  }
}
app.use(attachUserFromToken);

// Try to mount existing routers if they exist in repo, otherwise create safe fallbacks.
// 1) Auth router (if present)
try {
  // eslint-disable-next-line global-require
  const authRouter = require('./routes/auth');
  app.use('/api/auth', authRouter);
  console.log('Mounted existing /api/auth router');
} catch (e) {
  console.log('No /routes/auth found — skipping. You may add one for full auth support.');
  // fallback minimal endpoints for register/login (NOT secure; intended only to avoid 404s)
  app.post('/api/auth/login', (req, res) => {
    return res.status(400).json({ error: 'Auth router not configured on server. Please add /routes/auth.' });
  });
  app.post('/api/auth/register', (req, res) => {
    return res.status(400).json({ error: 'Auth router not configured on server. Please add /routes/auth.' });
  });
}

// 2) Coin router or GET /api/coin
let CoinModel = null;
try { CoinModel = require('./models/Coin'); } catch (e) { /* optional */ }

try {
  const coinRouter = require('./routes/coin');
  app.use('/api/coin', coinRouter);
  console.log('Mounted existing /api/coin router');
} catch (e) {
  // fallback GET /api/coin
  app.get('/api/coin', async (req, res) => {
    try {
      if (CoinModel) {
        const coins = await CoinModel.find({}).limit(500).lean();
        return res.json({ success: true, data: coins });
      }
      // fallback static sample (useful for UI)
      const sample = [
        { symbol: 'BTC', name: 'Bitcoin', price: 50000, market_cap_rank: 1, image: '/assets/coins/btc.png' },
        { symbol: 'ETH', name: 'Ethereum', price: 3500, market_cap_rank: 2, image: '/assets/coins/eth.png' },
        { symbol: 'USDT', name: 'Tether', price: 1, market_cap_rank: 3, image: '/assets/coins/usdt.png' },
      ];
      return res.json({ success: true, data: sample });
    } catch (err) {
      console.error('GET /api/coin fallback error', err);
      return res.status(500).json({ error: 'Failed to fetch coins' });
    }
  });
  console.log('Mounted fallback GET /api/coin');
}

// 3) Wallet router or GET /api/wallet
let WalletModel = null;
try { WalletModel = require('./models/Wallet'); } catch (e) { /* optional */ }

try {
  const walletRouter = require('./routes/wallet');
  app.use('/api/wallet', walletRouter);
  console.log('Mounted existing /api/wallet router');
} catch (e) {
  // fallback GET /api/wallet: returns wallets for authenticated user if possible
  app.get('/api/wallet', async (req, res) => {
    try {
      if (req.user && WalletModel) {
        const rows = await WalletModel.find({ user: req.user._id }).lean();
        return res.json({ success: true, data: rows });
      } else if (WalletModel && req.query.userId) {
        const rows = await WalletModel.find({ user: req.query.userId }).lean();
        return res.json({ success: true, data: rows });
      }
      return res.json({ success: true, data: [] });
    } catch (err) {
      console.error('GET /api/wallet fallback error', err);
      return res.status(500).json({ error: 'Failed to fetch wallet' });
    }
  });
  console.log('Mounted fallback GET /api/wallet');
}

// 4) Trade router or fallback endpoints
let TradeModel = null;
try { TradeModel = require('./models/Trade'); } catch (e) { /* optional */ }

try {
  const tradeRouter = require('./routes/trade');
  app.use('/api/trade', tradeRouter);
  console.log('Mounted existing /api/trade router');
} catch (e) {
  // fallback POST /api/trade/place and GET /api/trade/my
  app.post('/api/trade/place', async (req, res) => {
    try {
      const { type, coinSymbol, amount, price } = req.body || {};
      if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
      if (!type || !coinSymbol || !amount || !price) return res.status(400).json({ error: 'Missing trade params' });

      // If Trade model exists, create a trade record; otherwise return simulated success
      if (TradeModel) {
        const doc = await TradeModel.create({
          user: req.user._id,
          pair: `${coinSymbol}/USDT`,
          type,
          amount: Number(amount),
          price: Number(price),
          status: 'filled',
          createdAt: new Date(),
        });
        // broadcast to clients via broadcaster if available
        try { const { broadcast } = require('./utils/broadcaster'); broadcast({ type: 'trade_executed', payload: doc }); } catch (e) {}
        return res.json({ success: true, data: doc });
      }

      // fallback response
      const fake = {
        pair: `${coinSymbol}/USDT`,
        type,
        amount,
        price,
        status: 'filled',
        createdAt: new Date().toISOString(),
      };
      try { const { broadcast } = require('./utils/broadcaster'); broadcast({ type: 'trade_executed', payload: fake }); } catch (e) {}
      return res.json({ success: true, data: fake });
    } catch (err) {
      console.error('POST /api/trade/place fallback error', err);
      return res.status(500).json({ error: 'Failed to place trade' });
    }
  });

  app.get('/api/trade/my', async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
      if (TradeModel) {
        const rows = await TradeModel.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(200).lean();
        return res.json({ success: true, data: rows });
      }
      return res.json({ success: true, data: [] });
    } catch (err) {
      console.error('GET /api/trade/my fallback error', err);
      return res.status(500).json({ error: 'Failed to fetch trades' });
    }
  });
  console.log('Mounted fallback /api/trade endpoints');
}

// Admin router (full-featured - we created this earlier)
try {
  app.use('/api/admin', adminRouter);
  console.log('Mounted /api/admin router');
} catch (e) {
  console.error('Failed to mount /api/admin router:', e.message || e);
}

// Serve static assets if folder exists
const publicPath = path.join(process.cwd(), 'public');
app.use('/assets', express.static(path.join(publicPath, 'assets')));

// Default healthcheck
app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime(), env: process.env.NODE_ENV || 'development' }));

// Generic 404 and error handlers
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && (err.stack || err));
  res.status(500).json({ error: err && (err.message || 'Server error') });
});

module.exports = app;