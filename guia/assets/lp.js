(function () {
  "use strict";
  var CFG = window.LP_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };

  function store(key, val) {
    try { if (val === undefined) { return sessionStorage.getItem(key); } sessionStorage.setItem(key, val); } catch (e) { /* sem storage */ }
    return null;
  }

  /* Meta Pixel: so carrega com metaPixelId preenchido */
  function loadPixel() {
    var id = (CFG.metaPixelId || "").replace(/\D/g, "");
    if (!id) { return; }
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq("init", id);
    window.fbq("track", "PageView");
  }
  function track(evt) { if (window.fbq) { try { window.fbq("track", evt); } catch (e) { /* ignora */ } } }

  /* UTMs e referrer: capturados na primeira pagina e guardados na sessao */
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  function origem() {
    var saved = null;
    try { saved = JSON.parse(store("lp_origem") || "null"); } catch (e) { saved = null; }
    if (saved) { return saved; }
    var p = new URLSearchParams(location.search);
    var utm = {};
    UTM_KEYS.forEach(function (k) { utm[k] = (p.get(k) || "").slice(0, 200); });
    var o = { utm: utm, referrer: (document.referrer || "").slice(0, 500) };
    store("lp_origem", JSON.stringify(o));
    return o;
  }

  /* Mensagens de erro ligadas aos campos */
  function setErr(input, msg) {
    var err = $("err-" + input.id);
    if (!err) { return; }
    err.textContent = msg || "";
    if (msg) { input.setAttribute("aria-invalid", "true"); } else { input.removeAttribute("aria-invalid"); }
  }

  /* POST JSON */
  function post(url, body) {
    var headers = { "Content-Type": "application/json", "Prefer": "return=minimal" };
    if (CFG.apikey) { headers.apikey = CFG.apikey; headers.Authorization = "Bearer " + CFG.apikey; }
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 15000) : null;
    return fetch(url, { method: "POST", headers: headers, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (timer) { clearTimeout(timer); } if (!r.ok) { throw new Error("HTTP " + r.status); } return true; },
        function (e) { if (timer) { clearTimeout(timer); } throw e; });
  }
  /* Envia (ou, sem endpoint, mostra no console). Resolve quando pode seguir. */
  function send(url, body, label) {
    if (!url) {
      console.log("[LP modo dev] " + label + " (nada foi enviado):", JSON.stringify(body, null, 2));
      return Promise.resolve(true);
    }
    return post(url, body);
  }

  /* WhatsApp: mascara e validacao */
  function digitsBR(v) {
    var d = String(v || "").replace(/\D/g, "");
    if (d.length > 11 && d.indexOf("55") === 0) { d = d.slice(2); }
    return d.slice(0, 11);
  }
  function maskPhone(v) {
    var d = digitsBR(v), out = "";
    if (d.length === 0) { return ""; }
    out = "(" + d.slice(0, 2);
    if (d.length > 2) { out += ") " + d.slice(2, d.length > 10 ? 7 : 6); }
    if (d.length > (d.length > 10 ? 7 : 6)) { out += "-" + d.slice(d.length > 10 ? 7 : 6); }
    return out;
  }
  function phoneOk(d) {
    if (!/^[1-9][1-9]\d{8,9}$/.test(d)) { return false; }
    return d.length === 10 ? /^[2-5]/.test(d.charAt(2)) || /^[6-9]/.test(d.charAt(2)) : d.charAt(2) === "9";
  }
  function emailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254; }
  function nameOk(v) { return (v.match(/[A-Za-zÀ-ÿ]/g) || []).length >= 2; }

  /* ---------- Pagina principal ---------- */
  function initLead() {
    var form = $("lead-form");
    if (!form) { return; }
    var nome = $("nome"), email = $("email"), zap = $("whatsapp"), ok = $("consent"), hp = $("empresa_site");
    var btn = $("lead-btn"), fe = $("form-error"), busy = false;

    zap.addEventListener("input", function () { zap.value = maskPhone(zap.value); });
    [nome, email, zap].forEach(function (el) { el.addEventListener("input", function () { setErr(el, ""); }); });
    ok.addEventListener("change", function () { setErr(ok, ""); });

    function validate() {
      var first = null, bad = function (el, m) { setErr(el, m); if (!first) { first = el; } };
      var n = nome.value.trim(), e = email.value.trim(), d = digitsBR(zap.value);
      setErr(nome, ""); setErr(email, ""); setErr(zap, ""); setErr(ok, "");
      if (!nameOk(n)) { bad(nome, "Digite seu nome (pelo menos 2 letras)."); }
      if (!emailOk(e)) { bad(email, "Digite um e-mail válido, como nome@email.com."); }
      if (!phoneOk(d)) { bad(zap, "Digite seu WhatsApp com DDD, por exemplo (11) 91234-5678."); }
      if (!ok.checked) { bad(ok, "Para receber o guia, marque a caixa de consentimento."); }
      if (first) { first.focus(); }
      return !first;
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (busy) { return; }
      fe.textContent = "";
      if (hp.value) { /* robo: finge sucesso e nao envia */
        busy = true; btn.disabled = true; location.href = "obrigado.html"; return;
      }
      if (!validate()) { return; }
      var o = origem();
      var d = digitsBR(zap.value);
      var body = {
        nome: nome.value.trim(),
        email: email.value.trim(),
        whatsapp: "55" + d,
        consentimento: true,
        consentimento_texto: $("consent-text").textContent.replace(/\s+/g, " ").trim(),
        origem_utm: o.utm,
        referrer: o.referrer,
        pagina: location.origin + location.pathname,
        criado_em: new Date().toISOString()
      };
      busy = true; btn.disabled = true;
      var label = btn.textContent; btn.textContent = "Enviando...";
      send(CFG.endpoint, body, "POST do formulario").then(function () {
        store("lp_lead", JSON.stringify({ nome: body.nome, email: body.email, whatsapp: body.whatsapp }));
        track("Lead");
        location.href = "obrigado.html";
      }).catch(function (err) {
        console.warn("Falha ao enviar:", err && err.message);
        fe.textContent = "Não foi possível enviar agora. Confira sua conexão e tente de novo.";
        busy = false; btn.disabled = false; btn.textContent = label;
      });
    });
  }

  /* ---------- Pagina de obrigado ---------- */
  function initThanks() {
    var pdf = $("pdf-btn");
    if (!pdf) { return; }
    if (CFG.pdf) { pdf.setAttribute("href", CFG.pdf); }
    var lead = null;
    try { lead = JSON.parse(store("lp_lead") || "null"); } catch (e) { lead = null; }
    if (lead && lead.nome) {
      var first = String(lead.nome).trim().split(/\s+/)[0];
      $("hello").textContent = "Valeu, " + first + "!";
    }
    var form = $("qual-form");
    if (!form) { return; }
    var btn = $("qual-btn"), fe = $("qual-error"), done = $("qual-ok"), busy = false;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (busy) { return; }
      fe.textContent = "";
      var tipo = $("tipo").value, fat = $("faturamento").value, dor = $("dor").value.trim().slice(0, 300);
      if (!tipo && !fat && !dor) { form.hidden = true; done.hidden = false; done.focus(); return; }
      var o = origem();
      var body = {
        email: lead ? lead.email : null,
        whatsapp: lead ? lead.whatsapp : null,
        tipo_negocio: tipo || null,
        faturamento_mensal: fat || null,
        maior_dor: dor || null,
        origem_utm: o.utm,
        pagina: location.origin + location.pathname,
        criado_em: new Date().toISOString()
      };
      busy = true; btn.disabled = true;
      var label = btn.textContent; btn.textContent = "Enviando...";
      send(CFG.endpointQualificacao, body, "POST de qualificacao").then(function () {
        form.hidden = true; done.hidden = false; done.focus();
      }).catch(function (err) {
        console.warn("Falha ao enviar:", err && err.message);
        fe.textContent = "Não foi possível enviar agora. Tente de novo, o guia continua disponível acima.";
        busy = false; btn.disabled = false; btn.textContent = label;
      });
    });
  }

  loadPixel();
  origem();
  initLead();
  initThanks();
})();
