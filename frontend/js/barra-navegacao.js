/**
 * Barra de navegação + sino de notificações.
 * Renderiza dentro do elemento com id="navegacao-raiz", presente em todas as páginas.
 */

const CONFIG_TIPO_NOTIFICACAO = {
  curtida:            { icone: 'ti-heart',   cor: '#f07070', rotulo: 'curtiu seu projeto' },
  copia:              { icone: 'ti-copy',    cor: '#4ecfa0', rotulo: 'copiou seu projeto' },
  comentario:         { icone: 'ti-message', cor: '#7aadff', rotulo: 'comentou no seu projeto' },
  curtida_comentario: { icone: 'ti-heart',   cor: '#f0a070', rotulo: 'curtiu seu comentário' },
};

function iniciarBarraNavegacao() {
  const raiz = document.getElementById('navegacao-raiz');
  if (!raiz) return;

  const usuario = Sessao.obterUsuario();
  const linkLogo = usuario ? 'explorar.html' : 'inicio.html';

  const htmlDesktopLogado = !usuario ? '' : `
    <div class="navbar-desktop">
      <a href="explorar.html" class="btn btn-ghost btn-sm"><i class="ti ti-layout-grid"></i> Explorar</a>
      <a href="publicar.html" class="btn btn-primary btn-sm"><i class="ti ti-plus"></i> Publicar</a>
      <div id="sino-raiz"></div>
      <div class="nav-avatar-wrap" id="nav-avatar-wrap">
        <button class="nav-avatar" id="nav-avatar-btn">
          ${htmlAvatar(usuario.url_avatar, usuario.nome_usuario)}
        </button>
        <div class="nav-dropdown hidden" id="nav-menu-suspenso">
          <div class="nav-dd-user"><span>${escaparHtml(usuario.nome_usuario)}</span></div>
          <a href="perfil.html?usuario=${encodeURIComponent(usuario.nome_usuario)}" class="nav-dd-item"><i class="ti ti-user"></i> Meu perfil</a>
          <a href="salvos.html" class="nav-dd-item"><i class="ti ti-bookmark"></i> Projetos salvos</a>
          <a href="estatisticas.html" class="nav-dd-item"><i class="ti ti-chart-bar"></i> Estatísticas</a>
          ${usuario.papel === 'admin' ? '<a href="admin.html" class="nav-dd-item"><i class="ti ti-shield-lock"></i> Painel admin <span class="nav-dd-badge hidden" id="admin-pendencias-badge-desktop"></span></a>' : ''}
          <div class="nav-dd-divider"></div>
          <button class="nav-dd-item nav-dd-item-danger" id="nav-sair-btn" style="cursor:pointer;"><i class="ti ti-logout"></i> Sair</button>
        </div>
      </div>
    </div>`;

  const htmlDesktopVisitante = `
    <div class="navbar-desktop">
      <a href="entrar.html" class="btn btn-outline btn-sm">Entrar</a>
      <a href="cadastro.html" class="btn btn-primary btn-sm">Criar conta</a>
    </div>`;

  const htmlMobileLogado = !usuario ? '' : `
    <div class="nav-mobile-user">
      <div class="nav-avatar nav-mobile-avatar">${htmlAvatar(usuario.url_avatar, usuario.nome_usuario)}</div>
      <div>
        <div class="nav-mobile-name">${escaparHtml(usuario.nome_usuario)}</div>
        <div class="nav-mobile-role">Maker</div>
      </div>
    </div>
    <div class="nav-mobile-divider"></div>
    <a href="explorar.html" class="nav-mobile-item"><i class="ti ti-layout-grid"></i> Explorar projetos</a>
    <a href="publicar.html" class="nav-mobile-item nav-mobile-item-green"><i class="ti ti-plus"></i> Publicar projeto</a>
    <a href="salvos.html" class="nav-mobile-item"><i class="ti ti-bookmark"></i> Projetos salvos</a>
    <a href="estatisticas.html" class="nav-mobile-item"><i class="ti ti-chart-bar"></i> Estatísticas</a>
    ${usuario.papel === 'admin' ? '<a href="admin.html" class="nav-mobile-item"><i class="ti ti-shield-lock"></i> Painel admin <span class="nav-dd-badge hidden" id="admin-pendencias-badge-mobile"></span></a>' : ''}
    <a href="perfil.html?usuario=${encodeURIComponent(usuario.nome_usuario)}" class="nav-mobile-item"><i class="ti ti-user"></i> Meu perfil</a>
    <div class="nav-mobile-divider"></div>
    <button class="nav-mobile-item nav-mobile-item-danger" id="nav-mobile-sair-btn"><i class="ti ti-logout"></i> Sair</button>`;

  const htmlMobileVisitante = `
    <a href="entrar.html" class="nav-mobile-item"><i class="ti ti-login"></i> Entrar</a>
    <a href="cadastro.html" class="nav-mobile-item nav-mobile-item-green"><i class="ti ti-user-plus"></i> Criar conta</a>`;

  raiz.innerHTML = `
    <nav class="navbar">
      <a href="${linkLogo}" class="nav-logo">
        <img src="../recursos/logo.png" alt="Circuito Aberto" style="width:50px;height:50px;object-fit:contain;">
        <span class="nav-logo-text">Circuito Aberto</span>
      </a>
      ${usuario ? htmlDesktopLogado : htmlDesktopVisitante}
      <button class="navbar-hamburger" id="nav-menu-btn">
        <i class="ti ti-menu-2" style="font-size:24px;" id="nav-menu-icone"></i>
      </button>
    </nav>
    <div class="mobile-menu hidden" id="nav-menu-mobile">
      ${usuario ? htmlMobileLogado : htmlMobileVisitante}
    </div>`;

  // ── Menu suspenso do avatar (desktop) ─────────────────────────────────────
  const botaoAvatar = document.getElementById('nav-avatar-btn');
  const menuSuspenso = document.getElementById('nav-menu-suspenso');
  if (botaoAvatar && menuSuspenso) {
    botaoAvatar.addEventListener('click', () => menuSuspenso.classList.toggle('hidden'));
    document.addEventListener('mousedown', (evento) => {
      if (!evento.target.closest('.nav-avatar-wrap')) menuSuspenso.classList.add('hidden');
    });
  }
  const botaoSair = document.getElementById('nav-sair-btn');
  if (botaoSair) botaoSair.addEventListener('click', sairDaConta);

  // ── Menu mobile (hambúrguer) ──────────────────────────────────────────────
  const botaoMenu = document.getElementById('nav-menu-btn');
  const iconeMenu = document.getElementById('nav-menu-icone');
  const menuMobile = document.getElementById('nav-menu-mobile');
  if (botaoMenu) {
    botaoMenu.addEventListener('click', () => {
      const estaAberto = !menuMobile.classList.contains('hidden');
      menuMobile.classList.toggle('hidden');
      iconeMenu.className = !estaAberto ? 'ti ti-x' : 'ti ti-menu-2';
      iconeMenu.style.fontSize = '24px';
    });
  }
  const botaoSairMobile = document.getElementById('nav-mobile-sair-btn');
  if (botaoSairMobile) botaoSairMobile.addEventListener('click', sairDaConta);

  // ── Notificações (apenas logado) ──────────────────────────────────────────
  if (usuario) iniciarSinoNotificacoes();

  // ── Contador de denúncias pendentes no link "Painel admin" ────────────────
  if (usuario && usuario.papel === 'admin') iniciarContadorAdminPendencias();
}

