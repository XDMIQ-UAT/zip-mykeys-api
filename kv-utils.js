/**
 * Storage Utilities
 * 
 * Shared module for storage access to avoid circular dependencies
 */

const { createClient } = require('@vercel/kv');

let kv = null;

function getStorage() {
  if (!kv) {
    const kvUrl = process.env.KV_REST_API_URL || process.env.mykeys_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const kvToken = process.env.KV_REST_API_TOKEN || process.env.mykeys_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (kvUrl && kvToken) {
      kv = createClient({
        url: kvUrl,
        token: kvToken,
      });
    } else {
      // Try default @vercel/kv (requires KV_REST_API_URL/TOKEN)
      // @vercel/kv exports kv as a property, not a named export
      try {
        const kvModule = require('@vercel/kv');
        // kv is a property of the module, access it as kvModule.kv
        kv = kvModule.kv;
      } catch (e) {
        console.error('[storage] Storage client not available - missing environment variables');
      }
    }
  }
  return kv;
}

// Export both names for backward compatibility during migration
module.exports = { getStorage, getKV: getStorage };

// Debug: Verify module is loading
console.log('[storage] Module loaded, getStorage exported:', typeof getStorage === 'function');

