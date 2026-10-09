/**
 * Página de projetos salvos.
 */
function iniciarPaginaSalvos() {
  const elementoCarregando = document.getElementById('salvos-carregando');
  const elementoVazio = document.getElementById('salvos-vazio');
  const elementoGrade = document.getElementById('salvos-grade');
  const elementoSubtitulo = document.getElementById('salvos-subtitulo');

  let todosProjetos = [];
  let pagina = 1;
  let temProxima = false;
  let botaoCarregarMais = null;

  function garantirBotaoCarregarMais() {
    if (botaoCarregarMais) return botaoCarregarMais;
    botaoCarregarMais = document.createElement('button');
    botaoCarregarMais.className = 'btn btn-outline';
    botaoCarregarMais.style.cssText = 'display:block;margin:24px auto 0;';
    botaoCarregarMais.textContent = 'Carregar mais';
    botaoCarregarMais.addEventListener('click', () => carregarPagina(pagina + 1));
    elementoGrade.insertAdjacentElement('afterend', botaoCarregarMais);
    return botaoCarregarMais;
  }

  function carregarPagina(p) {
    if (botaoCarregarMais) {
      botaoCarregarMais.disabled = true;
      botaoCarregarMais.textContent = 'Carregando...';
    }

    API.obter('/salvos', { parametros: { pagina: p } })
      .then(({ dados }) => {
        pagina = dados.pagina;
        temProxima = dados.tem_proxima;
        todosProjetos = p === 1 ? dados.projetos : todosProjetos.concat(dados.projetos);

        elementoSubtitulo.textContent =
          `${dados.total} projeto${dados.total !== 1 ? 's' : ''} salvo${dados.total !== 1 ? 's' : ''}`;

        if (todosProjetos.length === 0) {
          elementoVazio.classList.remove('hidden');
          elementoGrade.classList.add('hidden');
        } else {
          elementoVazio.classList.add('hidden');
          elementoGrade.classList.remove('hidden');
          elementoGrade.innerHTML = todosProjetos.map(renderizarCartaoProjeto).join('');
        }

        const botao = garantirBotaoCarregarMais();
        botao.disabled = false;
        botao.textContent = 'Carregar mais';
        botao.classList.toggle('hidden', !temProxima);
      })
      .catch(() => {
        Aviso.mostrar('Erro ao carregar projetos salvos.', 'error');
        if (botaoCarregarMais) {
          botaoCarregarMais.disabled = false;
          botaoCarregarMais.textContent = 'Carregar mais';
        }
      })
      .finally(() => {
        elementoCarregando.classList.add('hidden');
      });
  }

  carregarPagina(1);
}
