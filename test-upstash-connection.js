#!/usr/bin/env node
/**
 * Test Upstash Redis Connection
 */

const { Redis } = require('@upstash/redis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

async function testConnection() {
  console.log('\n=== Testing Upstash Redis Connection ===\n');
  
  // Check environment variables
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  
  if (!url || !token) {
    console.error('❌ Upstash Redis credentials not found');
    console.error('\nSet these environment variables:');
    console.error('  UPSTASH_REDIS_REST_URL');
    console.error('  UPSTASH_REDIS_REST_TOKEN');
    console.error('\nOr pull from Vercel:');
    console.error('  vercel env pull .env.local');
    process.exit(1);
  }
  
  console.log('✓ Environment variables found');
  console.log(`  URL: ${url.substring(0, 30)}...`);
  console.log(`  Token: ${token.substring(0, 10)}...\n`);
  
  try {
    // Test ping
    console.log('Testing connection...');
    const pong = await redis.ping();
    console.log(`✓ Ping: ${pong}`);
    
    // Test set/get
    console.log('\nTesting set/get...');
    await redis.set('test:connection', 'success');
    const value = await redis.get('test:connection');
    console.log(`✓ Set/Get: ${value}`);
    
    // Clean up
    await redis.del('test:connection');
    console.log('✓ Cleanup complete');
    
    console.log('\n✅ Upstash Redis connection successful!');
    console.log('   Database: upstash-kv-purple-umbrella');
    console.log('   Ready to store secrets\n');
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    if (error.message.includes('401')) {
      console.error('   Authentication failed - check UPSTASH_REDIS_REST_TOKEN');
    } else if (error.message.includes('404')) {
      console.error('   Database not found - check UPSTASH_REDIS_REST_URL');
    }
    process.exit(1);
  }
}

testConnection().catch(console.error);




