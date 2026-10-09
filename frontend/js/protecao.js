/**
 * Proteção de rotas. Deve ser chamada o mais cedo possível (logo no início do
 * <body>) para evitar qualquer "flash" de conteúdo indevido.
 */

// Páginas privadas (explorar, projeto, publicar, editar, perfil, salvos, estatísticas)
function exigirLogin() {
  if (!Sessao.estaLogado()) {
    window.location.replace('entrar.html');
  }
}

// Páginas exclusivas de quem NÃO está logado (início, entrar, cadastro, senha)
function somenteVisitante() {
  if (Sessao.estaLogado()) {
    window.location.replace('explorar.html');
  }
}
