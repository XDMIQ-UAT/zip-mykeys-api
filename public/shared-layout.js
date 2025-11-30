/**
 * Shared Header and Footer Component
 * 
 * Loads header and footer HTML into any page that includes this script
 * Usage: <script src="/shared-layout.js"></script>
 */

(function() {
    'use strict';
    
    const headerHTML = `
        <header class="header">
            <div class="container">
                <nav class="nav">
                    <a href="/" class="logo">
                        <span class="logo-icon">🔐</span>
                        <span class="logo-text">MyKeys.zip</span>
                    </a>
                    <div class="nav-links">
                        <a href="/">Home</a>
                        <a href="/about">About</a>
                        <a href="/docs">Docs</a>
                        <a href="/tools">Tools</a>
                    </div>
                </nav>
            </div>
        </header>
    `;
    
    const footerHTML = `
        <footer class="footer">
            <div class="container">
                <div class="footer-content">
                    <div class="footer-section">
                        <h3>MyKeys.zip</h3>
                        <p>Secure credential management for AI agents and developers.</p>
                    </div>
                    <div class="footer-section">
                        <h4>Quick Links</h4>
                        <a href="/docs">Documentation</a>
                        <a href="/tools">Developer Tools</a>
                        <a href="/api/v1/health">API Health</a>
                    </div>
                    <div class="footer-section">
                        <h4>Resources</h4>
                        <a href="https://github.com/XDM-ZSBW/zip-myl-mykeys-api" target="_blank" rel="noopener noreferrer">GitHub</a>
                        <a href="/mcp-config-generator.html">MCP Config Generator</a>
                        <a href="/generate-token.html">Token Generator</a>
                    </div>
                </div>
                <div class="footer-bottom">
                    <p>&copy; 2025 MyKeys.zip - Built with ❤️ for developers and AI agents</p>
                </div>
            </div>
        </footer>
    `;
    
    const headerStyles = `
        <style id="shared-header-footer-styles">
        /* Header Styles */
        .header {
            background: white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            position: sticky;
            top: 0;
            z-index: 100;
            width: 100%;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        .header .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            width: 100%;
            box-sizing: border-box;
        }
        
        .nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 0;
        }
        
        .logo {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 24px;
            font-weight: 700;
            color: #333;
            text-decoration: none;
        }
        
        .logo-icon {
            font-size: 32px;
        }
        
        .logo-text {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .nav-links {
            display: flex;
            gap: 32px;
            align-items: center;
        }
        
        .nav-links a {
            color: #666;
            font-weight: 500;
            text-decoration: none;
            transition: color 0.2s;
            position: relative;
        }
        
        .nav-links a:hover {
            color: #667eea;
        }
        
        /* Footer Styles */
        .footer {
            background: #1a1a1a;
            color: white;
            margin-top: auto;
            padding: 60px 0 30px;
            width: 100%;
            margin-left: 0;
            margin-right: 0;
            box-sizing: border-box;
        }
        
        .footer .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            width: 100%;
            box-sizing: border-box;
        }
        
        .footer-content {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 40px;
            margin-bottom: 40px;
        }
        
        .footer-section h3,
        .footer-section h4 {
            margin-bottom: 16px;
            color: white;
        }
        
        .footer-section p {
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.6;
        }
        
        .footer-section a {
            display: block;
            color: rgba(255, 255, 255, 0.7);
            margin-bottom: 8px;
            text-decoration: none;
            transition: color 0.2s;
        }
        
        .footer-section a:hover {
            color: white;
        }
        
        .footer-bottom {
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            padding-top: 30px;
            text-align: center;
            color: rgba(255, 255, 255, 0.6);
        }
        
        /* Layout wrapper */
        body.has-shared-layout {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }
        
        .main-content {
            flex: 1;
        }
        
        @media (max-width: 768px) {
            .nav {
                flex-direction: column;
                gap: 20px;
            }
            
            .nav-links {
                flex-wrap: wrap;
                justify-content: center;
                gap: 20px;
            }
            
            .footer-content {
                grid-template-columns: 1fr;
            }
        }
        </style>
    `;
    
    function initSharedLayout() {
        // Add styles if not already added
        if (!document.getElementById('shared-header-footer-styles')) {
            document.head.insertAdjacentHTML('beforeend', headerStyles);
        }
        
        // Add body class for layout
        document.body.classList.add('has-shared-layout');
        
        // Find insertion points
        const headerPlaceholder = document.getElementById('shared-header');
        const footerPlaceholder = document.getElementById('shared-footer');
        const mainContent = document.querySelector('.main-content') || document.querySelector('main') || document.body;
        
        // Insert header
        if (headerPlaceholder) {
            headerPlaceholder.outerHTML = headerHTML;
        } else {
            // Insert at beginning of body
            const headerDiv = document.createElement('div');
            headerDiv.innerHTML = headerHTML;
            document.body.insertBefore(headerDiv.firstElementChild, document.body.firstChild);
        }
        
        // Wrap main content if needed
        const existingMain = document.querySelector('main');
        if (!existingMain && mainContent === document.body) {
            // Wrap body content in main-content div
            const wrapper = document.createElement('div');
            wrapper.className = 'main-content';
            while (document.body.firstChild && document.body.firstChild.tagName !== 'SCRIPT' && document.body.firstChild.id !== 'shared-footer') {
                wrapper.appendChild(document.body.firstChild);
            }
            document.body.insertBefore(wrapper, document.body.firstChild);
        } else if (existingMain) {
            existingMain.classList.add('main-content');
        }
        
        // Ensure footer placeholder is outside main-content and container
        const mainContentDiv = document.querySelector('.main-content');
        const containerDiv = document.querySelector('.container');
        
        if (footerPlaceholder) {
            // Check if footer is inside main-content or container and move it out
            if (mainContentDiv && mainContentDiv.contains(footerPlaceholder)) {
                mainContentDiv.removeChild(footerPlaceholder);
                document.body.appendChild(footerPlaceholder);
            } else if (containerDiv && containerDiv.contains(footerPlaceholder)) {
                containerDiv.removeChild(footerPlaceholder);
                document.body.appendChild(footerPlaceholder);
            }
            
            // Insert footer
            footerPlaceholder.outerHTML = footerHTML;
        } else {
            // Insert before closing body tag
            const footerDiv = document.createElement('div');
            footerDiv.innerHTML = footerHTML;
            document.body.appendChild(footerDiv.firstElementChild);
        }
        
        // Double-check: Ensure footer is not inside any container after insertion
        const insertedFooter = document.querySelector('.footer');
        if (insertedFooter) {
            let currentParent = insertedFooter.parentElement;
            let moved = false;
            
            // Keep moving up until we're outside main-content and container
            while (currentParent && currentParent !== document.body) {
                if (currentParent.classList.contains('main-content') || 
                    currentParent.classList.contains('container') ||
                    currentParent.id === 'main-content') {
                    currentParent.removeChild(insertedFooter);
                    document.body.appendChild(insertedFooter);
                    moved = true;
                    break;
                }
                currentParent = currentParent.parentElement;
            }
            
            if (moved) {
                console.log('Footer moved outside container');
            }
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSharedLayout);
    } else {
        initSharedLayout();
    }
})();

