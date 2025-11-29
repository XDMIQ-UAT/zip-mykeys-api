# MyKeys CLI - AI Credential Management Tool

**Purpose**: CLI tool for AI credential management only  
**Not**: A consumer-facing credential management service

---

## Design Philosophy

MyKeys is designed as a **CLI-first tool** for AI agents and developers, not a consumer product. It focuses on:

- ✅ **Programmatic access** via CLI and API
- ✅ **AI agent integration** (Cursor, Warp, MCP clients)
- ✅ **Developer workflows** (token generation, configuration)
- ✅ **Automation** (scripts, CI/CD, agent orchestration)

**Not focused on:**
- ❌ Consumer web interface
- ❌ End-user credential management
- ❌ Consumer-facing features

---

## Primary Use Cases

### 1. AI Agent Credential Management
- Store credentials for AI agents (OpenAI, Anthropic, etc.)
- Manage API keys for development tools
- Sync credentials across AI development environments

### 2. MCP (Model Context Protocol) Integration
- Generate tokens for Cursor, Warp, and other MCP clients
- Configure MCP servers with credential access
- Enable AI agents to securely access secrets

### 3. Development Automation
- CLI scripts for credential management
- CI/CD integration for secret access
- Agent orchestration workflows

---

## API Usage (CLI-First)

### Command Line Examples

```bash
# Get a secret
curl -u admin:$MYKEYS_PASS https://mykeys.zip/api/v1/secrets/shared/github-token

# Store a secret
curl -u admin:$MYKEYS_PASS -X POST https://mykeys.zip/api/v1/secrets/shared/my-secret \
  -H "Content-Type: application/json" \
  -d '{"value": "secret-value"}'

# Generate MCP token (for Cursor/Warp)
curl -u admin:$MYKEYS_PASS -X POST https://mykeys.zip/api/mcp/token \
  -H "Content-Type: application/json" \
  -d '{"clientId": "cursor-agent", "clientType": "cursor"}'
```

### PowerShell Examples

```powershell
# Get secret
$credential = New-Object PSCredential("admin", (ConvertTo-SecureString $env:MYKEYS_PASS -AsPlainText -Force))
Invoke-RestMethod -Uri "https://mykeys.zip/api/v1/secrets/shared/github-token" -Credential $credential

# Store secret
$body = @{value = "secret-value"} | ConvertTo-Json
Invoke-RestMethod -Uri "https://mykeys.zip/api/v1/secrets/shared/my-secret" `
  -Method POST `
  -Credential $credential `
  -Body $body `
  -ContentType "application/json"
```

---

## MCP Integration

MyKeys provides native MCP (Model Context Protocol) support for AI development tools:

### Cursor Integration
1. Generate token: `https://mykeys.zip/public/generate-token.html`
2. Configure MCP settings in Cursor
3. Use `get_secret` and `store_secret` tools in Cursor agents

### Warp Integration
1. Generate token: `https://mykeys.zip/public/generate-token.html`
2. Configure MCP settings in Warp
3. Access secrets via MCP protocol

---

## Developer Tools

The web interface at `https://mykeys.zip` provides **developer tools only**:

- **Token Generator**: Create MCP tokens for AI clients
- **MCP Config Generator**: Generate MCP configuration files
- **API Documentation**: Reference for CLI/API usage

**Not a consumer interface** - these tools are for developers and AI agents.

---

## Security Model

- **CLI/API Access**: Primary access method
- **MCP Tokens**: Per-client authentication for AI tools
- **Rate Limiting**: Prevents abuse (100 requests/15min)
- **GCP Secret Manager**: Enterprise-grade secret storage

---

## Deployment

Deployed to Vercel as an API service:
- **URL**: `https://mykeys.zip`
- **Purpose**: Backend API for CLI and MCP clients
- **Not**: Consumer web application

---

**Remember**: MyKeys is a CLI tool for AI credential management, not a consumer product.




