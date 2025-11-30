/**
 * Shared Header and Footer Component
 * 
 * Loads header and footer HTML into any page that includes this script
 * Usage: <script src="/shared-layout.js"></script>
 */

// Force execution indicator
try {
    console.log('=== shared-layout.js STARTING ===');
    if (typeof window !== 'undefined') {
        window.__sharedLayoutLoaded = true;
        document.addEventListener('DOMContentLoaded', function() {
            const indicator = document.createElement('div');
            indicator.id = 'shared-layout-debug';
            indicator.style.cssText = 'position:fixed;top:10px;right:10px;background:red;color:white;padding:10px;z-index:99999;font-size:12px;';
            indicator.textContent = 'shared-layout.js LOADED';
            document.body.appendChild(indicator);
            setTimeout(() => indicator.remove(), 3000);
        });
    }
} catch(e) {
    alert('shared-layout.js ERROR: ' + e.message);
}

(function() {
    'use strict';
    
    try {
        console.log('=== shared-layout.js IIFE EXECUTING ===');
    } catch(e) {
        alert('IIFE LOG ERROR: ' + e.message);
    }
    
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
            width: 100vw !important;
            max-width: 100vw !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
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
            width: 100vw !important;
            max-width: 100vw !important;
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
        console.log('initSharedLayout called');
        // Add styles if not already added
        if (!document.getElementById('shared-header-footer-styles')) {
            document.head.insertAdjacentHTML('beforeend', headerStyles);
            console.log('Header/footer styles added');
        }
        
        // Add body class for layout
        document.body.classList.add('has-shared-layout');
        console.log('Body class added');
        
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
        console.log('Footer found:', !!insertedFooter, insertedFooter ? insertedFooter.parentElement : 'none');
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
            
            // SIMPLE DIRECT APPROACH: Force full width using multiple methods
            const forceFullWidth = () => {
                const header = document.querySelector('.header');
                const footer = document.querySelector('.footer');
                const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
                
                [header, footer].forEach((el, idx) => {
                    if (!el) return;
                    const name = idx === 0 ? 'header' : 'footer';
                    
                    // Ensure it's direct child of body
                    if (el.parentElement !== document.body) {
                        const parent = el.parentElement;
                        parent.removeChild(el);
                        if (name === 'header') {
                            document.body.insertBefore(el, document.body.firstChild);
                        } else {
                            document.body.appendChild(el);
                        }
                    }
                    
                    // Get current position
                    const rect = el.getBoundingClientRect();
                    const leftOffset = -rect.left;
                    const rightOffset = viewportWidth - rect.right;
                    const totalWidth = viewportWidth + leftOffset + rightOffset;
                    
                    // Apply styles directly
                    el.style.setProperty('margin-left', leftOffset + 'px', 'important');
                    el.style.setProperty('margin-right', rightOffset + 'px', 'important');
                    el.style.setProperty('width', totalWidth + 'px', 'important');
                    el.style.setProperty('max-width', totalWidth + 'px', 'important');
                    el.style.setProperty('position', 'relative', 'important');
                    el.style.setProperty('box-sizing', 'border-box', 'important');
                    el.style.setProperty('padding-left', '0', 'important');
                    el.style.setProperty('padding-right', '0', 'important');
                });
            };
            
            // Apply immediately
            forceFullWidth();
            
            // Apply after layout
            requestAnimationFrame(forceFullWidth);
            setTimeout(forceFullWidth, 50);
            setTimeout(forceFullWidth, 200);
            setTimeout(forceFullWidth, 500);
            
            // Also on resize
            window.addEventListener('resize', forceFullWidth);
        }
    }
    
    // Initialize when DOM is ready
    console.log('shared-layout.js loaded, readyState:', document.readyState);
    if (document.readyState === 'loading') {
        console.log('Waiting for DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', () => {
            console.log('DOMContentLoaded fired');
            initSharedLayout();
        });
    } else {
        console.log('DOM already ready, calling initSharedLayout immediately');
        initSharedLayout();
    }
    
    // Also try after a delay as fallback
    setTimeout(() => {
        console.log('Fallback timeout - checking if layout initialized');
        const header = document.querySelector('.header');
        const footer = document.querySelector('.footer');
        if (!header || !footer) {
            console.warn('Header or footer not found after timeout, re-initializing');
            initSharedLayout();
        }
    }, 1000);
})();

