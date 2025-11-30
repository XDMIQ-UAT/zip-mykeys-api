/**
 * Test MFA code flow to debug verification issues
 */

const https = require('https');

const MYKEYS_URL = 'https://mykeys.zip';
const TEST_EMAIL = 'bcherrman@gmail.com';

async function testMFAFlow() {
  console.log('=== Testing MFA Code Flow ===\n');
  
  // Step 1: Request code
  console.log('1. Requesting verification code...');
  const requestResult = await makeRequest(`${MYKEYS_URL}/api/auth/request-mfa-code`, {
    email: TEST_EMAIL
  });
  
  if (!requestResult.success) {
    console.error('Failed to request code:', requestResult);
    return;
  }
  
  console.log('✓ Code requested successfully');
  console.log(`   Method: ${requestResult.method}`);
  console.log(`   Target: ${requestResult.target}\n`);
  
  // Wait a moment for code to be stored
  await sleep(2000);
  
  // Step 2: Try to verify (will fail, but shows what's stored)
  console.log('2. Attempting verification with test code "1234"...');
  const verifyResult = await makeRequest(`${MYKEYS_URL}/api/auth/verify-mfa-code`, {
    email: TEST_EMAIL,
    code: '1234',
    clientId: 'test-client'
  });
  
  console.log('Verification result:', verifyResult);
  
  if (verifyResult.error) {
    console.log(`\nError message: ${verifyResult.error}`);
    console.log(`Details: ${verifyResult.details || verifyResult.message || 'N/A'}`);
  }
}

function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          resolve({ raw: body, status: res.statusCode });
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

testMFAFlow().catch(console.error);

