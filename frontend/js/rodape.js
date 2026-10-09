/**
 * Rodapé do site. Renderiza dentro do elemento com id="rodape-raiz",
 * presente em todas as páginas.
 */
function iniciarRodape() {
  const raiz = document.getElementById('rodape-raiz');
  if (!raiz) return;
  const ano = new Date().getFullYear();

  raiz.innerHTML = `
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <div class="footer-logo-row">
            <img src="../recursos/logo.png" alt="Circuito Aberto" style="width:44px;height:44px;object-fit:contain;">
            <span class="footer-logo-text">Circuito Aberto</span>
          </div>
          <p class="footer-copy">Plataforma para a comunidade maker brasileira — projetos, código e conhecimento compartilhado entre estudantes.</p>
        </div>

        <div class="footer-col">
          <span class="footer-col-label">Navegação</span>
          <div class="footer-nav-list">
            <a href="inicio.html" class="footer-link"><i class="ti ti-home"></i> Início</a>
            <a href="explorar.html" class="footer-link"><i class="ti ti-layout-grid"></i> Explorar projetos</a>
            <a href="publicar.html" class="footer-link"><i class="ti ti-upload"></i> Publicar projeto</a>
            <a href="salvos.html" class="footer-link"><i class="ti ti-bookmark"></i> Meus salvos</a>
          </div>
        </div>

        <div class="footer-dev">
          <span class="footer-col-label">Desenvolvido por</span>
          <div class="footer-dev-list">
            <div class="footer-dev-member">
              <span class="footer-dev-name">Júnior Nascimento</span>
              <a href="https://github.com/JuniorNascimento2" target="_blank" rel="noopener noreferrer" class="footer-link">
                <i class="ti ti-brand-github"></i> JuniorNascimento2
              </a>
            </div>
            <div class="footer-dev-member">
              <span class="footer-dev-name">Gabryell Gonçalves</span>
              <a href="https://github.com/gabryellgs" target="_blank" rel="noopener noreferrer" class="footer-link">
                <i class="ti ti-brand-github"></i> gabryellgs
              </a>
            </div>
            <div class="footer-dev-member">
              <span class="footer-dev-name">Jadson Leitão</span>
              <a href="https://github.com/JadsonTSI" target="_blank" rel="noopener noreferrer" class="footer-link">
                <i class="ti ti-brand-github"></i> JadsonTSI
              </a>
            </div>
            <div class="footer-dev-member">
              <span class="footer-dev-name">Israel Cipriano</span>
              <a href="https://github.com/Israelf1lho" target="_blank" rel="noopener noreferrer" class="footer-link">
                <i class="ti ti-brand-github"></i> Israelf1lho
              </a>
            </div>
            <div class="footer-dev-member">
              <span class="footer-dev-name">Pedro Henrique</span>
              <a href="https://github.com/Henrriks" target="_blank" rel="noopener noreferrer" class="footer-link">
                <i class="ti ti-brand-github"></i> Henrriks
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="footer-bottom">
        <p class="footer-bottom-copy">© ${ano} Circuito Aberto. Todos os diretos reservados.</p>
        <div class="footer-bottom-right">
          <span class="footer-tag"><i class="ti ti-code"></i> Projetos reais</span>
          <span class="footer-tag"><i class="ti ti-bulb"></i> Conhecimento compartilhado</span>
          <button class="footer-top-btn" id="rodape-topo-btn" type="button">
            Voltar ao topo <i class="ti ti-arrow-up"></i>
          </button>
        </div>
      </div>
    </footer>`;

  const botaoTopo = document.getElementById('rodape-topo-btn');
  if (botaoTopo) {
    botaoTopo.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}
