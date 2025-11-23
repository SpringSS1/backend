/**
 * backend/index.js
 *
 * Lightweight wrapper to start the server (calls server.js).
 *
 * This file makes it easier for deployment platforms that expect index.js as entrypoint.
 * If your current project already has a different start script, you can replace that file content
 * with the code below, or update your package.json "start" script to "node backend/server.js".
 */

try {
  require('./server');
} catch (e) {
  console.error('Failed to start server:', e && e.stack ? e.stack : e);
  process.exit(1);
}