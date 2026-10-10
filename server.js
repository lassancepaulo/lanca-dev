// ══════════════════════════════════════════════════════
//  Lança.dev — Server
//  Node.js puro: arquivos estáticos + API de leads + Pixel proxy
// ══════════════════════════════════════════════════════
const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const url    = require('url');
const crypto = require('crypto');

const PORT         = process.env.PORT || 3030;
const DATA_DIR     = process.env.DATA_DIR || path.join(__dirname, 'data');
const LEADS_FILE       = path.join(DATA_DIR, 'leads.json');
const GUIA_LEADS_FILE  = path.join(DATA_DIR, 'guia-leads.json');
const ROOT             = path.resolve(__dirname);

// ── Admin key — sem padrão ────────────────────────────
const ADMIN_KEY_ENV = process.env.ADMIN_KEY || null;
if (!ADMIN_KEY_ENV) {
  console.warn('[SECURITY] ADMIN_KEY não definida — rotas de admin responderão 503');
}

// ── Garante que data/ existe ──────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, '[]', 'utf8');
if (!fs.existsSync(GUIA_LEADS_FILE)) fs.writeFileSync(GUIA_LEADS_FILE, '[]', 'utf8');

// ── MIME types ────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.pdf':  'application/pdf',
  '.webp': 'image/webp',
};

// Extensões permitidas para arquivos estáticos
const ALLOWED_EXTENSIONS = new Set([...Object.keys(MIME), '.webp']);

// Prefixos/arquivos bloqueados (relativos ao ROOT)
const BLOCKED = [
  'data',
  'node_modules',
  'server.js',
  'package.json',
  'package-lock.json',
  'Procfile',
  '.npmrc',
];

// ── Cabeçalhos de segurança ───────────────────────────
function addSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  // 'unsafe-inline' necessário para scripts inline do site atual
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "img-src 'self' data:; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "script-src 'self' 'unsafe-inline'; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none'"
  );
}

// ── Admin auth com timing-safe compare ───────────────
function isAdminAuth(req) {
  if (!ADMIN_KEY_ENV) return false;
  const provided = (req.headers['x-admin-key'] || '');
  try {
    // Buffers de mesmo comprimento para timingSafeEqual
    const len = Math.max(provided.length, ADMIN_KEY_ENV.length, 32);
    const a = Buffer.alloc(len);
    const b = Buffer.alloc(len);
    Buffer.from(provided).copy(a);
    Buffer.from(ADMIN_KEY_ENV).copy(b);
    return crypto.timingSafeEqual(a, b) && provided.length === ADMIN_KEY_ENV.length;
  } catch {
    return false;
  }
}

// ── Rate limiter em memória por IP ────────────────────
const rateStore = new Map();

function getClientIP(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateStore.get(ip);
  if (!entry) {
    entry = { min: { count: 0, ts: now }, hour: { count: 0, ts: now } };
  }
  if (now - entry.min.ts  > 60000)    entry.min  = { count: 0, ts: now };
  if (now - entry.hour.ts > 3600000)  entry.hour = { count: 0, ts: now };
  entry.min.count++;
  entry.hour.count++;
  rateStore.set(ip, entry);
  return entry.min.count <= 5 && entry.hour.count <= 30;
}

// Limpeza periódica do rate store (evita vazamento de memória)
setInterval(() => {
  const cutoff = Date.now() - 3600000 * 2;
  for (const [ip, entry] of rateStore) {
    if (entry.hour.ts < cutoff) rateStore.delete(ip);
  }
}, 3600000);

// ── Persistência: escrita atômica serializada ─────────
let writeQueue = Promise.resolve();

