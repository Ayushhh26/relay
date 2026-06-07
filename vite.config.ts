import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function spaFallback(): Plugin {
  return {
    name: 'spa-fallback',
    configurePreviewServer(server) {
      server.middlewares.use((req: any, _res: any, next: any) => {
        if (req.url && !req.url.includes('.')) {
          req.url = '/index.html'
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), spaFallback()],
});
