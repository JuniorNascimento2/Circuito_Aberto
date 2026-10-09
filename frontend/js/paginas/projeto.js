/**
 * Página de detalhe do projeto (inclui a seção de comentários).
 */
function iniciarPaginaProjeto() {
  const id = obterParametroUrl('id');
  const usuario = Sessao.obterUsuario();

  const elementoCarregando = document.getElementById('detalhe-carregando');
  const elementoRaiz       = document.getElementById('detalhe-raiz');
  const elementoPrincipal  = document.getElementById('detalhe-principal');
  const elementoLateral    = document.getElementById('detalhe-lateral');
  const botaoVoltar        = document.getElementById('detalhe-voltar-btn');

  botaoVoltar.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = 'explorar.html';
  });

  if (!id) {
    window.location.href = 'explorar.html';
    return;
  }

  let projeto = null;
  let curtido = false;
  let copiado = false;
  let salvo = false;

  API.obter(`/projetos/${id}`)
    .then(({ dados }) => {
      projeto = dados;
      curtido = !!dados.curtido_por_mim;
      renderizarTudo();
    })
    .catch(() => { window.location.href = 'explorar.html'; })
    .finally(() => {
      elementoCarregando.classList.add('hidden');
      elementoRaiz.classList.remove('hidden');
    });

  API.obter(`/salvos/${id}/verificar`).then(({ dados }) => {
    salvo = dados.salvo;
    renderizarAcoes();
  }).catch(() => {});

  function renderizarTudo() {
    if (!projeto) return;
    const materiais = projeto.materiais ? projeto.materiais.split('\n').filter(Boolean) : [];
    renderizarLateral(materiais);
    renderizarPrincipal();
  }

  function renderizarPrincipal() {
    const classePlataforma = classeTagPlataforma(projeto.plataforma);
    const classeDificuldade = classeTagDificuldade(projeto.dificuldade);

    const htmlImagem = projeto.url_imagem
      ? `<div class="detail-img-wrap"><img src="${escaparHtml(projeto.url_imagem)}" alt="${escaparHtml(projeto.titulo)}" class="detail-img"></div>`
      : `<div class="detail-img-placeholder"><i class="ti ti-circuit-board" style="font-size:56px;color:var(--border2);"></i></div>`;

    const htmlEtiquetas = (projeto.etiquetas && projeto.etiquetas.length > 0)
      ? `<div class="detail-proj-tags">${projeto.etiquetas.map(e => `<span class="detail-proj-tag">#${escaparHtml(e)}</span>`).join('')}</div>`
      : '';

    elementoPrincipal.innerHTML = `
      ${htmlImagem}
      <div class="card detail-card">
        <div class="detail-tag-row">
          <span class="tag ${classePlataforma}">${escaparHtml(projeto.plataforma)}</span>
          <span class="tag ${classeDificuldade}">${escaparHtml(projeto.dificuldade)}</span>
        </div>
        ${htmlEtiquetas}
        <h1 class="detail-title">${escaparHtml(projeto.titulo)}</h1>
        <div class="detail-meta-row">
          <a href="perfil.html?usuario=${encodeURIComponent(projeto.nome_usuario)}" class="detail-author-link">
            <div class="detail-avatar">${htmlAvatar(projeto.url_avatar, projeto.nome_usuario)}</div>
            ${escaparHtml(projeto.nome_usuario)}
          </a>
          <span class="detail-date">${formatarDataCurta(projeto.criado_em)}</span>
        </div>
        <div class="detail-stats-row"></div>
        <div class="action-row" id="detalhe-acoes"></div>
      </div>

      <div class="card detail-card">
        <h2 class="detail-sec-title"><i class="ti ti-file-text"></i> Descrição</h2>
        <p class="detail-desc">${escaparHtml(projeto.descricao)}</p>
      </div>

      ${projeto.montagem ? `
      <div class="card detail-card">
        <h2 class="detail-sec-title"><i class="ti ti-plug-connected"></i> Montagem</h2>
        <ol class="detail-steps">
          ${projeto.montagem.split('\n').filter(l => l.trim()).map(passo => `<li class="detail-step-item">${escaparHtml(passo.trim())}</li>`).join('')}
        </ol>
      </div>` : ''}

      ${projeto.codigo ? `
      <div class="card detail-card">
        <h2 class="detail-sec-title" style="margin-bottom:14px;"><i class="ti ti-code"></i> Código-fonte</h2>
        <div id="detalhe-bloco-codigo"></div>
      </div>` : ''}

      <div class="card detail-card" id="detalhe-comentarios"></div>
    `;

    renderizarAcoes();

    if (projeto.codigo) {
      renderizarBlocoCodigo(document.getElementById('detalhe-bloco-codigo'), projeto.codigo);
    }

    renderizarComentarios(document.getElementById('detalhe-comentarios'), projeto.id);
  }

  function renderizarAcoes() {
    const linhaAcoes = document.getElementById('detalhe-acoes');
    if (!linhaAcoes) return;
    const ehDono = usuario && usuario.id === projeto.usuario_id;
    const ehAdmin = usuario && usuario.papel === 'admin';
    const podeGerenciar = ehDono || ehAdmin;

    linhaAcoes.innerHTML = `
      <button class="btn btn-sm ${curtido ? 'btn-primary' : 'btn-outline'}" id="detalhe-curtir-btn">
        <i class="ti ti-heart"></i> ${curtido ? 'Curtido' : 'Curtir'}
      </button>
      <button class="btn btn-outline btn-sm" id="detalhe-copiar-btn" ${copiado ? 'disabled' : ''}>
        <i class="ti ti-copy"></i> ${copiado ? 'Copiado!' : 'Copiar projeto'}
      </button>
      <button class="btn btn-sm btn-outline ${salvo ? 'detail-saved-active' : ''}" id="detalhe-salvar-btn" title="${salvo ? 'Remover dos salvos' : 'Salvar projeto'}">
        <i class="ti ti-bookmark"></i> ${salvo ? 'Salvo' : 'Salvar'}
      </button>
      ${usuario && !ehDono ? `
        <button class="btn btn-outline btn-sm" id="detalhe-denunciar-btn" title="Denunciar este projeto">
          <i class="ti ti-flag"></i> Denunciar
        </button>
      ` : ''}
      ${podeGerenciar ? `
        <a href="editar.html?id=${projeto.id}" class="btn btn-outline btn-sm"><i class="ti ti-edit"></i> Editar</a>
        <button class="btn btn-danger btn-sm" id="detalhe-deletar-btn" ${!ehDono ? 'title="Remover como administrador"' : ''}><i class="ti ti-trash"></i> Deletar${!ehDono ? ' (admin)' : ''}</button>
      ` : ''}
    `;

    document.getElementById('detalhe-curtir-btn').addEventListener('click', curtir);
    document.getElementById('detalhe-copiar-btn').addEventListener('click', copiar);
    document.getElementById('detalhe-salvar-btn').addEventListener('click', salvar);
    const botaoDeletar = document.getElementById('detalhe-deletar-btn');
    if (botaoDeletar) botaoDeletar.addEventListener('click', deletar);
    const botaoDenunciar = document.getElementById('detalhe-denunciar-btn');
    if (botaoDenunciar) botaoDenunciar.addEventListener('click', () => {
      DenunciaModal.abrir(`/projetos/${projeto.id}/denunciar`, `Denunciando o projeto: ${projeto.titulo}`);
    });

    renderizarContadores();
  }

  // Mantém a linha de curtidas/cópias/visualizações em sincronia com as ações
  function renderizarContadores() {
    const linhaContadores = elementoPrincipal.querySelector('.detail-stats-row');
    if (!linhaContadores) return;
    linhaContadores.innerHTML = `
      <span class="detail-stat"><i class="ti ti-heart"></i> ${projeto.total_curtidas} curtidas</span>
      <span class="detail-stat"><i class="ti ti-copy"></i> ${projeto.total_copias} cópias</span>
      <span class="detail-stat"><i class="ti ti-eye"></i> ${projeto.total_visualizacoes} visualizações</span>`;
  }

  async function curtir() {
    try {
      const { dados } = await API.enviar(`/projetos/${id}/curtir`);
      curtido = dados.curtido;
      projeto.total_curtidas += dados.curtido ? 1 : -1;
      renderizarAcoes();
    } catch { Aviso.mostrar('Erro ao curtir.', 'error'); }
  }

  async function copiar() {
    if (copiado) return;
    try {
      await API.enviar(`/projetos/${id}/copiar`);
      copiado = true;
      projeto.total_copias += 1;
      renderizarAcoes();
      Aviso.mostrar('Projeto copiado!');
    } catch { Aviso.mostrar('Erro ao copiar.', 'error'); }
  }

  async function salvar() {
    try {
      const { dados } = await API.enviar(`/salvos/${id}`);
      salvo = dados.salvo;
      renderizarAcoes();
      Aviso.mostrar(dados.salvo ? 'Projeto salvo!' : 'Projeto removido dos salvos.');
    } catch { Aviso.mostrar('Erro ao salvar.', 'error'); }
  }

  async function deletar() {
    const ok = await Confirmacao.perguntar({
      titulo: 'Deletar projeto',
      mensagem: 'Tem certeza que deseja deletar este projeto? Essa ação não pode ser desfeita.',
      textoConfirmar: 'Deletar',
      perigo: true,
    });
    if (!ok) return;
    try {
      await API.remover(`/projetos/${id}`);
      Aviso.mostrar('Projeto deletado.');
      window.location.href = 'explorar.html';
    } catch { Aviso.mostrar('Erro ao deletar.', 'error'); }
  }

  function renderizarLateral(materiais) {
    const htmlMateriais = (materiais && materiais.length > 0) ? `
      <div class="card detail-card">
        <h2 class="detail-sec-title"><i class="ti ti-tools"></i> Materiais</h2>
        <ul style="list-style:none;">
          ${materiais.map(m => `<li class="detail-mat-item"><i class="ti ti-circle-check"></i><span>${escaparHtml(m)}</span></li>`).join('')}
        </ul>
      </div>` : '';

    elementoLateral.innerHTML = `
      ${htmlMateriais}
      <div class="card detail-card" id="detalhe-cartao-autor"></div>
    `;
    const cartaoAutor = document.getElementById('detalhe-cartao-autor');
    cartaoAutor.innerHTML = `
      <h2 class="detail-sec-title"><i class="ti ti-user"></i> Autor</h2>
      <a href="perfil.html?usuario=${encodeURIComponent(projeto.nome_usuario)}" class="detail-author-card">
        <div class="detail-avatar detail-author-card-avatar">${htmlAvatar(projeto.url_avatar, projeto.nome_usuario)}</div>
        <div>
          <div class="detail-author-card-name">${escaparHtml(projeto.nome_usuario)}</div>
          <div class="detail-author-card-link">Ver perfil →</div>
        </div>
      </a>`;
  }
}