function readLeads() {
  try { return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8')); }
  catch { return []; }
}

function writeLeads(leads) {
  writeQueue = writeQueue.then(() => new Promise((resolve, reject) => {
    const tmp = LEADS_FILE + '.tmp';
    fs.writeFile(tmp, JSON.stringify(leads, null, 2), 'utf8', err => {
      if (err) { console.error('[WRITE]', err); return reject(err); }
      fs.rename(tmp, LEADS_FILE, err2 => {
        if (err2) { console.error('[RENAME]', err2); return reject(err2); }
        resolve();
      });
    });
  }));
  return writeQueue;
}

function generateLeadId(leads) {
  const year = new Date().getFullYear();
  const num  = String(leads.length + 1).padStart(3, '0');
  return `LEAD-${year}-${num}`;
}

// ── Helpers guia-leads ────────────────────────────────
function readGuiaLeads() {
  try { return JSON.parse(fs.readFileSync(GUIA_LEADS_FILE, 'utf8')); }
  catch { return []; }
}

let writeGuiaQueue = Promise.resolve();
function writeGuiaLeads(leads) {
  writeGuiaQueue = writeGuiaQueue.then(() => new Promise((resolve, reject) => {
    const tmp = GUIA_LEADS_FILE + '.tmp';
    fs.writeFile(tmp, JSON.stringify(leads, null, 2), 'utf8', err => {
      if (err) { console.error('[WRITE GUIA]', err); return reject(err); }
      fs.rename(tmp, GUIA_LEADS_FILE, err2 => {
        if (err2) { console.error('[RENAME GUIA]', err2); return reject(err2); }
        resolve();
      });
    });
  }));
  return writeGuiaQueue;
}

function generateGuiaId(leads) {
  const year = new Date().getFullYear();
  // ID sequencial independente do tamanho (usa o maior número já existente)
  let max = 0;
  for (const l of leads) {
    const m = l.id && l.id.match(/^GUIA-\d{4}-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `GUIA-${year}-${String(max + 1).padStart(3, '0')}`;
}

function hashIP(ip) {
  // Hash com sal fixo — identifica padrões sem guardar IP bruto
  return crypto.createHash('sha256').update('lanca.dev:' + ip).digest('hex').slice(0, 16);
}

// Validação do body do guia
const STR_UTM = (v) => typeof v === 'string' && v.length <= 200;

function validateGuiaBody(body) {
  if (!body) return 'Corpo inválido';
  const { nome, email, whatsapp, consentimento, consentimento_texto, origem_utm, referrer, pagina } = body;
  if (!nome || typeof nome !== 'string' || nome.trim().replace(/[^A-Za-zÀ-ÿ]/g, '').length < 2 || nome.length > 120)
    return 'Nome inválido';
  if (!email || !EMAIL_RE.test(email) || email.length > 254)
    return 'E-mail inválido';
  if (!whatsapp || typeof whatsapp !== 'string' || !/^55\d{10,11}$/.test(whatsapp))
    return 'WhatsApp inválido (formato: 55DDD9XXXXXXXX)';
  if (consentimento !== true)
    return 'Consentimento obrigatório';
  if (consentimento_texto && (typeof consentimento_texto !== 'string' || consentimento_texto.length > 1000))
    return 'consentimento_texto muito longo';
  if (origem_utm !== undefined) {
    if (typeof origem_utm !== 'object' || origem_utm === null) return 'origem_utm inválido';
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    for (const k of utmKeys) {
      if (origem_utm[k] !== undefined && !STR_UTM(origem_utm[k])) return `origem_utm.${k} inválido`;
    }
  }
  if (referrer !== undefined && (typeof referrer !== 'string' || referrer.length > 500))
    return 'referrer inválido';
  if (pagina !== undefined && (typeof pagina !== 'string' || pagina.length > 300))
    return 'pagina inválida';
  return null;
}

// ── parseBody com limite de tamanho ───────────────────
const MAX_BODY_BYTES = 20 * 1024; // 20 KB

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES && !tooLarge) {
        tooLarge = true;
        req.resume(); // drena sem acumular
      }
      if (!tooLarge) body += chunk;
    });
    req.on('end', () => {
      if (tooLarge) {
        return reject(Object.assign(new Error('Payload too large'), { code: 'PAYLOAD_TOO_LARGE' }));
      }
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve(null); }
    });
    req.on('error', reject);
  });
}

