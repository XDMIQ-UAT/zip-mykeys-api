#!/usr/bin/env node

/**
 * Route Scaffolding Script
 * 
 * Creates a new route module with boilerplate code
 * 
 * Usage: node scripts/create-route.js my-feature
 */

const fs = require('fs');
const path = require('path');

const routeName = process.argv[2];

if (!routeName) {
  console.error('Usage: node scripts/create-route.js <route-name>');
  console.error('Example: node scripts/create-route.js user-management');
  process.exit(1);
}

const routeFile = path.join(__dirname, '..', 'routes', `${routeName}.js`);
const routeDir = path.dirname(routeFile);

// Ensure routes directory exists
if (!fs.existsSync(routeDir)) {
  fs.mkdirSync(routeDir, { recursive: true });
}

// Check if file already exists
if (fs.existsSync(routeFile)) {
  console.error(`Error: Route file already exists: ${routeFile}`);
  process.exit(1);
}

// Generate route template
const routeTemplate = `/**
 * ${routeName.charAt(0).toUpperCase() + routeName.slice(1)} Routes
 * 
 * Generated: ${new Date().toISOString()}
 */

const express = require('express');
const router = express.Router();
const { asyncHandler, sendResponse, requireAuth, getStorageSafe } = require('./route-helpers');

// Middleware for this router
router.use((req, res, next) => {
  console.log(\`[${routeName}] \${req.method} \${req.path}\`);
  next();
});

// GET /api/${routeName}
router.get('/', asyncHandler(async (req, res) => {
  sendResponse(res, 200, 'success', {
    message: '${routeName} endpoint is working',
    timestamp: new Date().toISOString()
  });
}));

// GET /api/${routeName}/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  sendResponse(res, 200, 'success', {
    id,
    message: \`Getting ${routeName} with id: \${id}\`
  });
}));

// POST /api/${routeName}
router.post('/', requireAuth(asyncHandler(async (req, res) => {
  const storage = getStorageSafe();
  if (!storage) {
    return sendResponse(res, 500, 'failure', null, 'Storage not available');
  }
  
  // TODO: Implement your logic here
  sendResponse(res, 201, 'success', {
    message: 'Created successfully',
    data: req.body
  });
})));

// PUT /api/${routeName}/:id
router.put('/:id', requireAuth(asyncHandler(async (req, res) => {
  const { id } = req.params;
  // TODO: Implement your logic here
  sendResponse(res, 200, 'success', {
    id,
    message: 'Updated successfully'
  });
})));

// DELETE /api/${routeName}/:id
router.delete('/:id', requireAuth(asyncHandler(async (req, res) => {
  const { id } = req.params;
  // TODO: Implement your logic here
  sendResponse(res, 200, 'success', {
    id,
    message: 'Deleted successfully'
  });
})));

module.exports = {
  path: '/api/${routeName}',
  router: router
};
`;

// Write the file
fs.writeFileSync(routeFile, routeTemplate, 'utf8');

console.log(`✓ Created route module: ${routeFile}`);
console.log(`\nNext steps:`);
console.log(`1. Edit ${routeFile} to implement your logic`);
console.log(`2. Restart the server to load the new route`);
console.log(`3. Test: curl http://localhost:8080/api/${routeName}`);

