/**
 * Painel administrativo. Só usuários com papel 'admin' têm acesso — a
 * verificação já acontece no backend em toda rota /api/admin/*, mas aqui
 * fazemos uma checagem extra no front para não nem carregar a tela.
 */
function iniciarPaginaAdmin() {
  const usuario = Sessao.obterUsuario();
  if (!usuario || usuario.papel !== 'admin') {
    window.location.replace('explorar.html');
    return;
  }

  iniciarSidebarAdmin(usuario);
  carregarEstatisticas();
  iniciarSecaoUsuarios();
  iniciarSecaoProjetos();
  iniciarSecaoDenuncias();
  iniciarSecaoLogs();
}

// ── Sidebar: dados do admin logado, navegação e sair ────────────────────────
function iniciarSidebarAdmin(usuario) {
  const raizUsuario = document.getElementById('admin-sidebar-usuario');
  if (raizUsuario) {
    const inicial = (usuario.nome_usuario || '?').charAt(0).toUpperCase();
    raizUsuario.innerHTML = `
      <div class="admin-sidebar-user-avatar">${inicial}</div>
      <div style="min-width:0;">
        <p class="admin-sidebar-user-nome">${escaparHtml(usuario.nome_usuario)}</p>
        <p class="admin-sidebar-user-papel">Administrador</p>
      </div>`;
  }

  const botaoSair = document.getElementById('admin-sair-btn');
  if (botaoSair) {
    botaoSair.innerHTML = '<i class="ti ti-logout"></i> <span>Sair</span>';
    botaoSair.addEventListener('click', () => {
      Sessao.sair();
      window.location.href = 'inicio.html';
    });
  }

  // Marca o item de navegação ativo ao clicar (sem scroll-spy, simples e robusto)
  document.querySelectorAll('.admin-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('admin-nav-item-active'));
      item.classList.add('admin-nav-item-active');
    });
  });
}

// ── Estatísticas gerais ──────────────────────────────────────────────────────
function carregarEstatisticas() {
  const raiz = document.getElementById('admin-estatisticas');
  API.obter('/admin/estatisticas')
    .then(({ dados }) => {
      const g = dados.geral;
      raiz.innerHTML = [
        ['ti-users', 'Usuários', g.total_usuarios],
        ['ti-shield-lock', 'Admins', g.total_admins],
        ['ti-user-off', 'Banidos', g.total_banidos, '#f07070'],
        ['ti-layout-grid', 'Projetos', g.total_projetos],
        ['ti-message', 'Comentários', g.total_comentarios],
        ['ti-heart', 'Curtidas', g.total_curtidas],
        ['ti-flag', 'Denúncias pendentes', g.total_denuncias_pendentes, g.total_denuncias_pendentes > 0 ? '#f0a070' : null],
      ].map(([icone, rotulo, valor, cor]) => `
        <div class="card stat-card">
          <div class="stat-card-icon" style="color:${cor || 'var(--green)'};background:${cor || 'var(--green)'}18;">
            <i class="ti ${icone}"></i>
          </div>
          <div class="stat-card-num">${valor}</div>
          <div class="stat-card-label">${rotulo}</div>
        </div>`).join('');

      const contadorNav = document.getElementById('admin-nav-denuncias-contador');
      if (contadorNav) {
        if (g.total_denuncias_pendentes > 0) {
          contadorNav.textContent = g.total_denuncias_pendentes;
          contadorNav.classList.remove('hidden');
        } else {
          contadorNav.classList.add('hidden');
        }
      }
    })
    .catch(() => { raiz.innerHTML = `<p style="color:var(--text3);">Erro ao carregar estatísticas.</p>`; });
}

