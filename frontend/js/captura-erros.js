/**
 * Captura de erros globais. Escuta erros de script não tratados e promessas
 * rejeitadas, e mostra uma tela amigável em vez de deixar a página quebrada.
 */
(function () {
  window.addEventListener('error', function (evento) {
    mostrarTelaErro(evento.error);
  });
  window.addEventListener('unhandledrejection', function (evento) {
    mostrarTelaErro(evento.reason);
  });

  function mostrarTelaErro(erro) {
    if (document.getElementById('eb-overlay')) return; // evita duplicar
    const sobreposicao = document.createElement('div');
    sobreposicao.id = 'eb-overlay';
    sobreposicao.className = 'eb-page';
    sobreposicao.style.position = 'fixed';
    sobreposicao.style.top = '0';
    sobreposicao.style.left = '0';
    sobreposicao.style.right = '0';
    sobreposicao.style.bottom = '0';
    sobreposicao.style.zIndex = '99999';
    sobreposicao.innerHTML = `
      <div class="eb-box">
        <div class="eb-emoji">⚡</div>
        <h1 class="eb-title">Algo deu errado</h1>
        <p class="eb-desc">Um erro inesperado aconteceu. Recarregue a página ou volte ao início.</p>
        <div class="eb-actions">
          <button class="btn btn-outline" id="eb-recarregar-btn"><i class="ti ti-refresh"></i> Recarregar</button>
          <a href="inicio.html" class="btn btn-primary"><i class="ti ti-home"></i> Início</a>
        </div>
      </div>`;
    document.body.appendChild(sobreposicao);
    document.getElementById('eb-recarregar-btn').addEventListener('click', () => window.location.reload());
  }
})();
