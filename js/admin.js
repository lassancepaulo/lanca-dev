// ══════════════════════════════════════════════════════
//  Lança.dev — admin.js
//  Auth, utilitários, PDF, toast
// ══════════════════════════════════════════════════════

// ── Auth ──────────────────────────────────────────────
function requireAuth() {
  if (sessionStorage.getItem('lancaAdmin') !== 'true') {
    window.location.href = '../admin-login.html';
  }
}

function logout() {
  sessionStorage.removeItem('lancaAdmin');
  window.location.href = '../admin-login.html';
}

// ── Toast ─────────────────────────────────────────────
function showToast(msg, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
  t.innerHTML = `<i class="fas ${icon}"></i> ${msg}`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Format ────────────────────────────────────────────
function fmtMoney(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtPhone(p) {
  return p ? `+55${p.replace(/\D/g, '')}` : '';
}

// ── Status labels ─────────────────────────────────────
const LEAD_STATUS = {
  novo:        { label: 'Novo',        cls: 'badge-novo' },
  em_contato:  { label: 'Em contato',  cls: 'badge-em_contato' },
  proposta:    { label: 'Proposta',    cls: 'badge-proposta' },
  fechado:     { label: 'Fechado',     cls: 'badge-fechado' },
  perdido:     { label: 'Perdido',     cls: 'badge-perdido' },
};

const QUOTE_STATUS = {
  pendente:   { label: 'Pendente',   cls: 'badge-pendente' },
  aprovado:   { label: 'Aprovado',   cls: 'badge-aprovado' },
  pago:       { label: 'Pago',       cls: 'badge-pago' },
  cancelado:  { label: 'Cancelado',  cls: 'badge-cancelado' },
};

const PROJECT_TYPES = {
  site_institucional: 'Site Institucional',
  landing_page:       'Landing Page',
  sistema_web:        'Sistema Web',
  app_mobile:         'App Mobile',
  ecommerce:          'E-commerce',
  agente_ia:          'Agente de IA',
  chatbot:            'Chatbot',
  automacao:          'Automação',
  marketing_digital:  'Marketing Digital',
  outro:              'Outro',
};

function statusBadge(status, map) {
  const m = map || QUOTE_STATUS;
  const s = m[status] || { label: status || '—', cls: '' };
  return `<span class="badge ${s.cls}">${s.label}</span>`;
}

// ── Confirm dialog ────────────────────────────────────
function confirmDialog(msg, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:380px">
      <div class="modal-header">
        <h3><i class="fas fa-exclamation-triangle text-orange" style="margin-right:8px"></i>Confirmação</h3>
      </div>
      <div class="modal-body"><p>${msg}</p></div>
      <div class="modal-footer">
        <button class="btn btn-outline btn-sm" id="cancelBtn">Cancelar</button>
        <button class="btn btn-primary btn-sm" id="confirmBtn">Confirmar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancelBtn').onclick = () => overlay.remove();
  overlay.querySelector('#confirmBtn').onclick = () => { overlay.remove(); onConfirm(); };
}

// ── PDF Generation ────────────────────────────────────
function generatePDF(quote) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const ORA  = [255, 77, 0];
  const DARK = [10, 10, 10];
  const GRAY = [80, 80, 80];
  const LGRAY= [200, 200, 200];

  // ── Header background ──
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 42, 'F');

  // ── Logo icon (triângulo estilizado) ──
  doc.setFillColor(...ORA);
  doc.triangle(14, 32, 18, 14, 22, 32, 'F');

  // ── Marca ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('lança', 26, 27);
  doc.setTextColor(...ORA);
  doc.text('.dev', 26 + doc.getTextWidth('lança'), 27);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text('Seu projeto digital no ar em dias.', 26, 33);

  // ── Número do orçamento ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...ORA);
  doc.text(`ORÇAMENTO ${quote.id}`, W - 14, 22, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Emitido em ${fmtDate(quote.createdAt || new Date().toISOString())}`, W - 14, 28, { align: 'right' });

  // ── Linha separadora ──
  doc.setDrawColor(...ORA);
  doc.setLineWidth(0.5);
  doc.line(14, 44, W - 14, 44);

  // ── Info do cliente ──
  let y = 54;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...ORA);
  doc.text('DADOS DO CLIENTE', 14, y);

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);

  const clientInfo = [
    ['Nome',    quote.clientName  || '—'],
    ['WhatsApp',quote.clientPhone || '—'],
    ['E-mail',  quote.clientEmail || '—'],
    ['Projeto', PROJECT_TYPES[quote.projectType] || quote.projectType || '—'],
    ['Status',  QUOTE_STATUS[quote.status]?.label || quote.status],
    ['Pagamento', quote.paymentMethod?.replace(/_/g,' ') || '—'],
  ];

  clientInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY);
    doc.text(`${label}:`, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    doc.text(value, 55, y);
    y += 6;
  });

  // ── Tabela de itens ──
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...ORA);
  doc.text('ITENS DO ORÇAMENTO', 14, y);
  y += 4;

  const tableRows = (quote.items || []).map(item => [
    item.description || item.desc || '',
    String(item.qty || 1),
    fmtMoney(item.unitPrice || item.price || 0),
    fmtMoney((item.qty || 1) * (item.unitPrice || item.price || 0)),
  ]);

  doc.autoTable({
    startY: y,
    head: [['Descrição', 'Qtd.', 'Valor Unit.', 'Total']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 4,
      textColor: DARK,
      lineColor: LGRAY,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: ORA,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 6;

  // ── Calcula totais a partir dos itens (fallback se não vieram no objeto) ──
  const _items    = quote.items || [];
  const _subtotal = typeof quote.subtotal === 'number'
    ? quote.subtotal
    : _items.reduce((s, i) => s + (i.qty || 1) * (i.unitPrice || i.price || 0), 0);
  const _discount = parseFloat(quote.discount) || 0;
  const _total    = typeof quote.total === 'number'
    ? quote.total
    : Math.max(0, _subtotal - _discount);

  // ── Totais ──
  const totals = [
    ['Subtotal',  fmtMoney(_subtotal)],
    ['Desconto',  `- ${fmtMoney(_discount)}`],
  ];

  totals.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(label, W - 60, y);
    doc.text(value, W - 14, y, { align: 'right' });
    y += 6;
  });

  // Total final
  doc.setDrawColor(...ORA);
  doc.setLineWidth(0.3);
  doc.line(W - 65, y - 2, W - 14, y - 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...ORA);
  doc.text('TOTAL', W - 60, y + 4);
  doc.text(fmtMoney(_total), W - 14, y + 4, { align: 'right' });

  y += 14;

  // ── Observações ──
  if (quote.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...ORA);
    doc.text('OBSERVAÇÕES', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    const lines = doc.splitTextToSize(quote.notes, W - 28);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 6;
  }

  // ── Bullets do tipo de projeto ──
  const bullets = getProjectBullets(quote.projectType);
  if (bullets.length > 0) {
    if (y > H - 60) { doc.addPage(); y = 20; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...ORA);
    doc.text('O QUE ESTÁ INCLUÍDO', 14, y);
    y += 6;

    bullets.forEach(b => {
      if (y > H - 20) { doc.addPage(); y = 20; }
      doc.setFillColor(...ORA);
      doc.circle(16, y - 1.5, 1, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...DARK);
      const lines = doc.splitTextToSize(b, W - 34);
      doc.text(lines, 20, y);
      y += lines.length * 5 + 2;
    });
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...DARK);
    doc.rect(0, H - 18, W, 18, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('lança.dev  |  WhatsApp: +55 21 98682-9331  |  lanca.dev', 14, H - 7);
    doc.text(`Pág. ${i}/${pageCount}`, W - 14, H - 7, { align: 'right' });
  }

  const fname = `Orcamento_${quote.id}_${(quote.clientName || 'cliente').replace(/\s+/g,'_')}.pdf`;
  doc.save(fname);
  showToast('PDF gerado com sucesso!');
}

function getProjectBullets(type) {
  const map = {
    site_institucional: [
      'Design moderno, responsivo e otimizado para todos os dispositivos',
      'Até 5 seções: Hero, Sobre, Serviços, Depoimentos e Contato',
      'Formulário de contato integrado ao WhatsApp',
      'SEO on-page básico (metatags, títulos, descrições)',
      'Velocidade de carregamento otimizada',
      'Entrega do código-fonte completo',
    ],
    landing_page: [
      'Página focada em conversão com CTA estratégico',
      'Design persuasivo com elementos de prova social',
      'Formulário de captura de leads integrado',
      'Pixel do Facebook e Google Tag Manager configurados',
      'Testes A/B prontos para aplicar',
      'Responsivo para mobile e desktop',
    ],
    sistema_web: [
      'Sistema web com login e controle de acesso',
      'Dashboard administrativo completo',
      'CRUD de dados com banco de dados',
      'API RESTful documentada',
      'Deploy em servidor cloud',
      'Treinamento de uso incluso',
    ],
    app_mobile: [
      'App nativo ou híbrido (Android/iOS)',
      'Design de UX/UI personalizado',
      'Integração com APIs externas',
      'Publicação nas stores (Play Store / App Store)',
      'Notificações push',
      'Suporte pós-lançamento por 30 dias',
    ],
    agente_ia: [
      'Agente de IA treinado com dados do seu negócio',
      'Integração com WhatsApp, Telegram ou site',
      'Fluxos de conversa personalizados',
      'Dashboard de monitoramento',
      'Handoff para humano quando necessário',
      'Relatório mensal de desempenho',
    ],
    chatbot: [
      'Chatbot com respostas automáticas 24/7',
      'Integração com WhatsApp Business API',
      'Fluxos de atendimento personalizados',
      'Captura automática de leads',
      'Relatórios de conversas',
      'Setup e treinamento da equipe',
    ],
    automacao: [
      'Mapeamento e automação do processo atual',
      'Integração entre ferramentas (CRM, e-mail, planilhas)',
      'Gatilhos automáticos por evento',
      'Redução de tarefas manuais',
      'Documentação do fluxo',
      'Suporte e ajustes por 30 dias',
    ],
    ecommerce: [
      'Loja virtual completa com catálogo de produtos',
      'Integração com gateways de pagamento (Pix, cartão)',
      'Gestão de estoque e pedidos',
      'Carrinho de compras e checkout otimizado',
      'Integração com marketplaces (opcional)',
      'SEO para produtos',
    ],
    marketing_digital: [
      'Estratégia de marketing digital personalizada',
      'Criação e gestão de campanhas (Meta Ads / Google Ads)',
      'Relatórios mensais de performance',
      'Otimização contínua de ROI',
      'Criação de criativos (imagens e vídeos)',
      'Gestão de redes sociais',
    ],
    outro: [
      'Escopo definido conforme briefing aprovado',
      'Entrega dentro do prazo combinado',
      'Revisões incluídas conforme contrato',
      'Código-fonte entregue ao cliente',
      'Suporte pós-entrega',
    ],
  };
  return map[type] || map.outro;
}

// ── Sidebar active link ───────────────────────────────
function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === path.split('/').pop());
  });
}

document.addEventListener('DOMContentLoaded', setActiveNav);
