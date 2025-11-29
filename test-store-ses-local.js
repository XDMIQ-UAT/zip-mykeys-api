#!/usr/bin/env node
/**
 * Test storing SES credentials locally using Upstash Redis
 */

const { Redis } = require('@upstash/redis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function storeSESCredentials() {
  console.log('\n=== Storing SES Credentials in Upstash Redis ===\n');
  
  const smtpUsername = process.argv[2] || 'AKIAVGDN36DN35Q62F4F';
  const smtpPassword = process.argv[3] || 'BMNmhuQjmqWO8ko8ABdk3rNuwNgsXDmBFG05hTYeBoXw';
  
  const sesCredentials = {
    smtp_username: smtpUsername,
    smtp_password: smtpPassword,
    region: 'us-east-1',
    from_email: 'hello@cosmiciq.org',
  };
  
  console.log('Storing SES credentials...');
  console.log(`  SMTP Username: ${smtpUsername.substring(0, 8)}...`);
  console.log(`  Region: us-east-1`);
  console.log(`  From Email: hello@cosmiciq.org\n`);
  
  try {
    const exists = await redis.exists('secret:ses-credentials');
    await redis.set('secret:ses-credentials', JSON.stringify(sesCredentials));
    
    // Store metadata
    await redis.set('secret:ses-credentials:meta', JSON.stringify({
      labels: { type: 'ses', region: 'us-east-1' },
      updatedAt: new Date().toISOString()
    }));
    
    console.log(`✅ SES credentials ${exists ? 'updated' : 'stored'} successfully!`);
    console.log('   Secret name: secret:ses-credentials');
    console.log('   Storage: Upstash Redis');
    console.log(`   From email: hello@cosmiciq.org\n`);
    
    // Verify it was stored
    const stored = await redis.get('secret:ses-credentials');
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
    console.log('✓ Verification: Credentials retrieved successfully');
    console.log(`  Username: ${parsed.smtp_username.substring(0, 8)}...`);
    console.log(`  Region: ${parsed.region}`);
    console.log(`  From: ${parsed.from_email}\n`);
    
  } catch (error) {
    console.error('❌ Failed to store:', error.message);
    process.exit(1);
  }
}

storeSESCredentials().catch(console.error);

