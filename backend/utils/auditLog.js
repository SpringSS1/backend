/**
 * Audit Log Utility - Premium Professional Refactor
 * Usage: Logs an admin action for audit trail.
 */
const AuditLog = require('../models/AuditLog');

/**
 * Logs an admin action for audit trail.
 * @param {Object} params
 * @param {Object} params.req - Express request object (must have req.user).
 * @param {string} params.action - Action name (e.g., "ban_user").
 * @param {string} [params.targetType] - Type of target (e.g., "user", "coin").
 * @param {string|Object} [params.targetId] - Target ID.
 * @param {Object} params.details - Details of the action.
 * @param {string} [params.note] - Optional note.
 */
exports.logAdminAction = async ({ req, action, targetType, targetId, details, note }) => {
  try {
    await AuditLog.create({
      adminId: req.user._id,
      action,
      targetType,
      targetId,
      details,
      ip: req.ip,
      note,
      timestamp: new Date()
    });
  } catch (err) {
    // Never crash admin action
    console.error("Audit logging failed:", err);
  }
};