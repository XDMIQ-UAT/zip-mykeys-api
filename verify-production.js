#!/usr/bin/env node
/**
 * Verify Production Server Configuration
 */

const axios = require('axios');

const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';

async function verifyProduction() {
  console.log('\n=== Verifying Production Server ===\n');
  
  // Test 1: Check if server is responding
  console.log('1. Testing server connectivity...');
  try {
    const healthCheck = await axios.get(`${MYKEYS_URL}/`, { timeout: 5000 });
    console.log('   ✓ Server is responding\n');
  } catch (error) {
    console.log('   ✗ Server not responding:', error.message);
    return;
  }
  
  // Test 2: Test email send (this will trigger Redis read)
  console.log('2. Testing email send (triggers Redis read)...');
  try {
    const response = await axios.post(
      `${MYKEYS_URL}/api/auth/request-mfa-code`,
      { email: 'hello@cosmiciq.org' },
      { timeout: 10000, validateStatus: () => true }
    );
    
    if (response.status === 200 && response.data.success) {
      console.log('   ✓ Email sent successfully!');
      console.log('   ✓ Redis connection working');
      console.log('   ✓ SES credentials accessible\n');
      return;
    } else if (response.status === 500) {
      const error = response.data?.details || response.data?.error || 'Unknown error';
      console.log(`   ✗ Server error: ${error}`);
      
      if (error.includes('SES credentials not configured')) {
        console.log('\n   Issue: Server cannot read from Redis');
        console.log('   Check:');
        console.log('     - Environment variables set in Vercel');
        console.log('     - Redis client initialized (check logs)');
        console.log('     - Credentials stored in Redis\n');
      }
    } else {
      console.log(`   Status: ${response.status}`);
      console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log('   ✗ Request failed:', error.message);
  }
  
  console.log('\n=== Next Steps ===');
  console.log('1. Check Vercel deployment logs:');
  console.log('   vercel logs <deployment-url> --follow');
  console.log('\n2. Look for:');
  console.log('   - "✓ Upstash Redis initialized" (good)');
  console.log('   - "⚠️ Upstash Redis not configured" (bad)');
  console.log('   - "[AUDIT] Secret accessed: ses-credentials" (good)');
  console.log('\n3. Verify environment variables in Vercel:');
  console.log('   https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables');
  console.log('   Look for: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN\n');
}

verifyProduction().catch(console.error);




