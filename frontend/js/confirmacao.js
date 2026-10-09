/**
 * Modal de confirmação customizado, no visual do site, pra substituir o
 * confirm() nativo do navegador. Cria (ou reaproveita) o overlay sob demanda
 * e devolve uma Promise<boolean> — true se o usuário confirmou, false se
 * cancelou (botão cancelar, clique fora, ESC ou botão fechar).
 *
 * Uso:
 *   const ok = await Confirmacao.perguntar({
 *     titulo: 'Remover projeto',
 *     mensagem: 'Deseja mesmo remover este projeto? Essa ação não pode ser desfeita.',
 *     textoConfirmar: 'Remover',
 *     textoCancelar: 'Cancelar', // opcional, usa 'Cancelar' por padrão
 *     perigo: true, // opcional, deixa o botão de confirmar vermelho
 *   });
 *   if (!ok) return;
 */
const Confirmacao = (() => {
  let overlay = null;
  let resolverAtual = null;

  function garantirDom() {
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.className = 'confirmacao-overlay hidden';
    overlay.innerHTML = `
      <div class="card confirmacao-caixa" role="alertdialog" aria-modal="true" aria-labelledby="confirmacao-titulo" aria-describedby="confirmacao-mensagem">
        <button type="button" class="confirmacao-fechar" aria-label="Fechar">
          <i class="ti ti-x"></i>
        </button>
        <h3 class="confirmacao-titulo" id="confirmacao-titulo"></h3>
        <p class="confirmacao-mensagem" id="confirmacao-mensagem"></p>
        <div class="confirmacao-botoes">
          <button type="button" class="btn btn-outline confirmacao-botao-cancelar"></button>
          <button type="button" class="btn btn-primary confirmacao-botao-confirmar"></button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('.confirmacao-fechar').addEventListener('click', () => concluir(false));
    overlay.querySelector('.confirmacao-botao-cancelar').addEventListener('click', () => concluir(false));
    overlay.querySelector('.confirmacao-botao-confirmar').addEventListener('click', () => concluir(true));
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) concluir(false);
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) concluir(false);
    });

    return overlay;
  }

  function concluir(resultado) {
    if (!overlay || !resolverAtual) return;
    overlay.classList.add('hidden');
    const resolver = resolverAtual;
    resolverAtual = null;
    resolver(resultado);
  }

  /**
   * @param {Object} opcoes
   * @param {string} opcoes.mensagem - texto da pergunta (obrigatório)
   * @param {string} [opcoes.titulo] - título da caixa (padrão: 'Confirmar ação')
   * @param {string} [opcoes.textoConfirmar] - texto do botão de confirmar (padrão: 'Sim')
   * @param {string} [opcoes.textoCancelar] - texto do botão de cancelar (padrão: 'Cancelar')
   * @param {boolean} [opcoes.perigo] - se true, botão de confirmar fica vermelho
   * @returns {Promise<boolean>}
   */
  function perguntar({ mensagem, titulo = 'Confirmar ação', textoConfirmar = 'Sim', textoCancelar = 'Cancelar', perigo = false }) {
    const raiz = garantirDom();

    raiz.querySelector('#confirmacao-titulo').textContent = titulo;
    raiz.querySelector('#confirmacao-mensagem').textContent = mensagem;

    const botaoConfirmar = raiz.querySelector('.confirmacao-botao-confirmar');
    botaoConfirmar.textContent = textoConfirmar;
    botaoConfirmar.classList.toggle('btn-primary', !perigo);
    botaoConfirmar.classList.toggle('btn-danger', !!perigo);

    raiz.querySelector('.confirmacao-botao-cancelar').textContent = textoCancelar;

    raiz.classList.remove('hidden');
    botaoConfirmar.focus();

    return new Promise((resolve) => {
      resolverAtual = resolve;
    });
  }

  return { perguntar };
})();
