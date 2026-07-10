import { defineConfig } from 'vite';

// Dev-only middleware: the browser POSTs gesture events to /api/log, and this
// prints them straight into the terminal running `npm run dev`. Nothing is
// written to disk — restart the server and the log is gone, which is exactly
// what "temporary" logging means here: good for comparing gesture behavior
// across takes in the same session, not a persistent record.
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
            // malformed payload, ignore — this is a debug tool, not a critical path
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [terminalGestureLogger()],
  server: {
    host: true,
  },
  assetsInclude: ['**/*.glsl'],
});