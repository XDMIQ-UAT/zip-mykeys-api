#!/usr/bin/env node
/**
 * Store Twilio Credentials
 * Stores credentials in mykeys.zip API (KV storage)
 */

const readline = require('readline');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config();

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
  // Use Basic Auth to generate Bearer token (HIPAA compliant approach)
  if (!MYKEYS_PASS) {
    throw new Error('MYKEYS_PASS not set in .env.local. Set it to your admin password.');
  }

  console.log('Using Basic Auth to generate Bearer token...');
  const auth = Buffer.from(`${MYKEYS_USER}:${MYKEYS_PASS}`).toString('base64');
  
  // Use legacy endpoint that accepts Basic Auth
  console.log('Generating Bearer token via Basic Auth...');
  const tokenResponse = await axios.post(
    `${MYKEYS_URL}/api/mcp/token/generate-legacy`,
    {
      clientId: 'twilio-setup-cli',
      clientType: 'cli',
      expiresInDays: 1, // Short-lived token for setup
    },
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  if (!tokenResponse.data.success || !tokenResponse.data.token) {
    throw new Error('Failed to generate Bearer token. Check MYKEYS_PASS is correct.');
  }

  console.log('✓ Bearer token generated');
  return `Bearer ${tokenResponse.data.token}`;
}

async function main() {
  console.log('\n=== Store Twilio Credentials ===\n');

  try {
    // Get authentication token
    const token = await getAuthToken();

    // Get Twilio credentials from user
    console.log('\nEnter Twilio credentials:');
    const accountSid = await question('Account SID: ');
    const authToken = await question('Auth Token: ');
    const phoneNumber = await question('Phone Number (e.g., +16269959974) [optional]: ') || '';
    const verifyServiceSid = await question('Verify Service SID [optional]: ') || '';

    // Build credentials object
    const twilioCredentials = {
      account_sid: accountSid.trim(),
      auth_token: authToken.trim(),
    };

    if (phoneNumber.trim()) {
      twilioCredentials.phone_number = phoneNumber.trim();
    }

    if (verifyServiceSid.trim()) {
      twilioCredentials.verify_service_sid = verifyServiceSid.trim();
    }

    // Store credentials
    console.log('\nStoring credentials...');
    // Token is already formatted as Bearer token
    const authHeader = token;
    
    const storeResponse = await axios.post(
      `${MYKEYS_URL}/api/secrets`,
      {
        name: 'twilio-credentials',
        value: JSON.stringify(twilioCredentials),
      },
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    if (storeResponse.data.success) {
      console.log('✓ Twilio credentials stored successfully!');
      console.log(`  Secret name: twilio-credentials`);
      console.log(`  Account SID: ${accountSid.substring(0, 10)}...`);
      console.log(`  Phone Number: ${phoneNumber || 'not set'}`);
    } else {
      console.error('✗ Failed to store credentials');
      console.error(storeResponse.data);
    }

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();

