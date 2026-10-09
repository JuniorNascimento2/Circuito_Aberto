/**
 * Cartão de projeto usado nas grades (explorar, perfil, salvos).
 * Recebe um objeto `projeto` e devolve a string HTML do cartão.
 */
function renderizarCartaoProjeto(projeto) {
  const classePlataforma = classeTagPlataforma(projeto.plataforma);
  const classeDificuldade = classeTagDificuldade(projeto.dificuldade);
  const emoji = EMOJI_PLATAFORMA[projeto.plataforma] || '⚡';

  const htmlImagem = projeto.url_imagem
    ? `<img src="${escaparHtml(projeto.url_imagem)}" alt="${escaparHtml(projeto.titulo)}" class="pc-img">`
    : `<div class="pc-placeholder"><span>${emoji}</span></div>`;

  const htmlEtiquetas = (projeto.etiquetas && projeto.etiquetas.length > 0)
    ? `<div class="pc-tags">${projeto.etiquetas.slice(0, 3).map(e => `<span class="pc-mini-tag">#${escaparHtml(e)}</span>`).join('')}</div>`
    : '';

  return `
    <a href="projeto.html?id=${encodeURIComponent(projeto.id)}" class="pc-link">
      <div class="card pc-card">
        <div class="pc-imgwrap">
          ${htmlImagem}
          <div class="pc-overlay"><span class="tag ${classePlataforma}">${escaparHtml(projeto.plataforma)}</span></div>
        </div>
        <div class="pc-body">
          <div class="pc-title">${escaparHtml(projeto.titulo)}</div>
          <div class="pc-author">
            <span class="pc-author-dot">${htmlAvatar(projeto.url_avatar, projeto.nome_usuario)}</span>
            ${escaparHtml(projeto.nome_usuario)}
          </div>
          ${htmlEtiquetas}
          <div class="pc-footer">
            <span class="tag ${classeDificuldade}" style="font-size:10px;">${escaparHtml(projeto.dificuldade)}</span>
            <div class="pc-stats">
              <span class="pc-stat"><i class="ti ti-heart"></i> ${projeto.total_curtidas}</span>
              <span class="pc-stat"><i class="ti ti-copy"></i> ${projeto.total_copias}</span>
              <span class="pc-stat"><i class="ti ti-eye"></i> ${projeto.total_visualizacoes}</span>
            </div>
          </div>
        </div>
      </div>
    </a>`;
}
