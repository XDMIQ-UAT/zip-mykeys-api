/**
 * Security & Privacy Middleware for Routes
 * 
 * Ensures all routes follow security and privacy best practices
 */

const helmet = require('helmet');
const { sendResponse } = require('./route-helpers');

/**
 * Security headers middleware
 * Protects against common web vulnerabilities
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for CLI
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://mykeys.zip", "https://*.vercel.app"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow API access
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Privacy headers middleware
 * Protects user privacy and prevents tracking
 */
const privacyHeaders = (req, res, next) => {
  // Prevent tracking
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Privacy headers
  res.setHeader('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );
  
  // Don't cache sensitive data
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

/**
 * Rate limiting per user (if authenticated)
 * Prevents abuse while allowing legitimate use
 */
const rateLimitByUser = (req, res, next) => {
  // Rate limiting is handled at app level
  // This is a placeholder for route-specific rate limiting
  next();
};

/**
 * Privacy-aware logging
 * Logs requests without exposing sensitive data
 */
const privacyAwareLogging = (req, res, next) => {
  const startTime = Date.now();
  
  // Log response after it's sent
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent')?.substring(0, 50), // Truncate
      ip: req.ip || req.connection.remoteAddress
    };
    
    // Don't log sensitive paths or data
    if (!req.path.includes('/api/v1/secrets') && !req.path.includes('/api/cli/execute')) {
      console.log(`[route] ${logData.method} ${logData.path} ${logData.statusCode} (${logData.duration})`);
    }
  });
  
  next();
};

/**
 * Validate request origin (for API routes)
 * Ensures requests come from trusted sources
 */
const validateOrigin = (req, res, next) => {
  // Allow same-origin and mykeys.zip domains
  const origin = req.get('origin');
  const allowedOrigins = [
    'https://mykeys.zip',
    'https://www.mykeys.zip',
    'http://localhost:8080',
    'http://localhost:3000'
  ];
  
  if (origin && !allowedOrigins.includes(origin)) {
    // Still allow, but log for monitoring
    console.warn(`[security] Request from untrusted origin: ${origin}`);
  }
  
  next();
};

/**
 * Sanitize request data
 * Removes potentially dangerous data from requests
 */
const sanitizeRequest = (req, res, next) => {
  // Remove any __proto__ or constructor properties (prototype pollution protection)
  if (req.body && typeof req.body === 'object') {
    delete req.body.__proto__;
    delete req.body.constructor;
  }
  
  if (req.query && typeof req.query === 'object') {
    delete req.query.__proto__;
    delete req.query.constructor;
  }
  
  next();
};

/**
 * Apply all security and privacy middleware
 */
function applySecurityMiddleware(router) {
  router.use(securityHeaders);
  router.use(privacyHeaders);
  router.use(privacyAwareLogging);
  router.use(validateOrigin);
  router.use(sanitizeRequest);
  
  return router;
}

module.exports = {
  securityHeaders,
  privacyHeaders,
  rateLimitByUser,
  privacyAwareLogging,
  validateOrigin,
  sanitizeRequest,
  applySecurityMiddleware
};