// ── Modal de denúncia (compartilhado entre projeto e comentários) ──────────
const DenunciaModal = (() => {
  const overlay          = document.getElementById('denuncia-modal-overlay');
  const elAlvo            = document.getElementById('denuncia-modal-alvo');
  const campoMotivo       = document.getElementById('denuncia-motivo');
  const contadorMotivo    = document.getElementById('denuncia-motivo-contador');
  const botaoConfirmar    = document.getElementById('denuncia-confirmar-btn');
  const botaoCancelar     = document.getElementById('denuncia-cancelar-btn');
  let endpointAtual = null;

  campoMotivo.addEventListener('input', () => {
    contadorMotivo.textContent = `${campoMotivo.value.length}/500`;
  });

  function fechar() {
    overlay.classList.add('hidden');
    endpointAtual = null;
  }

  function abrir(endpoint, descricaoAlvo) {
    endpointAtual = endpoint;
    elAlvo.textContent = descricaoAlvo;
    campoMotivo.value = '';
    contadorMotivo.textContent = '0/500';
    overlay.classList.remove('hidden');
    campoMotivo.focus();
  }

  botaoCancelar.addEventListener('click', fechar);
  overlay.addEventListener('click', (evento) => { if (evento.target === overlay) fechar(); });

  botaoConfirmar.addEventListener('click', async () => {
    const motivo = campoMotivo.value.trim();
    if (!motivo) {
      Aviso.mostrar('Informe o motivo da denúncia.', 'error');
      campoMotivo.focus();
      return;
    }
    botaoConfirmar.disabled = true;
    const htmlOriginal = botaoConfirmar.innerHTML;
    botaoConfirmar.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Enviando...';
    try {
      await API.enviar(endpointAtual, { motivo });
      Aviso.mostrar('Denúncia enviada. Nossa equipe vai analisar.');
      fechar();
    } catch (erro) {
      Aviso.mostrar(mensagemErro(erro, 'Erro ao enviar denúncia.'), 'error');
    } finally {
      botaoConfirmar.disabled = false;
      botaoConfirmar.innerHTML = htmlOriginal;
    }
  });

  return { abrir };
})();

