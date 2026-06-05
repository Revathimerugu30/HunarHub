import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

let server;
async function getServer() {
  if (!server) {
    const serverModule = await import('./dist/server/server.js');
    server = serverModule.default ?? serverModule;
  }
  return server;
}

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

function createRequest(req) {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? `localhost:${PORT}`}`);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null) headers.append(key, item);
      }
    } else if (value != null) {
      headers.append(key, value);
    }
  }

  const init = {
    method: req.method,
    headers,
    redirect: 'manual',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = Readable.toWeb(req);
  }

  return new Request(url.toString(), init);
}

async function sendResponse(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));

  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        res.write(Buffer.from(value));
      }
    }
  }

  res.end();
}

const httpServer = http.createServer(async (req, res) => {
  try {
    const request = createRequest(req);
    const appServer = await getServer();
    const response = await appServer.fetch(request, {}, {});
    await sendResponse(res, response);
  } catch (error) {
    console.error('Server request failure:', error);
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

httpServer.listen(PORT, HOST, () => {
  console.log(`✅ Server listening on http://${HOST}:${PORT}`);
});

httpServer.on('error', (error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
