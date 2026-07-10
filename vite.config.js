import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    https: false, // set true + provide certs if testing webcam on a phone over LAN
    host: true
  },
  assetsInclude: ['**/*.glsl'],
});
