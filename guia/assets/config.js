/* Configuracao unica da LP. Preencha so o que precisar.
 * endpoint: URL que recebe o POST JSON do formulario principal (ex.: REST do Supabase).
 * endpointQualificacao: URL do segundo POST (mini-formulario da pagina de obrigado).
 * apikey: chave publica (anon) enviada em "apikey" e "Authorization: Bearer".
 * metaPixelId: se vazio, nenhum script de terceiros e carregado.
 * Com endpoint vazio a LP roda em modo desenvolvimento: mostra o JSON no console e segue. */
window.LP_CONFIG = {
  endpoint: "/api/guia",
  endpointQualificacao: "/api/guia/qualificacao",
  apikey: "",
  metaPixelId: "",
  pdf: "assets/guia-lanca-dev-7-passos.pdf"
};
