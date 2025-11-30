import './About.css'

export default function About() {
  return (
    <div className="about">
      <section className="about-hero">
        <div className="container">
          <h1>About MyKeys.zip</h1>
          <p className="lead">
            A friendly, secure credential management tool built for developers and AI agents.
          </p>
        </div>
      </section>

      <section className="about-content">
        <div className="container">
          <div className="about-section">
            <h2>Our Mission</h2>
            <p>
              We believe security should be approachable, not intimidating. MyKeys.zip was created 
              to make credential management feel warm and friendly—like a trusted friend who helps 
              you keep your secrets safe.
            </p>
            <p>
              Built specifically for developers working with AI agents, automation workflows, and 
              modern development tools, MyKeys provides enterprise-grade security with a developer-first 
              experience.
            </p>
          </div>

          <div className="about-section">
            <h2>What Makes Us Different</h2>
            <div className="differentiators">
              <div className="differentiator">
                <h3>🤖 AI-Native</h3>
                <p>
                  Designed from the ground up for AI agents and MCP clients. Native support for 
                  Cursor, Warp, and other AI development tools.
                </p>
              </div>
              <div className="differentiator">
                <h3>🔐 Secure by Default</h3>
                <p>
                  Built on Google Cloud Secret Manager for enterprise-grade security. Your credentials 
                  are encrypted and protected at every layer.
                </p>
              </div>
              <div className="differentiator">
                <h3>💚 Developer-Friendly</h3>
                <p>
                  CLI-first design means you can use MyKeys from your terminal, scripts, and CI/CD 
                  pipelines. No complex web interfaces required.
                </p>
              </div>
              <div className="differentiator">
                <h3>✨ Warm & Approachable</h3>
                <p>
                  We've designed MyKeys to feel friendly and approachable. Security doesn't have to 
                  be scary—it can be warm and welcoming.
                </p>
              </div>
            </div>
          </div>

          <div className="about-section">
            <h2>Who We're For</h2>
            <div className="audience">
              <div className="audience-item">
                <h3>AI Developers</h3>
                <p>
                  Building AI agents that need secure credential access? MyKeys provides native MCP 
                  support and token-based authentication perfect for Cursor, Warp, and other AI tools.
                </p>
              </div>
              <div className="audience-item">
                <h3>DevOps Engineers</h3>
                <p>
                  Managing credentials across multiple environments? MyKeys integrates seamlessly with 
                  CI/CD pipelines, Vercel, GitHub Actions, and more.
                </p>
              </div>
              <div className="audience-item">
                <h3>Automation Enthusiasts</h3>
                <p>
                  Building scripts and automation workflows? MyKeys provides a simple API that works 
                  from PowerShell, Bash, Python, and any language you prefer.
                </p>
              </div>
            </div>
          </div>

          <div className="about-section">
            <h2>Our Values</h2>
            <div className="values">
              <div className="value">
                <h3>Security First</h3>
                <p>Enterprise-grade security without compromise.</p>
              </div>
              <div className="value">
                <h3>Developer Experience</h3>
                <p>Tools should feel good to use, not frustrating.</p>
              </div>
              <div className="value">
                <h3>Transparency</h3>
                <p>Open about how we work and what we do.</p>
              </div>
              <div className="value">
                <h3>Approachability</h3>
                <p>Security can be warm and friendly, not scary.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}





