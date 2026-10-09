/**
 * Página de perfil do usuário (dados, bio, avatar e lista de projetos).
 */
function iniciarPaginaPerfil() {
  const nomeUsuario = obterParametroUrl('usuario');
  const usuarioLogado = Sessao.obterUsuario();
  const souEu = usuarioLogado && usuarioLogado.nome_usuario === nomeUsuario;

  const elementoCarregando     = document.getElementById('perfil-carregando');
  const elementoNaoEncontrado  = document.getElementById('perfil-nao-encontrado');
  const elementoRaiz           = document.getElementById('perfil-raiz');
  const elementoCartao         = document.getElementById('perfil-cartao');
  const elementoTituloSecao    = document.getElementById('perfil-titulo-secao');
  const elementoVazio          = document.getElementById('perfil-vazio');
  const elementoGrade          = document.getElementById('perfil-grade');

  if (!nomeUsuario) {
    elementoCarregando.classList.add('hidden');
    elementoNaoEncontrado.classList.remove('hidden');
    return;
  }

  let perfil = null;
  let biografia = '';
  let editandoBio = false;
  let carregandoAvatar = false;
  let todosProjetos = [];
  let pagina = 1;
  let temProxima = false;
  let botaoCarregarMais = null;

  API.obter(`/usuarios/${nomeUsuario}`)
    .then(({ dados }) => {
      perfil = dados;
      biografia = dados.biografia || '';
      todosProjetos = dados.projetos || [];
      pagina = dados.pagina || 1;
      temProxima = !!dados.tem_proxima;
      renderizarTudo();
      elementoCarregando.classList.add('hidden');
      elementoRaiz.classList.remove('hidden');
    })
    .catch(() => {
      elementoCarregando.classList.add('hidden');
      elementoNaoEncontrado.classList.remove('hidden');
    });

  function renderizarTudo() {
    renderizarCartao();
    renderizarProjetos();
  }

  function renderizarCartao() {
    const blocoAvatar = perfil.url_avatar
      ? `<img src="${escaparHtml(perfil.url_avatar)}" alt="${escaparHtml(perfil.nome_usuario)}" class="profile-avatar-img">`
      : `<div class="profile-avatar-letter">${escaparHtml(obterInicial(perfil.nome_usuario))}</div>`;

    const htmlEditarAvatar = souEu ? `
      <button class="profile-avatar-edit-btn" id="perfil-avatar-editar-btn" title="Trocar foto de perfil" ${carregandoAvatar ? 'disabled' : ''}>
        ${carregandoAvatar ? '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>' : '<i class="ti ti-camera"></i>'}
      </button>
      <input type="file" accept="image/*" style="display:none;" id="perfil-avatar-campo">` : '';

    const htmlBio = editandoBio ? `
      <div class="profile-bio-edit-row">
        <textarea class="form-input profile-bio-textarea" id="perfil-bio-texto" placeholder="Escreva algo sobre você...">${escaparHtml(biografia)}</textarea>
        <div class="profile-bio-edit-actions">
          <button class="btn btn-primary btn-sm" id="perfil-bio-salvar-btn">Salvar</button>
          <button class="btn btn-outline btn-sm" id="perfil-bio-cancelar-btn">Cancelar</button>
        </div>
      </div>` : `
      <p class="profile-bio">
        ${souEu ? `<button type="button" class="btn btn-ghost btn-sm profile-bio-spacer" aria-hidden="true" tabindex="-1" disabled><i class="ti ti-edit" style="font-size:14px;"></i></button>` : ''}
        ${escaparHtml(perfil.biografia || (souEu ? 'Sem bio ainda. Clique para adicionar.' : ''))}
        ${souEu ? `<button type="button" class="btn btn-ghost btn-sm profile-bio-edit-btn" id="perfil-bio-editar-btn" title="Editar bio"><i class="ti ti-edit" style="font-size:14px;"></i></button>` : ''}
      </p>`;

    elementoCartao.innerHTML = `
      <div class="profile-avatar-wrap">
        ${blocoAvatar}
        ${htmlEditarAvatar}
      </div>
      <div class="profile-info">
        <h1 class="profile-name">${escaparHtml(perfil.nome_usuario)}</h1>
        ${htmlBio}
        <div class="profile-stats">
          <div class="profile-stat">
            <span class="profile-stat-num">${perfil.total_projetos ?? ((perfil.projetos && perfil.projetos.length) || 0)}</span>
            <span class="profile-stat-label">Projetos</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-num">${(perfil.estatisticas && perfil.estatisticas.total_curtidas) || 0}</span>
            <span class="profile-stat-label">Curtidas</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-num">${(perfil.estatisticas && perfil.estatisticas.total_copias) || 0}</span>
            <span class="profile-stat-label">Cópias</span>
          </div>
        </div>
        <div class="profile-member-since">
          <i class="ti ti-calendar"></i> Membro desde ${formatarMesAno(perfil.criado_em)}
        </div>
      </div>`;

    if (souEu) {
      const botaoEditarAvatar = document.getElementById('perfil-avatar-editar-btn');
      const campoAvatar = document.getElementById('perfil-avatar-campo');
      if (botaoEditarAvatar) botaoEditarAvatar.addEventListener('click', () => campoAvatar.click());
      if (campoAvatar) campoAvatar.addEventListener('change', trocarAvatar);

      if (editandoBio) {
        document.getElementById('perfil-bio-salvar-btn').addEventListener('click', salvarBio);
        document.getElementById('perfil-bio-cancelar-btn').addEventListener('click', () => {
          editandoBio = false;
          renderizarCartao();
        });
        document.getElementById('perfil-bio-texto').addEventListener('input', (evento) => {
          biografia = evento.target.value;
        });
      } else {
        const botaoEditar = document.getElementById('perfil-bio-editar-btn');
        if (botaoEditar) botaoEditar.addEventListener('click', () => { editandoBio = true; renderizarCartao(); });
      }
    }
  }

  async function salvarBio() {
    try {
      await API.atualizar('/usuarios/eu/perfil', { biografia });
      perfil.biografia = biografia;
      editandoBio = false;
      renderizarCartao();
      Aviso.mostrar('Bio atualizada!');
    } catch { Aviso.mostrar('Erro ao salvar bio.', 'error'); }
  }

  async function trocarAvatar(evento) {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;
    if (arquivo.size > 5 * 1024 * 1024) {
      Aviso.mostrar('Imagem muito grande. Máximo 5MB.', 'error');
      return;
    }
    carregandoAvatar = true;
    renderizarCartao();

    const campos = new FormData();
    campos.append('avatar', arquivo);
    try {
      const { dados } = await API.enviar('/usuarios/eu/avatar', campos);
      perfil.url_avatar = dados.url_avatar;
      // Atualiza também o usuário guardado no navegador
      Sessao.entrar(Sessao.obterToken(), { ...usuarioLogado, url_avatar: dados.url_avatar });
      Aviso.mostrar('Foto de perfil atualizada!');
    } catch {
      Aviso.mostrar('Erro ao enviar foto.', 'error');
    } finally {
      carregandoAvatar = false;
      renderizarCartao();
    }
  }

  function garantirBotaoCarregarMais() {
    if (botaoCarregarMais) return botaoCarregarMais;
    botaoCarregarMais = document.createElement('button');
    botaoCarregarMais.className = 'btn btn-outline';
    botaoCarregarMais.style.cssText = 'display:block;margin:24px auto 0;';
    botaoCarregarMais.textContent = 'Carregar mais';
    botaoCarregarMais.addEventListener('click', carregarMaisProjetos);
    elementoGrade.insertAdjacentElement('afterend', botaoCarregarMais);
    return botaoCarregarMais;
  }

  async function carregarMaisProjetos() {
    botaoCarregarMais.disabled = true;
    botaoCarregarMais.textContent = 'Carregando...';
    try {
      const { dados } = await API.obter(`/usuarios/${nomeUsuario}`, { parametros: { pagina: pagina + 1 } });
      pagina = dados.pagina;
      temProxima = dados.tem_proxima;
      todosProjetos = todosProjetos.concat(dados.projetos || []);
      renderizarProjetos();
    } catch {
      Aviso.mostrar('Erro ao carregar mais projetos.', 'error');
    } finally {
      const botao = garantirBotaoCarregarMais();
      botao.disabled = false;
      botao.textContent = 'Carregar mais';
    }
  }

  function renderizarProjetos() {
    elementoTituloSecao.innerHTML = souEu
      ? `Meus projetos <a href="publicar.html" class="btn btn-primary btn-sm" style="margin-left:12px;"><i class="ti ti-plus"></i> Publicar</a>`
      : `Projetos de ${escaparHtml(perfil.nome_usuario)}`;

    if (todosProjetos.length === 0) {
      elementoVazio.classList.remove('hidden');
      elementoGrade.classList.add('hidden');
      elementoVazio.innerHTML = `
        <i class="ti ti-mood-empty"></i>
        <p>${souEu ? 'Você ainda não publicou nenhum projeto.' : 'Este usuário ainda não publicou projetos.'}</p>
        ${souEu ? `<a href="publicar.html" class="btn btn-primary" style="margin-top:16px;"><i class="ti ti-plus"></i> Publicar meu primeiro projeto</a>` : ''}`;
      if (botaoCarregarMais) botaoCarregarMais.classList.add('hidden');
    } else {
      elementoGrade.classList.remove('hidden');
      elementoVazio.classList.add('hidden');
      elementoGrade.innerHTML = todosProjetos
        .map(p => renderizarCartaoProjeto({ ...p, nome_usuario: perfil.nome_usuario, url_avatar: perfil.url_avatar }))
        .join('');
      const botao = garantirBotaoCarregarMais();
      botao.classList.toggle('hidden', !temProxima);
    }
  }
}
