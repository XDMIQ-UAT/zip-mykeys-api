#!/usr/bin/env node
/**
 * Direct AWS SES SMTP Test
 */

require('dotenv').config({ path: '.env.local' });

const nodemailer = require('nodemailer');

console.log('╔════════════════════════════════════════╗');
console.log('║  AWS SES Direct SMTP Test              ║');
console.log('╚════════════════════════════════════════╝');
console.log('');

// Show loaded credentials (masked)
console.log('Configuration:');
console.log(`  Host: ${process.env.AWS_SES_SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com'}`);
console.log(`  Port: ${process.env.AWS_SES_SMTP_PORT || '587'}`);
console.log(`  Username: ${process.env.AWS_SES_SMTP_USERNAME || process.env.AWS_ACCESS_KEY_ID}`);
console.log(`  Password: ***${(process.env.AWS_SES_SMTP_PASSWORD || process.env.AWS_SECRET_ACCESS_KEY)?.slice(-4)}`);
console.log(`  Sender: ${process.env.SES_SENDER_EMAIL || 'hello@xdmiq.com'}`);
console.log('');

const transporter = nodemailer.createTransport({
  host: process.env.AWS_SES_SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com',
  port: parseInt(process.env.AWS_SES_SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.AWS_SES_SMTP_USERNAME || process.env.AWS_ACCESS_KEY_ID,
    pass: process.env.AWS_SES_SMTP_PASSWORD || process.env.AWS_SECRET_ACCESS_KEY,
  },
  debug: true, // Enable debug output
  logger: true, // Log to console
});

async function test() {
  try {
    console.log('Testing connection...');
    await transporter.verify();
    console.log('');
    console.log('✅ Connection successful!');
    console.log('');
    console.log('Ready to send emails via AWS SES SMTP');
  } catch (error) {
    console.error('');
    console.error('❌ Connection failed:', error.message);
    console.error('');
    console.error('Full error:', error);
    console.error('');
    console.error('Troubleshooting:');
    console.error('  1. Verify sender email is verified in AWS SES Console');
    console.error('  2. Check that SMTP credentials are correct');
    console.error('  3. Ensure AWS SES is enabled in your region (us-east-1)');
    console.error('  4. Check firewall/network allows outbound SMTP (port 587)');
    process.exit(1);
  }
}

test();
