#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'email-smtp.us-east-1.amazonaws.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.AWS_SES_SMTP_USERNAME,
    pass: process.env.AWS_SES_SMTP_PASSWORD,
  },
});

async function sendTest() {
  try {
    console.log('Attempting to send test email...');
    console.log('From: hello@xdmiq.com');
    console.log('To: bcherrman@gmail.com');
    console.log('');
    
    const info = await transporter.sendMail({
      from: '"XDMIQ Security" <hello@xdmiq.com>',
      to: 'bcherrman@gmail.com',
      subject: 'Test Email from MyKeys.zip',
      text: 'This is a test email from MyKeys.zip authentication system.',
      html: '<p>This is a test email from <strong>MyKeys.zip</strong> authentication system.</p>',
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('❌ Failed to send email');
    console.error('Error:', error.message);
    console.error('');
    
    if (error.responseCode) {
      console.error('Response code:', error.responseCode);
      console.error('Command:', error.command);
    }
    
    if (error.responseCode === 535) {
      console.error('');
      console.error('Authentication failed. The SMTP credentials from the screenshot');
      console.error('are either expired or for a different AWS account/region.');
      console.error('');
      console.error('Please generate NEW SMTP credentials:');
      console.error('  1. Go to AWS SES Console: https://console.aws.amazon.com/ses/');
      console.error('  2. Click "SMTP Settings" in left menu');
      console.error('  3. Click "Create SMTP Credentials"');
      console.error('  4. Copy the new username and password');
      console.error('  5. Update .env.local with new credentials');
    }
  }
}

sendTest();
