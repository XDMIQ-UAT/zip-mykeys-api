/**
 * Shared Header and Footer Component
 * 
 * Loads header and footer HTML into any page that includes this script
 * Usage: <script src="/shared-layout.js"></script>
 */

(function() {
    'use strict';
    
    const headerHTML = `
        <header class="header" style="width: 100%; margin: 0; padding: 0; position: relative; left: 0; right: 0;">
            <div class="container" style="max-width: 1200px; margin: 0 auto; padding: 0 20px;">
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
        <footer class="footer" style="width: 100%; margin: 0; padding: 60px 0 30px; position: relative; left: 0; right: 0;">
            <div class="container" style="max-width: 1200px; margin: 0 auto; padding: 0 20px;">
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
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            left: 0 !important;
            right: 0 !important;
            box-sizing: border-box;
            transform: translateX(0) !important;
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
            width: 100% !important;
            max-width: 100% !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            left: 0 !important;
            right: 0 !important;
            box-sizing: border-box;
            transform: translateX(0) !important;
        }
        
        .footer .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            width: 100%;
            box-sizing: border-box;
        }
        
        .footer-content {
            display: grid !important;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 40px;
            margin-bottom: 40px;
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .footer-section {
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .footer-section h3,
        .footer-section h4 {
            margin-bottom: 16px;
            color: white !important;
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .footer-section p {
            color: rgba(255, 255, 255, 0.8) !important;
            line-height: 1.6;
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .footer-section a {
            display: block;
            color: rgba(255, 255, 255, 0.7) !important;
            margin-bottom: 8px;
            text-decoration: none;
            transition: color 0.2s;
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .footer-section a:hover {
            color: white !important;
        }
        
        .footer-bottom {
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            padding-top: 30px;
            text-align: center;
            color: rgba(255, 255, 255, 0.6) !important;
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        /* Ensure html and body are full width */
        html, body {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow-x: hidden !important;
        }
        
        /* Layout wrapper */
        body.has-shared-layout {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow-x: hidden !important;
        }
        
        .main-content {
            flex: 1;
            width: 100% !important;
            max-width: 100% !important;
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
        
        // Insert header FIRST, before any wrapping
        let insertedHeader = null;
        if (headerPlaceholder) {
            // Check if header placeholder is inside main-content or container
            const headerParent = headerPlaceholder.parentElement;
            if (headerParent && (headerParent.classList.contains('main-content') || headerParent.classList.contains('container'))) {
                // Move placeholder outside first
                headerParent.removeChild(headerPlaceholder);
                document.body.insertBefore(headerPlaceholder, document.body.firstChild);
            }
            headerPlaceholder.outerHTML = headerHTML;
            insertedHeader = document.querySelector('.header');
        } else {
            // Insert at beginning of body
            const headerDiv = document.createElement('div');
            headerDiv.innerHTML = headerHTML;
            insertedHeader = headerDiv.firstElementChild;
            document.body.insertBefore(insertedHeader, document.body.firstChild);
        }
        
        // Ensure header is at the very top of body
        if (insertedHeader && insertedHeader.parentElement !== document.body) {
            const headerParent = insertedHeader.parentElement;
            headerParent.removeChild(insertedHeader);
            document.body.insertBefore(insertedHeader, document.body.firstChild);
        }
        
        // Wrap main content if needed (but skip header and footer)
        const existingMain = document.querySelector('main');
        const mainContentDiv = document.querySelector('.main-content');
        
        if (!existingMain && !mainContentDiv && mainContent === document.body) {
            // Find all children except header and footer placeholders
            const childrenToWrap = [];
            let child = document.body.firstChild;
            while (child) {
                const nextSibling = child.nextSibling;
                if (child !== insertedHeader && 
                    child.tagName !== 'SCRIPT' && 
                    child.id !== 'shared-footer' &&
                    (!child.classList || !child.classList.contains('header')) &&
                    (!child.classList || !child.classList.contains('footer'))) {
                    childrenToWrap.push(child);
                }
                child = nextSibling;
            }
            
            // Create wrapper and move children
            if (childrenToWrap.length > 0) {
                const wrapper = document.createElement('div');
                wrapper.className = 'main-content';
                childrenToWrap.forEach(child => wrapper.appendChild(child));
                
                // Insert wrapper after header
                if (insertedHeader && insertedHeader.nextSibling) {
                    document.body.insertBefore(wrapper, insertedHeader.nextSibling);
                } else {
                    document.body.appendChild(wrapper);
                }
            }
        } else if (existingMain && !existingMain.classList.contains('main-content')) {
            existingMain.classList.add('main-content');
        }
        
        // Final check: Ensure header is outside main-content
        if (insertedHeader) {
            const headerParent = insertedHeader.parentElement;
            if (headerParent && (headerParent.classList.contains('main-content') || headerParent.classList.contains('container'))) {
                headerParent.removeChild(insertedHeader);
                document.body.insertBefore(insertedHeader, document.body.firstChild);
            }
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
            
            // Ensure footer content is visible
            const footerContent = insertedFooter.querySelector('.footer-content');
            const footerBottom = insertedFooter.querySelector('.footer-bottom');
            const footerContainer = insertedFooter.querySelector('.container');
            
            if (footerContent) {
                footerContent.style.display = 'grid';
                footerContent.style.visibility = 'visible';
                footerContent.style.opacity = '1';
                footerContent.style.color = 'white';
            }
            if (footerBottom) {
                footerBottom.style.visibility = 'visible';
                footerBottom.style.opacity = '1';
                footerBottom.style.color = 'rgba(255, 255, 255, 0.6)';
            }
            if (footerContainer) {
                footerContainer.style.display = 'block';
                footerContainer.style.visibility = 'visible';
                footerContainer.style.opacity = '1';
            }
            
            // Force all footer text to be visible
            const footerSections = insertedFooter.querySelectorAll('.footer-section');
            footerSections.forEach(section => {
                section.style.visibility = 'visible';
                section.style.opacity = '1';
                section.style.display = 'block';
            });
            
            const footerTexts = insertedFooter.querySelectorAll('h3, h4, p, a');
            footerTexts.forEach(text => {
                text.style.visibility = 'visible';
                text.style.opacity = '1';
                text.style.display = 'block';
            });
            
            // Force header and footer to full width with inline styles
            const insertedHeader = document.querySelector('.header');
            if (insertedHeader) {
                // Remove from any parent that might constrain width
                if (insertedHeader.parentElement !== document.body) {
                    const parent = insertedHeader.parentElement;
                    parent.removeChild(insertedHeader);
                    document.body.insertBefore(insertedHeader, document.body.firstChild);
                }
                
                // Force full width
                insertedHeader.style.cssText = 'width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; left: 0 !important; right: 0 !important; position: relative !important; transform: translateX(0) !important; box-sizing: border-box !important;';
                
                // Ensure header container doesn't constrain width
                const headerContainer = insertedHeader.querySelector('.container');
                if (headerContainer) {
                    headerContainer.style.cssText = 'max-width: 1200px !important; margin: 0 auto !important; padding: 0 20px !important; width: 100% !important; box-sizing: border-box !important;';
                }
            }
            
            // Remove footer from any parent that might constrain width
            if (insertedFooter.parentElement !== document.body) {
                const parent = insertedFooter.parentElement;
                parent.removeChild(insertedFooter);
                document.body.appendChild(insertedFooter);
            }
            
            // Force full width
            insertedFooter.style.cssText = 'width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 60px 0 30px !important; left: 0 !important; right: 0 !important; position: relative !important; transform: translateX(0) !important; box-sizing: border-box !important;';
            
            // Ensure footer container doesn't constrain width
            const footerContainer = insertedFooter.querySelector('.container');
            if (footerContainer) {
                footerContainer.style.cssText = 'max-width: 1200px !important; margin: 0 auto !important; padding: 0 20px !important; width: 100% !important; box-sizing: border-box !important;';
            }
            
            // Also ensure html and body are full width
            document.documentElement.style.cssText = 'width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important;';
            
            document.body.style.cssText = 'width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important;';
            
            // Use multiple approaches to ensure full width
            const ensureFullWidth = (element, name) => {
                if (!element) return;
                
                // Method 1: Use calc() trick to break out of containers
                const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
                element.style.marginLeft = 'calc(50% - 50vw)';
                element.style.marginRight = 'calc(50% - 50vw)';
                element.style.width = '100vw';
                element.style.maxWidth = '100vw';
                
                // Method 2: Also set as pixel value as fallback
                element.style.width = viewportWidth + 'px';
                
                // Method 3: Use negative margins if still constrained
                const rect = element.getBoundingClientRect();
                const bodyRect = document.body.getBoundingClientRect();
                if (rect.left !== 0 || Math.abs(rect.right - bodyRect.width) > 1) {
                    const leftOffset = -rect.left;
                    const rightOffset = bodyRect.width - rect.right;
                    if (leftOffset !== 0 || rightOffset !== 0) {
                        element.style.marginLeft = leftOffset + 'px';
                        element.style.marginRight = rightOffset + 'px';
                        element.style.width = (viewportWidth + leftOffset + rightOffset) + 'px';
                    }
                }
                
                // Force other properties
                element.style.position = 'relative';
                element.style.boxSizing = 'border-box';
                element.style.paddingLeft = '0';
                element.style.paddingRight = '0';
                
                console.log(`${name} width:`, element.offsetWidth, 'viewport:', viewportWidth, 'rect.left:`, rect.left, 'rect.right:`, rect.right, 'body.width:`, bodyRect.width);
            };
            
            // Apply immediately and after layout
            ensureFullWidth(insertedHeader, 'Header');
            ensureFullWidth(insertedFooter, 'Footer');
            
            requestAnimationFrame(() => {
                ensureFullWidth(insertedHeader, 'Header (after RAF)');
                ensureFullWidth(insertedFooter, 'Footer (after RAF)');
            });
            
            // Also try after a short delay
            setTimeout(() => {
                ensureFullWidth(insertedHeader, 'Header (after delay)');
                ensureFullWidth(insertedFooter, 'Footer (after delay)');
            }, 100);
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSharedLayout);
    } else {
        initSharedLayout();
    }
})();

