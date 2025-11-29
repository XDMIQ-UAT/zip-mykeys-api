import { Link } from 'react-router-dom'
import './Home.css'

export default function Home() {
  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-icon">✨</span>
              <span>CLI-First Tool for AI Credential Management</span>
            </div>
            <h1 className="hero-title">
              Secure Credentials for
              <span className="hero-title-accent"> AI Agents</span>
            </h1>
            <p className="hero-description">
              MyKeys.zip is your friendly companion for managing credentials across AI development workflows. 
              Built for developers, AI agents, and automation tools—with a warm, approachable interface 
              that makes security feel effortless.
            </p>
            <div className="hero-actions">
              <Link to="/docs" className="btn btn-primary">
                Get Started
              </Link>
              <Link to="/tools" className="btn btn-secondary">
                Try Tools
              </Link>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <div className="stat-number">🔒</div>
                <div className="stat-label">Secure</div>
              </div>
              <div className="stat">
                <div className="stat-number">⚡</div>
                <div className="stat-label">Fast</div>
              </div>
              <div className="stat">
                <div className="stat-number">🤖</div>
                <div className="stat-label">AI-Ready</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="container">
          <h2 className="section-title">Why Developers Love MyKeys</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🔐</div>
              <h3>Secure by Default</h3>
              <p>
                Enterprise-grade security with Google Cloud Secret Manager. 
                Your credentials are encrypted and protected at every step.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI Agent Friendly</h3>
              <p>
                Native MCP (Model Context Protocol) support for Cursor, Warp, 
                and other AI development tools. Your agents can securely access 
                what they need.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>CLI-First Design</h3>
              <p>
                Built for developers who live in the terminal. Simple API calls, 
                PowerShell scripts, and automation workflows—all with a friendly interface.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Easy Integration</h3>
              <p>
                Works seamlessly with CI/CD pipelines, local development, 
                and production environments. One API, everywhere you need it.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Developer Tools</h3>
              <p>
                Token generators, MCP config builders, and helpful utilities 
                to get you started quickly. We've got your back.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💚</div>
              <h3>Warm & Approachable</h3>
              <p>
                Security doesn't have to be scary. We've designed MyKeys to feel 
                friendly and approachable—because good security should feel good.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="use-cases">
        <div className="container">
          <h2 className="section-title">Perfect For</h2>
          <div className="use-cases-grid">
            <div className="use-case-card warm-gradient">
              <h3>AI Development</h3>
              <p>
                Store API keys for OpenAI, Anthropic, and other AI services. 
                Your agents can securely access credentials without hardcoding.
              </p>
            </div>
            <div className="use-case-card" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white'}}>
              <h3>MCP Integration</h3>
              <p>
                Generate tokens for Cursor, Warp, and MCP clients. Configure 
                your AI tools with secure credential access in minutes.
              </p>
            </div>
            <div className="use-case-card" style={{background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white'}}>
              <h3>CI/CD Pipelines</h3>
              <p>
                Automate credential management in your deployment workflows. 
                Sync secrets from mykeys.zip to Vercel, GitHub Actions, and more.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Get Started?</h2>
            <p>
              Join developers and AI agents who trust MyKeys for secure credential management.
            </p>
            <div className="cta-actions">
              <Link to="/docs" className="btn btn-primary">
                Read the Docs
              </Link>
              <Link to="/tools" className="btn btn-secondary">
                Try Developer Tools
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}




