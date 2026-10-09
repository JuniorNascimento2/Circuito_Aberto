/**
 * Página de login.
 */
function iniciarPaginaEntrar() {
  iniciarAlternarSenha();
  const formulario = document.getElementById('entrar-form');
  const botaoEnviar = document.getElementById('entrar-enviar-btn');

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const campos = new FormData(formulario);
    const corpo = { email: campos.get('email'), senha: campos.get('senha') };

    botaoEnviar.disabled = true;
    botaoEnviar.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Entrando...';

    try {
      const { dados } = await API.enviar('/autenticacao/entrar', corpo);
      Sessao.entrar(dados.token, dados.usuario);
      Aviso.mostrar('Bem-vindo de volta, ' + dados.usuario.nome_usuario + '!');
      window.location.href = 'explorar.html';
    } catch (erro) {
      Aviso.mostrar(mensagemErro(erro, 'Erro ao entrar.'), 'error');
      botaoEnviar.disabled = false;
      botaoEnviar.innerHTML = '<i class="ti ti-login"></i> Entrar';
    }
  });
}
