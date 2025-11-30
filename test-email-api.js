/**
 * Test script for email sending via deployed API
 * Tests the /api/auth/request-mfa-code endpoint with email
 */

const https = require('https');

const API_URL = process.env.API_URL || 'https://zip-mykeys-api.vercel.app';
const TEST_EMAIL = process.argv[2] || process.env.TEST_EMAIL;

if (!TEST_EMAIL) {
  console.log('\n=== Email API Test ===\n');
  console.log('Usage: node test-email-api.js <your-email@example.com>');
  console.log('Or set TEST_EMAIL environment variable\n');
  console.log('Example:');
  console.log('  node test-email-api.js your-email@example.com\n');
  process.exit(1);
}

async function testEmailAPI() {
  console.log('\n=== Testing Email API ===\n');
  console.log(`API URL: ${API_URL}`);
  console.log(`Test Email: ${TEST_EMAIL}\n`);
  
  const requestData = JSON.stringify({
    email: TEST_EMAIL,
  });
  
  const options = {
    hostname: API_URL.replace('https://', '').replace('http://', ''),
    port: 443,
    path: '/api/auth/request-mfa-code',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': requestData.length,
    },
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          console.log(`Status: ${res.statusCode} ${res.statusMessage}`);
          console.log('\nResponse:');
          console.log(JSON.stringify(response, null, 2));
          
          if (res.statusCode === 200 && response.success) {
            console.log('\n✓ Email sent successfully!');
            console.log(`  Method: ${response.method}`);
            console.log(`  Target: ${response.target}`);
            console.log(`  Expires in: ${response.expiresIn} seconds`);
            console.log(`\n  Check your inbox at ${TEST_EMAIL} for the verification code.\n`);
            resolve(response);
          } else {
            console.log('\n✗ Failed to send email');
            console.log(`  Error: ${response.error || 'Unknown error'}`);
            console.log(`  Details: ${response.details || 'N/A'}\n`);
            reject(new Error(response.error || 'Failed to send email'));
          }
        } catch (error) {
          console.log('\n✗ Failed to parse response');
          console.log(`  Raw response: ${data}\n`);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log(`\n✗ Request failed: ${error.message}\n`);
      reject(error);
    });
    
    req.write(requestData);
    req.end();
  });
}

testEmailAPI()
  .then(() => {
    console.log('Test completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Test failed:', error.message);
    process.exit(1);
  });


