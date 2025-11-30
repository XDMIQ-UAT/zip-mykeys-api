#!/usr/bin/env node
/**
 * MyKeys CLI - Demo POC
 * Usage: 
 *   mykeys admin - Show admin information
 *   mykeys generate-token - Generate a new MCP token with MFA
 * 
 * Shows admin information based on token context (architect role)
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const crypto = require('crypto');
const {
  encryptWithPartialSupport,
  decryptWithPartialSupport,
  areKeysRelated,
  getKeyChainId,
} = require('./partial-decryption');

// Configuration
const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
const TOKEN_FILE = path.join(os.homedir(), '.mykeys', 'token');
const EMAIL_FILE = path.join(os.homedir(), '.mykeys', 'email'); // Store email for session retrieval
const SESSIONS_DIR = path.join(os.homedir(), '.mykeys', 'sessions');
const HELD_SESSIONS_DIR = path.join(os.homedir(), '.mykeys', 'sessions', 'held');
const HISTORY_DIR = path.join(os.homedir(), '.mykeys', 'sessions', 'history');
const DIFFS_DIR = path.join(os.homedir(), '.mykeys', 'sessions', 'diffs');
const FRAGMENTS_DIR = path.join(os.homedir(), '.mykeys', 'sessions', 'fragments');
const RELATED_TOKENS_FILE = path.join(os.homedir(), '.mykeys', 'related-tokens.json');

// Feature flag for partial decryption
const USE_PARTIAL_ENCRYPTION = process.env.MYKEYS_PARTIAL_DECRYPTION === 'true' || false;

// Encryption key derivation (uses token as base)
function deriveEncryptionKey(token) {
  return crypto.createHash('sha256').update(token + 'session-encryption-key').digest();
}

/**
 * Encrypt session data
 * Supports partial decryption when usePartialEncryption is true
 */
function encryptSessionData(data, token, usePartialEncryption = false) {
  // Use partial encryption if requested
  if (usePartialEncryption) {
    return encryptWithPartialSupport(data, token);
  }
  
  // Standard encryption (backward compatible)
  const key = deriveEncryptionKey(token);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    algorithm: 'aes-256-cbc'
  };
}

/**
 * Split encrypted data into fragments using Shamir's Secret Sharing concept
 * Each fragment is independently encrypted and can be stored separately
 */
function splitIntoFragments(encryptedData, seed, token) {
  const dataString = JSON.stringify(encryptedData);
  const fragmentSize = FRAGMENT_CONFIG.fragmentSize;
  const totalFragments = FRAGMENT_CONFIG.totalFragments;
  const minFragments = FRAGMENT_CONFIG.minFragments;
  
  // Split data into chunks
  const chunks = [];
  for (let i = 0; i < dataString.length; i += fragmentSize) {
    chunks.push(dataString.slice(i, i + fragmentSize));
  }
  
  // Create fragments with redundancy
  const fragments = [];
  const fragmentMetadata = {
    seed,
    totalFragments,
    minFragments,
    totalChunks: chunks.length,
    timestamp: new Date().toISOString(),
    hash: crypto.createHash('sha256').update(dataString).digest('hex'),
  };
  
  // Create multiple fragments, each containing overlapping data
  for (let fragIndex = 0; fragIndex < totalFragments; fragIndex++) {
    const fragmentData = {
      index: fragIndex,
      metadata: fragmentMetadata,
      chunks: [],
    };
    
    // Distribute chunks across fragments with overlap
    chunks.forEach((chunk, chunkIndex) => {
      // Each fragment gets chunks based on its index (with overlap for redundancy)
      const shouldInclude = (chunkIndex + fragIndex) % Math.ceil(totalFragments / minFragments) === 0 ||
                           fragIndex < minFragments; // First N fragments always included
      
      if (shouldInclude || fragIndex === 0) {
        fragmentData.chunks.push({
          index: chunkIndex,
          data: chunk,
        });
      }
    });
    
    // Encrypt each fragment independently
    const fragmentKey = deriveEncryptionKey(token + `-fragment-${fragIndex}`);
    const fragmentIv = crypto.randomBytes(16);
    const fragmentCipher = crypto.createCipheriv('aes-256-cbc', fragmentKey, fragmentIv);
    
    let fragmentEncrypted = fragmentCipher.update(JSON.stringify(fragmentData), 'utf8', 'hex');
    fragmentEncrypted += fragmentCipher.final('hex');
    
    fragments.push({
      index: fragIndex,
      encrypted: fragmentEncrypted,
      iv: fragmentIv.toString('hex'),
      algorithm: 'aes-256-cbc',
      metadata: fragmentMetadata, // Unencrypted metadata for identification
    });
  }
  
  return fragments;
}

/**
 * Reconstruct session from fragments
 * More fragments = more complete/vivid recall
 */
function reconstructFromFragments(fragments, token) {
  if (fragments.length < FRAGMENT_CONFIG.minFragments) {
    throw new Error(`Need at least ${FRAGMENT_CONFIG.minFragments} fragments, got ${fragments.length}`);
  }
  
  // Sort fragments by index
  fragments.sort((a, b) => a.index - b.index);
  
  // Decrypt fragments
  const decryptedFragments = [];
  for (const fragment of fragments) {
    try {
      const fragmentKey = deriveEncryptionKey(token + `-fragment-${fragment.index}`);
      const fragmentIv = Buffer.from(fragment.iv, 'hex');
      const fragmentDecipher = crypto.createDecipheriv('aes-256-cbc', fragmentKey, fragmentIv);
      
      let decrypted = fragmentDecipher.update(fragment.encrypted, 'hex', 'utf8');
      decrypted += fragmentDecipher.final('utf8');
      
      decryptedFragments.push(JSON.parse(decrypted));
    } catch (error) {
      console.warn(colorize(`Warning: Failed to decrypt fragment ${fragment.index}`, 'yellow'));
    }
  }
  
  if (decryptedFragments.length < FRAGMENT_CONFIG.minFragments) {
    throw new Error(`Only decrypted ${decryptedFragments.length} fragments, need ${FRAGMENT_CONFIG.minFragments}`);
  }
  
  // Reconstruct chunks from fragments
  const chunkMap = new Map();
  const metadata = decryptedFragments[0].metadata;
  
  // Collect chunks from all fragments (more fragments = more complete)
  decryptedFragments.forEach(fragment => {
    fragment.chunks.forEach(chunk => {
      if (!chunkMap.has(chunk.index) || chunkMap.get(chunk.index).length < chunk.data.length) {
        chunkMap.set(chunk.index, chunk.data);
      }
    });
  });
  
  // Verify we have enough chunks
  const totalChunks = metadata.totalChunks;
  const recoveredChunks = chunkMap.size;
  const completeness = (recoveredChunks / totalChunks) * 100;
  
  if (recoveredChunks < totalChunks) {
    console.warn(colorize(`⚠️  Incomplete reconstruction: ${recoveredChunks}/${totalChunks} chunks (${completeness.toFixed(1)}%)`, 'yellow'));
    console.warn(colorize(`   More fragments = more vivid recall. Try accessing more cloud storage providers.`, 'dim'));
  } else {
    console.log(colorize(`✓ Complete reconstruction: ${recoveredChunks}/${totalChunks} chunks (100%)`, 'green'));
  }
  
  // Reconstruct data string
  const chunks = [];
  for (let i = 0; i < totalChunks; i++) {
    const chunk = chunkMap.get(i);
    if (!chunk) {
      throw new Error(`Missing chunk ${i}, need more fragments for complete recall`);
    }
    chunks.push(chunk);
  }
  
  const reconstructedData = chunks.join('');
  
  // Verify hash
  const reconstructedHash = crypto.createHash('sha256').update(reconstructedData).digest('hex');
  if (reconstructedHash !== metadata.hash) {
    throw new Error('Hash mismatch - data corruption detected');
  }
  
  return {
    data: JSON.parse(reconstructedData),
    completeness,
    fragmentsUsed: decryptedFragments.length,
    totalFragments: metadata.totalFragments,
  };
}

/**
 * Decrypt session data
 * Supports partial decryption with related keys
 */
function decryptSessionData(encryptedData, token, relatedTokens = []) {
  // Check if this is partial encryption format
  if (encryptedData.partial && (encryptedData.partial.expired || encryptedData.partial.living)) {
    const result = decryptWithPartialSupport(encryptedData, token, relatedTokens);
    
    if (result.success) {
      // Log partial decryption status
      if (result.completeness < 100) {
        const portions = [];
        if (result.decryptedPortions.expired) portions.push('expired/deceased');
        if (result.decryptedPortions.living) portions.push('living/active');
        
        console.warn(colorize(
          `⚠️  Partial decryption: ${result.completeness}% complete (${portions.join(', ')})`,
          'yellow'
        ));
        
        if (!result.decryptedPortions.living) {
          console.warn(colorize(
            '   Living/active data requires exact key',
            'dim'
          ));
        }
      }
      
      return result.data;
    } else {
      // If partial decryption failed, try standard decryption as fallback
      console.warn(colorize(
        'Partial decryption failed, trying standard decryption...',
        'yellow'
      ));
    }
  }
  
  // Standard decryption (backward compatible)
  try {
    const key = deriveEncryptionKey(token);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    // If standard decryption fails and we have related tokens, try them
    if (relatedTokens.length > 0) {
      for (const relatedToken of relatedTokens) {
        if (areKeysRelated(token, relatedToken)) {
          try {
            const key = deriveEncryptionKey(relatedToken);
            const iv = Buffer.from(encryptedData.iv, 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            console.warn(colorize(
              `✓ Decrypted with related key (partial access)`,
              'yellow'
            ));
            
            return JSON.parse(decrypted);
          } catch (err) {
            // Continue to next token
            continue;
          }
        }
      }
    }
    
    throw new Error('Failed to decrypt session data: ' + error.message);
  }
}

/**
 * Calculate diff between two session states
 */
function calculateDiff(oldState, newState) {
  const diff = {
    timestamp: new Date().toISOString(),
    changes: [],
  };
  
  // Compare top-level fields
  const allKeys = new Set([...Object.keys(oldState || {}), ...Object.keys(newState || {})]);
  
  for (const key of allKeys) {
    const oldValue = oldState?.[key];
    const newValue = newState?.[key];
    
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      diff.changes.push({
        field: key,
        old: oldValue,
        new: newValue,
        type: oldValue === undefined ? 'added' : newValue === undefined ? 'removed' : 'modified'
      });
    }
  }
  
  return diff;
}

/**
 * Store encrypted diff
 */
