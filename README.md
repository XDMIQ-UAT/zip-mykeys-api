# MyKeys CLI

**CLI tool for AI credential management** - Secure secrets management system with Google Cloud Secret Manager integration.

## Overview

**MyKeys is a CLI tool designed exclusively for AI credential management** - not a consumer-facing credential management service. It provides programmatic access to secrets for AI agents, development tools, and automation workflows.

This is the backend API service for **https://mykeys.zip**, designed to be used via CLI and API clients (Cursor, Warp, MCP clients) rather than as a consumer web application.

## Features

- **Direct GCP Secret Manager Integration**: Stores and retrieves secrets from Google Cloud Secret Manager
- **Dual API Support**: Supports both legacy (`/api/secrets`) and v1 (`/api/v1/secrets/:ecosystem/:secretName`) API formats
- **Multiple Authentication Methods**: Supports Basic Auth and Bearer Token (JWT) authentication
- **TLD Management**: Specialized endpoints for domain registrar and DNS provider credentials
- **CLI-First Design**: Optimized for programmatic access via CLI and API clients
- **MCP Integration**: Native support for Model Context Protocol (Cursor, Warp, etc.)
- **Developer Tools**: Token generation and configuration tools for AI development workflows
- **Security**: Rate limiting, security headers, encryption utilities
- **Optional Passthrough**: Can forward requests to upstream API if enabled

## Project Structure

```
E:\zip-mykeys-api\
├── server.js              # Main application server (unified backend)
├── package.json           # Node.js dependencies
├── Dockerfile             # Container configuration
├── setup-vm.sh            # VM setup script
├── public/                # Developer tools (token generation, MCP config)
│   ├── index.html         # Developer dashboard (CLI-focused)
│   ├── generate-token.html # MCP token generator
│   └── mcp-config-generator.html # MCP configuration generator
├── *.conf                 # Nginx configuration files
└── server-passthrough.js.backup  # Backup of original passthrough service
```

## API Endpoints

### Health Checks
- `GET /health` - Basic health check
- `GET /api/health` - Legacy health check
- `GET /api/v1/health` - V1 health check

### Legacy API (`/api/secrets`)
- `GET /api/secrets` - List all secrets
- `GET /api/secrets/:name` - Get secret value
- `POST /api/secrets` - Create secret
- `PUT /api/secrets/:name` - Update secret
- `DELETE /api/secrets/:name` - Delete secret

### V1 API (`/api/v1/secrets/:ecosystem/:secretName`)
- `GET /api/v1/secrets/:ecosystem/:secretName` - Get secret by ecosystem
- `POST /api/v1/secrets/:ecosystem` - Store secret in ecosystem
- `GET /api/v1/secrets/:ecosystem` - List secrets in ecosystem

### TLD Endpoints
- `POST /api/tld/:domain` - Store TLD credentials
- `GET /api/tld/:domain` - Get TLD credentials

## Authentication

The service supports two authentication methods:

1. **Basic Auth**: `Authorization: Basic <base64(username:password)>`
   - Default: `admin` / `XRi6TgSrwfeuK8taYzhknoJc`
   - Set via `MYKEYS_USER` and `MYKEYS_PASS` environment variables

2. **Bearer Token**: `Authorization: Bearer <token>`
   - Token must be at least 32 characters
   - Used for JWT-based authentication

## Environment Variables

```bash
# GCP Configuration
GCP_PROJECT=myl-zip-www              # GCP project ID
PORT=8080                            # Server port

# Authentication
MYKEYS_USER=admin                    # Basic auth username
MYKEYS_PASS=XRi6TgSrwfeuK8taYzhknoJc  # Basic auth password

# Optional Passthrough
ENABLE_PASSTHROUGH=false             # Enable passthrough to api.myl.zip
API_MYL_ZIP_BASE=https://api.myl.zip # Upstream API URL
INTERNAL_API_KEY=...                 # Internal API key for passthrough

# Encryption (optional)
MASTER_KEY=...                       # Master key for encryption (auto-generated if not set)
```

## Installation

### Local Development

```bash
cd E:\zip-mykeys-api
npm install
npm run dev
```

### Production Deployment

#### Option 1: Google Cloud Run

```bash
npm run deploy
```

#### Option 2: VM Deployment

1. Upload files to VM:
```bash
gcloud compute scp --recurse E:\zip-mykeys-api mykeys-vm:/var/www/mykeys --zone=us-central1-a
```

2. SSH into VM:
```bash
gcloud compute ssh mykeys-vm --zone=us-central1-a
```

3. Install and start:
```bash
cd /var/www/mykeys
npm install
pm2 start server.js --name mykeys
pm2 save
```

4. Configure Nginx:
```bash
sudo cp mykeys.conf /etc/nginx/sites-available/mykeys
sudo ln -s /etc/nginx/sites-available/mykeys /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Migration Notes

This repository was refactored to consolidate:
- **Main Backend** (from `C:\users\dash\projects\myl\secrets-manager\`)
- **Passthrough Service** (from `E:\zip-mykeys-api\`)

The unified server now:
- Directly integrates with GCP Secret Manager (no passthrough needed)
- Supports both API formats for backward compatibility
- Includes the web UI from the main backend
- Maintains all nginx configuration files

## Security

- Rate limiting: 100 requests per 15 minutes per IP
- Security headers via Helmet.js
- CORS enabled
- Request logging via Morgan
- Encryption utilities available (AES-256-GCM)

## License

MIT



