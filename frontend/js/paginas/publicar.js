/**
 * Formulário de publicação de projeto (inclui o campo de etiquetas).
 * Usado tanto por publicar.html (criar) quanto por editar.html (editar),
 * distinguindo pelo parâmetro ?id= na URL.
 */
function iniciarPaginaPublicar() {
  const id = obterParametroUrl('id');
  const ehEdicao = !!id;

  let etiquetas = [];
  let arquivoImagem = null;

  const formulario          = document.getElementById('publicar-form');
  const campoTitulo         = formulario.querySelector('[name="titulo"]');
  const campoDescricao      = formulario.querySelector('[name="descricao"]');
  const campoMateriais      = formulario.querySelector('[name="materiais"]');
  const campoMontagem       = formulario.querySelector('[name="montagem"]');
  const campoCodigo         = formulario.querySelector('[name="codigo"]');
  const chipsPlataforma     = document.getElementById('publicar-chips-plataforma');
  const chipsDificuldade    = document.getElementById('publicar-chips-dificuldade');
  const areaEnvioInterna    = document.getElementById('publicar-envio-interno');
  const previaImagem        = document.getElementById('publicar-previa-img');
  const campoImagem         = document.getElementById('publicar-imagem-campo');
  const botaoRemoverImagem  = document.getElementById('publicar-remover-imagem-btn');
  const botaoEnviar         = document.getElementById('publicar-enviar-btn');
  const botaoCancelar       = document.getElementById('publicar-cancelar-btn');
  const tituloPagina        = document.getElementById('publicar-titulo-pagina');

  if (ehEdicao) {
    tituloPagina.textContent = 'Editar projeto';
    botaoEnviar.innerHTML = '<i class="ti ti-check"></i> Salvar alterações';
  }

  botaoCancelar.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = 'explorar.html';
  });

  // ── Chips de plataforma / dificuldade ──────────────────────────────────────
  function configurarChips(area) {
    area.querySelectorAll('.submit-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        area.querySelectorAll('.submit-chip').forEach(c => c.classList.remove('submit-chip-active'));
        chip.classList.add('submit-chip-active');
      });
    });
  }
  configurarChips(chipsPlataforma);
  configurarChips(chipsDificuldade);

  function obterChipAtivo(area, atributo) {
    const ativo = area.querySelector('.submit-chip-active');
    return ativo ? ativo.dataset[atributo] : null;
  }
  function definirChipAtivo(area, atributo, valor) {
    area.querySelectorAll('.submit-chip').forEach(c => {
      c.classList.toggle('submit-chip-active', c.dataset[atributo] === valor);
    });
  }

  // ── Envio de imagem ─────────────────────────────────────────────────────────
  campoImagem.addEventListener('change', (evento) => {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;
    arquivoImagem = arquivo;
    mostrarPrevia(URL.createObjectURL(arquivo));
  });

  function mostrarPrevia(url) {
    previaImagem.src = url;
    previaImagem.classList.remove('hidden');
    areaEnvioInterna.classList.add('hidden');
    botaoRemoverImagem.classList.remove('hidden');
  }

  botaoRemoverImagem.addEventListener('click', (evento) => {
    evento.preventDefault();
    arquivoImagem = null;
    previaImagem.src = '';
    previaImagem.classList.add('hidden');
    areaEnvioInterna.classList.remove('hidden');
    botaoRemoverImagem.classList.add('hidden');
  });

  // ── Etiquetas ───────────────────────────────────────────────────────────────
  const areaEtiquetas  = document.getElementById('etiquetas-area');
  const campoEtiquetas = document.getElementById('etiquetas-campo');

  function renderizarEtiquetas() {
    areaEtiquetas.querySelectorAll('.tag-input-pill').forEach(el => el.remove());
    etiquetas.forEach(e => {
      const pilula = document.createElement('span');
      pilula.className = 'tag-input-pill';
      pilula.innerHTML = `#${escaparHtml(e)} <button type="button" class="tag-input-remove" data-etiqueta="${escaparHtml(e)}">×</button>`;
      areaEtiquetas.insertBefore(pilula, campoEtiquetas);
    });
    areaEtiquetas.querySelectorAll('.tag-input-remove').forEach(botao => {
      botao.addEventListener('click', () => {
        etiquetas = etiquetas.filter(x => x !== botao.dataset.etiqueta);
        renderizarEtiquetas();
      });
    });
    campoEtiquetas.placeholder = etiquetas.length < 10
      ? 'Digite e pressione Enter ou vírgula...'
      : 'Máximo 10 etiquetas';
    campoEtiquetas.disabled = etiquetas.length >= 10;
  }

  function adicionarEtiqueta(texto) {
    const etiqueta = texto.trim().toLowerCase().replace(/\s+/g, '-');
    if (!etiqueta || etiquetas.includes(etiqueta) || etiquetas.length >= 10) return;
    etiquetas.push(etiqueta);
    campoEtiquetas.value = '';
    renderizarEtiquetas();
  }

  areaEtiquetas.addEventListener('click', () => campoEtiquetas.focus());
  campoEtiquetas.addEventListener('keydown', (evento) => {
    if (['Enter', ',', ' '].includes(evento.key)) {
      evento.preventDefault();
      adicionarEtiqueta(campoEtiquetas.value);
    }
    if (evento.key === 'Backspace' && !campoEtiquetas.value && etiquetas.length > 0) {
      etiquetas = etiquetas.slice(0, -1);
      renderizarEtiquetas();
    }
  });
  campoEtiquetas.addEventListener('blur', () => {
    if (campoEtiquetas.value) adicionarEtiqueta(campoEtiquetas.value);
  });

  // ── Carrega os dados existentes (modo edição) ───────────────────────────────
  if (ehEdicao) {
    API.obter(`/projetos/${id}`).then(({ dados }) => {
      campoTitulo.value = dados.titulo;
      campoDescricao.value = dados.descricao;
      campoMateriais.value = dados.materiais || '';
      campoMontagem.value = dados.montagem || '';
      campoCodigo.value = dados.codigo || '';
      definirChipAtivo(chipsPlataforma, 'plataforma', dados.plataforma);
      definirChipAtivo(chipsDificuldade, 'dificuldade', dados.dificuldade);
      etiquetas = dados.etiquetas || [];
      renderizarEtiquetas();
      if (dados.url_imagem) mostrarPrevia(dados.url_imagem);
    }).catch(() => { window.location.href = 'explorar.html'; });
  }

  // ── Envio do formulário ─────────────────────────────────────────────────────
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!campoTitulo.value.trim() || !campoDescricao.value.trim()) {
      Aviso.mostrar('Título e descrição são obrigatórios.', 'error');
      return;
    }
    // Imagem obrigatória: ao criar exige um arquivo novo; ao editar aceita
    // a imagem já existente (prévia visível) ou um arquivo novo.
    const temImagemExistente = !previaImagem.classList.contains('hidden') && previaImagem.src;
    if (!ehEdicao && !arquivoImagem) {
      Aviso.mostrar('É obrigatório enviar ao menos 1 foto do projeto.', 'error');
      return;
    }
    if (ehEdicao && !arquivoImagem && !temImagemExistente) {
      Aviso.mostrar('É obrigatório ter ao menos 1 foto no projeto.', 'error');
      return;
    }

    botaoEnviar.disabled = true;
    const htmlOriginalBotao = botaoEnviar.innerHTML;
    botaoEnviar.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Salvando...`;

    const campos = new FormData();
    campos.append('titulo', campoTitulo.value);
    campos.append('descricao', campoDescricao.value);
    campos.append('plataforma', obterChipAtivo(chipsPlataforma, 'plataforma'));
    campos.append('dificuldade', obterChipAtivo(chipsDificuldade, 'dificuldade'));
    campos.append('materiais', campoMateriais.value);
    campos.append('montagem', campoMontagem.value);
    campos.append('codigo', campoCodigo.value);
    campos.append('etiquetas', JSON.stringify(etiquetas));
    if (arquivoImagem) campos.append('imagem', arquivoImagem);

    try {
      if (ehEdicao) {
        await API.atualizar(`/projetos/${id}`, campos);
        Aviso.mostrar('Projeto atualizado!');
        window.location.href = `projeto.html?id=${id}`;
      } else {
        const { dados } = await API.enviar('/projetos', campos);
        Aviso.mostrar('Projeto publicado com sucesso!');
        window.location.href = `projeto.html?id=${dados.id}`;
      }
    } catch (erro) {
      Aviso.mostrar(mensagemErro(erro, 'Erro ao salvar projeto.'), 'error');
      botaoEnviar.disabled = false;
      botaoEnviar.innerHTML = htmlOriginalBotao;
    }
  });
}