// ── Seção de usuários ────────────────────────────────────────────────────────
function iniciarSecaoUsuarios() {
  const tabela = document.getElementById('admin-usuarios-tabela');
  const carregando = document.getElementById('admin-usuarios-carregando');
  const campoBusca = document.getElementById('admin-usuarios-busca');
  const paginacao = document.getElementById('admin-usuarios-paginacao');

  const usuarioAtual = Sessao.obterUsuario();
  let pagina = 1;
  let busca = '';

  function carregar(p) {
    pagina = p;
    carregando.classList.remove('hidden');
    tabela.classList.add('hidden');

    API.obter('/admin/usuarios', { parametros: { pagina, busca: busca || undefined } })
      .then(({ dados }) => renderizar(dados))
      .catch(() => Aviso.mostrar('Erro ao carregar usuários.', 'error'))
      .finally(() => carregando.classList.add('hidden'));
  }

  function formatarStatusBanimento(u) {
    if (!u.banido_em) return '<span class="tag" style="background:#4ecfa022;color:#4ecfa0;">Ativo</span>';
    const ate = u.banido_ate ? `até ${formatarDataCurta(u.banido_ate)}` : 'permanente';
    const tituloTooltip = escaparHtml(u.motivo_banimento || 'Sem motivo registrado');
    return `
      <span class="tag" style="background:#f0707022;color:#f07070;">Banido (${ate})</span>
      <span class="admin-ban-tag" title="${tituloTooltip}"><i class="ti ti-info-circle"></i> ver motivo</span>`;
  }

  function renderizar(dados) {
    tabela.classList.remove('hidden');
    tabela.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Usuário</th><th>E-mail</th><th>Projetos</th><th>Papel</th><th>Status</th><th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${dados.usuarios.map(u => `
            <tr>
              <td><a href="perfil.html?usuario=${encodeURIComponent(u.nome_usuario)}">${escaparHtml(u.nome_usuario)}</a></td>
              <td>${escaparHtml(u.email)}</td>
              <td>${u.total_projetos}</td>
              <td><span class="tag ${u.papel === 'admin' ? 'tag-avancado' : 'tag-iniciante'}">${u.papel}</span></td>
              <td>${formatarStatusBanimento(u)}</td>
              <td class="admin-table-acoes">
                ${u.id === usuarioAtual.id ? '<span style="color:var(--text3);font-size:12px;">você</span>' : `
                  <button class="btn btn-outline btn-sm" data-promover="${u.id}" data-nome="${escaparHtml(u.nome_usuario)}" data-papel="${u.papel}">${u.papel === 'admin' ? 'Rebaixar' : 'Promover'}</button>
                  ${u.banido_em
                    ? `<button class="btn btn-outline btn-sm" data-desbanir="${u.id}">Desbanir</button>`
                    : `<button class="btn btn-danger btn-sm" data-banir="${u.id}" data-nome="${escaparHtml(u.nome_usuario)}">Banir</button>`}
                `}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    tabela.querySelectorAll('[data-promover]').forEach(botao => {
      botao.addEventListener('click', () => promover(botao.dataset.promover, botao.dataset.nome, botao.dataset.papel));
    });
    tabela.querySelectorAll('[data-desbanir]').forEach(botao => {
      botao.addEventListener('click', () => desbanir(botao.dataset.desbanir));
    });
    tabela.querySelectorAll('[data-banir]').forEach(botao => {
      botao.addEventListener('click', () => abrirModalBanir(botao.dataset.banir, botao.dataset.nome));
    });

    paginacao.innerHTML = '';
    if (dados.total > dados.usuarios.length || pagina > 1) {
      const totalPaginas = Math.max(1, Math.ceil(dados.total / 20));
      paginacao.innerHTML = `
        <button class="btn btn-outline btn-sm" ${pagina <= 1 ? 'disabled' : ''} id="admin-usuarios-anterior">Anterior</button>
        <span style="font-size:13px;color:var(--text3);">página ${pagina} de ${totalPaginas}</span>
        <button class="btn btn-outline btn-sm" ${!dados.tem_proxima ? 'disabled' : ''} id="admin-usuarios-proxima">Próxima</button>`;
      const botaoAnt = document.getElementById('admin-usuarios-anterior');
      const botaoProx = document.getElementById('admin-usuarios-proxima');
      if (botaoAnt) botaoAnt.addEventListener('click', () => carregar(pagina - 1));
      if (botaoProx) botaoProx.addEventListener('click', () => carregar(pagina + 1));
    }
  }

  async function promover(id, nome, papelAtual) {
    const vaiRebaixar = papelAtual === 'admin';
    const ok = await Confirmacao.perguntar({
      titulo: vaiRebaixar ? 'Rebaixar usuário' : 'Promover a admin',
      mensagem: vaiRebaixar
        ? `Deseja rebaixar ${nome} para usuário comum?`
        : `Deseja promover ${nome} a admin?`,
      textoConfirmar: vaiRebaixar ? 'Rebaixar' : 'Promover',
    });
    if (!ok) return;
    try {
      const { dados } = await API.enviar(`/admin/usuarios/${id}/promover`);
      Aviso.mostrar(dados.papel === 'admin' ? 'Usuário promovido a admin.' : 'Usuário rebaixado a comum.');
      carregar(pagina);
    } catch (erro) {
      Aviso.mostrar(mensagemErro(erro, 'Erro ao alterar papel.'), 'error');
    }
  }

  async function desbanir(id) {
    const ok = await Confirmacao.perguntar({
      titulo: 'Remover banimento',
      mensagem: 'Remover o banimento desta conta?',
      textoConfirmar: 'Desbanir',
    });
    if (!ok) return;
    try {
      await API.enviar(`/admin/usuarios/${id}/banir`);
      Aviso.mostrar('Usuário desbanido.');
      carregar(pagina);
    } catch (erro) {
      Aviso.mostrar(mensagemErro(erro, 'Erro ao desbanir.'), 'error');
    }
  }

  // ── Modal de banimento (motivo obrigatório + duração opcional) ─────────────
  const overlay          = document.getElementById('admin-ban-modal-overlay');
  const modalUsuario      = document.getElementById('admin-ban-modal-usuario');
  const campoMotivo       = document.getElementById('admin-ban-motivo');
  const contadorMotivo    = document.getElementById('admin-ban-motivo-contador');
  const chipsDuracao       = document.getElementById('admin-ban-duracao-chips');
  const campoDiasCustom   = document.getElementById('admin-ban-dias-custom');
  const botaoConfirmarBan = document.getElementById('admin-ban-confirmar-btn');
  const botaoCancelarBan  = document.getElementById('admin-ban-cancelar-btn');
  let alvoBanimentoId = null;

  function abrirModalBanir(id, nome) {
    alvoBanimentoId = id;
    modalUsuario.textContent = `Você está banindo: ${nome}`;
    campoMotivo.value = '';
    contadorMotivo.textContent = '0/500';
    campoDiasCustom.value = '';
    campoDiasCustom.classList.add('hidden');
    chipsDuracao.querySelectorAll('.submit-chip').forEach(c => c.classList.remove('submit-chip-active'));
    chipsDuracao.querySelector('[data-dias=""]').classList.add('submit-chip-active');
    overlay.classList.remove('hidden');
    campoMotivo.focus();
  }

  function fecharModalBanir() {
    overlay.classList.add('hidden');
    alvoBanimentoId = null;
  }

  campoMotivo.addEventListener('input', () => {
    contadorMotivo.textContent = `${campoMotivo.value.length}/500`;
  });

  chipsDuracao.querySelectorAll('.submit-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chipsDuracao.querySelectorAll('.submit-chip').forEach(c => c.classList.remove('submit-chip-active'));
      chip.classList.add('submit-chip-active');
      if (chip.dataset.dias === 'custom') {
        campoDiasCustom.classList.remove('hidden');
        campoDiasCustom.focus();
      } else {
        campoDiasCustom.classList.add('hidden');
      }
    });
  });

  botaoCancelarBan.addEventListener('click', fecharModalBanir);
  overlay.addEventListener('click', (evento) => { if (evento.target === overlay) fecharModalBanir(); });

  botaoConfirmarBan.addEventListener('click', async () => {
    const motivo = campoMotivo.value.trim();
    if (!motivo) {
      Aviso.mostrar('Informe o motivo do banimento.', 'error');
      campoMotivo.focus();
      return;
    }
    const chipAtivo = chipsDuracao.querySelector('.submit-chip-active');
    let dias = chipAtivo ? chipAtivo.dataset.dias : '';
    if (dias === 'custom') {
      dias = campoDiasCustom.value.trim();
      if (!dias || parseInt(dias, 10) <= 0) {
        Aviso.mostrar('Informe um número de dias válido.', 'error');
        campoDiasCustom.focus();
        return;
      }
    }

    botaoConfirmarBan.disabled = true;
    botaoConfirmarBan.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Banindo...';
    try {
      await API.enviar(`/admin/usuarios/${alvoBanimentoId}/banir`, { motivo, dias: dias || undefined });
      Aviso.mostrar('Usuário banido.');
      fecharModalBanir();
      carregar(pagina);
    } catch (erro) {
      Aviso.mostrar(mensagemErro(erro, 'Erro ao banir usuário.'), 'error');
    } finally {
      botaoConfirmarBan.disabled = false;
      botaoConfirmarBan.innerHTML = '<i class="ti ti-ban"></i> Confirmar banimento';
    }
  });

  let temporizadorBusca;
  campoBusca.addEventListener('input', () => {
    clearTimeout(temporizadorBusca);
    temporizadorBusca = setTimeout(() => {
      busca = campoBusca.value.trim();
      carregar(1);
    }, 350);
  });

  carregar(1);
}

// ── Seção de moderação de projetos ──────────────────────────────────────────
function iniciarSecaoProjetos() {
  const tabela = document.getElementById('admin-projetos-tabela');
  const carregando = document.getElementById('admin-projetos-carregando');
  const campoBusca = document.getElementById('admin-projetos-busca');

  function carregar(busca) {
    carregando.classList.remove('hidden');
    tabela.classList.add('hidden');

    API.obter('/projetos', { parametros: { busca: busca || undefined, ordem: 'recentes', todos: '1' } })
      .then(({ dados }) => renderizar(dados.projetos))
      .catch(() => Aviso.mostrar('Erro ao carregar projetos.', 'error'))
      .finally(() => carregando.classList.add('hidden'));
  }

  function renderizar(projetos) {
    tabela.classList.remove('hidden');
    if (projetos.length === 0) {
      tabela.innerHTML = `<p style="color:var(--text3);font-size:13px;padding:12px 0;">Nenhum projeto encontrado.</p>`;
      return;
    }
    tabela.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Título</th><th>Autor</th><th>Plataforma</th><th>Publicado em</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${projetos.map(p => `
            <tr>
              <td><a href="projeto.html?id=${p.id}">${escaparHtml(p.titulo)}</a></td>
              <td><a href="perfil.html?usuario=${encodeURIComponent(p.nome_usuario)}">${escaparHtml(p.nome_usuario)}</a></td>
              <td>${escaparHtml(p.plataforma)}</td>
              <td>${formatarDataCurta(p.criado_em)}</td>
              <td>${p.arquivado ? '<span class="tag tag-iniciante" style="background:rgba(255,255,255,0.08);color:var(--text3);border-color:var(--border2);">Arquivado</span>' : '<span class="tag tag-avancado" style="background:rgba(0,230,118,0.1);color:var(--green);border-color:rgba(0,230,118,0.3);">Ativo</span>'}</td>
              <td class="admin-table-acoes">
                <button class="btn btn-outline btn-sm" data-arquivar-projeto="${p.id}">${p.arquivado ? '<i class="ti ti-archive-off"></i> Desarquivar' : '<i class="ti ti-archive"></i> Arquivar'}</button>
                <button class="btn btn-danger btn-sm" data-deletar-projeto="${p.id}"><i class="ti ti-trash"></i> Remover</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    tabela.querySelectorAll('[data-arquivar-projeto]').forEach(botao => {
      botao.addEventListener('click', () => arquivar(botao.dataset.arquivarProjeto, busca));
    });

    tabela.querySelectorAll('[data-deletar-projeto]').forEach(botao => {
      botao.addEventListener('click', () => deletar(botao.dataset.deletarProjeto, busca));
    });
  }

  let busca = '';
  async function arquivar(id, buscaAtual) {
    try {
      const { dados } = await API.enviar(`/projetos/${id}/arquivar`);
      Aviso.mostrar(dados.arquivado ? 'Projeto arquivado.' : 'Projeto desarquivado.');
      carregar(buscaAtual);
    } catch (erro) {
      Aviso.mostrar(mensagemErro(erro, 'Erro ao arquivar projeto.'), 'error');
    }
  }

  async function deletar(id, buscaAtual) {
    const ok = await Confirmacao.perguntar({
      titulo: 'Remover projeto',
      mensagem: 'Remover este projeto da plataforma? Essa ação não pode ser desfeita.',
      textoConfirmar: 'Remover',
      perigo: true,
    });
    if (!ok) return;
    try {
      await API.remover(`/projetos/${id}`);
      Aviso.mostrar('Projeto removido.');
      carregar(buscaAtual);
    } catch (erro) {
      Aviso.mostrar(mensagemErro(erro, 'Erro ao remover projeto.'), 'error');
    }
  }

  let temporizadorBusca;
  campoBusca.addEventListener('input', () => {
    clearTimeout(temporizadorBusca);
    temporizadorBusca = setTimeout(() => {
      busca = campoBusca.value.trim();
      carregar(busca);
    }, 350);
  });

  carregar('');
}

// ── Seção de denúncias ───────────────────────────────────────────────────────
function iniciarSecaoDenuncias() {
  const tabela = document.getElementById('admin-denuncias-tabela');
  const carregando = document.getElementById('admin-denuncias-carregando');
  const paginacao = document.getElementById('admin-denuncias-paginacao');
  const chipsStatus = document.getElementById('admin-denuncias-status-chips');

  let pagina = 1;
  let status = 'pendente';

  chipsStatus.querySelectorAll('.submit-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chipsStatus.querySelectorAll('.submit-chip').forEach(c => c.classList.remove('submit-chip-active'));
      chip.classList.add('submit-chip-active');
      status = chip.dataset.status;
      carregar(1);
    });
  });

  function carregar(p) {
    pagina = p;
    carregando.classList.remove('hidden');
    tabela.classList.add('hidden');

    API.obter('/admin/denuncias', { parametros: { status, pagina } })
      .then(({ dados }) => renderizar(dados))
      .catch(() => Aviso.mostrar('Erro ao carregar denúncias.', 'error'))
      .finally(() => carregando.classList.add('hidden'));
  }

  function formatarAlvo(d) {
    const rotuloTipo = d.alvo_tipo === 'projeto' ? 'Projeto' : 'Comentário';
    if (!d.alvo_existe) {
      return `<span class="tag" style="background:var(--bg2);color:var(--text3);">${rotuloTipo} já removido</span>`;
    }
    const resumo = d.alvo_resumo.length > 60 ? d.alvo_resumo.slice(0, 60) + '…' : d.alvo_resumo;
    return `
      <a href="${d.alvo_link}" target="_blank" style="display:block;">${escaparHtml(resumo)}</a>
      <span style="font-size:11px;color:var(--text3);">${rotuloTipo} · por ${escaparHtml(d.alvo_autor || '—')}</span>`;
  }

  function renderizar(dados) {
    tabela.classList.remove('hidden');
    if (dados.denuncias.length === 0) {
      tabela.innerHTML = `<p style="color:var(--text3);font-size:13px;padding:12px 0;">Nenhuma denúncia ${status === 'pendente' ? 'pendente' : status === 'resolvida' ? 'resolvida' : 'ignorada'}.</p>`;
      paginacao.innerHTML = '';
      return;
    }
    tabela.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr><th>Conteúdo denunciado</th><th>Motivo</th><th>Denunciado por</th><th>Data</th>${status === 'pendente' ? '<th>Ações</th>' : '<th>Status</th>'}</tr>
        </thead>
        <tbody>
          ${dados.denuncias.map(d => `
            <tr>
              <td style="min-width:160px;">${formatarAlvo(d)}</td>
              <td style="max-width:260px;">${escaparHtml(d.motivo)}</td>
              <td>${escaparHtml(d.denunciante_nome)}</td>
              <td>${formatarDataCurta(d.criado_em)}</td>
              ${status === 'pendente' ? `
                <td class="admin-table-acoes">
                  ${d.alvo_existe ? `<button class="btn btn-danger btn-sm" data-resolver-excluir="${d.id}">Remover conteúdo</button>` : ''}
                  <button class="btn btn-outline btn-sm" data-resolver="${d.id}">Marcar resolvida</button>
                  <button class="btn btn-ghost btn-sm" data-ignorar="${d.id}">Ignorar</button>
                </td>` : `
                <td><span class="tag ${status === 'resolvida' ? 'tag-avancado' : 'tag-iniciante'}">${status === 'resolvida' ? 'Resolvida' : 'Ignorada'}</span></td>`}
            </tr>`).join('')}
        </tbody>
      </table>`;

    tabela.querySelectorAll('[data-resolver-excluir]').forEach(botao => {
      botao.addEventListener('click', () => concluir(botao.dataset.resolverExcluir, 'resolver', true));
    });
    tabela.querySelectorAll('[data-resolver]').forEach(botao => {
      botao.addEventListener('click', () => concluir(botao.dataset.resolver, 'resolver', false));
    });
    tabela.querySelectorAll('[data-ignorar]').forEach(botao => {
      botao.addEventListener('click', () => concluir(botao.dataset.ignorar, 'ignorar', false));
    });

    paginacao.innerHTML = '';
    if (dados.total > dados.denuncias.length || pagina > 1) {
      const totalPaginas = Math.max(1, Math.ceil(dados.total / 20));
      paginacao.innerHTML = `
        <button class="btn btn-outline btn-sm" ${pagina <= 1 ? 'disabled' : ''} id="admin-denuncias-anterior">Anterior</button>
        <span style="font-size:13px;color:var(--text3);">página ${pagina} de ${totalPaginas}</span>
        <button class="btn btn-outline btn-sm" ${!dados.tem_proxima ? 'disabled' : ''} id="admin-denuncias-proxima">Próxima</button>`;
      const botaoAnt = document.getElementById('admin-denuncias-anterior');
      const botaoProx = document.getElementById('admin-denuncias-proxima');
      if (botaoAnt) botaoAnt.addEventListener('click', () => carregar(pagina - 1));
      if (botaoProx) botaoProx.addEventListener('click', () => carregar(pagina + 1));
    }
  }

  async function concluir(id, acao, excluirConteudo) {
    if (excluirConteudo) {
      const ok = await Confirmacao.perguntar({
        titulo: 'Remover conteúdo denunciado',
        mensagem: 'Remover o conteúdo denunciado da plataforma? Essa ação não pode ser desfeita.',
        textoConfirmar: 'Remover',
        perigo: true,
      });
      if (!ok) return;
    }
    try {
      await API.enviar(`/admin/denuncias/${id}/${acao}`, excluirConteudo ? { excluir_conteudo: true } : undefined);
      Aviso.mostrar(acao === 'resolver' ? 'Denúncia marcada como resolvida.' : 'Denúncia ignorada.');
      carregar(pagina);
      carregarEstatisticas();
    } catch (erro) {
      Aviso.mostrar(mensagemErro(erro, 'Erro ao concluir denúncia.'), 'error');
    }
  }

  carregar(1);
}

// ── Seção de log de auditoria ────────────────────────────────────────────────
const ROTULOS_ACAO_LOG = {
  banir: 'Baniu', desbanir: 'Desbaniu', promover: 'Promoveu a admin', rebaixar: 'Rebaixou a comum',
  deletar_projeto: 'Removeu projeto', deletar_comentario: 'Removeu comentário',
  arquivar_projeto: 'Arquivou projeto', desarquivar_projeto: 'Desarquivou projeto',
  resolver_denuncia: 'Resolveu denúncia', ignorar_denuncia: 'Ignorou denúncia',
};

function iniciarSecaoLogs() {
  const tabela = document.getElementById('admin-logs-tabela');
  const carregando = document.getElementById('admin-logs-carregando');
  const paginacao = document.getElementById('admin-logs-paginacao');
  let pagina = 1;

  function carregar(p) {
    pagina = p;
    carregando.classList.remove('hidden');
    tabela.classList.add('hidden');

    API.obter('/admin/logs', { parametros: { pagina } })
      .then(({ dados }) => renderizar(dados))
      .catch(() => Aviso.mostrar('Erro ao carregar log de auditoria.', 'error'))
      .finally(() => carregando.classList.add('hidden'));
  }

  function renderizar(dados) {
    tabela.classList.remove('hidden');
    if (dados.logs.length === 0) {
      tabela.innerHTML = `<p style="color:var(--text3);font-size:13px;padding:12px 0;">Nenhuma ação registrada ainda.</p>`;
      paginacao.innerHTML = '';
      return;
    }
    tabela.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Quando</th><th>Admin</th><th>Ação</th><th>Alvo</th><th>Detalhes</th></tr></thead>
        <tbody>
          ${dados.logs.map(l => `
            <tr>
              <td style="white-space:nowrap;">${formatarDataCurta(l.criado_em)}</td>
              <td>${escaparHtml(l.admin_nome)}</td>
              <td>${ROTULOS_ACAO_LOG[l.acao] || escaparHtml(l.acao)}</td>
              <td>${escaparHtml(l.alvo_desc || `#${l.alvo_id}`)}</td>
              <td style="max-width:260px;color:var(--text3);">${escaparHtml(l.detalhes || '—')}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    paginacao.innerHTML = '';
    if (dados.total > dados.logs.length || pagina > 1) {
      const totalPaginas = Math.max(1, Math.ceil(dados.total / 25));
      paginacao.innerHTML = `
        <button class="btn btn-outline btn-sm" ${pagina <= 1 ? 'disabled' : ''} id="admin-logs-anterior">Anterior</button>
        <span style="font-size:13px;color:var(--text3);">página ${pagina} de ${totalPaginas}</span>
        <button class="btn btn-outline btn-sm" ${!dados.tem_proxima ? 'disabled' : ''} id="admin-logs-proxima">Próxima</button>`;
      const botaoAnt = document.getElementById('admin-logs-anterior');
      const botaoProx = document.getElementById('admin-logs-proxima');
      if (botaoAnt) botaoAnt.addEventListener('click', () => carregar(pagina - 1));
      if (botaoProx) botaoProx.addEventListener('click', () => carregar(pagina + 1));
    }
  }

  carregar(1);
}
