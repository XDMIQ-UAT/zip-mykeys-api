import { Link, useLocation } from 'react-router-dom'
import './Layout.css'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  return (
    <div className="layout">
      <header className="header">
        <div className="container">
          <nav className="nav">
            <Link to="/" className="logo">
              <span className="logo-icon">🔐</span>
              <span className="logo-text">MyKeys.zip</span>
            </Link>
            <div className="nav-links">
              <Link 
                to="/" 
                className={location.pathname === '/' ? 'active' : ''}
              >
                Home
              </Link>
              <Link 
                to="/about" 
                className={location.pathname === '/about' ? 'active' : ''}
              >
                About
              </Link>
              <Link 
                to="/docs" 
                className={location.pathname === '/docs' ? 'active' : ''}
              >
                Docs
              </Link>
              <Link 
                to="/tools" 
                className={location.pathname === '/tools' ? 'active' : ''}
              >
                Tools
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main className="main">
        {children}
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3>MyKeys.zip</h3>
              <p>Secure credential management for AI agents and developers.</p>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <Link to="/docs">Documentation</Link>
              <Link to="/tools">Developer Tools</Link>
              <a href="/api/v1/health">API Health</a>
            </div>
            <div className="footer-section">
              <h4>Resources</h4>
              <a href="https://github.com/XDM-ZSBW/zip-myl-mykeys-api" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
              <a href="/mcp-config-generator.html">MCP Config Generator</a>
              <a href="/generate-token.html">Token Generator</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 MyKeys.zip - Built with ❤️ for developers and AI agents</p>
          </div>
        </div>
      </footer>
    </div>
  )
}





