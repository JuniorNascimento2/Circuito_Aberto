/**
 * Página "Minhas estatísticas".
 */
const ROTULOS_MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CORES_DIFICULDADE = { 'Iniciante': '#4ecfa0', 'Intermediário': '#f5c842', 'Avançado': '#f07070' };

function iniciarPaginaEstatisticas() {
  const elementoCarregando = document.getElementById('estatisticas-carregando');
  const elementoErro       = document.getElementById('estatisticas-erro');
  const elementoRaiz       = document.getElementById('estatisticas-raiz');

  API.obter('/minhas-estatisticas')
    .then(({ dados }) => {
      renderizarEstatisticas(dados);
      elementoRaiz.classList.remove('hidden');
    })
    .catch(() => { elementoErro.classList.remove('hidden'); })
    .finally(() => { elementoCarregando.classList.add('hidden'); });
}

function htmlCartaoEstatistica(icone, rotulo, valor, cor) {
  cor = cor || 'var(--green)';
  return `
    <div class="card stat-card">
      <div class="stat-card-icon" style="color:${cor};background:${cor}18;">
        <i class="ti ${icone}"></i>
      </div>
      <div class="stat-card-num">${valor !== undefined && valor !== null ? valor : '—'}</div>
      <div class="stat-card-label">${rotulo}</div>
    </div>`;
}

function htmlBarraEstatistica(rotulo, valor, maximo, cor) {
  cor = cor || 'var(--green)';
  const porcentagem = maximo > 0 ? Math.round((valor / maximo) * 100) : 0;
  return `
    <div class="stats-bar-row">
      <div class="stats-bar-label">${escaparHtml(rotulo)}</div>
      <div class="stats-bar-track"><div class="stats-bar-fill" style="width:${porcentagem}%;background:${cor};"></div></div>
      <div class="stats-bar-value">${valor}</div>
    </div>`;
}

function renderizarEstatisticas(dados) {
  const { totais, top_projetos, por_plataforma, por_dificuldade, atividade, total_comentarios } = dados;
  const maxPlataforma  = Math.max(...por_plataforma.map(p => p.total), 1);
  const maxAtividade   = Math.max(...atividade.map(a => a.total), 1);
  const maxDificuldade = Math.max(...por_dificuldade.map(d => d.total), 1);

  document.getElementById('estatisticas-cartoes').innerHTML = [
    htmlCartaoEstatistica('ti-layout-grid', 'Projetos publicados', totais.total_projetos),
    htmlCartaoEstatistica('ti-heart', 'Curtidas recebidas', totais.total_curtidas, '#f07070'),
    htmlCartaoEstatistica('ti-copy', 'Cópias feitas', totais.total_copias, '#7aadff'),
    htmlCartaoEstatistica('ti-eye', 'Visualizações', totais.total_visualizacoes, '#f5c842'),
    htmlCartaoEstatistica('ti-message', 'Comentários recebidos', total_comentarios, '#c084fc'),
  ].join('');

  const cartaoTopProjetos = document.getElementById('estatisticas-top-projetos');
  cartaoTopProjetos.innerHTML = `
    <h2 class="stats-sec-title"><i class="ti ti-trophy"></i> Top projetos por visualizações</h2>
    ${top_projetos.length === 0
      ? `<p style="color:var(--text3);font-size:13px;">Nenhum projeto ainda.</p>`
      : top_projetos.map((p, i) => `
        <a href="projeto.html?id=${p.id}" class="stats-top-row">
          <span class="stats-top-rank">#${i + 1}</span>
          <div class="stats-top-info">
            <span class="stats-top-title">${escaparHtml(p.titulo)}</span>
            <div class="stats-top-meta">
              <span><i class="ti ti-eye"></i> ${p.total_visualizacoes}</span>
              <span><i class="ti ti-heart"></i> ${p.total_curtidas}</span>
              <span><i class="ti ti-copy"></i> ${p.total_copias}</span>
            </div>
          </div>
        </a>`).join('')}`;

  const cartaoPorPlataforma = document.getElementById('estatisticas-por-plataforma');
  cartaoPorPlataforma.innerHTML = `
    <h2 class="stats-sec-title"><i class="ti ti-circuit-board"></i> Projetos por plataforma</h2>
    ${por_plataforma.length === 0
      ? `<p style="color:var(--text3);font-size:13px;">Nenhum projeto ainda.</p>`
      : por_plataforma.map(p => htmlBarraEstatistica(p.plataforma, p.total, maxPlataforma)).join('')}
    <div class="stats-by-difficulty">
      <h3 class="stats-sec-title stats-by-difficulty-title"><i class="ti ti-stairs"></i> Por dificuldade</h3>
      ${por_dificuldade.map(d => htmlBarraEstatistica(
          d.dificuldade, d.total, maxDificuldade, CORES_DIFICULDADE[d.dificuldade] || 'var(--green)'
        )).join('')}
    </div>`;

  if (atividade.length > 0) {
    const cartaoAtividade = document.getElementById('estatisticas-atividade');
    cartaoAtividade.classList.remove('hidden');
    cartaoAtividade.innerHTML = `
      <h2 class="stats-sec-title"><i class="ti ti-calendar-stats"></i> Projetos publicados nos últimos 6 meses</h2>
      <div class="activity-chart">
        ${atividade.map(a => {
          const [ano, mes] = a.mes.split('-');
          const porcentagem = Math.round((a.total / maxAtividade) * 100);
          return `
            <div class="stats-activity-col">
              <div class="stats-activity-bar-wrap">
                <span class="stats-activity-count">${a.total}</span>
                <div class="stats-activity-bar" style="height:${Math.max(porcentagem, 8)}%;"></div>
              </div>
              <span class="stats-activity-month">${ROTULOS_MESES[parseInt(mes, 10) - 1]}</span>
              <span class="stats-activity-year">${ano}</span>
            </div>`;
        }).join('')}
      </div>`;
  }
}
