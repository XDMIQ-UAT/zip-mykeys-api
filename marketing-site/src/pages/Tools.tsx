import './Tools.css'

export default function Tools() {
  return (
    <div className="tools">
      <section className="tools-hero">
        <div className="container">
          <h1>Developer Tools</h1>
          <p className="lead">
            Helpful utilities to get you started with MyKeys.zip
          </p>
        </div>
      </section>

      <section className="tools-content">
        <div className="container">
          <div className="tools-grid">
            <div className="tool-card">
              <div className="tool-icon">🔑</div>
              <h2>Token Generator</h2>
              <p>
                Generate secure MCP tokens for Cursor, Warp, and other AI development tools.
                Create tokens with custom client IDs and expiration settings.
              </p>
              <a href="/generate-token" className="btn btn-primary">
                Generate Token
              </a>
            </div>

            <div className="tool-card">
              <div className="tool-icon">🔧</div>
              <h2>MCP Config Generator</h2>
              <p>
                Generate MCP configuration files for Cursor and Warp. Get your MCP server
                configured in seconds with token-based authentication.
              </p>
              <a href="/mcp-config-generator.html" className="btn btn-primary">
                Generate Config
              </a>
            </div>

            <div className="tool-card">
              <div className="tool-icon">📊</div>
              <h2>API Health Check</h2>
              <p>
                Check the status of the MyKeys API. Verify connectivity and see current
                service status.
              </p>
              <a href="/api/v1/health" className="btn btn-secondary">
                Check Health
              </a>
            </div>
          </div>

          <div className="tools-info">
            <h2>Using the Tools</h2>
            <p>
              These developer tools are designed to help you get started quickly with MyKeys.zip.
              They're simple, friendly interfaces for common tasks like generating tokens and
              creating MCP configurations.
            </p>
            <p>
              <strong>Note:</strong> These tools are for developers and AI agents, not consumer
              credential management. MyKeys is a CLI-first tool designed for programmatic access.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}


