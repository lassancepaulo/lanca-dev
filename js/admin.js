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
function drawLancaLogo(doc, x, y, size) {
  // Logo G1: diamante/lança apontando pra cima
  // Escala baseada no SVG original viewBox="0 0 44 100"
  // Pontos: topo(22,2) direita(34,72) ponta-baixo(22,82) esquerda(10,72)
  const sx = size / 24;   // largura span = 34-10 = 24
  const sy = size * 2 / 80; // altura span = 82-2 = 80, ratio 2:1
  // Centraliza: ponto topo = x, y
  doc.setFillColor(255, 77, 0);
  doc.lines(
    [
      [12 * sx,  70 * sy],   // topo → direita
      [-12 * sx,  10 * sy],  // direita → ponta-baixo
      [-12 * sx, -10 * sy],  // ponta-baixo → esquerda
      [ 12 * sx, -70 * sy],  // esquerda → topo
    ],
    x, y, [1, 1], 'F', true
  );
}

function pdfSectionLabel(doc, label, y, W) {
  const ORA = [255, 77, 0];
  // Barra laranja lateral
  doc.setFillColor(...ORA);
  doc.rect(14, y - 4, 2.5, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...ORA);
  doc.text(label, 19, y);
}

function generatePDF(quote) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // ── Paleta ──
  const ORA   = [255, 77, 0];
  const DARK  = [10, 10, 10];
  const DARK2 = [22, 22, 22];
  const GRAY  = [100, 100, 100];
  const LGRAY = [220, 220, 220];
  const WHITE = [255, 255, 255];
  const OFFWH = [248, 248, 248];

  // ════════════════════════════════════════
  // HEADER PREMIUM
  // ════════════════════════════════════════
  // Fundo escuro principal
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 52, 'F');

  // Faixa laranja sutil na base do header
  doc.setFillColor(...ORA);
  doc.rect(0, 50, W, 2, 'F');

  // Barra de destaque lateral esquerda
  doc.setFillColor(...ORA);
  doc.rect(0, 0, 4, 52, 'F');

  // ── Logo G1 (diamante lança) ──
  drawLancaLogo(doc, 18, 13, 5);

  // ── Marca "lança.dev" ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...WHITE);
  doc.text('lan\u00e7a', 27, 26);
  doc.setTextColor(...ORA);
  const lancaW = doc.getTextWidth('lan\u00e7a');
  doc.text('.dev', 27 + lancaW, 26);

  // Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text('Projetos digitais que acertam no alvo.', 27, 33);

  // ── Badge "PROPOSTA COMERCIAL" ──
  doc.setFillColor(...ORA);
  doc.roundedRect(27, 37, 52, 8, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text('PROPOSTA COMERCIAL', 53, 42.5, { align: 'center' });

  // ── Número e data (direita) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...ORA);
  doc.text(quote.id || 'ORC-2026-001', W - 12, 24, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  const dataEmissao = fmtDate(quote.createdAt || new Date().toISOString());
  doc.text(`Emitido em ${dataEmissao}`, W - 12, 31, { align: 'right' });

  if (quote.deadline) {
    doc.text(`Prazo: ${fmtDate(quote.deadline)}`, W - 12, 37, { align: 'right' });
  }

  // ════════════════════════════════════════
  // BLOCO DO CLIENTE — 2 colunas
  // ════════════════════════════════════════
  let y = 62;
  pdfSectionLabel(doc, 'DADOS DO CLIENTE', y, W);
  y += 6;

  // Fundo sutil
  doc.setFillColor(...OFFWH);
  doc.roundedRect(14, y - 2, W - 28, 34, 1.5, 1.5, 'F');
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y - 2, W - 28, 34, 1.5, 1.5, 'S');

  const colL = 18;
  const colR = W / 2 + 4;
  const colW = W / 2 - 22;

  const clientLeft  = [
    ['NOME',     quote.clientName  || '—'],
    ['WHATSAPP', quote.clientPhone || '—'],
    ['E-MAIL',   quote.clientEmail || '—'],
  ];
  const clientRight = [
    ['TIPO DE PROJETO', PROJECT_TYPES[quote.projectType] || quote.projectType || '—'],
    ['PAGAMENTO',       (quote.paymentMethod || 'PIX').replace(/_/g,' ')],
    ['STATUS',          QUOTE_STATUS[quote.status]?.label || quote.status || '—'],
  ];

  const drawClientPair = (pairs, xBase) => {
    let cy = y + 5;
    pairs.forEach(([label, val]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...GRAY);
      doc.text(label, xBase, cy);
      cy += 3.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...DARK);
      const wrapped = doc.splitTextToSize(val, colW);
      doc.text(wrapped, xBase, cy);
      cy += wrapped.length * 4.5 + 2;
    });
  };

  drawClientPair(clientLeft,  colL);
  drawClientPair(clientRight, colR);

  // Divisor vertical entre colunas
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.3);
  doc.line(W / 2 + 1, y + 2, W / 2 + 1, y + 30);

  y += 42;

  // ════════════════════════════════════════
  // TABELA DE ITENS
  // ════════════════════════════════════════
  pdfSectionLabel(doc, 'ITENS DO ORÇAMENTO', y, W);
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
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
      textColor: DARK,
      lineColor: LGRAY,
      lineWidth: 0,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 5, right: 4, bottom: 5, left: 4 },
    },
    bodyStyles: {
      fillColor: WHITE,
      lineWidth: 0,
    },
    alternateRowStyles: {
      fillColor: OFFWH,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 36, halign: 'right' },
      3: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Linha laranja topo da tabela
      doc.setFillColor(...ORA);
      doc.rect(14, data.settings.startY - 0.5, W - 28, 1, 'F');
    },
    didDrawCell: (data) => {
      if (data.section === 'head' && data.column.index === 0) {
        // Acento laranja no cabeçalho esquerdo
        doc.setFillColor(...ORA);
        doc.rect(data.cell.x, data.cell.y, 2.5, data.cell.height, 'F');
      }
    },
  });

  y = doc.lastAutoTable.finalY;

  // Linha base da tabela
  doc.setFillColor(...ORA);
  doc.rect(14, y, W - 28, 0.8, 'F');
  y += 8;

  // ════════════════════════════════════════
  // TOTAIS
  // ════════════════════════════════════════
  const _items    = quote.items || [];
  const _subtotal = typeof quote.subtotal === 'number'
    ? quote.subtotal
    : _items.reduce((s, i) => s + (i.qty || 1) * (i.unitPrice || i.price || 0), 0);
  const _discount = parseFloat(quote.discount) || 0;
  const _total    = typeof quote.total === 'number'
    ? quote.total
    : Math.max(0, _subtotal - _discount);

  // Subtotal e desconto
  const totalsX = W - 78;
  const totalsW = 64;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text('Subtotal', totalsX, y);
  doc.setTextColor(...DARK);
  doc.text(fmtMoney(_subtotal), W - 14, y, { align: 'right' });
  y += 6;

  if (_discount > 0) {
    doc.setTextColor(...GRAY);
    doc.text('Desconto', totalsX, y);
    doc.setTextColor(180, 60, 0);
    doc.text(`- ${fmtMoney(_discount)}`, W - 14, y, { align: 'right' });
    y += 6;
  }

  // Bloco TOTAL invertido (dark bg, laranja)
  y += 2;
  doc.setFillColor(...DARK);
  doc.roundedRect(totalsX - 4, y - 5, totalsW + 4, 14, 2, 2, 'F');
  doc.setFillColor(...ORA);
  doc.rect(totalsX - 4, y - 5, 3, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text('TOTAL', totalsX + 2, y + 1);
  doc.setFontSize(13);
  doc.setTextColor(...ORA);
  doc.text(fmtMoney(_total), W - 14, y + 4, { align: 'right' });
  y += 18;

  // ════════════════════════════════════════
  // OBSERVAÇÕES
  // ════════════════════════════════════════
  if (quote.notes) {
    if (y > H - 50) { doc.addPage(); y = 20; }
    pdfSectionLabel(doc, 'OBSERVAÇÕES', y, W);
    y += 6;
    doc.setFillColor(...OFFWH);
    const notesLines = doc.splitTextToSize(quote.notes, W - 32);
    const notesH = notesLines.length * 5 + 8;
    doc.roundedRect(14, y - 3, W - 28, notesH, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(notesLines, 19, y + 2);
    y += notesH + 8;
  }

  // ════════════════════════════════════════
  // O QUE ESTÁ INCLUÍDO
  // ════════════════════════════════════════
  const bullets = getProjectBullets(quote.projectType);
  if (bullets.length > 0) {
    if (y > H - 70) { doc.addPage(); y = 20; }
    pdfSectionLabel(doc, 'O QUE ESTÁ INCLUÍDO', y, W);
    y += 8;

    bullets.forEach((b, idx) => {
      if (y > H - 22) { doc.addPage(); y = 20; }
      // Fundo alternado
      if (idx % 2 === 0) {
        doc.setFillColor(...OFFWH);
        doc.rect(14, y - 4, W - 28, 8, 'F');
      }
      // Ícone checkmark (losango laranja mini)
      doc.setFillColor(...ORA);
      doc.rect(16, y - 2, 2.5, 2.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...DARK);
      const lines = doc.splitTextToSize(b, W - 38);
      doc.text(lines, 22, y);
      y += lines.length * 5 + 2;
    });
    y += 4;
  }

  // ════════════════════════════════════════
  // FOOTER
  // ════════════════════════════════════════
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Barra footer escura
    doc.setFillColor(...DARK);
    doc.rect(0, H - 20, W, 20, 'F');
    doc.setFillColor(...ORA);
    doc.rect(0, H - 20, 4, 20, 'F');

    // Logo mini no footer
    drawLancaLogo(doc, 11, H - 15, 2.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...WHITE);
    doc.text('lan\u00e7a.dev', 16, H - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 130);
    doc.text('WhatsApp: (21) 98682-9331  ·  lanca.dev', 16, H - 7);

    doc.setTextColor(130, 130, 130);
    doc.text(`${i} / ${pageCount}`, W - 12, H - 9, { align: 'right' });
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
