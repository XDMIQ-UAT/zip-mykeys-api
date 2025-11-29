/**
 * Test Vercel KV (Redis) Connection
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { createClient } = require('@vercel/kv');

async function testConnection() {
  console.log('\n=== Testing Vercel KV Connection ===\n');
  
  // Check environment variables
  const kvUrl = process.env.KV_REST_API_URL || process.env.mykeys_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.mykeys_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  console.log('Environment Variables:');
  console.log(`  KV_REST_API_URL: ${process.env.KV_REST_API_URL ? '✓ Set' : '✗ Missing'}`);
  console.log(`  KV_REST_API_TOKEN: ${process.env.KV_REST_API_TOKEN ? '✓ Set' : '✗ Missing'}`);
  console.log(`  mykeys_KV_REST_API_URL: ${process.env.mykeys_KV_REST_API_URL ? '✓ Set' : '✗ Missing'}`);
  console.log(`  mykeys_KV_REST_API_TOKEN: ${process.env.mykeys_KV_REST_API_TOKEN ? '✓ Set' : '✗ Missing'}`);
  console.log(`  UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? '✓ Set' : '✗ Missing'}`);
  console.log(`  UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? '✓ Set' : '✗ Missing'}`);
  console.log('');
  
  if (!kvUrl || !kvToken) {
    console.error('❌ KV connection variables not found');
    console.error('\nTo fix:');
    console.error('  1. Connect Redis/KV database in Vercel dashboard');
    console.error('  2. Pull env vars: vercel env pull .env.local');
    console.error('  3. Or set KV_REST_API_URL and KV_REST_API_TOKEN manually');
    process.exit(1);
  }
  
  console.log(`Using: ${kvUrl ? '✓ URL found' : '✗ URL missing'}, ${kvToken ? '✓ Token found' : '✗ Token missing'}\n`);
  
  try {
    // Create KV client
    const kv = createClient({
      url: kvUrl,
      token: kvToken,
    });
    
    // Test basic connection
    console.log('Testing connection...');
    await kv.set('test:connection', 'ok');
    const testValue = await kv.get('test:connection');
    
    if (testValue === 'ok') {
      console.log('✓ Connection successful!\n');
      
      // Clean up test key
      await kv.del('test:connection');
      
      // Check existing secrets
      console.log('Checking existing secrets...');
      const kvClient = createClient({ url: kvUrl, token: kvToken });
      const sesCreds = await kvClient.get('secret:ses-credentials');
      const twilioCreds = await kvClient.get('secret:twilio-credentials');
      
      if (sesCreds) {
        console.log('✓ ses-credentials found');
      } else {
        console.log('✗ ses-credentials not found');
      }
      
      if (twilioCreds) {
        console.log('✓ twilio-credentials found');
      } else {
        console.log('✗ twilio-credentials not found');
      }
      
      console.log('\n✅ Vercel KV is ready!');
      console.log('\nNext steps:');
      if (!sesCreds) {
        console.log('  1. Store SES credentials: node store-ses-credentials.js');
      }
      console.log('  2. Deploy: vercel --prod');
      
    } else {
      console.error('❌ Connection test failed - unexpected value');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
    
    if (error.message.includes('WRONGPASS') || error.message.includes('auth')) {
      console.error('\n⚠️  Authentication failed - check KV_REST_API_TOKEN');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('\n⚠️  Connection failed - check KV_REST_API_URL');
    }
    
    process.exit(1);
  }
}

testConnection().catch(console.error);

