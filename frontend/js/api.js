/**
 * Cliente HTTP da API. Anexa o token JWT em toda requisição e redireciona
 * para a tela de login quando o servidor responde 401 (exceto em rotas públicas).
 */
const API = (() => {
  const urlBase = '/api';

  // Rotas públicas que não devem redirecionar para o login no 401
  const ROTAS_PUBLICAS = ['/estatisticas', '/saude'];

  function montarQuery(parametros) {
    if (!parametros) return '';
    const query = new URLSearchParams();
    Object.entries(parametros).forEach(([chave, valor]) => {
      if (valor !== undefined && valor !== null) query.append(chave, valor);
    });
    const texto = query.toString();
    return texto ? `?${texto}` : '';
  }

  async function requisitar(metodo, url, { dados, parametros, cabecalhos } = {}) {
    const urlCompleta = urlBase + url + montarQuery(parametros);

    const token = localStorage.getItem('ca_token');
    const cabecalhosReq = { ...(cabecalhos || {}) };
    if (token) cabecalhosReq['Authorization'] = `Bearer ${token}`;

    let corpo;
    const ehFormData = (typeof FormData !== 'undefined') && (dados instanceof FormData);
    if (ehFormData) {
      corpo = dados; // o navegador define o Content-Type (multipart/form-data) automaticamente
    } else if (dados !== undefined) {
      cabecalhosReq['Content-Type'] = 'application/json';
      corpo = JSON.stringify(dados);
    }

    let resposta;
    try {
      resposta = await fetch(urlCompleta, { method: metodo, headers: cabecalhosReq, body: corpo });
    } catch (erroRede) {
      const erro = new Error('Erro de conexão.');
      erro.resposta = null;
      throw erro;
    }

    let json = null;
    try { json = await resposta.json(); } catch { json = null; }

    if (!resposta.ok) {
      const ehPublica = ROTAS_PUBLICAS.some(r => url.includes(r));
      if (resposta.status === 401 && !ehPublica) {
        localStorage.removeItem('ca_token');
        localStorage.removeItem('ca_usuario');
        if (!window.location.pathname.includes('entrar')) {
          window.location.href = 'entrar.html';
        }
      }
      const erro = new Error((json && json.erro) || 'Erro');
      erro.resposta = { status: resposta.status, dados: json };
      throw erro;
    }

    return { dados: json };
  }

  return {
    obter:    (url, config)        => requisitar('GET', url, config || {}),
    enviar:   (url, dados, config) => requisitar('POST', url, { ...(config || {}), dados }),
    atualizar:(url, dados, config) => requisitar('PUT', url, { ...(config || {}), dados }),
    remover:  (url, config)        => requisitar('DELETE', url, config || {}),
  };
})();

// Lê a mensagem de erro que o servidor devolveu, com um texto padrão de reserva.
function mensagemErro(erro, padrao) {
  return (erro && erro.resposta && erro.resposta.dados && erro.resposta.dados.erro) || padrao;
}
