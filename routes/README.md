# Route Development Guide

This directory contains modular route handlers for the MyKeys API. Routes are automatically loaded and registered when the server starts.

## 🔒 Security: Routes are PRIVATE by Default

**All routes require authentication by default.** The route loader automatically applies authentication middleware to all routes unless explicitly marked as public.

To create a public route (no authentication), set `public: true` in your route module exports.

## Creating a New Route Module

### Option 1: Function Export (Simplest)

Create a new file `routes/my-feature.js`:

```javascript
module.exports = function(app) {
  app.get('/api/my-feature', (req, res) => {
    res.json({ message: 'My feature works!' });
  });
  
  app.post('/api/my-feature', (req, res) => {
    res.json({ received: req.body });
  });
};
```

### Option 2: Register Method

```javascript
module.exports = {
  register: function(app) {
    app.get('/api/my-feature', (req, res) => {
      res.json({ message: 'My feature works!' });
    });
  }
};
```

### Option 3: Express Router (Recommended for complex routes)

**Private Route (Default - requires authentication):**
```javascript
const express = require('express');
const router = express.Router();

router.get('/items', (req, res) => {
  // req.userEmail and req.ringId are available after authentication
  res.json({ items: [], user: req.userEmail });
});

router.post('/items', (req, res) => {
  res.json({ created: true, user: req.userEmail });
});

module.exports = {
  path: '/api/my-feature',
  router: router
  // Routes are PRIVATE by default - authentication is automatically applied
};
```

**Public Route (No authentication required):**
```javascript
const express = require('express');
const router = express.Router();

router.get('/public-info', (req, res) => {
  res.json({ message: 'This is public' });
});

module.exports = {
  path: '/api/my-feature',
  router: router,
  public: true  // Mark as public - no authentication required
};
```

## Using Middleware

Routes can use existing middleware:

```javascript
const { authenticate } = require('../server'); // Import from server.js

module.exports = function(app) {
  // Protected route
  app.get('/api/protected', authenticate, (req, res) => {
    res.json({ 
      user: req.userEmail,
      ringId: req.ringId 
    });
  });
  
  // Public route
  app.get('/api/public', (req, res) => {
    res.json({ message: 'Public endpoint' });
  });
};
```

## Using Storage

```javascript
const { getStorage } = require('../kv-utils');

module.exports = function(app) {
  app.get('/api/data', async (req, res) => {
    const storage = getStorage();
    if (!storage) {
      return res.status(500).json({ error: 'Storage not available' });
    }
    
    const data = await storage.get('my-key');
    res.json({ data });
  });
};
```

## Best Practices

1. **Use Express Router** for routes with multiple endpoints
2. **Add authentication** using `authenticate` middleware for protected routes
3. **Handle errors** gracefully with try-catch
4. **Use consistent response format** - see `sendResponse` helper in server.js
5. **Add logging** for debugging: `console.log('[my-feature] Action performed')`
6. **Validate input** before processing
7. **Use async/await** for async operations

## Example: Complete Route Module

```javascript
const express = require('express');
const router = express.Router();
const { getStorage } = require('../kv-utils');

// Middleware for this router
router.use((req, res, next) => {
  console.log(`[my-feature] ${req.method} ${req.path}`);
  next();
});

// GET /api/my-feature/items
router.get('/items', async (req, res) => {
  try {
    const storage = getStorage();
    if (!storage) {
      return res.status(500).json({ error: 'Storage not available' });
    }
    
    const items = await storage.get('my-feature:items') || [];
    res.json({ items });
  } catch (error) {
    console.error('[my-feature] Error getting items:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/my-feature/items
router.post('/items', async (req, res) => {
  try {
    const { name, value } = req.body;
    if (!name || !value) {
      return res.status(400).json({ error: 'name and value required' });
    }
    
    const storage = getStorage();
    if (!storage) {
      return res.status(500).json({ error: 'Storage not available' });
    }
    
    await storage.set(`my-feature:item:${name}`, value);
    res.json({ success: true, name, value });
  } catch (error) {
    console.error('[my-feature] Error creating item:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = {
  path: '/api/my-feature',
  router: router
};
```

## Testing Routes

Routes are automatically loaded when the server starts. To test:

1. Start the server: `npm start`
2. Check logs for: `[routes] ✓ Loaded route module: my-feature.js`
3. Test endpoint: `curl http://localhost:8080/api/my-feature/items`

## File Naming

- Use kebab-case: `my-feature.js`
- Be descriptive: `user-management.js` not `users.js`
- Group related routes: `secrets-management.js` contains all secret-related routes

