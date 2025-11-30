# 🎫 Using Your MCP Token - Quick Guide

Congratulations! You've got your golden ticket (MCP token). Here's what to do next:

## Option 1: Use the Web Config Generator (Easiest)

1. **Go to the Config Generator**: https://mykeys.zip/mcp-config-generator.html

2. **Paste your token** in the "Configuration" tab:
   - Copy the token you just generated
   - Paste it into the "MCP Token" field

3. **Fill in the details**:
   - **Client ID**: The ID you used when generating the token (e.g., `dashpc`)
   - **Client Type**: Select `Cursor` (or `Warp` if using Warp)
   - **MCP Server Path**: `E:\zip-myl-mykeys-api\mcp-server.ts` (or the compiled `.js` file)
   - **MyKeys URL**: `https://mykeys.zip` (already filled)

4. **Click "Generate Configuration"** - This creates a JSON config file

5. **Copy the JSON configuration**

6. **Add to Cursor**:
   - Open Cursor Settings → Features → Model Context Protocol
   - Or edit the file directly:
     - **Windows**: `%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
     - **macOS**: `~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
     - **Linux**: `~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

7. **Add the config** to the `mcpServers` object in that JSON file

8. **Restart Cursor** to load the new MCP server

## Option 2: Manual Configuration

If you prefer to configure manually, here's the JSON structure:

```json
{
  "mcpServers": {
    "mykeys": {
      "command": "node",
      "args": ["E:\\zip-myl-mykeys-api\\mcp-server.ts"],
      "env": {
        "MYKEYS_URL": "https://mykeys.zip",
        "MCP_TOKEN": "YOUR_TOKEN_HERE",
        "MCP_CLIENT_ID": "dashpc"
      }
    }
  }
}
```

**Important**: Replace `YOUR_TOKEN_HERE` with the actual token you generated.

## Option 3: Use Token Directly in API Calls

You can also use your token to authenticate with the mykeys.zip API directly:

```bash
# Get a secret
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  https://mykeys.zip/api/v1/secrets/ecosystem/secret-name

# List secrets in an ecosystem
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  https://mykeys.zip/api/v1/secrets/ecosystem
```

## What Your Token Does

- ✅ Authenticates you with mykeys.zip API
- ✅ Allows MCP clients (Cursor, Warp) to access credentials
- ✅ Valid for 90 days (or whatever you set)
- ✅ Can be revoked if needed

## Security Notes

- 🔒 **Save your token securely** - it won't be shown again
- 🔒 **Don't commit tokens to git** - use environment variables
- 🔒 **Revoke old tokens** if compromised
- 🔒 **Generate new tokens** when they expire

## Troubleshooting

**Token not working?**
- Check that the token is copied correctly (no extra spaces)
- Verify the token hasn't expired
- Ensure the MCP server path is correct

**MCP server not connecting?**
- Make sure Node.js is installed
- Check that the mcp-server.ts file exists at the specified path
- Restart Cursor after adding the configuration

**Need help?**
- Check the full docs: https://mykeys.zip/docs
- Review the MCP config generator instructions tab

---

**Next Step**: Go to https://mykeys.zip/mcp-config-generator.html and generate your configuration! 🚀





