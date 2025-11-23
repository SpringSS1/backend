/**
 * Create an initial admin user (safe to run once)
 *
 * Usage:
 *   NODE_ENV=development node backend/scripts/seedAdmin.js
 *
 * Environment variables used (or pass directly below):
 * - MONGODB_URI
 * - ADMIN_EMAIL
 * - ADMIN_PASSWORD
 * - ADMIN_USERNAME (optional)
 *
 * If ADMIN_EMAIL/ADMIN_PASSWORD are missing, the script will prompt (or you can set defaults).
 *
 * NOTE: this script depends on the exact User model already present under backend/models/User.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const mongoose = require('mongoose');
const readline = require('readline');

async function prompt(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (ans) => { rl.close(); resolve(ans); });
  });
}

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("MONGODB_URI missing in environment (.env). Aborting.");
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  const User = require('../models/User');

  let email = process.env.ADMIN_EMAIL || (await prompt("Admin email: "));
  let password = process.env.ADMIN_PASSWORD || (await prompt("Admin password: "));
  let username = process.env.ADMIN_USERNAME || (await prompt("Admin username (optional): "));

  if (!email || !password) {
    console.error("Email and password are required. Aborting.");
    process.exit(1);
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    console.log("Admin user already exists:", existing.email, existing._id);
    await mongoose.disconnect();
    process.exit(0);
  }

  const u = new User({
    email: email.toLowerCase().trim(),
    password,
    username: username || email.split('@')[0],
    role: 'admin',
    isVerified: true,
    emailVerified: true
  });

  await u.save();
  console.log("Admin user created:", u.email, "ID:", u._id.toString());
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error("Seed error:", err && (err.stack || err.message || err));
  process.exit(1);
});