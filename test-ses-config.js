#!/usr/bin/env node
/**
 * Test SES Configuration
 * 
 * Diagnoses Amazon SES email configuration issues
 */

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const nodemailer = require('nodemailer');

const PROJECT_ID = process.env.GCP_PROJECT || 'myl-zip-www';
const TEST_EMAIL = process.argv[2] || process.env.TEST_EMAIL || 'bcherrman@gmail.com';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

async function getSecretFromGCP(secretName) {
  try {
    const client = new SecretManagerServiceClient();
    const fullName = `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`;
    const [version] = await client.accessSecretVersion({ name: fullName });
    return version.payload.data.toString('utf8');
  } catch (error) {
    if (error.code === 5) { // NOT_FOUND
      return null;
    }
    throw error;
  }
}

async function testSESConfig() {
  console.log(colorize('\n=== SES Configuration Diagnostic ===\n', 'bright'));
  
  // Step 1: Check GCP credentials
  console.log(colorize('Step 1: Checking GCP credentials...', 'cyan'));
  try {
    const client = new SecretManagerServiceClient();
    console.log(colorize('✓ GCP Secret Manager client initialized', 'green'));
  } catch (error) {
    console.error(colorize('✗ GCP credentials not configured:', 'red'), error.message);
    console.log('\nTo fix:');
    console.log('  1. Set GOOGLE_APPLICATION_CREDENTIALS environment variable');
    console.log('  2. Or set GCP_PROJECT environment variable');
    console.log('  3. Or ensure gcloud is authenticated: gcloud auth application-default login');
    return;
  }
  
  // Step 2: Check for SES credentials (env vars first, then GCP)
  console.log(colorize('\nStep 2: Checking for SES credentials...', 'cyan'));
  
  let ses = null;
  let source = '';
  
  // Check environment variables first (for Vercel)
  if (process.env.SES_SMTP_USERNAME && process.env.SES_SMTP_PASSWORD) {
    console.log(colorize('✓ Found SES credentials in environment variables', 'green'));
    ses = {
      smtp_username: process.env.SES_SMTP_USERNAME,
      smtp_password: process.env.SES_SMTP_PASSWORD,
      region: process.env.SES_REGION || 'us-east-1',
      from_email: process.env.SES_FROM_EMAIL || 'noreply@mykeys.zip',
    };
    source = 'environment variables';
  } else {
    // Check GCP Secret Manager
    const sesSecret = await getSecretFromGCP('ses-credentials');
    if (!sesSecret) {
      console.error(colorize('✗ SES credentials not found', 'red'));
      console.log('\nTo fix:');
      console.log('  Option 1: Set environment variables (for Vercel):');
      console.log('    SES_SMTP_USERNAME=your-smtp-username');
      console.log('    SES_SMTP_PASSWORD=your-smtp-password');
      console.log('    SES_REGION=us-east-1 (optional)');
      console.log('    SES_FROM_EMAIL=noreply@mykeys.zip (optional)');
      console.log('\n  Option 2: Create secret in GCP Secret Manager:');
      console.log('    gcloud secrets create ses-credentials --data-file=-');
      console.log('    Secret should contain JSON with: smtp_username, smtp_password, region, from_email');
      return;
    }
    console.log(colorize('✓ Found SES credentials in GCP Secret Manager', 'green'));
    source = 'GCP Secret Manager';
    
    // Step 3: Parse and validate secret
    console.log(colorize('\nStep 3: Validating secret format...', 'cyan'));
    try {
      ses = JSON.parse(sesSecret);
    } catch (error) {
      console.error(colorize('✗ Failed to parse secret as JSON:', 'red'), error.message);
      console.log('\nSecret should be valid JSON with these fields:');
      console.log('  {');
      console.log('    "smtp_username": "your-ses-smtp-username",');
      console.log('    "smtp_password": "your-ses-smtp-password",');
      console.log('    "region": "us-east-1",');
      console.log('    "from_email": "noreply@mykeys.zip"');
      console.log('  }');
      return;
    }
  }
  
  // Step 3/4: Validate credentials
  const stepNumber = source === 'environment variables' ? '3' : '4';
  console.log(colorize(`\nStep ${stepNumber}: Validating credentials...`, 'cyan'));
  
  // Check required fields
  const requiredFields = ['smtp_username', 'smtp_password'];
  const missingFields = requiredFields.filter(field => !ses[field]);
  
  if (missingFields.length > 0) {
    console.error(colorize(`✗ Missing required fields: ${missingFields.join(', ')}`, 'red'));
    return;
  }
  
  console.log(colorize('✓ Credentials format is valid', 'green'));
  console.log(`  Source: ${source}`);
  console.log(`  Region: ${ses.region || 'us-east-1'}`);
  console.log(`  From Email: ${ses.from_email || 'noreply@mykeys.zip'}`);
  console.log(`  SMTP Username: ${ses.smtp_username.substring(0, 8)}...`);
  
  // Step 4/5: Test SMTP connection
  const stepNumber2 = source === 'environment variables' ? '4' : '5';
  console.log(colorize(`\nStep ${stepNumber2}: Testing SMTP connection...`, 'cyan'));
  const transporter = nodemailer.createTransport({
    host: `email-smtp.${ses.region || 'us-east-1'}.amazonaws.com`,
    port: 587,
    secure: false,
    auth: {
      user: ses.smtp_username,
      pass: ses.smtp_password,
    },
  });
  
  try {
    await transporter.verify();
    console.log(colorize('✓ SMTP connection verified successfully', 'green'));
  } catch (error) {
    console.error(colorize('✗ SMTP connection failed:', 'red'), error.message);
    console.log('\nCommon issues:');
    console.log('  1. Check SMTP username and password are correct');
    console.log('  2. Verify SES region matches your AWS account');
    console.log('  3. Check network connectivity');
    console.log('  4. Ensure SES is enabled in your AWS account');
    return;
  }
  
  // Step 5/6: Test sending email
  const stepNumber3 = source === 'environment variables' ? '5' : '6';
  console.log(colorize(`\nStep ${stepNumber3}: Testing email send to ${TEST_EMAIL}...`, 'cyan'));
  try {
    await transporter.sendMail({
      from: ses.from_email || 'noreply@mykeys.zip',
      to: TEST_EMAIL,
      subject: 'SES Configuration Test',
      text: 'This is a test email from mykeys.zip SES configuration diagnostic.',
      html: '<p>This is a test email from <strong>mykeys.zip</strong> SES configuration diagnostic.</p>',
    });
    console.log(colorize('✓ Test email sent successfully!', 'green'));
    console.log(`  Check ${TEST_EMAIL} inbox for the test email`);
  } catch (error) {
    console.error(colorize('✗ Failed to send test email:', 'red'), error.message);
    
    if (error.code === 'EAUTH') {
      console.log('\nAuthentication error:');
      console.log('  - Check SMTP username and password');
      console.log('  - Verify credentials in AWS SES console');
    } else if (error.responseCode === 554) {
      console.log('\nEmail rejection error:');
      console.log('  - Email address may not be verified in SES');
      console.log('  - SES may be in sandbox mode (only verified emails allowed)');
      console.log('  - Check SES sending statistics in AWS console');
    } else {
      console.log('\nCommon issues:');
      console.log('  1. Email address not verified in SES (if in sandbox mode)');
      console.log('  2. Domain not verified in SES');
      console.log('  3. SES sending limits exceeded');
      console.log('  4. Check AWS SES console for sending statistics');
    }
    return;
  }
  
  console.log(colorize('\n=== All checks passed! ===\n', 'green'));
  console.log('SES configuration is working correctly.');
  console.log('You can now use email verification in the MFA flow.');
}

testSESConfig().catch((error) => {
  console.error(colorize('\n✗ Diagnostic failed:', 'red'), error.message);
  console.error(error.stack);
  process.exit(1);
});

