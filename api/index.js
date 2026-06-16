const { promises: fs } = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { Readable } = require('stream');

const ROOT_DIR = path.join(__dirname, '..');
const CLIENT_DIR = path.join(ROOT_DIR, 'dist', 'client');
const SERVER_PATH = path.join(ROOT_DIR, 'dist', 'server', 'server.js');

const mimeTypes = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
  '.ico': 'image/vnd.microsoft.icon',
};

async function serveStaticIfExists(req, res) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  const hasFileExtension = path.extname(pathname) !== '';

  if (!hasFileExtension) return false;

  const relativePath = pathname.replace(/^\/+/, '');
  const filePath = path.join(CLIENT_DIR, relativePath);
  if (!filePath.startsWith(CLIENT_DIR)) return false;

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return false;
  } catch {
    return false;
  }

  const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const data = await fs.readFile(filePath);

  res.setHeader('content-type', contentType);
  res.setHeader('cache-control', 'public, max-age=31536000, immutable');
  res.statusCode = 200;
  res.end(data);
  return true;
}

function createRequest(req) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
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
    init.duplex = 'half';
  }

  return new Request(url.toString(), init);
}

async function sendResponse(res, response) {
  res.statusCode = response.status;
  for (const [key, value] of response.headers.entries()) {
    res.setHeader(key, value);
  }

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

let appServer;
async function getAppServer() {
  if (!appServer) {
    const serverModule = await import(pathToFileURL(SERVER_PATH).href);
    appServer = serverModule.default || serverModule;
  }
  return appServer;
}

module.exports = async function handler(req, res) {
  try {
    if (await serveStaticIfExists(req, res)) {
      return;
    }

    const request = createRequest(req);
    const server = await getAppServer();
    const response = await server.fetch(request, {}, {});
    await sendResponse(res, response);
  } catch (error) {
    console.error('Vercel function error:', error);
    res.statusCode = error.status || 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Internal Server Error');
  }
};
