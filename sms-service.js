/**
 * SMS Service for MyKeys.zip Authentication
 * 
 * Sends 4-digit verification codes via Twilio SMS
 * Supports jobmatch.zip and other integrations
 */

const axios = require('axios');
const { kv } = require('@vercel/kv');

// Use shared storage utility
const { getStorage } = require('./kv-utils');

// Lazy initialization of Twilio credentials
let twilioCredentials = null;

async function getTwilioCredentials() {
  if (twilioCredentials) return twilioCredentials;
  
  try {
    const kv = getStorage();
    if (!kv) {
      throw new Error('Storage service not available');
    }
    
    const twilioCredsStr = await kv.get('secret:twilio-credentials');
    if (!twilioCredsStr) {
      throw new Error('Twilio credentials not found. Store them first.');
    }
    
    twilioCredentials = typeof twilioCredsStr === 'string' ? JSON.parse(twilioCredsStr) : twilioCredsStr;
    return twilioCredentials;
  } catch (error) {
    console.error('[sms-service] Failed to load Twilio credentials:', error.message);
    throw error;
  }
}

/**
 * Send 4-digit verification code via SMS
 * 
 * @param {string} phoneNumber - Recipient phone number (E.164 format)
 * @param {string} code - 4-digit verification code
 * @param {string} serviceName - Service name for branding (e.g., 'jobmatch', 'mykeys')
 * @returns {Promise<Object>} - Send result with messageId
 */
async function sendVerificationCode(phoneNumber, code, serviceName = 'mykeys') {
  try {
    const twilio = await getTwilioCredentials();
    
    // Validate required fields
    if (!twilio.account_sid || !twilio.auth_token) {
      throw new Error('Twilio credentials incomplete. Missing account_sid or auth_token.');
    }
    
    const fromNumber = twilio.phone_number || '+16269959974';
    const serviceDomain = serviceName === 'jobmatch' ? 'jobmatch.zip' : 'mykeys.zip';
    
    // Improved SMS message format
    const messageBody = `${serviceDomain.toUpperCase()}\n\nYour verification code is: ${code}\n\nValid for 10 minutes.\n\nIf you didn't request this code, please ignore this message.`;
    
    console.log(`[sms-service] Sending SMS via Twilio:`);
    console.log(`  From: ${fromNumber}`);
    console.log(`  To: ${phoneNumber}`);
    console.log(`  Service: ${serviceName}`);
    
    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${twilio.account_sid}/Messages.json`,
      new URLSearchParams({
        From: fromNumber,
        To: phoneNumber,
        Body: messageBody,
      }),
      {
        auth: {
          username: twilio.account_sid,
          password: twilio.auth_token,
        },
        timeout: 30000,
      }
    );
    
    if (response.status === 201) {
      console.log(`[sms-service] ✓ SMS sent successfully`);
      console.log(`  Message SID: ${response.data.sid}`);
      console.log(`  Status: ${response.data.status}`);
      
      return {
        success: true,
        messageId: response.data.sid,
        messageSid: response.data.sid,
        status: response.data.status,
        to: phoneNumber,
        from: fromNumber,
      };
    } else {
      throw new Error(`Unexpected response status: ${response.status}`);
    }
    
  } catch (error) {
    console.error('[sms-service] ✗ Failed to send SMS:');
    console.error(`  Error message: ${error.message}`);
    
    if (error.response) {
      const errorCode = error.response.data?.code;
      const errorMessage = error.response.data?.message || error.message;
      
      // Map Twilio error codes to user-friendly messages
      const errorMessages = {
        21211: 'Invalid phone number format. Please use E.164 format (e.g., +12132484250).',
        21212: 'Invalid phone number. Number is not a valid mobile number.',
        21408: 'Permission denied. Phone number not verified (trial account restriction).',
        21608: 'Unsubscribed recipient. Phone number has opted out.',
        21610: 'Unsubscribed recipient. Phone number is on the unsubscribe list.',
        21614: 'Invalid phone number. Number is not a valid mobile number.',
      };
      
      const userMessage = errorMessages[errorCode] || errorMessage;
      
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Code: ${errorCode || 'N/A'}`);
      console.error(`  Message: ${userMessage}`);
      
      return {
        success: false,
        error: userMessage,
        errorCode: errorCode,
        statusCode: error.response.status,
      };
    }
    
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Test Twilio connection
 */
async function testConnection() {
  try {
    const twilio = await getTwilioCredentials();
    if (!twilio.account_sid || !twilio.auth_token) {
      return { success: false, error: 'Twilio credentials incomplete' };
    }
    
    console.log('[sms-service] ✓ Twilio credentials loaded');
    console.log(`  Account SID: ${twilio.account_sid.substring(0, 10)}...`);
    console.log(`  Phone Number: ${twilio.phone_number || 'Not set'}`);
    
    return { success: true };
  } catch (error) {
    console.error('[sms-service] ✗ Twilio connection test failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendVerificationCode,
  testConnection,
};



