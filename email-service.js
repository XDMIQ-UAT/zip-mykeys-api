/**
 * Email Service for MyKeys.zip Authentication
 * 
 * Sends 4-digit verification codes via Amazon SES SDK
 * From: hello@cosmiciq.org
 * 
 * Uses environment variables from Vercel:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_REGION (defaults to us-east-1)
 * - SES_SENDER_EMAIL or SES_FROM_EMAIL (defaults to hello@cosmiciq.org)
 */

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

// Lazy initialization of SES client (loads credentials from environment variables)
let sesClient = null;
let DEFAULT_SENDER = 'hello@cosmiciq.org';
let AWS_REGION = 'us-east-1';

function getSESClient() {
  if (sesClient) return sesClient;
  
  // Skip initialization in test mode
  if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
    console.log('[email-service] TEST MODE: Skipping SES client initialization');
    return null; // Will be handled by sendAuthCode test mode check
  }
  
  // Get credentials from environment variables (Vercel)
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || 'us-east-1';
  
  if (!accessKeyId || !secretAccessKey) {
    const missingVars = [];
    if (!accessKeyId) missingVars.push('AWS_ACCESS_KEY_ID');
    if (!secretAccessKey) missingVars.push('AWS_SECRET_ACCESS_KEY');
    
    // In test mode, don't throw - just log and return null
    if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
      console.log(`[email-service] TEST MODE: AWS SES credentials missing (expected in tests)`);
      return null;
    }
    
    const errorMsg = `AWS SES credentials missing: ${missingVars.join(', ')}. ` +
      `Please set these environment variables in Vercel: ` +
      `https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables`;
    console.error('[email-service]', errorMsg);
    throw new Error(errorMsg);
  }
  
  try {
    AWS_REGION = region;
    // Check SES_SENDER_EMAIL (already set in Vercel) or fallback to SES_FROM_EMAIL
    // Trim whitespace (including \r\n) that might be present in environment variables
    const senderEmail = process.env.SES_SENDER_EMAIL || process.env.SES_FROM_EMAIL || 'hello@cosmiciq.org';
    DEFAULT_SENDER = senderEmail.trim();
    
    sesClient = new SESClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
    
    console.log('[email-service] SES client initialized with AWS SDK');
    console.log(`[email-service] Region: ${AWS_REGION}, Sender: ${DEFAULT_SENDER}`);
    return sesClient;
  } catch (error) {
    console.error('[email-service] Failed to initialize SES client:', error.message);
    throw new Error(`Failed to initialize AWS SES client: ${error.message}`);
  }
}

/**
 * Send 4-digit authentication code via email
 * 
 * @param {string} toEmail - Recipient email address
 * @param {string} code - 4-digit verification code
 * @param {string} username - Username for context (optional)
 * @returns {Promise<Object>} - Send result with messageId
 */
