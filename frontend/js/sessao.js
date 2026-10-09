/**
 * Sessão do usuário. Guarda token e dados do usuário logado no localStorage.
 */
const Sessao = {
  obterUsuario() {
    const dados = localStorage.getItem('ca_usuario');
    try { return dados ? JSON.parse(dados) : null; } catch { return null; }
  },
  obterToken() {
    return localStorage.getItem('ca_token');
  },
  estaLogado() {
    return !!this.obterToken();
  },
  entrar(token, dadosUsuario) {
    localStorage.setItem('ca_token', token);
    localStorage.setItem('ca_usuario', JSON.stringify(dadosUsuario));
  },
  sair() {
    localStorage.removeItem('ca_token');
    localStorage.removeItem('ca_usuario');
  },
};
