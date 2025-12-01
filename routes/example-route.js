/**
 * Example Route Module
 * 
 * This is a template for creating new route modules.
 * Copy this file and modify it to create your own routes.
 */

const express = require('express');
const router = express.Router();

/**
 * Register routes with the Express app
 * @param {Express} app - Express app instance
 */
function registerRoutes(app) {
  // Example: GET /api/example/hello
  router.get('/hello', (req, res) => {
    res.json({ 
      message: 'Hello from example route!',
      timestamp: new Date().toISOString()
    });
  });
  
  // Example: POST /api/example/echo
  router.post('/echo', (req, res) => {
    res.json({
      received: req.body,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });
  });
  
  // Mount the router at /api/example
  app.use('/api/example', router);
}

module.exports = { register: registerRoutes };

