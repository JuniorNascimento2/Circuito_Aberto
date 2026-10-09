/**
 * Funções utilitárias compartilhadas entre as páginas.
 */

// Escapa texto para inserir com segurança dentro de innerHTML
function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EMOJI_PLATAFORMA = {
  'Arduino Uno': '🔵',
  'Arduino Mega': '🔵',
  'Arduino Nano': '🔵',
  'ESP32': '🟣',
  'ESP8266': '🟠',
};

function classeTagPlataforma(plataforma) {
  return (plataforma || '').startsWith('Arduino') ? 'tag-arduino' : 'tag-esp32';
}

function classeTagDificuldade(dificuldade) {
  return {
    'Iniciante': 'tag-iniciante',
    'Intermediário': 'tag-intermediario',
    'Avançado': 'tag-avancado',
  }[dificuldade] || 'tag-iniciante';
}

function tempoAtras(data) {
  const diferenca = (Date.now() - new Date(data)) / 1000;
  if (diferenca < 60) return 'agora';
  if (diferenca < 3600) return `${Math.floor(diferenca / 60)}min`;
  if (diferenca < 86400) return `${Math.floor(diferenca / 3600)}h`;
  return `${Math.floor(diferenca / 86400)}d`;
}

function formatarDataCurta(data) {
  return new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatarMesAno(data) {
  return new Date(data).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

// Lê parâmetros da query string da URL atual
function obterParametroUrl(nome) {
  return new URLSearchParams(window.location.search).get(nome);
}

function obterInicial(nomeUsuario) {
  return nomeUsuario ? nomeUsuario[0].toUpperCase() : '?';
}

// Constrói o avatar (imagem ou letra) usado em vários lugares
function htmlAvatar(urlAvatar, nomeUsuario) {
  if (urlAvatar) {
    return `<img src="${escaparHtml(urlAvatar)}" alt="${escaparHtml(nomeUsuario)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  }
  return escaparHtml(obterInicial(nomeUsuario));
}

// Liga o comportamento de mostrar/ocultar senha nos campos com [data-toggle-pw]
function iniciarAlternarSenha(raiz) {
  (raiz || document).querySelectorAll('[data-toggle-pw]').forEach(botao => {
    if (botao.dataset.pwBound) return;
    botao.dataset.pwBound = '1';
    botao.addEventListener('click', () => {
      const campo = botao.closest('.pw-input-wrap').querySelector('input');
      const icone = botao.querySelector('i');
      const mostrar = campo.type === 'password';
      campo.type = mostrar ? 'text' : 'password';
      icone.className = `ti ti-eye${mostrar ? '-off' : ''}`;
    });
  });
}