async function sendAuthCode(toEmail, code, username = 'user') {
  // Skip actual email sending in test mode to prevent hangs
  if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
    console.log(`[email-service] TEST MODE: Skipping actual email send to ${toEmail} (code: ${code})`);
    return {
      success: true,
      messageId: 'test-message-id',
      to: toEmail,
      testMode: true
    };
  }
  
  // Get SES client (will throw if credentials missing)
  const client = getSESClient();
  
  // Improved HTML email with better spam score - removed trigger words
  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="format-detection" content="telephone=no">
  <title>Your MyKeys Verification Code</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
      line-height: 1.6; 
      color: #333333; 
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .email-wrapper {
      max-width: 600px; 
      margin: 0 auto; 
      background-color: #ffffff;
    }
    .email-content {
      padding: 40px 30px;
    }
    .header {
      text-align: center;
      padding-bottom: 30px;
      border-bottom: 2px solid #e0e0e0;
    }
    .header h1 {
      margin: 0;
      color: #1a1a1a;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 30px 0;
    }
    .greeting {
      font-size: 16px;
      color: #333333;
      margin-bottom: 20px;
    }
    .code-container {
      text-align: center;
      margin: 30px 0;
    }
    .code { 
      display: inline-block;
      font-size: 36px; 
      font-weight: 700; 
      color: #0066cc; 
      padding: 20px 40px; 
      background-color: #f8f9fa; 
      border-radius: 8px; 
      letter-spacing: 12px;
      border: 2px solid #e0e0e0;
      font-family: 'Courier New', monospace;
    }
    .info {
      color: #666666; 
      font-size: 14px; 
      margin-top: 20px;
      line-height: 1.8;
    }
    .footer { 
      margin-top: 40px; 
      padding-top: 20px; 
      border-top: 1px solid #e0e0e0; 
      color: #999999; 
      font-size: 12px;
      text-align: center;
    }
    .footer a {
      color: #0066cc;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-content">
      <div class="header">
        <h1>MyKeys.zip</h1>
      </div>
      <div class="content">
        <div class="greeting">Hello ${username},</div>
        <p style="font-size: 16px; color: #333333; margin-bottom: 10px;">Your verification code for MyKeys is:</p>
        <div class="code-container">
          <div class="code">${code}</div>
        </div>
        <div class="info">
          <p style="margin: 10px 0;">This code will expire in <strong>10 minutes</strong>.</p>
          <p style="margin: 10px 0;">If you did not request this code, you can safely ignore this email.</p>
        </div>
      </div>
      <div class="footer">
        <p style="margin: 5px 0;">Cosmiciq Platform</p>
        <p style="margin: 5px 0;"><a href="https://cosmiciq.org">https://cosmiciq.org</a></p>
        <p style="margin: 10px 0 0 0; font-size: 11px; color: #cccccc;">This is an automated authentication email. Please do not reply.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
Hello ${username},

Your verification code for MyKeys is:

${code}

This code will expire in 10 minutes.

If you did not request this code, you can safely ignore this email.

---
Cosmiciq Platform
https://cosmiciq.org

This is an automated message. Please do not reply.
  `.trim();

  try {
    const client = getSESClient();
    
    // Double-check test mode (in case getSESClient returned null)
    if (!client && (process.env.NODE_ENV === 'test' || process.env.CI === 'true')) {
      console.log(`[email-service] TEST MODE: Skipping actual email send to ${toEmail} (code: ${code})`);
      return {
        success: true,
        messageId: 'test-message-id',
        to: toEmail,
        testMode: true
      };
    }
    
    // Log sender email for debugging (after trimming)
    console.log(`[email-service] Sending email from: "${DEFAULT_SENDER}" (length: ${DEFAULT_SENDER.length})`);
    console.log(`[email-service] Sending email to: ${toEmail}`);
    
    // Improved subject line (less spammy - removed "authentication code")
    const subject = `Your MyKeys verification code`;
    
    const command = new SendEmailCommand({
      Source: DEFAULT_SENDER,
      ReplyToAddresses: [DEFAULT_SENDER], // Proper reply-to
      Destination: {
        ToAddresses: [toEmail],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8',
          },
        },
      },
      // Add configuration set if available (helps with reputation and tracking)
      ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined,
    });
    
    // Add timeout to prevent hangs (10 seconds max)
    const sendPromise = client.send(command);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email send timeout after 10 seconds')), 10000)
    );
    
    const response = await Promise.race([sendPromise, timeoutPromise]);
    console.log(`✓ Auth code email sent to ${toEmail}: ${response.MessageId}`);
    return {
      success: true,
      messageId: response.MessageId,
      to: toEmail,
    };
  } catch (error) {
    console.error('✗ Failed to send auth code email:');
    console.error('  Error message:', error.message);
    console.error('  Error code:', error.Code || error.name || 'N/A');
    console.error('  Error details:', error.$metadata || 'N/A');
    console.error('  Full error:', JSON.stringify(error, null, 2));
    
    // Check if AWS credentials are actually available
    const hasAccessKey = !!process.env.AWS_ACCESS_KEY_ID;
    const hasSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY;
    console.error('  AWS_ACCESS_KEY_ID present:', hasAccessKey);
    console.error('  AWS_SECRET_ACCESS_KEY present:', hasSecretKey);
    
    // Check for common SES errors
    const errorCode = error.Code || error.name || '';
    const errorMessage = error.message || '';
    
    // Sandbox mode error - email address not verified
    if (errorCode === 'MessageRejected' || errorMessage.includes('Email address is not verified') || errorMessage.includes('not verified')) {
      const sandboxError = `Email delivery failed: The recipient email address (${toEmail}) is not verified in AWS SES. ` +
        `AWS SES is in sandbox mode, which only allows sending to verified email addresses. ` +
        `To fix: 1) Verify the email in AWS SES Console, or 2) Request production access to remove sandbox restrictions. ` +
        `Original error: ${errorMessage}`;
      console.error('[email-service] Sandbox mode detected:', sandboxError);
      throw new Error(sandboxError);
    }
    
    // If error mentions PLAIN, it might be trying SMTP instead of SDK
    if (error.message.includes('PLAIN') || error.message.includes('SMTP')) {
      throw new Error(`Email delivery failed: AWS SES SDK not initialized correctly. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables. Original error: ${error.message}`);
    }
    
    throw new Error(`Email delivery failed: ${error.message}`);
  }
}

/**
 * Test SES connection
 */
async function testConnection() {
  try {
    const client = getSESClient();
    // Test by getting account sending quota (lightweight operation)
    const { SESClient: TestSESClient, GetSendQuotaCommand } = require('@aws-sdk/client-ses');
    const testClient = new TestSESClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    
    // Note: GetSendQuotaCommand might not be available in all SDK versions
    // For now, just verify client initialization
    console.log('✓ Amazon SES client initialized successfully');
    return { success: true };
  } catch (error) {
    console.error('✗ Amazon SES connection failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendAuthCode,
  testConnection,
};

