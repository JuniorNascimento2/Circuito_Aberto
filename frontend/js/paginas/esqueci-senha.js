/**
 * Página "esqueci minha senha".
 */
function iniciarPaginaEsqueciSenha() {
  const formulario = document.getElementById('esqueci-form');
  const botaoEnviar = document.getElementById('esqueci-enviar-btn');
  const telaFormulario = document.getElementById('esqueci-form-tela');
  const telaEnviado = document.getElementById('esqueci-enviado-tela');

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const email = new FormData(formulario).get('email');

    botaoEnviar.disabled = true;
    botaoEnviar.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Enviando...';

    try {
      await API.enviar('/autenticacao/esqueci-senha', { email });
      telaFormulario.classList.add('hidden');
      telaEnviado.classList.remove('hidden');
    } catch (erro) {
      Aviso.mostrar(mensagemErro(erro, 'Erro ao enviar e-mail.'), 'error');
      botaoEnviar.disabled = false;
      botaoEnviar.innerHTML = '<i class="ti ti-send"></i> Enviar link';
    }
  });
}
