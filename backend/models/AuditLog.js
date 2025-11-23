/**
 * AuditLog Model
 * - Records admin actions for traceability.
 */
const mongoose = require("mongoose");

const auditSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

module.exports = mongoose.model("AuditLog", auditSchema);