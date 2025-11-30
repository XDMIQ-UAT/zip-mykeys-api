/**
 * KV Storage Utilities
 * 
 * Shared module for KV storage access to avoid circular dependencies
 */

const { createClient } = require('@vercel/kv');

let kv = null;

function getKV() {
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
      try {
        const { kv: defaultKv } = require('@vercel/kv');
        kv = defaultKv;
      } catch (e) {
        console.error('[kv-utils] KV client not available - missing environment variables');
      }
    }
  }
  return kv;
}

module.exports = { getKV };

// Debug: Verify module is loading
console.log('[kv-utils] Module loaded, getKV exported:', typeof getKV === 'function');

