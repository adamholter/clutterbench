import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: { 'process.env.IS_PREACT': JSON.stringify('false') },
  server: { port: 7378, proxy: { '/api': 'http://localhost:7377', '/runs': 'http://localhost:7377' } },
  build: { chunkSizeWarningLimit: 4000 },
});
