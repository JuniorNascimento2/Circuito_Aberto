/**
 * Página de exploração de projetos (busca, filtros, ordenação e paginação).
 */
function iniciarPaginaExplorar() {
  const estado = {
    plataforma: 'Todos',
    ordem: 'recentes',
    busca: '',
    pagina: 1,
    totalPaginas: 1,
    total: 0,
  };

  const formularioBusca   = document.getElementById('explorar-busca-form');
  const campoBusca        = document.getElementById('explorar-busca-campo');
  const botaoLimpar       = document.getElementById('explorar-limpar-btn');
  const seletorOrdem      = document.getElementById('explorar-ordem-select');
  const linhaFiltros      = document.getElementById('explorar-filtros');
  const elementoContagem  = document.getElementById('explorar-contagem');
  const elementoCarregando = document.getElementById('explorar-carregando');
  const elementoVazio     = document.getElementById('explorar-vazio');
  const elementoGrade     = document.getElementById('explorar-grade');
  const elementoPaginacao = document.getElementById('explorar-paginacao');
  const elementoNumeros   = document.getElementById('explorar-numeros-pagina');
  const botaoAnterior     = document.getElementById('explorar-anterior-btn');
  const botaoProxima      = document.getElementById('explorar-proxima-btn');
  const elementoVazioIcone = document.getElementById('explorar-vazio-icone');
  const elementoVazioTexto = document.getElementById('explorar-vazio-texto');
  const botaoTentarNovamente = document.getElementById('explorar-tentar-novamente-btn');

  botaoTentarNovamente?.addEventListener('click', () => carregar(estado.pagina));

  async function carregar(p = 1) {
    elementoCarregando.classList.remove('hidden');
    elementoVazio.classList.add('hidden');
    elementoGrade.classList.add('hidden');
    elementoContagem.classList.add('hidden');
    elementoPaginacao.classList.add('hidden');

    try {
      const { dados } = await API.obter('/projetos', {
        parametros: {
          plataforma: estado.plataforma === 'Todos' ? undefined : estado.plataforma,
          ordem: estado.ordem,
          busca: estado.busca || undefined,
          pagina: p,
        },
      });
      renderizarResultados(dados.projetos, dados.total, dados.pagina, dados.total_paginas);
    } catch (erro) {
      // Diferencia "deu erro" (rede, rate limit, servidor fora) de "não há projetos" —
      // mostrar "nenhum projeto encontrado" aqui seria enganoso, parece que os dados sumiram.
      elementoVazioIcone.className = 'ti ti-alert-triangle';
      elementoVazioTexto.textContent = mensagemErro(erro, 'Não foi possível carregar os projetos agora. Verifique sua conexão e tente novamente.');
      botaoTentarNovamente?.classList.remove('hidden');
      elementoVazio.classList.remove('hidden');
      elementoContagem.classList.add('hidden');
      elementoGrade.classList.add('hidden');
      elementoPaginacao.classList.add('hidden');
    } finally {
      elementoCarregando.classList.add('hidden');
    }
  }

  function renderizarResultados(projetos, total, pagina, totalPaginas) {
    estado.total = total;
    estado.pagina = pagina;
    estado.totalPaginas = totalPaginas;

    elementoContagem.classList.remove('hidden');
    elementoContagem.textContent =
      `${total} projeto${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}` +
      (totalPaginas > 1 ? ` · página ${pagina} de ${totalPaginas}` : '');

    if (projetos.length === 0) {
      // Resultado real de busca/filtro sem projetos — não confundir com estado de erro.
      elementoVazioIcone.className = 'ti ti-mood-empty';
      elementoVazioTexto.textContent = 'Nenhum projeto encontrado.';
      botaoTentarNovamente?.classList.add('hidden');
      elementoVazio.classList.remove('hidden');
      elementoGrade.classList.add('hidden');
    } else {
      elementoGrade.classList.remove('hidden');
      elementoVazio.classList.add('hidden');
      elementoGrade.innerHTML = projetos.map(renderizarCartaoProjeto).join('');
    }

    renderizarPaginacao();
  }

  function renderizarPaginacao() {
    if (estado.totalPaginas <= 1) {
      elementoPaginacao.classList.add('hidden');
      return;
    }
    elementoPaginacao.classList.remove('hidden');
    botaoAnterior.disabled = estado.pagina <= 1;
    botaoProxima.disabled = estado.pagina >= estado.totalPaginas;

    const paginas = Array.from({ length: estado.totalPaginas }, (_, i) => i + 1)
      .filter(n => n === 1 || n === estado.totalPaginas || Math.abs(n - estado.pagina) <= 1)
      .reduce((acumulado, n, indice, lista) => {
        if (indice > 0 && n - lista[indice - 1] > 1) acumulado.push('...');
        acumulado.push(n);
        return acumulado;
      }, []);

    elementoNumeros.innerHTML = paginas.map(n => {
      if (n === '...') return `<span class="feed-ellipsis">...</span>`;
      const classeAtiva = n === estado.pagina ? 'feed-page-btn-active' : '';
      return `<button class="feed-page-btn ${classeAtiva}" data-pagina="${n}">${n}</button>`;
    }).join('');

    elementoNumeros.querySelectorAll('[data-pagina]').forEach(botao => {
      botao.addEventListener('click', () => trocarPagina(parseInt(botao.dataset.pagina, 10)));
    });
  }

  function trocarPagina(p) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    carregar(p);
  }

  formularioBusca.addEventListener('submit', (evento) => {
    evento.preventDefault();
    estado.busca = campoBusca.value;
    carregar(1);
  });

  campoBusca.addEventListener('input', () => {
    botaoLimpar.classList.toggle('hidden', !campoBusca.value);
  });

  botaoLimpar.addEventListener('click', () => {
    campoBusca.value = '';
    estado.busca = '';
    botaoLimpar.classList.add('hidden');
    carregar(1);
  });

  seletorOrdem.addEventListener('change', () => {
    estado.ordem = seletorOrdem.value;
    carregar(1);
  });

  linhaFiltros.querySelectorAll('.feed-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      linhaFiltros.querySelectorAll('.feed-chip').forEach(c => c.classList.remove('feed-chip-active'));
      chip.classList.add('feed-chip-active');
      estado.plataforma = chip.dataset.plataforma;
      carregar(1);
    });
  });

  botaoAnterior.addEventListener('click', () => trocarPagina(estado.pagina - 1));
  botaoProxima.addEventListener('click', () => trocarPagina(estado.pagina + 1));

  carregar(1);
}