function sairDaConta() {
  Sessao.sair();
  window.location.href = 'inicio.html';
}

// ── Contador de denúncias pendentes (link "Painel admin") ───────────────────
let intervaloPendenciasAdmin = null;

function iniciarContadorAdminPendencias() {
  const badgeDesktop = document.getElementById('admin-pendencias-badge-desktop');
  const badgeMobile = document.getElementById('admin-pendencias-badge-mobile');
  if (!badgeDesktop && !badgeMobile) return;

  async function atualizar() {
    try {
      const { dados } = await API.obter('/admin/denuncias?status=pendente');
      const total = dados.total || 0;
      const texto = total > 9 ? '9+' : String(total);
      [badgeDesktop, badgeMobile].forEach(badge => {
        if (!badge) return;
        badge.textContent = texto;
        badge.classList.toggle('hidden', total === 0);
      });
    } catch {}
  }

  atualizar();
  if (intervaloPendenciasAdmin) clearInterval(intervaloPendenciasAdmin);
  intervaloPendenciasAdmin = setInterval(atualizar, 30000);
}

// ── Sino de notificações ─────────────────────────────────────────────────────
let intervaloNotificacoes = null;

function iniciarSinoNotificacoes() {
  const raiz = document.getElementById('sino-raiz');
  if (!raiz) return;

  let notificacoes = [];
  let naoLidas = 0;
  let aberto = false;

  raiz.innerHTML = `
    <div style="position:relative;" id="sino-wrap">
      <button class="nb-bell" id="sino-btn" title="Notificações">
        <i class="ti ti-bell"></i>
        <span class="nb-badge hidden" id="sino-contador"></span>
      </button>
      <div class="nb-panel hidden" id="sino-painel"></div>
    </div>`;

  const wrap = document.getElementById('sino-wrap');
  const botaoSino = document.getElementById('sino-btn');
  const contador = document.getElementById('sino-contador');
  const painel = document.getElementById('sino-painel');

  function renderizarContador() {
    if (naoLidas > 0) {
      contador.textContent = naoLidas > 9 ? '9+' : String(naoLidas);
      contador.classList.remove('hidden');
    } else {
      contador.classList.add('hidden');
    }
  }

  function renderizarPainel() {
    let htmlLista;
    if (notificacoes.length === 0) {
      htmlLista = `
        <div class="nb-empty">
          <i class="ti ti-bell-off"></i>
          <p>Nenhuma notificação ainda</p>
        </div>`;
    } else {
      htmlLista = notificacoes.map(n => {
        const config = CONFIG_TIPO_NOTIFICACAO[n.tipo] || CONFIG_TIPO_NOTIFICACAO.curtida;
        const classeNaoLida = !n.lida_em ? 'nb-item-unread' : '';
        return `
          <a href="projeto.html?id=${encodeURIComponent(n.projeto_id)}" class="nb-item ${classeNaoLida}" data-notificacao-id="${n.id}">
            <div class="nb-actor-avatar">${htmlAvatar(n.autor_url_avatar, n.autor_nome_usuario)}</div>
            <div class="nb-type-icon" style="background:${config.cor}22;color:${config.cor};">
              <i class="ti ${config.icone}"></i>
            </div>
            <div class="nb-item-body">
              <span class="nb-item-text"><strong>${escaparHtml(n.autor_nome_usuario)}</strong> ${config.rotulo}</span>
              <span class="nb-item-project">"${escaparHtml(n.projeto_titulo)}"</span>
              <span class="nb-item-time">${tempoAtras(n.criado_em)}</span>
            </div>
            ${!n.lida_em ? '<div class="nb-unread-dot"></div>' : ''}
          </a>`;
      }).join('');
    }

    const temNaoLidas = notificacoes.some(n => !n.lida_em);
    painel.innerHTML = `
      <div class="nb-panel-header">
        <span class="nb-panel-title">Notificações</span>
        ${temNaoLidas ? '<button class="nb-mark-all" id="sino-marcar-todas-btn">Marcar todas como lidas</button>' : ''}
      </div>
      <div class="nb-list">${htmlLista}</div>`;

    const botaoMarcarTodas = document.getElementById('sino-marcar-todas-btn');
    if (botaoMarcarTodas) {
      botaoMarcarTodas.addEventListener('click', async () => {
        try {
          await API.atualizar('/notificacoes/marcar-todas');
          notificacoes = notificacoes.map(n => ({ ...n, lida_em: new Date().toISOString() }));
          naoLidas = 0;
          renderizarContador();
          renderizarPainel();
        } catch {}
      });
    }
    painel.querySelectorAll('.nb-item').forEach(item => {
      item.addEventListener('click', () => { aberto = false; painel.classList.add('hidden'); });
    });
  }

  async function buscarNaoLidas() {
    try {
      const { dados } = await API.obter('/notificacoes/nao-lidas');
      naoLidas = dados.total;
      renderizarContador();
    } catch {}
  }

  async function alternarPainel() {
    aberto = !aberto;
    painel.classList.toggle('hidden', !aberto);
    if (aberto) {
      try {
        const { dados } = await API.obter('/notificacoes');
        notificacoes = dados;
        renderizarPainel();
        if (naoLidas > 0) {
          await API.atualizar('/notificacoes/marcar-todas');
          naoLidas = 0;
          renderizarContador();
        }
      } catch {}
    }
  }

  botaoSino.addEventListener('click', alternarPainel);
  document.addEventListener('mousedown', (evento) => {
    if (wrap && !wrap.contains(evento.target)) {
      aberto = false;
      painel.classList.add('hidden');
    }
  });

  buscarNaoLidas();
  if (intervaloNotificacoes) clearInterval(intervaloNotificacoes);
  intervaloNotificacoes = setInterval(buscarNaoLidas, 30000);
}
