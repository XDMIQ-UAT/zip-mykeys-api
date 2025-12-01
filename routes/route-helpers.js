/**
 * Route Helper Utilities
 * 
 * Common utilities for building routes
 */

const { getStorage } = require('../kv-utils');

/**
 * Standardized response helper
 * @param {Response} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} status - 'success' or 'failure'
 * @param {any} data - Response data
 * @param {string} message - Response message
 */
function sendResponse(res, statusCode, status, data, message) {
  return res.status(statusCode).json({
    status,
    data,
    message
  });
}

/**
 * Require authentication middleware wrapper
 * @param {Function} handler - Route handler function
 * @returns {Function} Wrapped handler with authentication
 */
function requireAuth(handler) {
  return async (req, res, next) => {
    // Import authenticate middleware dynamically to avoid circular deps
    const { authenticate } = require('../server');
    
    // Apply authenticate middleware first
    authenticate(req, res, (err) => {
      if (err) {
        return sendResponse(res, 401, 'failure', null, 'Authentication required');
      }
      // Then call the actual handler
      handler(req, res, next);
    });
  };
}

/**
 * Require admin role middleware wrapper
 * @param {Function} handler - Route handler function
 * @returns {Function} Wrapped handler with admin auth
 */
function requireAdmin(handler) {
  return async (req, res, next) => {
    // Import requireAdminRole dynamically
    // Note: This assumes requireAdminRole is exported from server.js
    // You may need to extract it to a separate auth module
    
    // For now, use authenticate + role check
    const { authenticate } = require('../server');
    const { getUserRoles, hasRole } = require('../role-management');
    
    authenticate(req, res, async (err) => {
      if (err) {
        return sendResponse(res, 401, 'failure', null, 'Authentication required');
      }
      
      const userEmail = req.userEmail;
      if (!userEmail) {
        return sendResponse(res, 403, 'failure', null, 'User email required');
      }
      
      const roles = await getUserRoles(userEmail);
      if (!hasRole(roles, 'owner') && !hasRole(roles, 'architect')) {
        return sendResponse(res, 403, 'failure', null, 'Admin role required');
      }
      
      handler(req, res, next);
    });
  };
}

/**
 * Validate request body against schema
 * @param {Object} schema - Schema object with required/optional fields
 * @param {Object} body - Request body
 * @returns {Object|null} Error object or null if valid
 */
function validateBody(schema, body) {
  const errors = [];
  
  if (schema.required) {
    for (const field of schema.required) {
      if (body[field] === undefined || body[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }
  
  if (schema.types) {
    for (const [field, type] of Object.entries(schema.types)) {
      if (body[field] !== undefined && typeof body[field] !== type) {
        errors.push(`Field ${field} must be of type ${type}`);
      }
    }
  }
  
  return errors.length > 0 ? { errors } : null;
}

/**
 * Async route handler wrapper (catches errors)
 * @param {Function} handler - Async route handler
 * @returns {Function} Wrapped handler with error handling
 */
function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      console.error(`[route-error] ${req.method} ${req.path}:`, error);
      sendResponse(res, 500, 'failure', null, error.message || 'Internal server error');
    }
  };
}

/**
 * Get storage with error handling
 * @returns {Object|null} Storage instance or null
 */
function getStorageSafe() {
  try {
    return getStorage();
  } catch (error) {
    console.error('[route-helpers] Storage error:', error);
    return null;
  }
}

module.exports = {
  sendResponse,
  requireAuth,
  requireAdmin,
  validateBody,
  asyncHandler,
  getStorageSafe
};

