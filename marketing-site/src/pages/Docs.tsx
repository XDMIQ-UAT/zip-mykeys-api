import './Docs.css'

export default function Docs() {
  return (
    <div className="docs">
      <section className="docs-hero">
        <div className="container">
          <h1>Documentation</h1>
          <p className="lead">
            Everything you need to get started with MyKeys.zip
          </p>
        </div>
      </section>

      <section className="docs-content">
        <div className="container">
          <div className="docs-grid">
            <div className="docs-section">
              <h2>Quick Start</h2>
              <div className="code-block">
                <pre><code>{`# Get a secret
curl -u admin:$MYKEYS_PASS \\
  https://mykeys.zip/api/v1/secrets/shared/github-token

# Store a secret
curl -u admin:$MYKEYS_PASS -X POST \\
  https://mykeys.zip/api/v1/secrets/shared/my-secret \\
  -H "Content-Type: application/json" \\
  -d '{"value": "secret-value"}'`}</code></pre>
              </div>
            </div>

            <div className="docs-section">
              <h2>PowerShell Examples</h2>
              <div className="code-block">
                <pre><code>{`# Get secret
$credential = New-Object PSCredential(
  "admin", 
  (ConvertTo-SecureString $env:MYKEYS_PASS -AsPlainText -Force)
)
Invoke-RestMethod -Uri "https://mykeys.zip/api/v1/secrets/shared/github-token" \\
  -Credential $credential

# Store secret
$body = @{value = "secret-value"} | ConvertTo-Json
Invoke-RestMethod -Uri "https://mykeys.zip/api/v1/secrets/shared/my-secret" \\
  -Method POST \\
  -Credential $credential \\
  -Body $body \\
  -ContentType "application/json"`}</code></pre>
              </div>
            </div>

            <div className="docs-section">
              <h2>MCP Integration</h2>
              <p>
                MyKeys provides native MCP (Model Context Protocol) support for AI development tools.
              </p>
              <h3>Cursor Integration</h3>
              <ol>
                <li>Generate token: <a href="/generate-token.html">Token Generator</a></li>
                <li>Configure MCP settings in Cursor</li>
                <li>Use <code>get_secret</code> and <code>store_secret</code> tools</li>
              </ol>
              <h3>Warp Integration</h3>
              <ol>
                <li>Generate token: <a href="/generate-token.html">Token Generator</a></li>
                <li>Configure MCP settings in Warp</li>
                <li>Access secrets via MCP protocol</li>
              </ol>
            </div>

            <div className="docs-section">
              <h2>API Endpoints</h2>
              <div className="endpoint-list">
                <div className="endpoint">
                  <code>GET /api/v1/secrets/:ecosystem/:secretName</code>
                  <p>Get a secret by ecosystem and name</p>
                </div>
                <div className="endpoint">
                  <code>POST /api/v1/secrets/:ecosystem</code>
                  <p>Store a secret in an ecosystem</p>
                </div>
                <div className="endpoint">
                  <code>GET /api/v1/secrets/:ecosystem</code>
                  <p>List all secrets in an ecosystem</p>
                </div>
                <div className="endpoint">
                  <code>POST /api/mcp/token</code>
                  <p>Generate MCP token for Cursor/Warp</p>
                </div>
              </div>
            </div>

            <div className="docs-section">
              <h2>Authentication</h2>
              <p>
                MyKeys supports multiple authentication methods:
              </p>
              <ul>
                <li><strong>Basic Auth:</strong> <code>Authorization: Basic &lt;base64(username:password)&gt;</code></li>
                <li><strong>Bearer Token:</strong> <code>Authorization: Bearer &lt;token&gt;</code></li>
                <li><strong>MCP Token:</strong> For Cursor, Warp, and other MCP clients</li>
              </ul>
            </div>

            <div className="docs-section">
              <h2>Security</h2>
              <p>
                MyKeys uses Google Cloud Secret Manager for enterprise-grade security:
              </p>
              <ul>
                <li>✅ Encrypted at rest</li>
                <li>✅ Encrypted in transit (HTTPS)</li>
                <li>✅ Rate limiting (100 requests/15min)</li>
                <li>✅ Security headers</li>
                <li>✅ Authentication required</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}