// ── Validação de campos ───────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateLeadBody(body) {
  if (!body) return 'Corpo inválido';
  const { name, phone, email, project, message } = body;
  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120)
    return 'Nome inválido (2–120 caracteres)';
  if (!phone || typeof phone !== 'string' || !/^\d{10,15}$/.test(phone))
    return 'WhatsApp inválido (somente dígitos, 10–15)';
  if (email && (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254))
    return 'E-mail inválido';
  if (project && (typeof project !== 'string' || project.length > 100))
    return 'Tipo de projeto inválido';
  if (message && (typeof message !== 'string' || message.length > 1000))
    return 'Mensagem muito longa (máx. 1000 caracteres)';
  return null;
}

// ── Helpers de resposta ───────────────────────────────
function sendJSON(res, status, data) {
  addSecurityHeaders(res);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function send404(res) {
  addSecurityHeaders(res);
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 — Página não encontrada');
}

function adminUnavailable(res) {
  addSecurityHeaders(res);
  res.writeHead(503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Admin indisponível: ADMIN_KEY não configurada' }));
}

// ── Serve arquivos estáticos com allowlist ────────────
function serveStatic(req, res, rawPath) {
  // 1. Decodifica e normaliza
  let decoded;
  try { decoded = decodeURIComponent(rawPath); }
  catch { return send404(res); }

  const resolved = path.resolve(ROOT, '.' + decoded);

  // 2. Path traversal: deve ficar dentro do ROOT
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) {
    return send404(res);
  }

  // 3. Caminho relativo ao ROOT para checagem de allowlist
  const relative = resolved.slice(ROOT.length).replace(/^[\\/]/, '').replace(/\\/g, '/');

  // 4. Bloqueia dotfiles e paths específicos
  const parts = relative.split('/');
  if (parts[0].startsWith('.')) return send404(res);
  if (BLOCKED.includes(parts[0])) return send404(res);

  // 5. Verifica extensão
  const ext = path.extname(resolved).toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) return send404(res);

  // 6. Lê e serve
  fs.readFile(resolved, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') return send404(res);
      addSecurityHeaders(res);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('500 — Erro interno');
    }
    const mime = MIME[ext] || 'application/octet-stream';
    addSecurityHeaders(res);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

// ── HTTP Server ───────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method   = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    addSecurityHeaders(res);
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    });
    return res.end();
  }

  // ── API: POST /api/leads (form público) ─────────────
  if (pathname === '/api/leads' && method === 'POST') {
    const ip = getClientIP(req);
    if (!checkRateLimit(ip)) {
      return sendJSON(res, 429, { error: 'Muitas requisições. Tente novamente em breve.' });
    }

    let body;
    try { body = await parseBody(req); }
    catch (err) {
      if (err.code === 'PAYLOAD_TOO_LARGE')
        return sendJSON(res, 413, { error: 'Corpo da requisição muito grande' });
      return sendJSON(res, 400, { error: 'Requisição inválida' });
    }

    const validationError = validateLeadBody(body);
    if (validationError) return sendJSON(res, 400, { error: validationError });

    const leads = readLeads();
    const lead  = {
      id:        generateLeadId(leads),
      name:      body.name.trim(),
      phone:     body.phone.trim(),
      email:     (body.email   || '').trim(),
      project:   (body.project || '').trim(),
      message:   (body.message || '').trim(),
      source:    typeof body.source === 'string' ? body.source.slice(0, 50) : 'site',
      status:    'novo',
      notes:     '',
      createdAt: new Date().toISOString(),
    };
    leads.push(lead);
    await writeLeads(leads);
    console.log(`[LEAD] ${lead.id} — ${lead.name} — ${lead.phone}`);
    return sendJSON(res, 201, { ok: true, id: lead.id });
  }

  // ── API: GET /api/leads (admin) ──────────────────────
  if (pathname === '/api/leads' && method === 'GET') {
    if (!ADMIN_KEY_ENV) return adminUnavailable(res);
    if (!isAdminAuth(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
    return sendJSON(res, 200, readLeads());
  }

  // ── API: PATCH /api/leads/:id ────────────────────────
  if (pathname.startsWith('/api/leads/') && method === 'PATCH') {
    if (!ADMIN_KEY_ENV) return adminUnavailable(res);
    if (!isAdminAuth(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
    const id = pathname.replace('/api/leads/', '');
    if (!id || id.includes('/')) return sendJSON(res, 400, { error: 'ID inválido' });

    let body;
    try { body = await parseBody(req); }
    catch { return sendJSON(res, 400, { error: 'Corpo inválido' }); }
    if (!body) return sendJSON(res, 400, { error: 'JSON inválido' });

    const leads = readLeads();
    const idx   = leads.findIndex(l => l.id === id);
    if (idx === -1) return sendJSON(res, 404, { error: 'Lead não encontrado' });

    // Permite atualizar apenas campos seguros
    const allowed = ['status', 'notes', 'name', 'phone', 'email', 'project', 'message'];
    const update  = {};
    for (const k of allowed) {
      if (body[k] !== undefined) update[k] = String(body[k]).slice(0, 1000);
    }
    leads[idx] = { ...leads[idx], ...update, id, updatedAt: new Date().toISOString() };
    await writeLeads(leads);
    return sendJSON(res, 200, leads[idx]);
  }

  // ── API: DELETE /api/leads/:id ───────────────────────
  if (pathname.startsWith('/api/leads/') && method === 'DELETE') {
    if (!ADMIN_KEY_ENV) return adminUnavailable(res);
    if (!isAdminAuth(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
    const id = pathname.replace('/api/leads/', '');
    if (!id || id.includes('/')) return sendJSON(res, 400, { error: 'ID inválido' });
    const leads = readLeads().filter(l => l.id !== id);
    await writeLeads(leads);
    return sendJSON(res, 200, { ok: true });
  }

  // ── API: POST /api/guia (formulário público) ─────────
  if (pathname === '/api/guia' && method === 'POST') {
    const ip = getClientIP(req);
    if (!checkRateLimit(ip)) {
      return sendJSON(res, 429, { error: 'Muitas requisições. Tente novamente em breve.' });
    }

    let body;
    try { body = await parseBody(req); }
    catch (err) {
      if (err.code === 'PAYLOAD_TOO_LARGE')
        return sendJSON(res, 413, { error: 'Corpo da requisição muito grande' });
      return sendJSON(res, 400, { error: 'Requisição inválida' });
    }

    const err = validateGuiaBody(body);
    if (err) return sendJSON(res, 400, { error: err });

    const leads = readGuiaLeads();
    const emailNorm = body.email.trim().toLowerCase();
    const existing  = leads.findIndex(l => l.email === emailNorm && l.whatsapp === body.whatsapp);

    if (existing !== -1) {
      // Atualiza último contato em vez de duplicar
      leads[existing].ultimoContato = new Date().toISOString();
      leads[existing].pagina        = body.pagina || leads[existing].pagina;
      await writeGuiaLeads(leads);
      console.log(`[GUIA] atualizado ${leads[existing].id}`);
      return sendJSON(res, 201, { ok: true, id: leads[existing].id });
    }

    const lead = {
      id:                 generateGuiaId(leads),
      nome:               body.nome.trim(),
      email:              emailNorm,
      whatsapp:           body.whatsapp,
      consentimento:      true,
      consentimento_texto:(body.consentimento_texto || '').slice(0, 1000),
      origem_utm:         body.origem_utm || {},
      referrer:           (body.referrer || '').slice(0, 500),
      pagina:             (body.pagina   || '').slice(0, 300),
      ipHash:             hashIP(ip),
      qualificacao:       null,
      criadoEm:           new Date().toISOString(),
      ultimoContato:      new Date().toISOString(),
    };
    leads.push(lead);
    await writeGuiaLeads(leads);
    console.log(`[GUIA] ${lead.id} — ${lead.nome}`);
    return sendJSON(res, 201, { ok: true });
  }

  // ── API: POST /api/guia/qualificacao ─────────────────
  if (pathname === '/api/guia/qualificacao' && method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch { return sendJSON(res, 400, { error: 'Requisição inválida' }); }
    if (!body) return sendJSON(res, 400, { error: 'JSON inválido' });

    const { email, whatsapp, tipo_negocio, faturamento_mensal, maior_dor } = body;
    if (!email || !whatsapp) return sendJSON(res, 400, { error: 'email e whatsapp obrigatórios' });

    const leads = readGuiaLeads();
    const idx   = leads.findIndex(l => l.email === email.toLowerCase() && l.whatsapp === whatsapp);
    if (idx === -1) {
      // Lead não encontrado — não cria, só avisa sem revelar dados
      return sendJSON(res, 200, { ok: true });
    }

    leads[idx].qualificacao = {
      tipo_negocio:      typeof tipo_negocio    === 'string' ? tipo_negocio.slice(0, 100)    : null,
      faturamento_mensal:typeof faturamento_mensal==='string'? faturamento_mensal.slice(0,50): null,
      maior_dor:         typeof maior_dor        === 'string' ? maior_dor.slice(0, 300)       : null,
      respondidoEm:      new Date().toISOString(),
    };
    leads[idx].ultimoContato = new Date().toISOString();
    await writeGuiaLeads(leads);
    return sendJSON(res, 200, { ok: true });
  }

  // ── API: GET /api/guia (admin) ────────────────────────
  if (pathname === '/api/guia' && method === 'GET') {
    if (!ADMIN_KEY_ENV) return adminUnavailable(res);
    if (!isAdminAuth(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
    return sendJSON(res, 200, readGuiaLeads());
  }

  // ── API: DELETE /api/guia/:id ─────────────────────────
  if (pathname.startsWith('/api/guia/') && method === 'DELETE') {
    if (!ADMIN_KEY_ENV) return adminUnavailable(res);
    if (!isAdminAuth(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
    const id = pathname.replace('/api/guia/', '');
    if (!id || id.includes('/') || id === 'qualificacao') return sendJSON(res, 400, { error: 'ID inválido' });
    const leads = readGuiaLeads().filter(l => l.id !== id);
    await writeGuiaLeads(leads);
    return sendJSON(res, 200, { ok: true });
  }

  // ── API: POST /api/pixel (requer admin) ──────────────
  if (pathname === '/api/pixel' && method === 'POST') {
    if (!ADMIN_KEY_ENV) return adminUnavailable(res);
    if (!isAdminAuth(req)) return sendJSON(res, 401, { error: 'Unauthorized' });

    let body;
    try { body = await parseBody(req); }
    catch { return sendJSON(res, 400, { error: 'Requisição inválida' }); }
    if (!body) return sendJSON(res, 400, { error: 'JSON inválido' });

    const { pixelId, accessToken, events } = body;
    if (!pixelId || !accessToken || !events) {
      return sendJSON(res, 400, { error: 'pixelId, accessToken e events são obrigatórios' });
    }

    try {
      const payload = JSON.stringify({ data: events });
      const fbPath  = `/v18.0/${pixelId}/events?access_token=${accessToken}`;

      const fbReq = https.request({
        hostname: 'graph.facebook.com',
        path:     fbPath,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, fbRes => {
        let fbBody = '';
        fbRes.on('data', c => fbBody += c);
        fbRes.on('end', () => {
          try { sendJSON(res, fbRes.statusCode, JSON.parse(fbBody)); }
          catch { sendJSON(res, 200, { ok: true }); }
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

  // ── Arquivos estáticos ────────────────────────────────
  let staticPath = pathname;

  // /guia (sem barra) → 301 /guia/
  if (staticPath === '/guia') {
    addSecurityHeaders(res);
    res.writeHead(301, { 'Location': '/guia/' });
    return res.end();
  }

  // Raiz e diretórios com barra final → index.html
  if (staticPath === '/' || staticPath.endsWith('/')) {
    staticPath = staticPath + 'index.html';
  }

  // /guia/obrigado ou /guia/privacidade (sem .html) → tenta .html
  if (!path.extname(staticPath)) {
    const withHtml = path.resolve(ROOT, '.' + staticPath + '.html');
    if (withHtml.startsWith(ROOT + path.sep) && fs.existsSync(withHtml)) {
      staticPath = staticPath + '.html';
    }
  }

  serveStatic(req, res, staticPath);
});

server.listen(PORT, () => {
  console.log(`Lança.dev rodando em http://localhost:${PORT}`);
  if (!ADMIN_KEY_ENV) {
    console.warn('[SECURITY] ADMIN_KEY não definida. Admin bloqueado.');
  }
});
