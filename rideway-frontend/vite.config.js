import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'favicon-handler',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/favicon.ico') {
            res.statusCode = 204;
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
  define: {
    global: 'window',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
           
            
            if (res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                message: 'Service is temporarily reconnecting. Please try again shortly.',
                error: 'Service is temporarily reconnecting. Please try again shortly.'
              }));
            }
          });
        },
      },
      '/ws-notifications': {
        target: process.env.VITE_WS_BASE_URL || 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
