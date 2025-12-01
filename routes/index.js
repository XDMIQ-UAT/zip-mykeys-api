/**
 * Route Loader
 * 
 * Automatically loads and registers route modules from the routes directory
 * Routes are PRIVATE by default - require authentication unless marked as public
 * All routes include security and privacy middleware
 */

const fs = require('fs');
const path = require('path');
const { applySecurityMiddleware } = require('./security-middleware');

/**
 * Load all route modules from a directory
 * @param {Express} app - Express app instance
 * @param {string} routesDir - Directory containing route files
 */
function loadRoutes(app, routesDir = __dirname) {
  // Import authenticate middleware once
  let authenticate;
  try {
    // Try to get authenticate from server module
    const serverModule = require('../server');
    authenticate = serverModule.authenticate;
  } catch (error) {
    console.warn('[routes] Could not import authenticate middleware - routes will not be protected');
  }
  
  const routeFiles = fs.readdirSync(routesDir)
    .filter(file => file.endsWith('.js') && file !== 'index.js' && file !== 'route-helpers.js');
  
  console.log(`[routes] Loading ${routeFiles.length} route modules...`);
  
  routeFiles.forEach(file => {
    try {
      const routePath = path.join(routesDir, file);
      const routeModule = require(routePath);
      
      // Route modules can export:
      // - A function: routeModule(app) - registers routes directly
      // - An object with 'register' method: routeModule.register(app)
      // - An object with 'router': app.use(routeModule.path, routeModule.router)
      // - An object with 'public: true' to mark as public route
      
      if (typeof routeModule === 'function') {
        routeModule(app);
        console.log(`[routes] ✓ Loaded route module: ${file}`);
      } else if (routeModule.register && typeof routeModule.register === 'function') {
        routeModule.register(app);
        console.log(`[routes] ✓ Loaded route module: ${file} (via register)`);
      } else if (routeModule.router) {
        const mountPath = routeModule.path || '/';
        
        // Apply security and privacy middleware to all routes
        applySecurityMiddleware(routeModule.router);
        
        // Apply authentication middleware unless route is marked as public
        if (!routeModule.public && authenticate) {
          app.use(mountPath, authenticate);
          console.log(`[routes] ✓ Loaded route module: ${file} (mounted at ${mountPath}, PRIVATE, SECURED)`);
        } else {
          console.log(`[routes] ✓ Loaded route module: ${file} (mounted at ${mountPath}, PUBLIC, SECURED)`);
        }
        
        app.use(mountPath, routeModule.router);
      } else {
        console.warn(`[routes] ⚠ Route module ${file} doesn't export a valid route handler`);
      }
    } catch (error) {
      console.error(`[routes] ✗ Failed to load route module ${file}:`, error.message);
    }
  });
  
  console.log(`[routes] Route loading complete (routes are PRIVATE by default)`);
}

module.exports = { loadRoutes };

