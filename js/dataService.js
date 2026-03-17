// ══════════════════════════════════════════════════════
//  Lança.dev — dataService.js
//  Abstração de dados: localStorage (quotes) + API (leads)
// ══════════════════════════════════════════════════════

const ADMIN_KEY = 'lanca2025';

const DS = {
  _keys: {
    quotes:  'lancaOrcamentos',
    config:  'lancaConfig',
  },

  // ── Config ──────────────────────────────────────────
  getConfig() {
    const defaults = {
      fbPixelId: '', fbAccessToken: '', gtmId: '',
      whatsapp: '5521986829331', adminPass: ADMIN_KEY,
    };
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(this._keys.config) || '{}') };
    } catch { return defaults; }
  },

  saveConfig(cfg) {
    localStorage.setItem(this._keys.config, JSON.stringify(cfg));
  },

  // ── Leads (via API) ──────────────────────────────────
  async getLeads() {
    try {
      const res = await fetch('/api/leads', {
        headers: { 'X-Admin-Key': ADMIN_KEY },
      });
      if (!res.ok) throw new Error('Unauthorized');
      return await res.json();
    } catch (e) {
      console.error('[DS] getLeads:', e.message);
      return [];
    }
  },

  async updateLead(id, data) {
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteLead(id) {
    await fetch(`/api/leads/${id}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });
  },

  // ── Quotes (localStorage) ────────────────────────────
  getQuotes() {
    try { return JSON.parse(localStorage.getItem(this._keys.quotes) || '[]'); }
    catch { return []; }
  },

  saveQuotes(quotes) {
    localStorage.setItem(this._keys.quotes, JSON.stringify(quotes));
  },

  generateQuoteId() {
    const all  = this.getQuotes();
    const year = new Date().getFullYear();
    const num  = String(all.length + 1).padStart(3, '0');
    return `ORC-${year}-${num}`;
  },

  getQuoteById(id) {
    return this.getQuotes().find(q => q.id === id) || null;
  },

  saveQuote(quote) {
    const all = this.getQuotes();
    const idx = all.findIndex(q => q.id === quote.id);
    if (idx >= 0) {
      all[idx] = { ...quote, updatedAt: new Date().toISOString() };
    } else {
      all.push({ ...quote, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.saveQuotes(all);
    return quote;
  },

  deleteQuote(id) {
    this.saveQuotes(this.getQuotes().filter(q => q.id !== id));
  },

  // ── Stats ────────────────────────────────────────────
  async getStats() {
    const [leads, quotes] = await Promise.all([this.getLeads(), this.getQuotes()]);
    const now  = new Date();
    const month = now.getMonth();
    const year  = now.getFullYear();

    const paidQuotes  = quotes.filter(q => q.status === 'pago');
    const faturamento = paidQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
    const conversion  = leads.length > 0
      ? Math.round((paidQuotes.length / leads.length) * 100)
      : 0;

    return {
      totalLeads:    leads.length,
      newLeads:      leads.filter(l => l.status === 'novo').length,
      totalQuotes:   quotes.length,
      pendingQuotes: quotes.filter(q => q.status === 'pendente').length,
      faturamento,
      conversion,
      leads,
      quotes,
    };
  },
};
