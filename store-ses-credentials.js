#!/usr/bin/env node
/**
 * Store SES Credentials for cosmiciq.org
 * Stores credentials in mykeys.zip API
 */

const readline = require('readline');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
const MYKEYS_USER = process.env.MYKEYS_USER || 'admin';
const MYKEYS_PASS = process.env.MYKEYS_PASS;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function getAuthToken() {
  // Step 1: Verify partial password to get architect code
  console.log('Verifying partial password...');
  const verifyResponse = await axios.post(
    `${MYKEYS_URL}/api/auth/verify-partial`,
    { partialPassword: MYKEYS_PASS },
    { timeout: 10000 }
  );

  if (!verifyResponse.data.success || !verifyResponse.data.code) {
    throw new Error('Failed to verify partial password');
  }

  const architectCode = verifyResponse.data.code;
  console.log('✓ Partial password verified, got architect code');

  // Step 2: Generate token using architect code
  console.log('Generating token...');
  const tokenResponse = await axios.post(
    `${MYKEYS_URL}/api/mcp/token/generate`,
    {
      architectCode: architectCode,
      clientId: 'ses-setup-cli',
      clientType: 'cli',
      expiresInDays: 1, // Short-lived token for setup
    },
    { timeout: 10000 }
  );

  if (!tokenResponse.data.success || !tokenResponse.data.token) {
    throw new Error('Failed to generate token');
  }

  console.log('✓ Token generated');
  return tokenResponse.data.token;
}

async function storeSESCredentials() {
  console.log('\n=== Store SES Credentials for cosmiciq.org ===\n');

  if (!MYKEYS_PASS) {
    console.error('❌ MYKEYS_PASS not set in .env.local');
    console.error('   Set MYKEYS_PASS (partial password) in .env.local');
    process.exit(1);
  }

  // Get SES credentials
  const smtpUsername = process.argv[2] || await question('Enter SES SMTP Username: ');
  const smtpPassword = process.argv[3] || await question('Enter SES SMTP Password: ');
  const region = process.argv[4] || 'us-east-1';
  const fromEmail = 'hello@cosmiciq.org';

  const sesCredentials = {
    smtp_username: smtpUsername,
    smtp_password: smtpPassword,
    region: region,
    from_email: fromEmail,
  };

  console.log('\nStoring SES credentials...');
  console.log(`  SMTP Username: ${smtpUsername.substring(0, Math.min(8, smtpUsername.length))}...`);
  console.log(`  Region: ${region}`);
  console.log(`  From Email: ${fromEmail}\n`);

  // Get auth token using partial password flow
  let token;
  try {
    token = await getAuthToken();
  } catch (error) {
    console.error('❌ Failed to authenticate:', error.response?.data?.error || error.message);
    if (error.response?.status === 401) {
      console.error('   Check MYKEYS_PASS in .env.local (should be partial password)');
    }
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    console.log(`Storing to: ${MYKEYS_URL}/api/secrets`);
    // Try to create the secret
    const response = await axios.post(
      `${MYKEYS_URL}/api/secrets`,
      {
        name: 'ses-credentials',
        value: JSON.stringify(sesCredentials),
      },
      { headers, timeout: 60000 }
    );

    console.log('✓ SES credentials stored successfully in mykeys.zip API!');
    console.log('  Secret name: ses-credentials');
    console.log(`  From email: ${fromEmail}\n`);
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error('✗ Request timed out after 60 seconds');
      console.error('   The server may be slow or GCP Secret Manager is taking longer than expected');
      console.error(`   URL: ${MYKEYS_URL}/api/secrets`);
      console.error('   Try again or check server logs');
      process.exit(1);
    }
    
    if (error.response && error.response.status === 409) {
      // Secret exists, try to update
      console.log('Secret exists, updating...');
      try {
        await axios.put(
          `${MYKEYS_URL}/api/secrets/ses-credentials`,
          {
            value: JSON.stringify(sesCredentials),
          },
          { headers, timeout: 60000 }
        );

        console.log('✓ SES credentials updated successfully!');
        console.log(`  From email: ${fromEmail}\n`);
      } catch (updateError) {
        console.error('✗ Failed to update:', updateError.response?.data?.error || updateError.message);
        if (updateError.response?.status === 401) {
          console.error('   Authentication failed - token may have expired');
        }
        process.exit(1);
      }
    } else {
      console.error('✗ Failed to store:', error.response?.data?.error || error.message);
      if (error.response?.status === 401) {
        console.error('   Authentication failed - token may have expired');
      } else if (error.response?.status === 404) {
        console.error('   Endpoint not found - check MYKEYS_URL');
      } else if (error.code) {
        console.error(`   Error code: ${error.code}`);
      }
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Response: ${JSON.stringify(error.response.data)}`);
      }
      process.exit(1);
    }
  }

  rl.close();
}

storeSESCredentials().catch((error) => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});

