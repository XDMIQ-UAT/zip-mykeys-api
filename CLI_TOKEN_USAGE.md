# Using Your Token with the CLI

## Quick Start

Once you have generated a token (via the web interface at `https://myl.zip/generate-token` or `http://localhost:3000/generate-token`), follow these steps to use it with the `myl-cli`:

### 1. Login with Your Token

```bash
myl zip login
```

You'll be prompted to enter:
- **Token**: Paste your generated token (input is hidden for security)
- **Endpoint**: API endpoint URL (defaults to `https://myl.zip`)

Or pass the token directly:

```bash
myl zip login --token "your-token-here"
```

### 2. Verify Authentication

```bash
myl zip status
```

This will show:
- ✓ Authentication status
- Endpoint URL
- User information (if available)

### 3. Use CLI Commands

Once authenticated, you can use all CLI commands:

```bash
# List issues
myl zip issues

# Query memories
myl zip query dan

# Remember something
myl remember dan "Be kind."
```

## Token Storage

Your token is stored securely in your OS keyring:
- **Windows**: Windows Credential Manager
- **macOS**: Keychain
- **Linux**: Secret Service (gnome-keyring, kwallet, etc.)

## Environment Variable Alternative

You can also set the token via environment variable:

```bash
# Windows PowerShell
$env:MYL_API_TOKEN="your-token-here"

# Windows CMD
set MYL_API_TOKEN=your-token-here

# Linux/macOS
export MYL_API_TOKEN="your-token-here"
```

## Troubleshooting

### Token Not Working

1. **Check token format**: Tokens should be 64 hexadecimal characters
2. **Verify token is valid**: Use the web interface to check if your token is still valid
3. **Check endpoint**: Ensure you're using the correct API endpoint (`https://myl.zip` for production)

### Authentication Failed

```bash
# Clear stored credentials and try again
myl zip logout
myl zip login
```

### Token Expired

If your token has expired, generate a new one:
1. Go to `https://myl.zip/generate-token`
2. Follow the email verification flow
3. Copy the new token
4. Run `myl zip login` again

## API Endpoint Configuration

The CLI defaults to `https://myl.zip`. For local development:

```bash
myl zip login --endpoint "http://localhost:3000"
```

## Example Workflow

```bash
# 1. Generate token via web interface
# Visit: https://myl.zip/generate-token
# Complete email verification
# Copy the token

# 2. Login to CLI
myl zip login
# Enter token when prompted

# 3. Verify connection
myl zip status

# 4. Use CLI commands
myl zip issues
myl remember dan "Loved fishing."
myl zip query dan
```

## Security Notes

- **Never share your token**: Treat it like a password
- **Token expiration**: Tokens expire after 90 days by default
- **Secure storage**: Tokens are stored in OS keyring, not plain text files
- **HTTPS only**: Always use HTTPS endpoints in production

