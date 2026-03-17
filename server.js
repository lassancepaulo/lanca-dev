// ══════════════════════════════════════════════════════
//  Lança.dev — Server
//  Node.js puro: arquivos estáticos + API de leads + Pixel proxy
// ══════════════════════════════════════════════════════
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT      = process.env.PORT || 3030;
const ADMIN_KEY = process.env.ADMIN_KEY || 'lanca2025';
const DATA_DIR  = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

// ── Garante que data/ e leads.json existem ───────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, '[]', 'utf8');

// ── MIME types ────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

// ── Helpers ───────────────────────────────────────────
function readLeads() {
  try { return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8')); }
  catch { return []; }
}

function writeLeads(leads) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
}

function generateLeadId(leads) {
  const year = new Date().getFullYear();
  const num  = String(leads.length + 1).padStart(3, '0');
  return `LEAD-${year}-${num}`;
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function isAdminAuth(req) {
  return req.headers['x-admin-key'] === ADMIN_KEY;
}

// ── Serve static file ─────────────────────────────────
function serveStatic(req, res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 — Página não encontrada');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 — Erro interno');
      }
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

// ── HTTP Server ───────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);
  const method   = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    });
    return res.end();
  }

  // ── API: POST /api/leads (form público) ──────────────
  if (pathname === '/api/leads' && method === 'POST') {
    const body  = await parseBody(req);
    const leads = readLeads();
    const lead  = {
      id:        generateLeadId(leads),
      name:      (body.name    || '').trim(),
      phone:     (body.phone   || '').trim(),
      email:     (body.email   || '').trim(),
      project:   (body.project || '').trim(),
      budget:    (body.budget  || '').trim(),
      message:   (body.message || '').trim(),
      source:    body.source || 'site',
      status:    'novo',
      notes:     '',
      createdAt: new Date().toISOString(),
    };
    leads.push(lead);
    writeLeads(leads);
    console.log(`[LEAD] ${lead.id} — ${lead.name} — ${lead.phone}`);
    return sendJSON(res, 201, { ok: true, id: lead.id });
  }

  // ── API: GET /api/leads (admin) ───────────────────────
  if (pathname === '/api/leads' && method === 'GET') {
    if (!isAdminAuth(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
    return sendJSON(res, 200, readLeads());
  }

  // ── API: PATCH /api/leads/:id ─────────────────────────
  if (pathname.startsWith('/api/leads/') && method === 'PATCH') {
    if (!isAdminAuth(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
    const id    = pathname.replace('/api/leads/', '');
    const body  = await parseBody(req);
    const leads = readLeads();
    const idx   = leads.findIndex(l => l.id === id);
    if (idx === -1) return sendJSON(res, 404, { error: 'Lead não encontrado' });
    leads[idx] = { ...leads[idx], ...body, id, updatedAt: new Date().toISOString() };
    writeLeads(leads);
    return sendJSON(res, 200, leads[idx]);
  }

  // ── API: DELETE /api/leads/:id ────────────────────────
  if (pathname.startsWith('/api/leads/') && method === 'DELETE') {
    if (!isAdminAuth(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
    const id    = pathname.replace('/api/leads/', '');
    const leads = readLeads().filter(l => l.id !== id);
    writeLeads(leads);
    return sendJSON(res, 200, { ok: true });
  }

  // ── API: POST /api/pixel (FB Conversions API proxy) ───
  if (pathname === '/api/pixel' && method === 'POST') {
    const body = await parseBody(req);
    const { pixelId, accessToken, events } = body;

    if (!pixelId || !accessToken || !events) {
      return sendJSON(res, 400, { error: 'pixelId, accessToken e events são obrigatórios' });
    }

    try {
      const https = require('https');
      const payload = JSON.stringify({ data: events });
      const fbPath  = `/v18.0/${pixelId}/events?access_token=${accessToken}`;

      const fbReq = https.request({
        hostname: 'graph.facebook.com',
        path: fbPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      }, fbRes => {
        let fbBody = '';
        fbRes.on('data', c => fbBody += c);
        fbRes.on('end', () => {
          try {
            const parsed = JSON.parse(fbBody);
            sendJSON(res, fbRes.statusCode, parsed);
          } catch {
            sendJSON(res, 200, { ok: true });
          }
        });
      });

      fbReq.on('error', err => {
        console.error('[PIXEL]', err.message);
        sendJSON(res, 500, { error: err.message });
      });

      fbReq.write(payload);
      fbReq.end();
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ── Serve arquivos estáticos ──────────────────────────
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Se não tem extensão, tenta .html
  if (!path.extname(filePath)) {
    const withHtml = filePath + '.html';
    if (fs.existsSync(withHtml)) filePath = withHtml;
  }

  serveStatic(req, res, filePath);
});

server.listen(PORT, () => {
  console.log(`🚀 Lança.dev rodando em http://localhost:${PORT}`);
  console.log(`🔐 Admin: http://localhost:${PORT}/admin-login.html`);
});
