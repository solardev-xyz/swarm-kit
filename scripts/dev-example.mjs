import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { context } from 'esbuild';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function serveBundledExample({
  exampleName,
  label,
  defaultPort,
  portEnv,
}) {
  const exampleDir = path.join(repoRoot, 'examples', exampleName);
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || (portEnv ? process.env[portEnv] : undefined) || defaultPort);

  const bundle = await context({
    entryPoints: [path.join(repoRoot, 'src', 'index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    outfile: path.join(exampleDir, 'swarm-kit.js'),
  });

  await bundle.rebuild();
  await bundle.watch();

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);
      const filePath = resolveRequestPath(exampleDir, url.pathname);
      if (!filePath) {
        send(response, 403, 'Forbidden\n', 'text/plain; charset=utf-8');
        return;
      }

      const file = await stat(filePath);
      const finalPath = file.isDirectory() ? path.join(filePath, 'index.html') : filePath;
      const body = await readFile(finalPath);

      response.writeHead(200, {
        'Content-Type': contentType(finalPath),
        'Cache-Control': 'no-store',
      });
      response.end(body);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        send(response, 404, 'Not found\n', 'text/plain; charset=utf-8');
        return;
      }
      console.error(error);
      send(response, 500, 'Internal server error\n', 'text/plain; charset=utf-8');
    }
  });

  server.on('error', async (error) => {
    await bundle.dispose();
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Try PORT=${port + 1} npm run dev:${exampleName}`);
      process.exit(1);
    }
    throw error;
  });

  server.listen(port, host, () => {
    console.log(`${label} is serving at http://${host}:${port}/`);
    console.log(`Rebuilding examples/${exampleName}/swarm-kit.js on source changes...`);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      server.close();
      await bundle.dispose();
      process.exit(0);
    });
  }
}

function resolveRequestPath(exampleDir, pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const filePath = path.resolve(exampleDir, relative);
  if (filePath !== exampleDir && !filePath.startsWith(`${exampleDir}${path.sep}`)) {
    return null;
  }
  return filePath;
}

function send(response, status, body, type) {
  response.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

function contentType(filePath) {
  switch (path.extname(filePath)) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.map': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}
