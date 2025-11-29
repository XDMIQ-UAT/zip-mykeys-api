#!/usr/bin/env node
/**
 * Generate a new MCP token via CLI
 */

const https = require('https');
const os = require('os');

// Configuration
const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
const MYKEYS_USER = process.env.MYKEYS_USER || 'admin';
// Standardized on MYKEYS_PASS for all environments
const MYKEYS_PASS = process.env.MYKEYS_PASS || 'riddle-squiggle@#$34alkdjf';

// Get client ID from hostname
const hostname = os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '');
const clientId = `cli-${hostname}`;

console.log('=== MyKeys Token Generator ===\n');
console.log(`Client ID: ${clientId}`);
console.log(`API URL: ${MYKEYS_URL}\n`);

// Prepare request
const url = new URL(`${MYKEYS_URL}/api/mcp/token/generate-legacy`);
const auth = Buffer.from(`${MYKEYS_USER}:${MYKEYS_PASS}`).toString('base64');
const data = JSON.stringify({
  clientId: clientId,
  clientType: 'generic',
  expiresInDays: 90
});

const options = {
  hostname: url.hostname,
  port: url.port || 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Generating token...\n');

const req = https.request(options, (res) => {
  let body = '';
  
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(body);
      
      if (res.statusCode === 200 && result.token) {
        console.log('✅ SUCCESS! Token generated:\n');
        console.log(result.token);
        console.log(`\nToken expires: ${new Date(result.expiresAt).toLocaleString()}`);
        console.log(`\nTo save this token, run:`);
        console.log(`  .\\setup-cli-token.ps1 -Token "${result.token}"`);
      } else {
        console.error('❌ Error:', result.error || 'Unknown error');
        console.error('Response:', body);
        process.exit(1);
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', body);
      console.error('Status:', res.statusCode);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
  process.exit(1);
});

req.write(data);
req.end();

