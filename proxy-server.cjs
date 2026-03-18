// Likey Figma Plugin - Image Proxy Server
// Deploy to Render.com: https://render.com
// This proxies image requests to bypass CORS restrictions in Figma plugins

const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 7777;

const ALLOWED_DOMAINS = [
  'static.likeycontents.xyz',
  'lh3.googleusercontent.com',
  'drive.google.com',
  'i.pravatar.cc',
  'picsum.photos',
];

const server = http.createServer(function(req, res) {
  // CORS headers - allow Figma plugin (null origin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405);
    res.end('Method Not Allowed');
    return;
  }

  const url = new URL(req.url, 'http://localhost:' + PORT);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (url.pathname !== '/proxy-image') {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const imageUrl = url.searchParams.get('url');
  if (!imageUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'url parameter required' }));
    return;
  }

  // Security: only allow whitelisted domains
  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid URL' }));
    return;
  }

  const isAllowed = ALLOWED_DOMAINS.some(d => parsedUrl.hostname === d || parsedUrl.hostname.endsWith('.' + d));
  if (!isAllowed) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Domain not allowed: ' + parsedUrl.hostname }));
    return;
  }

  function fetchWithRedirects(fetchUrl, redirectCount) {
    if (redirectCount > 5) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: 'Too many redirects' }));
      return;
    }
    const mod = fetchUrl.startsWith('https') ? https : http;
    mod.get(fetchUrl, function(proxyRes) {
      if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
        fetchWithRedirects(proxyRes.headers.location, redirectCount + 1);
        return;
      }
      if (proxyRes.statusCode !== 200) {
        res.writeHead(proxyRes.statusCode);
        res.end(JSON.stringify({ error: 'Upstream error: ' + proxyRes.statusCode }));
        return;
      }
      const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      });
      proxyRes.pipe(res);
    }).on('error', function(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    });
  }

  fetchWithRedirects(imageUrl, 0);
});

server.listen(PORT, function() {
  console.log('Likey image proxy running on port ' + PORT);
});