function storeEncryptedDiff(seed, diff, token) {
  ensureSessionsDir();
  const diffPath = path.join(DIFFS_DIR, `${seed}-${Date.now()}.json`);
  const encryptedDiff = encryptSessionData(diff, token, USE_PARTIAL_ENCRYPTION);
  fs.writeFileSync(diffPath, JSON.stringify(encryptedDiff, null, 2), 'utf8');
  return diffPath;
}

/**
 * Load and decrypt diff history
 */
function loadDiffHistory(seed, token) {
  ensureSessionsDir();
  const diffs = [];
  
  if (!fs.existsSync(DIFFS_DIR)) {
    return diffs;
  }
  
  const files = fs.readdirSync(DIFFS_DIR)
    .filter(f => f.startsWith(seed) && f.endsWith('.json'))
    .sort();
  
  for (const file of files) {
    try {
      const fileContent = fs.readFileSync(path.join(DIFFS_DIR, file), 'utf8');
      const encryptedDiff = JSON.parse(fileContent);
      
      // Check if it's encrypted (has encrypted, iv fields) or plain JSON
      if (encryptedDiff.encrypted && encryptedDiff.iv) {
        if (!token) {
          console.warn(colorize(`Warning: Diff ${file} is encrypted but no token available`, 'yellow'));
          continue;
        }
        try {
          const relatedTokens = loadRelatedTokens();
          const diff = decryptSessionData(encryptedDiff, token, relatedTokens);
          diffs.push(diff);
        } catch (decryptError) {
          // Token mismatch - diff encrypted with different token
          console.warn(colorize(`Warning: Failed to decrypt diff ${file} (token mismatch or corrupted)`, 'yellow'));
        }
      } else {
        // Legacy unencrypted diff
        diffs.push(encryptedDiff);
      }
    } catch (error) {
      console.warn(colorize(`Warning: Failed to load diff ${file}: ${error.message}`, 'yellow'));
    }
  }
  
  return diffs;
}

/**
 * Store session history snapshot
 */
function storeHistorySnapshot(seed, sessionData, token) {
  ensureSessionsDir();
  const historyPath = path.join(HISTORY_DIR, `${seed}-${Date.now()}.json`);
  const encryptedSnapshot = encryptSessionData(sessionData, token, USE_PARTIAL_ENCRYPTION);
  fs.writeFileSync(historyPath, JSON.stringify(encryptedSnapshot, null, 2), 'utf8');
  return historyPath;
}

/**
 * Load history snapshots
 */
function loadHistorySnapshots(seed, token) {
  ensureSessionsDir();
  const snapshots = [];
  
  if (!fs.existsSync(HISTORY_DIR)) {
    return snapshots;
  }
  
  const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.startsWith(seed) && f.endsWith('.json'))
    .sort();
  
  for (const file of files) {
    try {
      const fileContent = fs.readFileSync(path.join(HISTORY_DIR, file), 'utf8');
      const encryptedSnapshot = JSON.parse(fileContent);
      
      // Check if it's encrypted (has encrypted, iv fields) or plain JSON
      if (encryptedSnapshot.encrypted && encryptedSnapshot.iv) {
        if (!token) {
          console.warn(colorize(`Warning: Snapshot ${file} is encrypted but no token available`, 'yellow'));
          continue;
        }
        try {
          const relatedTokens = loadRelatedTokens();
          const snapshot = decryptSessionData(encryptedSnapshot, token, relatedTokens);
          snapshots.push({
            ...snapshot,
            snapshotFile: file,
            snapshotTime: new Date(parseInt(file.split('-')[1].split('.')[0])).toISOString()
          });
        } catch (decryptError) {
          // Token mismatch - snapshot encrypted with different token
          console.warn(colorize(`Warning: Failed to decrypt snapshot ${file} (token mismatch or corrupted)`, 'yellow'));
        }
      } else {
        // Legacy unencrypted snapshot
        snapshots.push({
          ...encryptedSnapshot,
          snapshotFile: file,
          snapshotTime: new Date(parseInt(file.split('-')[1].split('.')[0])).toISOString()
        });
      }
    } catch (error) {
      console.warn(colorize(`Warning: Failed to load snapshot ${file}: ${error.message}`, 'yellow'));
    }
  }
  
  return snapshots;
}

/**
 * Replay session history
 */
function replaySessionHistory(seed, token) {
  const snapshots = loadHistorySnapshots(seed, token);
  const diffs = loadDiffHistory(seed, token);
  
  console.log('');
  console.log(colorize('╔════════════════════════════════════════╗', 'cyan'));
  console.log(colorize('║', 'cyan') + colorize('      Session History Replay', 'bright') + colorize('          ║', 'cyan'));
  console.log(colorize('╚════════════════════════════════════════╝', 'cyan'));
  console.log('');
  console.log(colorize(`Seed: ${seed}`, 'bright'));
  console.log(colorize(`Snapshots: ${snapshots.length}`, 'dim'));
  console.log(colorize(`Diffs: ${diffs.length}`, 'dim'));
  console.log('');
  
  if (snapshots.length === 0 && diffs.length === 0) {
    console.log(colorize('No history found for this session.', 'yellow'));
    return;
  }
  
  // Show snapshots
  if (snapshots.length > 0) {
    console.log(colorize('History Snapshots:', 'bright'));
    snapshots.forEach((snapshot, idx) => {
      console.log(`  ${idx + 1}. ${new Date(snapshot.snapshotTime).toLocaleString()}`);
      if (snapshot.context) {
        console.log(`     Context: ${JSON.stringify(snapshot.context).substring(0, 50)}...`);
      }
      if (snapshot.memory && snapshot.memory.length > 0) {
        console.log(`     Memory entries: ${snapshot.memory.length}`);
      }
    });
    console.log('');
  }
  
  // Show diffs
  if (diffs.length > 0) {
    console.log(colorize('Change History:', 'bright'));
    diffs.forEach((diff, idx) => {
      console.log(`  ${idx + 1}. ${new Date(diff.timestamp).toLocaleString()}`);
      diff.changes.forEach(change => {
        const changeType = change.type === 'added' ? '+' : change.type === 'removed' ? '-' : '~';
        const changeColor = change.type === 'added' ? 'green' : change.type === 'removed' ? 'red' : 'yellow';
        console.log(`     ${colorize(changeType, changeColor)} ${change.field}`);
      });
    });
    console.log('');
  }
}

/**
 * Compare session states
 */
function compareSessionStates(currentState, historicalState) {
  const comparison = {
    timestamp: new Date().toISOString(),
    differences: [],
  };
  
  const allKeys = new Set([...Object.keys(currentState || {}), ...Object.keys(historicalState || {})]);
  
  for (const key of allKeys) {
    const current = currentState?.[key];
    const historical = historicalState?.[key];
    
    if (JSON.stringify(current) !== JSON.stringify(historical)) {
      comparison.differences.push({
        field: key,
        current,
        historical,
        type: current === undefined ? 'removed' : historical === undefined ? 'added' : 'changed'
      });
    }
  }
  
  return comparison;
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Save email to file
 */
function saveEmail(email) {
  try {
    const emailDir = path.dirname(EMAIL_FILE);
    if (!fs.existsSync(emailDir)) {
      fs.mkdirSync(emailDir, { recursive: true });
    }
    fs.writeFileSync(EMAIL_FILE, email.trim().toLowerCase(), 'utf8');
  } catch (error) {
    // Ignore file write errors
  }
}

/**
 * Load email from file
 */
function getEmail() {
  try {
    if (fs.existsSync(EMAIL_FILE)) {
      return fs.readFileSync(EMAIL_FILE, 'utf8').trim();
    }
  } catch (error) {
    // Ignore file read errors
  }
  return null;
}

/**
 * Load token from file or environment (synchronous)
 */
function getTokenSync() {
  // Try environment variable first
  if (process.env.MCP_TOKEN || process.env.MYKEYS_TOKEN) {
    return process.env.MCP_TOKEN || process.env.MYKEYS_TOKEN;
  }
  
  // Try token file
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
      if (token) return token;
    }
  } catch (error) {
    // Ignore file read errors
  }
  
  return null;
}

/**
 * Validate token by making a test request
 */
