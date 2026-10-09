/**
 * Página de criação de conta.
 */
function iniciarPaginaCadastro() {
  iniciarAlternarSenha();
  const formulario = document.getElementById('cadastro-form');
  const botaoEnviar = document.getElementById('cadastro-enviar-btn');

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const campos = new FormData(formulario);
    const nome_usuario = campos.get('nome_usuario');
    const email = campos.get('email');
    const senha = campos.get('senha');
    const confirmacao = campos.get('confirmacao');

    if (senha !== confirmacao) {
      Aviso.mostrar('As senhas não coincidem.', 'error');
      return;
    }
    if (senha.length < 6) {
      Aviso.mostrar('Senha deve ter ao menos 6 caracteres.', 'error');
      return;
    }

    botaoEnviar.disabled = true;
    botaoEnviar.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Criando...';

    try {
      const { dados } = await API.enviar('/autenticacao/cadastrar', { nome_usuario, email, senha });
      Sessao.entrar(dados.token, dados.usuario);
      Aviso.mostrar('Conta criada! Bem-vindo, ' + dados.usuario.nome_usuario + '!');
      window.location.href = 'explorar.html';
    } catch (erro) {
      Aviso.mostrar(mensagemErro(erro, 'Erro ao criar conta.'), 'error');
      botaoEnviar.disabled = false;
      botaoEnviar.innerHTML = '<i class="ti ti-user-plus"></i> Criar minha conta';
    }
  });
}