// ── Comentários ──────────────────────────────────────────────────────────────
function renderizarComentarios(cartao, projetoId) {
  const usuario = Sessao.obterUsuario();
  let comentarios = [];
  let enviando = false;

  function renderizarCarregando() {
    cartao.innerHTML = `
      <h2 class="detail-sec-title"><i class="ti ti-message-circle"></i> Comentários</h2>
      <div style="padding:20px 0;display:flex;justify-content:center;"><div class="spinner" style="width:24px;height:24px;"></div></div>`;
  }

  function renderizarCartao() {
    const htmlLista = comentarios.length === 0
      ? `<p style="font-size:13px;color:var(--text3);margin-bottom:16px;">Nenhum comentário ainda. Seja o primeiro!</p>`
      : `<div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
          ${comentarios.map(c => `
            <div class="comment-item" data-comentario-id="${c.id}">
              <div class="comment-header">
                <div class="comment-header-left">
                  ${c.url_avatar
                    ? `<img src="${escaparHtml(c.url_avatar)}" alt="${escaparHtml(c.nome_usuario)}" class="comment-avatar">`
                    : `<div class="comment-avatar-letter">${escaparHtml(obterInicial(c.nome_usuario))}</div>`}
                  <a href="perfil.html?usuario=${encodeURIComponent(c.nome_usuario)}" class="comment-author">${escaparHtml(c.nome_usuario)}</a>
                  <span class="comment-date">${formatarDataCurta(c.criado_em)}</span>
                </div>
                ${usuario ? `
                <div class="comment-header-actions">
                  ${usuario.nome_usuario === c.nome_usuario || usuario.papel === 'admin' ? `<button class="comment-delete-btn" data-deletar-comentario="${c.id}" title="Remover comentário"><i class="ti ti-trash"></i></button>` : ''}
                  ${usuario.nome_usuario !== c.nome_usuario ? `<button class="comment-delete-btn" data-denunciar-comentario="${c.id}" title="Denunciar comentário"><i class="ti ti-flag"></i></button>` : ''}
                </div>` : ''}
              </div>
              <p class="comment-text">${escaparHtml(c.conteudo)}</p>
              <button class="comment-like-btn ${c.curtido ? 'is-liked' : ''}" data-curtir-comentario="${c.id}">
                <i class="ti ti-heart"></i> <span class="comment-like-count">${c.total_curtidas || 0}</span>
              </button>
            </div>`).join('')}
        </div>`;

    cartao.innerHTML = `
      <h2 class="detail-sec-title">
        <i class="ti ti-message-circle"></i> Comentários
        <span style="margin-left:8px;font-size:13px;font-weight:400;color:var(--text3);">(${comentarios.length})</span>
      </h2>
      ${htmlLista}
      <form class="comment-form" id="comentario-form">
        <div class="detail-avatar comment-form-avatar">${usuario ? htmlAvatar(usuario.url_avatar, usuario.nome_usuario) : ''}</div>
        <div class="comment-form-body">
          <textarea class="form-input comment-textarea" id="comentario-texto" placeholder="Escreva um comentário..." maxlength="1000"></textarea>
          <div class="comment-form-footer">
            <span class="comment-char-count" id="comentario-contador">0/1000</span>
            <button type="submit" class="btn btn-primary btn-sm" id="comentario-enviar-btn" disabled>
              <i class="ti ti-send"></i> Comentar
            </button>
          </div>
        </div>
      </form>`;

    cartao.querySelectorAll('[data-deletar-comentario]').forEach(botao => {
      botao.addEventListener('click', () => deletarComentario(botao.dataset.deletarComentario));
    });

    cartao.querySelectorAll('[data-curtir-comentario]').forEach(botao => {
      botao.addEventListener('click', () => curtirComentario(botao.dataset.curtirComentario));
    });

    cartao.querySelectorAll('[data-denunciar-comentario]').forEach(botao => {
      botao.addEventListener('click', () => {
        const comentarioId = botao.dataset.denunciarComentario;
        const comentario = comentarios.find(c => String(c.id) === String(comentarioId));
        const trecho = comentario ? comentario.conteudo.slice(0, 60) : '';
        DenunciaModal.abrir(
          `/projetos/${projetoId}/comentarios/${comentarioId}/denunciar`,
          `Denunciando comentário: "${trecho}${comentario && comentario.conteudo.length > 60 ? '…' : ''}"`
        );
      });
    });

    const formulario = document.getElementById('comentario-form');
    const areaTexto = document.getElementById('comentario-texto');
    const contador = document.getElementById('comentario-contador');
    const botaoEnviar = document.getElementById('comentario-enviar-btn');

    areaTexto.addEventListener('input', () => {
      contador.textContent = `${areaTexto.value.length}/1000`;
      botaoEnviar.disabled = enviando || !areaTexto.value.trim();
    });

    formulario.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const texto = areaTexto.value;
      if (!texto.trim()) return;
      enviando = true;
      botaoEnviar.disabled = true;
      botaoEnviar.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>';
      try {
        const { dados } = await API.enviar(`/projetos/${projetoId}/comentarios`, { conteudo: texto });
        comentarios.push(dados);
        enviando = false;
        renderizarCartao();
      } catch (erro) {
        Aviso.mostrar(mensagemErro(erro, 'Erro ao comentar.'), 'error');
        enviando = false;
        botaoEnviar.disabled = false;
        botaoEnviar.innerHTML = '<i class="ti ti-send"></i> Comentar';
      }
    });
  }

  async function curtirComentario(comentarioId) {
    const comentario = comentarios.find(c => String(c.id) === String(comentarioId));
    if (!comentario) return;
    try {
      const { dados } = await API.enviar(`/projetos/${projetoId}/comentarios/${comentarioId}/curtir`);
      comentario.curtido = dados.curtido;
      comentario.total_curtidas = dados.total_curtidas;
      renderizarCartao();
    } catch {
      Aviso.mostrar('Erro ao curtir comentário.', 'error');
    }
  }

  async function deletarComentario(comentarioId) {
    const ok = await Confirmacao.perguntar({
      titulo: 'Excluir comentário',
      mensagem: 'Deseja mesmo excluir este comentário? Essa ação não pode ser desfeita.',
      textoConfirmar: 'Excluir',
      perigo: true,
    });
    if (!ok) return;
    try {
      await API.remover(`/projetos/${projetoId}/comentarios/${comentarioId}`);
      comentarios = comentarios.filter(c => String(c.id) !== String(comentarioId));
      Aviso.mostrar('Comentário removido.');
      renderizarCartao();
    } catch { Aviso.mostrar('Erro ao remover comentário.', 'error'); }
  }

  renderizarCarregando();
  API.obter(`/projetos/${projetoId}/comentarios`)
    .then(({ dados }) => { comentarios = dados; })
    .catch(() => { Aviso.mostrar('Erro ao carregar comentários.', 'error'); })
    .finally(() => { renderizarCartao(); });
}