async function validateToken(token) {
  try {
    const response = await makeRequest(`${MYKEYS_URL}/api/admin/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      timeout: 5000,
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Load token from file or environment, or auto-authenticate via email
 */
async function getToken() {
  const token = getTokenSync();
  
  // If token exists, validate it
  if (token) {
    const isValid = await validateToken(token);
    if (isValid) {
      return token;
    } else {
      console.log(colorize('⚠️  Existing token is invalid or expired. Re-authenticating...', 'yellow'));
      console.log('');
      // Remove invalid token file
      try {
        if (fs.existsSync(TOKEN_FILE)) {
          fs.unlinkSync(TOKEN_FILE);
        }
      } catch (error) {
        // Ignore errors
      }
    }
  }
  
  // No token found or token invalid - auto-authenticate via email
  return await authenticateViaEmail();
}

/**
 * Authenticate via email and generate token automatically
 */
async function authenticateViaEmail() {
  console.log('');
  console.log(colorize('╔════════════════════════════════════════╗', 'cyan'));
  console.log(colorize('║', 'cyan') + colorize('     MyKeys Authentication', 'bright') + colorize('           ║', 'cyan'));
  console.log(colorize('╚════════════════════════════════════════╝', 'cyan'));
  console.log('');
  console.log(colorize('No token found. Please authenticate via email:', 'yellow'));
  console.log('');
  
  // Try to use saved email, or prompt for new one
  let email = getEmail();
  if (email) {
    console.log(colorize(`Using saved email: ${email}`, 'dim'));
    const useSaved = await prompt(colorize('Use this email? (Y/n): ', 'yellow'));
    if (useSaved.toLowerCase() !== 'n' && useSaved.toLowerCase() !== 'no') {
      // Use saved email
    } else {
      email = null;
    }
  }
  
  if (!email) {
    email = await prompt(colorize('Enter your email address: ', 'yellow'));
    if (!email) {
      console.error(colorize('Error:', 'red'), 'Email is required');
      process.exit(1);
    }
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error(colorize('Error:', 'red'), 'Invalid email address format');
      process.exit(1);
    }
    
    // Save email for future use
    saveEmail(email);
  }
  
  email = email.trim().toLowerCase();
  
  try {
    // Request 4-digit code
    console.log('');
    console.log(colorize('Sending 4-digit verification code to your email...', 'dim'));
    const mfaResult = await requestMFACode(null, email);
    console.log(colorize(`✓ 4-digit code sent to ${email}`, 'green'));
    console.log('');
    
    // Prompt for code
    const code = await prompt(colorize('Enter 4-digit verification code: ', 'yellow'));
    if (!code || code.replace(/\D/g, '').length !== 4) {
      console.error(colorize('Error:', 'red'), 'Please enter a valid 4-digit verification code');
      process.exit(1);
    }
    
    // Normalize code (remove non-digits, pad to 4)
    const normalizedCode = code.replace(/\D/g, '').padStart(4, '0').slice(0, 4);
    
    // Generate client ID from hostname
    const hostname = os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '');
    const clientId = `cli-${hostname}`;
    
    // Verify code and generate token
    console.log('');
    console.log(colorize('Verifying code and generating token...', 'dim'));
    const tokenResult = await verifyMFACodeAndGenerateToken(
      null,
      email,
      normalizedCode,
      clientId,
      'cli',
      90 // 90 days expiration
    );
    
    const token = tokenResult.token;
    
    // Save token
    const tokenDir = path.dirname(TOKEN_FILE);
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }
    fs.writeFileSync(TOKEN_FILE, token, 'utf8');
    
    console.log(colorize('✓ Authenticated successfully', 'green'));
    console.log(colorize(`✓ Token saved to: ${TOKEN_FILE}`, 'green'));
    console.log('');
    
    return token;
  } catch (error) {
    console.error('');
    console.error(colorize('Authentication failed:', 'red'), error.message);
    
    // Show more details if available
    if (error.response && error.response.data) {
      console.error(colorize('Error details:', 'yellow'), error.response.data.details || error.response.data.error || '');
    }
    
    console.log('');
    console.log('Troubleshooting:');
    console.log('  1. Check that email address is correct');
    console.log('  2. Check your email for the 4-digit code');
    console.log('  3. Ensure code is entered within 10 minutes');
    console.log('  4. Verify email service is configured');
    console.log(`  5. API URL: ${MYKEYS_URL}`);
    console.log(`  6. Check Vercel logs for detailed error: https://vercel.com/xdmiq/zip-myl-mykeys-api/logs`);
    process.exit(1);
  }
}

/**
 * Make HTTP/HTTPS request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    let urlObj = new URL(url);
    
    // Add Vercel deployment protection bypass if token is available
    const vercelBypassToken = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (vercelBypassToken) {
      urlObj.searchParams.set('x-vercel-set-bypass-cookie', 'true');
      urlObj.searchParams.set('x-vercel-protection-bypass', vercelBypassToken);
    }
    
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    const timeout = options.timeout || 30000; // 30 second default timeout
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      timeout: timeout,
    };
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

/**
 * Get admin info from API
 */
async function getAdminInfo(token) {
  try {
    const response = await makeRequest(`${MYKEYS_URL}/api/admin/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      timeout: 15000, // 15 second timeout for admin info
    });
    
    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error(response.data.error || `HTTP ${response.status}`);
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Display admin info in a nice format
 */
function displayAdminInfo(info) {
  console.log('');
  console.log(colorize('╔════════════════════════════════════════╗', 'cyan'));
  console.log(colorize('║', 'cyan') + colorize('        MyKeys Admin Info', 'bright') + colorize('           ║', 'cyan'));
  console.log(colorize('╚════════════════════════════════════════╝', 'cyan'));
  console.log('');
  
  if (info.role) {
    console.log(colorize('Role:', 'bright') + ` ${colorize(info.role, 'green')}`);
  }
  
  if (info.context) {
    console.log(colorize('Context:', 'bright') + ` ${colorize(info.context, 'cyan')}`);
  }
  
  if (info.tokenInfo) {
    console.log('');
    console.log(colorize('Token Information:', 'bright'));
    if (info.tokenInfo.clientId) {
      console.log(`  ${colorize('Client ID:', 'dim')} ${info.tokenInfo.clientId}`);
    }
    if (info.tokenInfo.clientType) {
      console.log(`  ${colorize('Client Type:', 'dim')} ${info.tokenInfo.clientType}`);
    }
    if (info.tokenInfo.expiresAt) {
      const expiresAt = new Date(info.tokenInfo.expiresAt);
      const now = new Date();
      const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
      const expiresColor = daysLeft > 30 ? 'green' : daysLeft > 7 ? 'yellow' : 'red';
      console.log(`  ${colorize('Expires:', 'dim')} ${colorize(expiresAt.toLocaleDateString(), expiresColor)} (${daysLeft} days)`);
    }
  }
  
  if (info.permissions) {
    console.log('');
    console.log(colorize('Permissions:', 'bright'));
    info.permissions.forEach(perm => {
      console.log(`  ${colorize('✓', 'green')} ${perm}`);
    });
  }
  
  if (info.stats) {
    console.log('');
    console.log(colorize('Statistics:', 'bright'));
    if (info.stats.secretsCount !== undefined) {
      console.log(`  ${colorize('Secrets:', 'dim')} ${info.stats.secretsCount}`);
    }
    if (info.stats.ecosystemsCount !== undefined) {
      console.log(`  ${colorize('Ecosystems:', 'dim')} ${info.stats.ecosystemsCount}`);
    }
  }
  
  if (info.capabilities) {
    console.log('');
    console.log(colorize('Capabilities:', 'bright'));
    info.capabilities.forEach(cap => {
      console.log(`  ${colorize('•', 'cyan')} ${cap}`);
    });
  }
  
  console.log('');
  console.log(colorize('─'.repeat(42), 'dim'));
  console.log('');
}

/**
 * Ensure sessions directory exists
 */
function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
  if (!fs.existsSync(HELD_SESSIONS_DIR)) {
    fs.mkdirSync(HELD_SESSIONS_DIR, { recursive: true });
  }
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
  if (!fs.existsSync(DIFFS_DIR)) {
    fs.mkdirSync(DIFFS_DIR, { recursive: true });
  }
  if (!fs.existsSync(FRAGMENTS_DIR)) {
    fs.mkdirSync(FRAGMENTS_DIR, { recursive: true });
  }
}

/**
 * Get session file path for a seed
 */
function getSessionPath(seed, held = false) {
  const dir = held ? HELD_SESSIONS_DIR : SESSIONS_DIR;
  // Sanitize seed to safe filename
  const safeSeed = seed.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(dir, `${safeSeed}.json`);
}

/**
 * Load related tokens from file
 */
function loadRelatedTokens() {
  try {
    if (fs.existsSync(RELATED_TOKENS_FILE)) {
      const data = fs.readFileSync(RELATED_TOKENS_FILE, 'utf8');
      const tokens = JSON.parse(data);
      return Array.isArray(tokens) ? tokens : [];
    }
  } catch (error) {
    // Ignore errors loading related tokens
  }
  return [];
}

/**
 * Load session data (with decryption and partial decryption support)
 */
function loadSession(seed, token = null) {
  ensureSessionsDir();
  
  // Try to get token if not provided
  if (!token) {
    token = getTokenSync();
  }
  
  // Load related tokens for partial decryption
  const relatedTokens = loadRelatedTokens();
  
  // Check active sessions first
  const activePath = getSessionPath(seed, false);
  if (fs.existsSync(activePath)) {
    try {
      const data = fs.readFileSync(activePath, 'utf8');
      const parsed = JSON.parse(data);
      
      // Check if encrypted
      if (parsed.encrypted && parsed.iv && token) {
        return decryptSessionData(parsed, token, relatedTokens);
      } else if (!parsed.encrypted) {
        // Legacy unencrypted session
        return parsed;
      } else {
        throw new Error('Session is encrypted but no token available');
      }
    } catch (error) {
      return null;
    }
  }
  
  // Check held sessions
  const heldPath = getSessionPath(seed, true);
  if (fs.existsSync(heldPath)) {
    try {
      const data = fs.readFileSync(heldPath, 'utf8');
      const parsed = JSON.parse(data);
      
      // Check if encrypted
      if (parsed.encrypted && parsed.iv && token) {
        return decryptSessionData(parsed, token, relatedTokens);
      } else if (!parsed.encrypted) {
        // Legacy unencrypted session
        return parsed;
      } else {
        throw new Error('Session is encrypted but no token available');
      }
    } catch (error) {
      return null;
    }
  }
  
  return null;
}

/**
 * Get last session seed by email
 */
function getLastSessionByEmail(email) {
  ensureSessionsDir();
  email = email.trim().toLowerCase();
  
  // Scan all session files to find the most recent one with matching email
  let lastSession = null;
  let lastModified = 0;
  
  try {
    const sessionFiles = fs.readdirSync(SESSIONS_DIR);
    for (const file of sessionFiles) {
      if (file.endsWith('.json')) {
        const sessionPath = path.join(SESSIONS_DIR, file);
        try {
          const data = fs.readFileSync(sessionPath, 'utf8');
          const session = JSON.parse(data);
          
          // Check if session has email metadata
          if (session.email && session.email.toLowerCase() === email) {
            const stats = fs.statSync(sessionPath);
            if (stats.mtimeMs > lastModified) {
              lastModified = stats.mtimeMs;
              lastSession = {
                seed: file.replace('.json', ''),
                session: session,
                modified: stats.mtime,
              };
            }
          }
        } catch (error) {
          // Skip invalid session files
          continue;
        }
      }
    }
  } catch (error) {
    // Directory might not exist or be empty
  }
  
  return lastSession;
}

/**
 * Save session data (with encryption and diff tracking)
 */
function saveSession(seed, sessionData, token = null) {
  ensureSessionsDir();
  
  // Try to get token if not provided
  if (!token) {
    token = getTokenSync();
  }
  
  // Store email in session metadata if available
  const email = getEmail();
  if (email && !sessionData.email) {
    sessionData.email = email;
  }
  
  const sessionPath = getSessionPath(seed, false);
  
  // Load old session for diff calculation
  let oldSession = null;
  if (fs.existsSync(sessionPath)) {
    try {
      const oldData = fs.readFileSync(sessionPath, 'utf8');
      const oldParsed = JSON.parse(oldData);
      if (oldParsed.encrypted && oldParsed.iv && token) {
        oldSession = decryptSessionData(oldParsed, token);
      } else if (!oldParsed.encrypted) {
        oldSession = oldParsed;
      }
    } catch (error) {
      // Ignore errors loading old session
    }
  }
  
  // Update timestamps
  if (!sessionData.createdAt && oldSession) {
    sessionData.createdAt = oldSession.createdAt;
  } else if (!sessionData.createdAt) {
    sessionData.createdAt = new Date().toISOString();
  }
  sessionData.lastAccessed = new Date().toISOString();
  
  // Calculate and store diff if we have old session and token
  if (oldSession && token) {
    const diff = calculateDiff(oldSession, sessionData);
    if (diff.changes.length > 0) {
      storeEncryptedDiff(seed, diff, token);
      // Store history snapshot periodically (every 10 changes or every hour)
      const snapshots = loadHistorySnapshots(seed, token);
      const lastSnapshot = snapshots[snapshots.length - 1];
      const shouldSnapshot = !lastSnapshot || 
        (Date.now() - new Date(lastSnapshot.snapshotTime).getTime() > 60 * 60 * 1000) ||
        (loadDiffHistory(seed, token).length % 10 === 0);
      
      if (shouldSnapshot) {
        storeHistorySnapshot(seed, sessionData, token);
      }
    }
  }
  
    // Encrypt and save
    if (token) {
      const encrypted = encryptSessionData(sessionData, token, USE_PARTIAL_ENCRYPTION);
      fs.writeFileSync(sessionPath, JSON.stringify(encrypted, null, 2), 'utf8');
      
      // Split into fragments and distribute across multiple cloud providers
      // More fragments across more providers = more vivid recall
      syncSessionToServer(seed, encrypted, token).then(results => {
        if (results && results.successful.length > 0) {
          console.log(colorize(`✓ Stored ${results.successful.length} fragments across ${new Set(results.successful.map(s => s.provider)).size} cloud providers`, 'dim'));
        }
      }).catch(err => {
        // Silently fail - fragment storage is optional
      });
    } else {
      // Fallback to unencrypted if no token
      console.warn(colorize('Warning: Saving session without encryption (no token)', 'yellow'));
      fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2), 'utf8');
    }
}

/**
 * Delete session
 */
function deleteSession(seed) {
  ensureSessionsDir();
  const activePath = getSessionPath(seed, false);
  const heldPath = getSessionPath(seed, true);
  
  if (fs.existsSync(activePath)) {
    fs.unlinkSync(activePath);
  }
  if (fs.existsSync(heldPath)) {
    fs.unlinkSync(heldPath);
  }
}

/**
 * Hold session (move to held directory)
 */
function holdSession(seed, holdDurationMinutes = 60) {
  ensureSessionsDir();
  const activePath = getSessionPath(seed, false);
  const heldPath = getSessionPath(seed, true);
  
  if (fs.existsSync(activePath)) {
    const sessionData = JSON.parse(fs.readFileSync(activePath, 'utf8'));
    sessionData.heldUntil = new Date(Date.now() + holdDurationMinutes * 60 * 1000).toISOString();
    sessionData.heldAt = new Date().toISOString();
    fs.writeFileSync(heldPath, JSON.stringify(sessionData, null, 2), 'utf8');
    fs.unlinkSync(activePath);
    return sessionData;
  }
  
  return null;
}

/**
 * Restore held session (move back to active)
 */
function restoreHeldSession(seed) {
  ensureSessionsDir();
  const heldPath = getSessionPath(seed, true);
  const activePath = getSessionPath(seed, false);
  
  if (fs.existsSync(heldPath)) {
    const sessionData = JSON.parse(fs.readFileSync(heldPath, 'utf8'));
    delete sessionData.heldUntil;
    delete sessionData.heldAt;
    sessionData.restoredAt = new Date().toISOString();
    fs.writeFileSync(activePath, JSON.stringify(sessionData, null, 2), 'utf8');
    fs.unlinkSync(heldPath);
    return sessionData;
  }
  
  return null;
}

/**
 * Display session information
 */
function displaySessionInfo(session) {
  console.log('');
  console.log(colorize('╔════════════════════════════════════════╗', 'cyan'));
  console.log(colorize('║', 'cyan') + colorize('        Session Information', 'bright') + colorize('           ║', 'cyan'));
  console.log(colorize('╚════════════════════════════════════════╝', 'cyan'));
  console.log('');
  
  if (session.seed) {
    console.log(colorize('Seed:', 'bright') + ` ${colorize(session.seed, 'cyan')}`);
  }
  
  if (session.createdAt) {
    const created = new Date(session.createdAt);
    console.log(colorize('Created:', 'bright') + ` ${created.toLocaleString()}`);
  }
  
  if (session.lastAccessed) {
    const lastAccess = new Date(session.lastAccessed);
    const timeAgo = Math.floor((Date.now() - lastAccess.getTime()) / 1000 / 60);
    console.log(colorize('Last Accessed:', 'bright') + ` ${lastAccess.toLocaleString()} (${timeAgo} minutes ago)`);
  }
  
  if (session.heldUntil) {
    const heldUntil = new Date(session.heldUntil);
    const now = new Date();
    if (heldUntil > now) {
      const minutesLeft = Math.ceil((heldUntil - now) / 1000 / 60);
      console.log(colorize('Held Until:', 'bright') + ` ${colorize(heldUntil.toLocaleString(), 'yellow')} (${minutesLeft} minutes remaining)`);
    } else {
      console.log(colorize('Held Until:', 'bright') + ` ${colorize('EXPIRED', 'red')}`);
    }
  }
  
  if (session.context) {
    console.log('');
    console.log(colorize('Context:', 'bright'));
    if (typeof session.context === 'string') {
      console.log(`  ${colorize(session.context, 'dim')}`);
    } else if (typeof session.context === 'object') {
      Object.entries(session.context).forEach(([key, value]) => {
        console.log(`  ${colorize(key + ':', 'dim')} ${value}`);
      });
    }
  }
  
  if (session.memory && session.memory.length > 0) {
    console.log('');
    console.log(colorize('Memory Entries:', 'bright') + ` ${session.memory.length}`);
    session.memory.slice(-3).forEach((entry, idx) => {
      const preview = typeof entry === 'string' ? entry.substring(0, 50) : JSON.stringify(entry).substring(0, 50);
      console.log(`  ${colorize('•', 'cyan')} ${preview}${preview.length >= 50 ? '...' : ''}`);
    });
    if (session.memory.length > 3) {
      console.log(`  ${colorize(`... and ${session.memory.length - 3} more`, 'dim')}`);
    }
  }
  
  console.log('');
}

/**
 * Sync session to server using fragments distributed across multiple cloud providers
 * More fragments across more providers = more vivid recall
 */
async function syncSessionToServer(seed, encryptedSession, token) {
  try {
    // Split into fragments and distribute across clouds
    const fragments = splitIntoFragments(encryptedSession, seed, token);
    const storageResults = await storeFragmentsAcrossClouds(seed, fragments, token);
    
    // Also store complete session for backward compatibility
    await makeRequest(`${MYKEYS_URL}/api/sessions/${encodeURIComponent(seed)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: {
        encrypted: encryptedSession.encrypted,
        iv: encryptedSession.iv,
        algorithm: encryptedSession.algorithm,
      },
      timeout: 10000,
    });
    
    return storageResults;
  } catch (error) {
    // Silently fail - fragment storage is optional
  }
}

/**
 * Load session from server - try fragments first for vivid recall
 */
async function loadSessionFromServer(seed, token) {
  try {
    // First, try to retrieve fragments from all cloud providers
    const fragmentResult = await retrieveFragmentsFromClouds(seed, token);
    
    if (fragmentResult.fragments.length >= FRAGMENT_CONFIG.minFragments) {
      console.log(colorize(`✓ Retrieved ${fragmentResult.fragments.length} fragments from ${fragmentResult.sources.length} sources`, 'green'));
      console.log(colorize(`  Sources: ${fragmentResult.sources.join(', ')}`, 'dim'));
      
      // Reconstruct from fragments
      const reconstruction = reconstructFromFragments(fragmentResult.fragments, token);
      
      if (reconstruction.completeness >= 100) {
        console.log(colorize(`✓ Complete vivid recall achieved!`, 'green'));
      } else {
        console.log(colorize(`⚠️  Partial recall: ${reconstruction.completeness.toFixed(1)}% complete`, 'yellow'));
        console.log(colorize(`   Access more cloud storage providers for more vivid recall`, 'dim'));
      }
      
      return reconstruction.data;
    } else if (fragmentResult.fragments.length > 0) {
      console.warn(colorize(`⚠️  Only ${fragmentResult.fragments.length} fragments retrieved, need ${FRAGMENT_CONFIG.minFragments}`, 'yellow'));
      console.warn(colorize(`   Access more cloud storage providers for complete recall`, 'dim'));
    }
    
    // Fallback to complete session retrieval
    const response = await makeRequest(`${MYKEYS_URL}/api/sessions/${encodeURIComponent(seed)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      timeout: 10000,
    });
    
    if (response.status === 200 && response.data.encrypted) {
      const relatedTokens = loadRelatedTokens();
      return decryptSessionData(response.data, token, relatedTokens);
    }
  } catch (error) {
    // Silently fail - server load is optional
  }
  return null;
}

/**
 * Prompt for seed and handle session management
 */
async function promptForSeed() {
  ensureSessionsDir();
  const token = await getToken();
  
  // Try to retrieve last session by email
  const email = getEmail();
  let lastSession = null;
  if (email) {
    lastSession = getLastSessionByEmail(email);
  }
  
  console.log('');
  console.log(colorize('╔════════════════════════════════════════╗', 'cyan'));
  console.log(colorize('║', 'cyan') + colorize('     MyKeys Session Manager', 'bright') + colorize('          ║', 'cyan'));
  console.log(colorize('╚════════════════════════════════════════╝', 'cyan'));
  console.log('');
  
  if (lastSession) {
    console.log(colorize(`Found last session for ${email}:`, 'green'));
    console.log(colorize(`  Seed: ${lastSession.seed}`, 'dim'));
    console.log(colorize(`  Modified: ${new Date(lastSession.modified).toLocaleString()}`, 'dim'));
    console.log('');
  }
  
  console.log(colorize('Enter a session seed (identifier for this context/memory session):', 'bright'));
  if (lastSession) {
    console.log(colorize(`  • Press Enter to use last session: ${lastSession.seed}`, 'dim'));
  }
  console.log(colorize('  • Use the same seed to resume a previous session', 'dim'));
  console.log(colorize('  • Use a new seed to start a fresh session', 'dim'));
  console.log(colorize('  • Sessions are encrypted and synced to server', 'dim'));
  console.log('');
  
  const seed = await prompt(colorize('Session seed: ', 'yellow'));
  
  if (!seed || seed.trim().length === 0) {
    if (lastSession) {
      console.log(colorize(`✓ Using last session: ${lastSession.seed}`, 'green'));
      return lastSession.seed;
    }
    console.log(colorize('⚠️  No seed provided. Using default session.', 'yellow'));
    return 'default';
  }
  
  const trimmedSeed = seed.trim();
  
  // Try to load from local first, then server
  let existingSession = loadSession(trimmedSeed, token);
  if (!existingSession && token) {
    existingSession = await loadSessionFromServer(trimmedSeed, token);
  }
  
  if (existingSession) {
    console.log('');
    console.log(colorize('✓ Found existing session!', 'green'));
    displaySessionInfo(existingSession);
    
    // Check if held session is expired
    if (existingSession.heldUntil) {
      const heldUntil = new Date(existingSession.heldUntil);
      if (heldUntil < new Date()) {
        console.log(colorize('⚠️  This session was held but has expired.', 'yellow'));
        console.log('');
        const action = await prompt(colorize('Restore expired session? (yes/no/delete): ', 'yellow'));
        if (action.toLowerCase() === 'yes' || action.toLowerCase() === 'y') {
          restoreHeldSession(trimmedSeed);
          console.log(colorize('✓ Session restored', 'green'));
          return trimmedSeed;
        } else if (action.toLowerCase() === 'delete' || action.toLowerCase() === 'd') {
          deleteSession(trimmedSeed);
          console.log(colorize('✓ Session deleted', 'green'));
          return trimmedSeed; // Continue with fresh session
        } else {
          console.log(colorize('Cancelled.', 'dim'));
          process.exit(0);
        }
      }
    }
    
    console.log(colorize('What would you like to do?', 'bright'));
    console.log('  1. Rejoin this session (continue with existing context)');
    console.log('  2. Delete this session (start fresh)');
    console.log('  3. Hold this session temporarily (save for later, expires in 60 min)');
    console.log('  4. Cancel');
    console.log('');
    
    const action = await prompt(colorize('Enter choice (1-4): ', 'yellow'));
    
    switch (action) {
      case '1':
        console.log(colorize('✓ Rejoining session...', 'green'));
        // Show option to replay history
        console.log('');
        const replayHistory = await prompt(colorize('Replay session history? (yes/no): ', 'dim'));
        if (replayHistory.toLowerCase() === 'yes' || replayHistory.toLowerCase() === 'y') {
          replaySessionHistory(trimmedSeed, token);
          console.log('');
        }
        // Update last accessed
        existingSession.lastAccessed = new Date().toISOString();
        saveSession(trimmedSeed, existingSession, token);
        return trimmedSeed;
        
      case '2':
        console.log(colorize('⚠️  Deleting session...', 'yellow'));
        deleteSession(trimmedSeed);
        console.log(colorize('✓ Session deleted. Starting fresh session.', 'green'));
        return trimmedSeed;
        
      case '3':
        const holdDuration = parseInt(await prompt(colorize('Hold duration in minutes (default: 60): ', 'dim')) || '60');
        holdSession(trimmedSeed, holdDuration);
        console.log(colorize(`✓ Session held for ${holdDuration} minutes`, 'green'));
        console.log(colorize('You can restore it later using the same seed.', 'dim'));
        process.exit(0);
        
      case '4':
        console.log(colorize('Cancelled.', 'dim'));
        process.exit(0);
        
      default:
        console.log(colorize('Invalid choice. Rejoining session by default.', 'yellow'));
        existingSession.lastAccessed = new Date().toISOString();
        saveSession(trimmedSeed, existingSession);
        return trimmedSeed;
    }
  } else {
    console.log('');
    console.log(colorize('✓ New session. Starting fresh.', 'green'));
    // Create new session
    const newSession = {
      seed: trimmedSeed,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      context: {},
      memory: [],
    };
    saveSession(trimmedSeed, newSession, token);
    return trimmedSeed;
  }
}

/**
 * Update session with new context/memory
 */
function updateSession(seed, updates, token = null) {
  if (!token) token = getTokenSync();
  const session = loadSession(seed, token);
  if (session) {
    Object.assign(session, updates);
    saveSession(seed, session, token);
  }
}

/**
 * Add memory entry to session
 */
function addSessionMemory(seed, memoryEntry, token = null) {
  if (!token) token = getTokenSync();
  const session = loadSession(seed, token);
  if (session) {
    if (!session.memory) {
      session.memory = [];
    }
    session.memory.push({
      timestamp: new Date().toISOString(),
      entry: memoryEntry,
    });
    // Keep only last 100 entries
    if (session.memory.length > 100) {
      session.memory = session.memory.slice(-100);
    }
    saveSession(seed, session, token);
  }
}

/**
 * Prompt for user input
 */
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt for password (hidden input)
 * Note: On Windows, password masking may not work perfectly, but input will still be captured
 */
function promptPassword(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    // Try to hide input, but fall back to regular prompt if not supported
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdout.write(question);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      let password = '';
      const onData = (char) => {
        char = char.toString();
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004': // Ctrl+D
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener('data', onData);
            rl.close();
            console.log(''); // New line after password
            resolve(password);
            break;
          case '\u0003': // Ctrl+C
            process.exit();
            break;
          case '\u007f': // Backspace
          case '\b': // Backspace (Windows)
            if (password.length > 0) {
              password = password.slice(0, -1);
              process.stdout.write('\b \b');
            }
            break;
          default:
            if (char.charCodeAt(0) >= 32) { // Only printable characters
              password += char;
              process.stdout.write('*');
            }
            break;
        }
      };
      
      process.stdin.on('data', onData);
    } else {
      // Fallback to regular prompt
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}


/**
 * Request MFA code via SMS or Email (simplified - no architect code)
 */
async function requestMFACode(phoneNumber, email) {
  try {
    console.log(`[DEBUG] Requesting MFA code from: ${MYKEYS_URL}/api/auth/request-mfa-code`);
    console.log(`[DEBUG] Email: ${email || 'N/A'}, Phone: ${phoneNumber || 'N/A'}`);
    
    const response = await makeRequest(`${MYKEYS_URL}/api/auth/request-mfa-code`, {
      method: 'POST',
      body: { phoneNumber, email },
      timeout: 30000,
    });
    
    console.log(`[DEBUG] Response status: ${response.status}`);
    console.log(`[DEBUG] Response data:`, JSON.stringify(response.data, null, 2));
    
    // Handle standardized API response format: { status: 'success', ... }
    if (response.status === 200 && (response.data.success || response.data.status === 'success')) {
      return response.data;
    } else {
      const errorMsg = response.data.error || response.data.message || response.data.details || 'Failed to request MFA code';
      console.error(`[DEBUG] API Error: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  } catch (error) {
    console.error(`[DEBUG] Request failed:`, error.message);
    if (error.response) {
      console.error(`[DEBUG] Response status: ${error.response.status}`);
      console.error(`[DEBUG] Response data:`, JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Verify MFA code and generate token (simplified)
 */
async function verifyMFACodeAndGenerateToken(phoneNumber, email, code, clientId, clientType, expiresInDays) {
  try {
    const response = await makeRequest(`${MYKEYS_URL}/api/auth/verify-mfa-code`, {
      method: 'POST',
      body: {
        phoneNumber,
        email,
        code,
        clientId,
        clientType,
        expiresInDays,
      },
      timeout: 30000,
    });
    
    // Handle standardized API response format: { status: 'success', data: { token: ... } }
    if (response.status === 200 && (response.data.success || response.data.status === 'success')) {
      // Handle both old format (data.success) and new format (data.status)
      if (response.data.status === 'success' && response.data.data && response.data.data.token) {
        return {
          token: response.data.data.token,
          expiresAt: response.data.data.expiresAt,
          tokenId: response.data.data.tokenId,
        };
      }
      return response.data;
    } else {
      throw new Error(response.data.error || response.data.message || 'Failed to verify MFA code');
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Generate token with MFA flow (simplified)
 */
async function generateTokenFlow() {
  try {
    console.log('');
    console.log(colorize('╔════════════════════════════════════════╗', 'cyan'));
    console.log(colorize('║', 'cyan') + colorize('     MyKeys Token Generator (MFA)', 'bright') + colorize('      ║', 'cyan'));
    console.log(colorize('╚════════════════════════════════════════╝', 'cyan'));
    console.log('');
    
    // Step 1: Choose delivery method
    console.log(colorize('Choose verification method:', 'bright'));
    console.log('  1. SMS (phone number)');
    console.log('  2. Email (recommended for international users)');
    console.log('');
    console.log(colorize('Note:', 'dim'), 'SMS verification may incur costs for international numbers.');
    console.log(colorize('      ', 'dim'), 'Email verification is free and works worldwide.');
    const method = await prompt(colorize('Enter choice (1 or 2): ', 'yellow'));
    
    let phoneNumber = null;
    let email = null;
    
    if (method === '1') {
      phoneNumber = await prompt(colorize('Enter phone number (e.g., +12132484250, 12132484250, or 213-248-4250): ', 'yellow'));
      if (!phoneNumber) {
        console.error(colorize('Error:', 'red'), 'Phone number is required');
        process.exit(1);
      }
      
      // Normalize phone number to E.164 format
      // Remove all non-digit characters except leading +
      let normalized = phoneNumber.trim();
      
      // If it starts with +, keep it; otherwise assume US (+1)
      if (normalized.startsWith('+')) {
        // Already has country code, just remove formatting
        normalized = '+' + normalized.substring(1).replace(/\D/g, '');
      } else {
        // No +, check if it starts with country code
        const digitsOnly = normalized.replace(/\D/g, '');
        
        // If 11 digits and starts with 1, assume US number with country code
        if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
          normalized = '+' + digitsOnly;
        } else if (digitsOnly.length === 10) {
          // 10 digits, assume US number, add +1
          normalized = '+1' + digitsOnly;
        } else if (digitsOnly.length > 10) {
          // More than 10 digits, assume it includes country code
          normalized = '+' + digitsOnly;
        } else {
          console.error(colorize('Error:', 'red'), 'Invalid phone number format. Please provide a valid phone number.');
          console.log(colorize('Accepted formats:', 'yellow'));
          console.log('  • +12132484250 (E.164 with country code)');
          console.log('  • 12132484250 (11 digits with US country code)');
          console.log('  • 213-248-4250 (10 digits, US number)');
          process.exit(1);
        }
      }
      
      // Validate normalized format: + followed by country code (1-3 digits) and number (7-14 digits)
      const phoneRegex = /^\+[1-9]\d{9,14}$/;
      if (!phoneRegex.test(normalized)) {
        console.error(colorize('Error:', 'red'), 'Invalid phone number format.');
        console.log(colorize('Accepted formats:', 'yellow'));
        console.log('  • +12132484250 (E.164 with country code)');
        console.log('  • 12132484250 (11 digits with US country code)');
        console.log('  • 213-248-4250 (10 digits, US number)');
        process.exit(1);
      }
      
      // Use normalized phone number
      phoneNumber = normalized;
      console.log(colorize(`✓ Normalized to E.164 format: ${phoneNumber}`, 'dim'));
      
      // Check if international (not US/Canada) and warn about costs
      const countryCode = phoneNumber.substring(1, 2); // Get first digit after +
      const isUSCanada = countryCode === '1';
      
      if (!isUSCanada) {
        console.log('');
        console.log(colorize('⚠️  International Number Detected', 'yellow'));
        console.log(colorize('SMS verification to international numbers may incur charges.', 'yellow'));
        console.log(colorize('Consider using email verification (option 2) for cost-free verification.', 'dim'));
        console.log('');
        const confirm = await prompt(colorize('Continue with SMS? (yes/no): ', 'yellow'));
        if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
          console.log(colorize('Cancelled. Please restart and choose email verification (option 2).', 'dim'));
          process.exit(0);
        }
      }
    } else if (method === '2') {
      email = await prompt(colorize('Enter email address: ', 'yellow'));
      if (!email) {
        console.error(colorize('Error:', 'red'), 'Email is required');
        process.exit(1);
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.error(colorize('Error:', 'red'), 'Invalid email address format');
        process.exit(1);
      }
    } else {
      console.error(colorize('Error:', 'red'), 'Invalid choice');
      process.exit(1);
    }
    
    // Step 2: Request MFA code (4-digit)
    console.log('');
    console.log(colorize(`Sending 4-digit verification code to ${phoneNumber ? 'SMS' : 'email'}...`, 'dim'));
    const mfaResult = await requestMFACode(phoneNumber, email);
    console.log(colorize(`✓ 4-digit code sent to ${phoneNumber || email}`, 'green'));
    console.log('');
    
    // Step 3: Enter 4-digit code
    const code = await prompt(colorize('Enter 4-digit verification code: ', 'yellow'));
    if (!code || code.length !== 4) {
      console.error(colorize('Error:', 'red'), 'Please enter a 4-digit verification code');
      process.exit(1);
    }
    
    // Step 4: Get client info (optional, with defaults)
    const clientId = await prompt(colorize('Enter client ID (default: cli-token): ', 'dim')) || 'cli-token';
    const clientType = await prompt(colorize('Enter client type (default: generic): ', 'dim')) || 'generic';
    const expiresInDays = parseInt(await prompt(colorize('Enter expiration in days (default: 90): ', 'dim')) || '90');
    
    // Step 5: Verify code and generate token
    console.log('');
    console.log(colorize('Verifying code and generating token...', 'dim'));
    const tokenResult = await verifyMFACodeAndGenerateToken(
      phoneNumber,
      email,
      code,
      clientId,
      clientType,
      expiresInDays
    );
    
    // Step 7: Save token
    console.log('');
    console.log(colorize('╔════════════════════════════════════════╗', 'green'));
    console.log(colorize('║', 'green') + colorize('      Token Generated Successfully!', 'bright') + colorize('      ║', 'green'));
    console.log(colorize('╚════════════════════════════════════════╝', 'green'));
    console.log('');
    console.log(colorize('Token:', 'bright'));
    console.log(colorize(tokenResult.token, 'cyan'));
    console.log('');
    console.log(colorize(`Expires: ${new Date(tokenResult.expiresAt).toLocaleString()}`, 'dim'));
    console.log('');
    
    // Save token
    const tokenDir = path.dirname(TOKEN_FILE);
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }
    fs.writeFileSync(TOKEN_FILE, tokenResult.token, 'utf8');
    console.log(colorize(`✓ Token saved to: ${TOKEN_FILE}`, 'green'));
    
    // Update session with token generation info
    if (sessionSeed) {
      const token = getTokenSync();
      if (token) {
        addSessionMemory(sessionSeed, {
          type: 'token_generated',
          expiresAt: tokenResult.expiresAt,
          clientId: clientId,
          clientType: clientType,
        }, token);
      }
      updateSession(sessionSeed, {
        lastTokenGenerated: new Date().toISOString(),
      }, token);
    }
    
    console.log('');
    console.log(colorize('You can now use:', 'dim'));
    console.log(colorize('  mykeys admin', 'cyan'));
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error(colorize('Error:', 'red'), error.message);
    console.log('');
    console.log('Troubleshooting:');
    console.log('  1. Check that phone/email is correct');
    console.log('  2. Ensure 4-digit verification code is entered correctly');
    console.log('  3. Check network connectivity');
    console.log('  4. Verify Twilio/SES credentials are configured');
    process.exit(1);
  }
}

/**
 * Get or create session seed based on email
 */
function getSessionSeedFromEmail() {
  const email = getEmail();
  if (!email) {
    return 'default';
  }
  // Use email as seed (normalized)
  return email.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

/**
 * Main CLI function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Get token (will auto-authenticate via email if needed)
  const token = await getToken();
  
  // Use email-based session seed
  const sessionSeed = getSessionSeedFromEmail();
  
  // Update session with command info
  if (token && sessionSeed) {
    try {
      updateSession(sessionSeed, { 
        lastCommand: command || 'help',
        lastCommandTime: new Date().toISOString(),
      }, token);
    } catch (error) {
      // Silently fail - session updates are optional
    }
  }
  
  if (command === 'admin') {
    // Token already obtained in main() via getToken()
    
    // Get admin info
    try {
      console.log(colorize('Fetching admin information...', 'dim'));
      const info = await getAdminInfo(token);
      displayAdminInfo(info);
      
      // Update session with admin info
      if (sessionSeed) {
        const token = getTokenSync();
        if (token) {
          addSessionMemory(sessionSeed, {
            type: 'admin_info',
            data: info,
          }, token);
        }
        updateSession(sessionSeed, {
          lastAdminInfo: new Date().toISOString(),
        }, token);
        
        // Show comparison with historical state if available
        const snapshots = loadHistorySnapshots(sessionSeed, token);
        if (snapshots.length > 0) {
          const lastSnapshot = snapshots[snapshots.length - 1];
          const comparison = compareSessionStates(info, lastSnapshot);
          if (comparison.differences.length > 0) {
            console.log('');
            console.log(colorize('Changes since last snapshot:', 'yellow'));
            comparison.differences.forEach(diff => {
              const diffType = diff.type === 'added' ? '+' : diff.type === 'removed' ? '-' : '~';
              const diffColor = diff.type === 'added' ? 'green' : diff.type === 'removed' ? 'red' : 'yellow';
              console.log(`  ${colorize(diffType, diffColor)} ${diff.field}`);
            });
            console.log('');
          }
        }
      }
    } catch (error) {
      console.error(colorize('Error:', 'red'), error.message);
      console.log('');
      console.log('Troubleshooting:');
      console.log('  1. Verify your token is correct');
      console.log('  2. Check that MYKEYS_URL is correct');
      console.log('  3. Ensure you have network connectivity');
      process.exit(1);
    }
  } else if (command === 'logout' || command === 'logoff') {
    // Remove token file
    let tokenRemoved = false;
    let emailRemoved = false;
    
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
        tokenRemoved = true;
      }
    } catch (error) {
      console.error(colorize('Error removing token:', 'red'), error.message);
    }
    
    // Optionally remove email (ask user)
    if (fs.existsSync(EMAIL_FILE)) {
      const removeEmail = await prompt(colorize('Also remove saved email? (y/N): ', 'yellow'));
      if (removeEmail.toLowerCase() === 'y' || removeEmail.toLowerCase() === 'yes') {
        try {
          fs.unlinkSync(EMAIL_FILE);
          emailRemoved = true;
        } catch (error) {
          console.error(colorize('Error removing email:', 'red'), error.message);
        }
      }
    }
    
    console.log('');
    if (tokenRemoved) {
      console.log(colorize('✓ Logged out successfully', 'green'));
      console.log(colorize(`✓ Token removed from: ${TOKEN_FILE}`, 'green'));
    } else {
      console.log(colorize('⚠️  No token found to remove', 'yellow'));
    }
    
    if (emailRemoved) {
      console.log(colorize(`✓ Email removed from: ${EMAIL_FILE}`, 'green'));
    } else if (fs.existsSync(EMAIL_FILE)) {
      console.log(colorize(`  Email kept: ${EMAIL_FILE}`, 'dim'));
    }
    console.log('');
    console.log(colorize('You can now run any command to authenticate again.', 'dim'));
    console.log('');
  } else if (command === 'generate-token') {
    await generateTokenFlow();
  } else if (command === 'session-history') {
    const seed = args[1] || sessionSeed;
    if (!seed) {
      console.error(colorize('Error:', 'red'), 'Session seed required');
      console.log('Usage: mykeys session-history [seed]');
      console.log(colorize('  If seed not provided, uses email-based session', 'dim'));
      process.exit(1);
    }
    if (!token) {
      console.error(colorize('Error:', 'red'), 'Token required for encrypted session history');
      process.exit(1);
    }
    replaySessionHistory(seed, token);
  } else if (command === 'session-compare') {
    const seed = args[1] || sessionSeed;
    const snapshotIndex = parseInt(args[2] || '0');
    if (!seed) {
      console.error(colorize('Error:', 'red'), 'Session seed required');
      console.log('Usage: mykeys session-compare [seed] [snapshot-index]');
      console.log(colorize('  If seed not provided, uses email-based session', 'dim'));
      process.exit(1);
    }
    if (!token) {
      console.error(colorize('Error:', 'red'), 'Token required for encrypted session comparison');
      process.exit(1);
    }
    const snapshots = loadHistorySnapshots(seed, token);
    const currentSession = loadSession(seed, token);
    if (snapshots.length === 0) {
      console.log(colorize('No snapshots found for comparison.', 'yellow'));
      process.exit(0);
    }
    const snapshot = snapshots[snapshotIndex] || snapshots[snapshots.length - 1];
    const comparison = compareSessionStates(currentSession, snapshot);
    console.log('');
    console.log(colorize('╔════════════════════════════════════════╗', 'cyan'));
    console.log(colorize('║', 'cyan') + colorize('     Session Comparison', 'bright') + colorize('              ║', 'cyan'));
    console.log(colorize('╚════════════════════════════════════════╝', 'cyan'));
    console.log('');
    console.log(colorize(`Seed: ${seed}`, 'bright'));
    console.log(colorize(`Snapshot: ${new Date(snapshot.snapshotTime).toLocaleString()}`, 'dim'));
    console.log(colorize(`Current: ${new Date().toLocaleString()}`, 'dim'));
    console.log('');
    if (comparison.differences.length === 0) {
      console.log(colorize('✓ No differences found', 'green'));
    } else {
      console.log(colorize(`Found ${comparison.differences.length} differences:`, 'bright'));
      comparison.differences.forEach(diff => {
        const diffType = diff.type === 'added' ? '+' : diff.type === 'removed' ? '-' : '~';
        const diffColor = diff.type === 'added' ? 'green' : diff.type === 'removed' ? 'red' : 'yellow';
        console.log(`  ${colorize(diffType, diffColor)} ${diff.field}`);
        if (diff.type === 'changed') {
          console.log(`    Historical: ${JSON.stringify(diff.historical).substring(0, 50)}...`);
          console.log(`    Current:    ${JSON.stringify(diff.current).substring(0, 50)}...`);
        }
      });
    }
    console.log('');
  } else if (command === 'rings') {
    // Ring management commands
    const subcommand = process.argv[3];
    
    if (subcommand === 'list') {
      const response = await makeRequest(`${MYKEYS_URL}/api/admin/rings`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 200 && response.data.status === 'success') {
        const rings = response.data.data;
        console.log(colorize('Rings:', 'bright'));
        Object.entries(rings).forEach(([ringId, ring]) => {
          console.log(`  ${colorize(ringId, 'cyan')}`);
          console.log(`    First Email: ${ring.firstEmail}`);
          console.log(`    Members: ${Object.keys(ring.members || {}).length}`);
          console.log(`    Created: ${ring.createdAt}`);
        });
      } else {
        console.error(colorize('Error:', 'red'), response.data?.error || response.data?.message || 'Failed to list rings');
      }
    } else if (subcommand === 'create') {
      const ringId = process.argv[4];
      const firstEmail = process.argv[5] || 'bcherrman@gmail.com';
      if (!ringId) {
        console.error('Usage: mykeys rings create <ringId> [firstEmail]');
        process.exit(1);
      }
      const response = await makeRequest(`${MYKEYS_URL}/api/admin/rings`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: {
          ringId,
          firstEmail,
          initialRoles: { [firstEmail]: ['owner', 'architect', 'member'] }
        }
      });
      if (response.status === 201 && response.data.status === 'success') {
        console.log(colorize('Ring created:', 'green'), response.data.data.id);
      } else {
        console.error(colorize('Error:', 'red'), response.data?.error || response.data?.message || 'Failed to create ring');
      }
    } else if (subcommand === 'get') {
      const ringId = process.argv[4];
      if (!ringId) {
        console.error('Usage: mykeys rings get <ringId>');
        process.exit(1);
      }
      const response = await makeRequest(`${MYKEYS_URL}/api/admin/rings/${ringId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 200 && response.data.status === 'success') {
        const ring = response.data.data;
        console.log(colorize('Ring:', 'bright'), ring.id);
        console.log(`  First Email: ${ring.firstEmail}`);
        console.log(`  Created: ${ring.createdAt}`);
        console.log(`  Members:`);
        Object.entries(ring.members || {}).forEach(([email, data]) => {
          console.log(`    ${email}: [${data.roles.join(', ')}]`);
        });
      } else {
        console.error(colorize('Error:', 'red'), response.data?.error || response.data?.message || 'Failed to get ring');
      }
    } else if (subcommand === 'discover') {
      const response = await makeRequest(`${MYKEYS_URL}/api/rings/discover`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 200 && response.data.status === 'success') {
        const rings = response.data.data;
        console.log(colorize('Discovered Rings:', 'bright'));
        Object.entries(rings).forEach(([ringId, metadata]) => {
          console.log(`  ${colorize(ringId, 'cyan')}`);
          if (metadata.publicName) console.log(`    Name: ${metadata.publicName}`);
          if (metadata.capabilities) console.log(`    Capabilities: ${metadata.capabilities.join(', ')}`);
        });
      } else {
        console.error(colorize('Error:', 'red'), response.data?.error || response.data?.message || 'Failed to discover rings');
      }
    } else if (subcommand === 'my-ring') {
      const response = await makeRequest(`${MYKEYS_URL}/api/rings/my-ring`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 200 && response.data.status === 'success') {
        const data = response.data.data;
        console.log(colorize('Your Ring:', 'bright'), data.ringId);
        if (data.ring) {
          console.log(`  First Email: ${data.ring.firstEmail}`);
          console.log(`  Members: ${Object.keys(data.ring.members || {}).length}`);
        }
      } else {
        console.error(colorize('Error:', 'red'), response.data?.error || response.data?.message || 'Failed to get ring');
      }
    } else {
      console.log('Ring Management Commands:');
      console.log(`  ${colorize('mykeys rings list', 'cyan')}           - List all rings`);
      console.log(`  ${colorize('mykeys rings create <ringId>', 'cyan')} - Create new ring`);
      console.log(`  ${colorize('mykeys rings get <ringId>', 'cyan')}    - Get ring details`);
      console.log(`  ${colorize('mykeys rings discover', 'cyan')}       - Discover rings`);
      console.log(`  ${colorize('mykeys rings my-ring', 'cyan')}        - Get your ring`);
    }
  } else if (command === 'keys') {
    // Key management commands
    const subcommand = process.argv[3];
    
    if (subcommand === 'list') {
      const ringId = process.argv[4];
      if (!ringId) {
        console.error('Usage: mykeys keys list <ringId>');
        process.exit(1);
      }
      const response = await makeRequest(`${MYKEYS_URL}/api/rings/${ringId}/keys`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 200 && response.data.status === 'success') {
        console.log(colorize(`Keys in ${ringId}:`, 'bright'));
        response.data.data.keys.forEach(key => {
          console.log(`  ${colorize(key, 'cyan')}`);
        });
        console.log(`\nTotal: ${response.data.data.count}`);
      } else {
        console.error(colorize('Error:', 'red'), response.data?.error || response.data?.message || 'Failed to list keys');
      }
    } else if (subcommand === 'get') {
      const ringId = process.argv[4];
      const keyName = process.argv[5];
      const ecosystem = process.argv[6] || 'default';
      if (!ringId || !keyName) {
        console.error('Usage: mykeys keys get <ringId> <keyName> [ecosystem]');
        process.exit(1);
      }
      const response = await makeRequest(`${MYKEYS_URL}/api/v1/secrets/${ecosystem}/${keyName}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 200 && response.data.success) {
        console.log(colorize('Key Value:', 'bright'));
        console.log(response.data.secret_value);
      } else {
        console.error(colorize('Error:', 'red'), response.data?.error || 'Failed to get key');
      }
    } else if (subcommand === 'set') {
      const ringId = process.argv[4];
      const keyName = process.argv[5];
      const value = process.argv[6];
      const ecosystem = process.argv[7] || 'default';
      if (!ringId || !keyName || !value) {
        console.error('Usage: mykeys keys set <ringId> <keyName> <value> [ecosystem]');
        process.exit(1);
      }
      const response = await makeRequest(`${MYKEYS_URL}/api/v1/secrets/${ecosystem}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: {
          secret_name: keyName,
          secret_value: value
        }
      });
      if (response.status === 200 && response.data.success) {
        console.log(colorize('Key stored:', 'green'), keyName);
      } else {
        console.error(colorize('Error:', 'red'), response.data?.error || 'Failed to store key');
      }
    } else {
      console.log('Key Management Commands:');
      console.log(`  ${colorize('mykeys keys list <ringId>', 'cyan')}        - List keys in ring`);
      console.log(`  ${colorize('mykeys keys get <ringId> <keyName>', 'cyan')} - Get key value`);
      console.log(`  ${colorize('mykeys keys set <ringId> <keyName> <value>', 'cyan')} - Set key value`);
    }
  } else if (command === 'vault') {
    // Privacy vault commands
    const subcommand = process.argv[3];
    
    if (subcommand === 'store') {
      const ringId = process.argv[4];
      const keyName = process.argv[5];
      const vaultSecretName = process.argv[6];
      const value = process.argv[7];
      if (!ringId || !keyName || !vaultSecretName || !value) {
        console.error('Usage: mykeys vault store <ringId> <keyName> <vaultSecretName> <value>');
        process.exit(1);
      }
      const response = await makeRequest(`${MYKEYS_URL}/api/rings/${ringId}/keys/${keyName}/vault`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: {
          vault_secret_name: vaultSecretName,
          vault_secret_value: value
        }
      });
      if (response.status === 200 && response.data.status === 'success') {
        console.log(colorize('Vault secret stored:', 'green'), vaultSecretName);
      } else {
        console.error(colorize('Error:', 'red'), response.data?.error || response.data?.message || 'Failed to store vault secret');
      }
    } else if (subcommand === 'get') {
      const ringId = process.argv[4];
      const keyName = process.argv[5];
      const vaultSecretName = process.argv[6];
      if (!ringId || !keyName || !vaultSecretName) {
        console.error('Usage: mykeys vault get <ringId> <keyName> <vaultSecretName>');
        process.exit(1);
      }
      const response = await makeRequest(`${MYKEYS_URL}/api/rings/${ringId}/keys/${keyName}/vault/${vaultSecretName}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 200 && response.data.status === 'success') {
        console.log(colorize('Vault Secret:', 'bright'));
        console.log(response.data.data.vaultSecretValue);
      } else {
        console.error(colorize('Error:', 'red'), response.data?.error || response.data?.message || 'Failed to get vault secret');
      }
    } else if (subcommand === 'list') {
      const ringId = process.argv[4];
      const keyName = process.argv[5];
      if (!ringId || !keyName) {
        console.error('Usage: mykeys vault list <ringId> <keyName>');
        process.exit(1);
      }
      const response = await makeRequest(`${MYKEYS_URL}/api/rings/${ringId}/keys/${keyName}/vault`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 200 && response.data.status === 'success') {
        console.log(colorize('Vault Secrets:', 'bright'));
        response.data.data.vaultSecrets.forEach(secret => {
          console.log(`  ${colorize(secret, 'cyan')}`);
        });
      } else {
        console.error(colorize('Error:', 'red'), response.data?.error || response.data?.message || 'Failed to list vault secrets');
      }
    } else {
      console.log('Privacy Vault Commands:');
      console.log(`  ${colorize('mykeys vault store <ringId> <keyName> <vaultSecretName> <value>', 'cyan')} - Store vault secret`);
      console.log(`  ${colorize('mykeys vault get <ringId> <keyName> <vaultSecretName>', 'cyan')} - Get vault secret`);
      console.log(`  ${colorize('mykeys vault list <ringId> <keyName>', 'cyan')} - List vault secrets`);
    }
  } else if (command === 'mcp') {
    // MCP server management
    const subcommand = process.argv[3];
    
    if (subcommand === 'update') {
      const { execSync } = require('child_process');
      const updateScript = path.join(__dirname, 'scripts', 'mcp-update.js');
      const force = process.argv.includes('--force');
      
      try {
        console.log('🔄 Updating MCP server...\n');
        execSync(`node "${updateScript}" ${force ? '--force' : ''}`, {
          stdio: 'inherit',
          cwd: __dirname
        });
      } catch (error) {
        console.error(colorize('Error updating MCP server:', 'red'), error.message);
        process.exit(1);
      }
    } else if (subcommand === 'check') {
      try {
        const response = await makeRequest(`${MYKEYS_URL}/api/mcp/version`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 200) {
          const info = response.data;
          console.log(colorize('MCP Server Version Info:', 'bright'));
          console.log(`  Current Version: ${info.version || 'unknown'}`);
          console.log(`  Download URL: ${info.downloadUrl || 'N/A'}`);
          console.log(`\n💡 Run ${colorize('mykeys mcp update', 'cyan')} to update to the latest version.`);
        }
      } catch (error) {
        console.error(colorize('Error checking version:', 'red'), error.message);
      }
    } else {
      console.log('MCP Server Management:');
      console.log(`  ${colorize('mykeys mcp update', 'cyan')}      - Update MCP server to latest version`);
      console.log(`  ${colorize('mykeys mcp check', 'cyan')}      - Check for updates`);
    }
  } else if (command === 'secrets') {
    // Secret management commands
    const subcommand = process.argv[3];
    
    if (subcommand === 'list') {
      const ecosystem = process.argv[4] || 'default';
      const response = await makeRequest(`${MYKEYS_URL}/api/v1/secrets/${ecosystem}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 200 && response.data.success) {
        console.log(colorize(`Secrets in ${ecosystem}:`, 'bright'));
        response.data.secrets.forEach(secret => {
          console.log(`  ${colorize(secret.secret_name, 'cyan')}`);
        });
      } else {
        console.error(colorize('Error:', 'red'), response.data?.error || 'Failed to list secrets');
      }
    } else if (subcommand === 'get') {
      const ecosystem = process.argv[4];
      const secretName = process.argv[5];
      if (!ecosystem || !secretName) {
        console.error('Usage: mykeys secrets get <ecosystem> <secretName>');
        process.exit(1);
      }
      const response = await makeRequest(`${MYKEYS_URL}/api/v1/secrets/${ecosystem}/${secretName}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 200 && response.data.success) {
        console.log(colorize('Secret Value:', 'bright'));
        console.log(response.data.secret_value);
      } else {
        console.error(colorize('Error:', 'red'), response.data?.error || 'Failed to get secret');
      }
    } else if (subcommand === 'set') {
      const ecosystem = process.argv[4];
      const secretName = process.argv[5];
      const value = process.argv[6];
      if (!ecosystem || !secretName || !value) {
        console.error('Usage: mykeys secrets set <ecosystem> <secretName> <value>');
        process.exit(1);
      }
      const response = await makeRequest(`${MYKEYS_URL}/api/v1/secrets/${ecosystem}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: {
          secret_name: secretName,
          secret_value: value
        }
      });
      if (response.status === 200 && response.data.success) {
        console.log(colorize('Secret stored:', 'green'), secretName);
      } else {
        console.error(colorize('Error:', 'red'), response.data?.error || 'Failed to store secret');
      }
    } else {
      console.log('Secret Management Commands:');
      console.log(`  ${colorize('mykeys secrets list [ecosystem]', 'cyan')} - List secrets`);
      console.log(`  ${colorize('mykeys secrets get <ecosystem> <secretName>', 'cyan')} - Get secret`);
      console.log(`  ${colorize('mykeys secrets set <ecosystem> <secretName> <value>', 'cyan')} - Set secret`);
    }
  } else if (command === 'related-tokens') {
    const subcommand = args[1];
    
    if (subcommand === 'add') {
      const tokenToAdd = args[2];
      if (!tokenToAdd) {
        console.error(colorize('Error:', 'red'), 'Token required');
        console.log('Usage: mykeys related-tokens add <token>');
        process.exit(1);
      }
      
      const relatedTokens = loadRelatedTokens();
      if (!relatedTokens.includes(tokenToAdd)) {
        relatedTokens.push(tokenToAdd);
        const tokenDir = path.dirname(RELATED_TOKENS_FILE);
        if (!fs.existsSync(tokenDir)) {
          fs.mkdirSync(tokenDir, { recursive: true });
        }
        fs.writeFileSync(RELATED_TOKENS_FILE, JSON.stringify(relatedTokens, null, 2), 'utf8');
        console.log(colorize('✓ Added related token', 'green'));
        
        // Check if it's actually related
        const currentToken = getTokenSync();
        if (currentToken && areKeysRelated(currentToken, tokenToAdd)) {
          console.log(colorize('✓ Token is related to current key chain', 'green'));
        } else {
          console.warn(colorize('⚠️  Token may not be related to current key chain', 'yellow'));
        }
      } else {
        console.log(colorize('Token already in related tokens list', 'dim'));
      }
    } else if (subcommand === 'list') {
      const relatedTokens = loadRelatedTokens();
      const currentToken = getTokenSync();
      
      console.log('');
      console.log(colorize('Related Tokens:', 'bright'));
      if (relatedTokens.length === 0) {
        console.log(colorize('  No related tokens configured', 'dim'));
      } else {
        relatedTokens.forEach((token, idx) => {
          const isRelated = currentToken && areKeysRelated(currentToken, token);
          const chainId = getKeyChainId(token);
          const status = isRelated ? colorize('(related)', 'green') : colorize('(not related)', 'yellow');
          console.log(`  ${idx + 1}. ${token.substring(0, 16)}... ${status}`);
          console.log(`     Chain ID: ${chainId}`);
        });
      }
      if (currentToken) {
        console.log('');
        console.log(colorize(`Current token chain ID: ${getKeyChainId(currentToken)}`, 'dim'));
      }
    } else if (subcommand === 'remove') {
      const tokenToRemove = args[2];
      if (!tokenToRemove) {
        console.error(colorize('Error:', 'red'), 'Token required');
        console.log('Usage: mykeys related-tokens remove <token>');
        process.exit(1);
      }
      
      const relatedTokens = loadRelatedTokens();
      const index = relatedTokens.indexOf(tokenToRemove);
      if (index !== -1) {
        relatedTokens.splice(index, 1);
        fs.writeFileSync(RELATED_TOKENS_FILE, JSON.stringify(relatedTokens, null, 2), 'utf8');
        console.log(colorize('✓ Removed related token', 'green'));
      } else {
        console.warn(colorize('Token not found in related tokens list', 'yellow'));
      }
    } else if (subcommand === 'clear') {
      fs.writeFileSync(RELATED_TOKENS_FILE, JSON.stringify([], null, 2), 'utf8');
      console.log(colorize('✓ Cleared all related tokens', 'green'));
    } else {
      console.log(colorize('Related Tokens Management', 'bright'));
      console.log('');
      console.log('Usage:');
      console.log(`  ${colorize('mykeys related-tokens add <token>', 'cyan')}    - Add a related token`);
      console.log(`  ${colorize('mykeys related-tokens list', 'cyan')}         - List related tokens`);
      console.log(`  ${colorize('mykeys related-tokens remove <token>', 'cyan')} - Remove a related token`);
      console.log(`  ${colorize('mykeys related-tokens clear', 'cyan')}        - Clear all related tokens`);
      console.log('');
      console.log('Related tokens allow partial decryption of expired/deceased data');
      console.log('when using keys from the same key chain.');
      process.exit(1);
    }
  } else {
    console.log(colorize('MyKeys CLI', 'bright'));
    console.log('');
    console.log('Usage:');
    console.log(`  ${colorize('mykeys admin', 'cyan')}              - Show admin information`);
    console.log(`  ${colorize('mykeys generate-token', 'cyan')}     - Generate a new MCP token with MFA`);
    console.log(`  ${colorize('mykeys logout', 'cyan')}             - Remove saved token and logout`);
    console.log(`  ${colorize('mykeys session-history <seed>', 'cyan')} - Replay session history`);
    console.log(`  ${colorize('mykeys session-compare <seed> [index]', 'cyan')} - Compare current vs historical state`);
    console.log(`  ${colorize('mykeys related-tokens', 'cyan')}      - Manage related tokens for partial decryption`);
    console.log('');
    console.log('Ring Management:');
    console.log(`  ${colorize('mykeys rings list', 'cyan')}           - List all rings`);
    console.log(`  ${colorize('mykeys rings create <ringId>', 'cyan')} - Create new ring`);
    console.log(`  ${colorize('mykeys rings get <ringId>', 'cyan')}    - Get ring details`);
    console.log(`  ${colorize('mykeys rings discover', 'cyan')}       - Discover rings`);
    console.log(`  ${colorize('mykeys rings my-ring', 'cyan')}        - Get your ring`);
    console.log('');
    console.log('Key Management:');
    console.log(`  ${colorize('mykeys keys list <ringId>', 'cyan')}        - List keys in ring`);
    console.log(`  ${colorize('mykeys keys get <ringId> <keyName>', 'cyan')} - Get key value`);
    console.log(`  ${colorize('mykeys keys set <ringId> <keyName> <value>', 'cyan')} - Set key value`);
    console.log('');
    console.log('Privacy Vault:');
    console.log(`  ${colorize('mykeys vault store <ringId> <keyName> <vaultSecretName> <value>', 'cyan')} - Store vault secret`);
    console.log(`  ${colorize('mykeys vault get <ringId> <keyName> <vaultSecretName>', 'cyan')} - Get vault secret`);
    console.log(`  ${colorize('mykeys vault list <ringId> <keyName>', 'cyan')} - List vault secrets`);
    console.log('');
    console.log('Secret Management:');
    console.log(`  ${colorize('mykeys secrets list [ecosystem]', 'cyan')} - List secrets`);
    console.log(`  ${colorize('mykeys secrets get <ecosystem> <secretName>', 'cyan')} - Get secret`);
    console.log(`  ${colorize('mykeys secrets set <ecosystem> <secretName> <value>', 'cyan')} - Set secret`);
    console.log('');
    console.log('MCP Server Management:');
    console.log(`  ${colorize('mykeys mcp update', 'cyan')}      - Update MCP server to latest version`);
    console.log(`  ${colorize('mykeys mcp check', 'cyan')}      - Check for updates`);
    console.log('');
    console.log('Session Management:');
    console.log(`  Sessions are automatically managed by email`);
    console.log(`  Sessions stored in: ${SESSIONS_DIR}`);
    console.log(`  History: ${HISTORY_DIR}`);
    console.log(`  Diffs: ${DIFFS_DIR}`);
    console.log(colorize('  • Sessions are encrypted and synced to server', 'dim'));
    console.log('');
    console.log('Partial Decryption:');
    console.log(`  ${colorize('MYKEYS_PARTIAL_DECRYPTION=true', 'cyan')} - Enable partial decryption`);
    console.log(`  Related tokens file: ${RELATED_TOKENS_FILE}`);
    console.log('');
    console.log('Environment variables:');
    console.log('  MCP_TOKEN or MYKEYS_TOKEN - Your authentication token');
    console.log('  MYKEYS_URL - API URL (default: https://mykeys.zip)');
    console.log('  MYKEYS_PARTIAL_DECRYPTION - Enable partial decryption (true/false)');
    console.log('');
    console.log('Token file:');
    console.log(`  ${TOKEN_FILE}`);
    process.exit(1);
  }
}

// Run CLI
if (require.main === module) {
  main().catch((error) => {
    console.error(colorize('Fatal error:', 'red'), error);
    process.exit(1);
  });
}

module.exports = { getAdminInfo, getToken };

