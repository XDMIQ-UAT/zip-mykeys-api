#!/usr/bin/env node
/**
 * MCP Server Auto-Update Script
 * 
 * Checks for updates and downloads the latest mcp-server.js
 * Usage: node scripts/mcp-update.js [--force]
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
const MCP_SERVER_PATH = process.env.MCP_SERVER_PATH || path.join(os.homedir(), '.mykeys', 'mcp-server.js');
const MCP_SERVER_DIR = path.dirname(MCP_SERVER_PATH);

// Ensure directory exists
if (!fs.existsSync(MCP_SERVER_DIR)) {
  fs.mkdirSync(MCP_SERVER_DIR, { recursive: true });
}

/**
 * Download file from URL
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const file = fs.createWriteStream(destPath);
    
    const request = client.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirects
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      } else {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
      }
    });
    
    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(err);
    });
    
    file.on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(err);
    });
  });
}

/**
 * Get current version from mcp-server.js
 */
function getCurrentVersion() {
  if (!fs.existsSync(MCP_SERVER_PATH)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(MCP_SERVER_PATH, 'utf8');
    const versionMatch = content.match(/MCP_SERVER_VERSION\s*=\s*['"]([^'"]+)['"]/);
    return versionMatch ? versionMatch[1] : null;
  } catch (error) {
    return null;
  }
}

/**
 * Check for updates
 */
async function checkForUpdates() {
  try {
    const urlObj = new URL(`${MYKEYS_URL}/api/mcp/version`);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    return new Promise((resolve, reject) => {
      const request = client.get(urlObj, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            // Fallback: assume update available if endpoint doesn't exist
            resolve({ version: 'unknown', updateAvailable: true });
          }
        });
      });
      
      request.on('error', () => {
        // Fallback: assume update available
        resolve({ version: 'unknown', updateAvailable: true });
      });
      
      request.setTimeout(5000, () => {
        request.destroy();
        resolve({ version: 'unknown', updateAvailable: true });
      });
    });
  } catch (error) {
    return { version: 'unknown', updateAvailable: true };
  }
}

/**
 * Main update function
 */
async function update(force = false) {
  console.log('🔍 Checking for MCP server updates...\n');
  
  const currentVersion = getCurrentVersion();
  if (currentVersion) {
    console.log(`Current version: ${currentVersion}`);
  } else {
    console.log('No existing MCP server found');
  }
  
  const updateInfo = await checkForUpdates();
  const latestVersion = updateInfo.version || 'latest';
  
  console.log(`Latest version: ${latestVersion}\n`);
  
  if (!force && currentVersion === latestVersion && currentVersion !== null) {
    console.log('✅ MCP server is already up to date!');
    return;
  }
  
  console.log('📥 Downloading latest MCP server...');
  
  const downloadUrl = `${MYKEYS_URL}/mcp-server.js`;
  const tempPath = `${MCP_SERVER_PATH}.tmp`;
  
  try {
    // Download to temp file first
    await downloadFile(downloadUrl, tempPath);
    
    // Backup existing file if it exists
    if (fs.existsSync(MCP_SERVER_PATH)) {
      const backupPath = `${MCP_SERVER_PATH}.backup`;
      fs.copyFileSync(MCP_SERVER_PATH, backupPath);
      console.log(`📦 Backed up existing server to: ${backupPath}`);
    }
    
    // Replace with new file
    fs.renameSync(tempPath, MCP_SERVER_PATH);
    fs.chmodSync(MCP_SERVER_PATH, 0o755); // Make executable
    
    const newVersion = getCurrentVersion();
    console.log(`✅ MCP server updated successfully!`);
    console.log(`   New version: ${newVersion || 'latest'}`);
    console.log(`   Location: ${MCP_SERVER_PATH}`);
    console.log(`\n💡 Restart your MCP client (Cursor/Warp) to use the updated server.`);
    
  } catch (error) {
    console.error(`❌ Failed to update MCP server: ${error.message}`);
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    process.exit(1);
  }
}

// Run update
const force = process.argv.includes('--force');
update(force).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});



