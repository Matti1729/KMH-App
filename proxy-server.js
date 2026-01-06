// proxy-server.js - Lokaler Proxy für api-fussball.de
// Startet mit: node proxy-server.js

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;
const API_BASE = 'https://api-fussball.de';

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-auth-token');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Parse request URL
  const parsedUrl = url.parse(req.url, true);
  const targetPath = parsedUrl.pathname.replace('/proxy', '');
  const targetUrl = `${API_BASE}${targetPath}${parsedUrl.search || ''}`;
  
  console.log(`[PROXY] ${req.method} ${targetUrl}`);
  
  // Forward headers
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (req.headers['x-auth-token']) {
    headers['x-auth-token'] = req.headers['x-auth-token'];
  }
  
  // Make request to api-fussball.de
  const proxyReq = https.request(targetUrl, {
    method: req.method,
    headers: headers
  }, (proxyRes) => {
    let data = '';
    
    proxyRes.on('data', chunk => {
      data += chunk;
    });
    
    proxyRes.on('end', () => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
      console.log(`[PROXY] Response: ${proxyRes.statusCode}`);
    });
  });
  
  proxyReq.on('error', (err) => {
    console.error('[PROXY] Error:', err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  });
  
  // Forward request body if present
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      proxyReq.write(body);
      proxyReq.end();
    });
  } else {
    proxyReq.end();
  }
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  🚀 Proxy Server läuft auf http://localhost:${PORT}          ║
║                                                            ║
║  Dieser Proxy leitet Anfragen an api-fussball.de weiter    ║
║  und umgeht dabei CORS-Beschränkungen.                     ║
║                                                            ║
║  Lass dieses Terminal offen während du die App nutzt!      ║
╚════════════════════════════════════════════════════════════╝
  `);
});
