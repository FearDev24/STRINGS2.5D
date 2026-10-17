import { defineConfig, Plugin } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(ROOT, 'docs', 'screenshots');

/**
 * Somente desenvolvimento: recebe um PNG enviado pela própria página (canvas.toDataURL)
 * e grava em docs/screenshots/. Não há rede externa nem serviço pago envolvido.
 */
function captureEndpoint(): Plugin {
  return {
    name: 'strings-capture-endpoint',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__capture', (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        const name = (url.searchParams.get('name') ?? 'captura').replace(/[^a-z0-9_-]/gi, '');
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString('utf8'); });
        req.on('end', () => {
          const b64 = body.replace(/^data:image\/png;base64,/, '');
          mkdirSync(SHOTS, { recursive: true });
          const file = join(SHOTS, `${name}.png`);
          writeFileSync(file, Buffer.from(b64, 'base64'));
          res.setHeader('content-type', 'text/plain');
          res.end(file);
        });
      });
    },
  };
}

// Tudo roda localmente. Nenhum serviço externo é chamado em tempo de execução.
export default defineConfig({
  plugins: [captureEndpoint()],
  server: { host: '127.0.0.1', port: 5173, strictPort: false },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
