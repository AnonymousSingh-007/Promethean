import { defineConfig } from 'vite';

function terminalGestureLogger() {
  return {
    name: 'promethean-gesture-logger',
    configureServer(server) {
      server.middlewares.use('/api/log', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            const entry = JSON.parse(body);
            console.log(`[gesture] +${entry.t}ms  ${entry.event}`, entry.payload ?? '');
          } catch {
            // malformed payload, ignore
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  // GitHub Pages serves this repo from /Promethean/, not from the domain
  // root — base ensures every built <script>/<link>/asset URL is prefixed
  // correctly. If you ever rename the repo, update this to match.
  base: '/Promethean/',
  plugins: [terminalGestureLogger()],
  server: {
    host: true,
  },
  assetsInclude: ['**/*.glsl'],
});