/**
 * Route Loader
 * 
 * Automatically loads and registers route modules from the routes directory
 */

const fs = require('fs');
const path = require('path');

/**
 * Load all route modules from a directory
 * @param {Express} app - Express app instance
 * @param {string} routesDir - Directory containing route files
 */
function loadRoutes(app, routesDir = __dirname) {
  const routeFiles = fs.readdirSync(routesDir)
    .filter(file => file.endsWith('.js') && file !== 'index.js');
  
  console.log(`[routes] Loading ${routeFiles.length} route modules...`);
  
  routeFiles.forEach(file => {
    try {
      const routePath = path.join(routesDir, file);
      const routeModule = require(routePath);
      
      // Route modules can export:
      // - A function: routeModule(app) - registers routes directly
      // - An object with 'register' method: routeModule.register(app)
      // - An object with 'router': app.use(routeModule.path, routeModule.router)
      
      if (typeof routeModule === 'function') {
        routeModule(app);
        console.log(`[routes] ✓ Loaded route module: ${file}`);
      } else if (routeModule.register && typeof routeModule.register === 'function') {
        routeModule.register(app);
        console.log(`[routes] ✓ Loaded route module: ${file} (via register)`);
      } else if (routeModule.router) {
        const mountPath = routeModule.path || '/';
        app.use(mountPath, routeModule.router);
        console.log(`[routes] ✓ Loaded route module: ${file} (mounted at ${mountPath})`);
      } else {
        console.warn(`[routes] ⚠ Route module ${file} doesn't export a valid route handler`);
      }
    } catch (error) {
      console.error(`[routes] ✗ Failed to load route module ${file}:`, error.message);
    }
  });
  
  console.log(`[routes] Route loading complete`);
}

module.exports = { loadRoutes };

