/**
 * Página de redefinição de senha (acessada pelo link enviado por e-mail).
 */
function iniciarPaginaRedefinirSenha() {
  const token = obterParametroUrl('token');
  const caixa = document.getElementById('redefinir-caixa');

  if (!token) {
    caixa.style.textAlign = 'center';
    caixa.innerHTML = `
      <i class="ti ti-alert-circle" style="font-size:48px;color:#f07070;margin-bottom:16px;display:block;"></i>
      <h2 class="auth-title">Link inválido</h2>
      <p class="auth-sub">Este link de recuperação não é válido.</p>
      <a href="esqueci-senha.html" class="btn btn-primary" style="justify-content:center;margin-top:8px;">Solicitar novo link</a>`;
    return;
  }

  renderizarFormulario();

  function renderizarFormulario() {
    caixa.innerHTML = `
      <div class="auth-logo-row">
        <img src="../recursos/logo.png" alt="Circuito Aberto" style="width:40px;height:40px;object-fit:contain;">
        <span class="auth-logo-text">Circuito Aberto</span>
      </div>
      <h1 class="auth-title">Redefinir senha</h1>
      <p class="auth-sub">Digite sua nova senha abaixo.</p>
      <form id="redefinir-form">
        <div class="form-group">
          <label class="form-label">Nova senha</label>
          <div class="pw-input-wrap">
            <input name="senha" type="password" class="form-input" placeholder="mínimo 6 caracteres" required style="padding-right:40px;">
            <button type="button" class="pw-eye-btn" data-toggle-pw><i class="ti ti-eye"></i></button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Confirmar nova senha</label>
          <div class="pw-input-wrap">
            <input name="confirmacao" type="password" class="form-input" placeholder="repita a senha" required style="padding-right:40px;">
            <button type="button" class="pw-eye-btn" data-toggle-pw><i class="ti ti-eye"></i></button>
          </div>
        </div>
        <button type="submit" class="btn btn-primary" id="redefinir-enviar-btn" style="width:100%;justify-content:center;padding:10px;">
          <i class="ti ti-lock"></i> Redefinir senha
        </button>
      </form>`;

    iniciarAlternarSenha(caixa);
    const formulario = document.getElementById('redefinir-form');
    const botaoEnviar = document.getElementById('redefinir-enviar-btn');

    formulario.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const campos = new FormData(formulario);
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
      botaoEnviar.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Salvando...';

      try {
        await API.enviar('/autenticacao/redefinir-senha', { token, senha });
        renderizarSucesso();
        setTimeout(() => { window.location.href = 'entrar.html'; }, 3000);
      } catch (erro) {
        Aviso.mostrar(mensagemErro(erro, 'Link inválido ou expirado.'), 'error');
        botaoEnviar.disabled = false;
        botaoEnviar.innerHTML = '<i class="ti ti-lock"></i> Redefinir senha';
      }
    });
  }

  function renderizarSucesso() {
    caixa.innerHTML = `
      <div class="auth-logo-row">
        <img src="../recursos/logo.png" alt="Circuito Aberto" style="width:28px;height:28px;object-fit:contain;">
        <span class="auth-logo-text">Circuito Aberto</span>
      </div>
      <div class="center-block">
        <i class="ti ti-circle-check" style="font-size:48px;color:var(--green);margin-bottom:16px;display:block;"></i>
        <h2 class="auth-title">Senha redefinida!</h2>
        <p class="auth-sub">Redirecionando para o login...</p>
      </div>`;
  }
}
