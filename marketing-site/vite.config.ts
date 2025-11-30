import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Middleware to serve static HTML files directly, bypassing React Router
    {
      name: 'serve-static-html',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // If requesting an HTML file in public directory, serve it directly
          if (req.url && req.url.endsWith('.html') && req.url !== '/index.html') {
            // Let Vite handle it - it should serve from public/ directory
            next()
          } else {
            next()
          }
        })
      }
    }
  ],
  build: {
    outDir: '../public',
    emptyOutDir: false, // Don't delete existing API files
  },
  base: '/',
  server: {
    // Ensure static HTML files are served directly
    fs: {
      strict: false,
    },
  },
  // Configure public directory
  publicDir: 'public',
})




