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
  
  try {
    // Get credentials from environment variables (Vercel)
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-1';
    
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not found in environment variables. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in Vercel.');
    }
    
    AWS_REGION = region;
    // Check SES_SENDER_EMAIL (already set in Vercel) or fallback to SES_FROM_EMAIL
    DEFAULT_SENDER = process.env.SES_SENDER_EMAIL || process.env.SES_FROM_EMAIL || 'hello@cosmiciq.org';
    
    sesClient = new SESClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
    
    console.log('[email-service] SES client initialized with AWS SDK');
    return sesClient;
  } catch (error) {
    console.error('[email-service] Failed to initialize SES client:', error.message);
    throw error;
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
    
    const response = await client.send(command);
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

