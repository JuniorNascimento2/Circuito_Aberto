/**
 * Bloco de código com realce de sintaxe, usando o Prism.js (carregado via CDN
 * na página de detalhe do projeto).
 */

// Detecta a linguagem pelo conteúdo do código
function detectarLinguagem(codigo) {
  if (!codigo) return 'cpp';
  if (/#include|void setup|void loop|Serial\.|digitalWrite|analogRead|pinMode/i.test(codigo)) return 'cpp';
  if (/import\s+\w+|from\s+\w+|def\s+\w+|print\(|__name__/i.test(codigo)) return 'python';
  if (/function\s+\w+|const\s+\w+|let\s+\w+|=>\s*{|require\(|module\.exports/i.test(codigo)) return 'javascript';
  if (/<\?php|echo\s+|isset\(|\$\w+\s*=/i.test(codigo)) return 'php';
  if (/SELECT|INSERT|UPDATE|DELETE|CREATE TABLE/i.test(codigo)) return 'sql';
  if (/^\s*#.+\n|^\w+=.+/m.test(codigo)) return 'bash';
  return 'cpp'; // padrão para Arduino
}

const ROTULOS_LINGUAGEM = {
  cpp: 'Arduino / C++',
  python: 'Python',
  javascript: 'JavaScript',
  php: 'PHP',
  sql: 'SQL',
  bash: 'Bash',
};

function renderizarBlocoCodigo(container, codigo) {
  const linguagem = detectarLinguagem(codigo);
  const rotulo = ROTULOS_LINGUAGEM[linguagem] || linguagem;

  container.innerHTML = `
    <div class="cb-wrap">
      <div class="cb-header">
        <div class="cb-dots">
          <span class="cb-dot" style="background:#ff5f57;"></span>
          <span class="cb-dot" style="background:#febc2e;"></span>
          <span class="cb-dot" style="background:#28c840;"></span>
        </div>
        <span class="cb-lang">${escaparHtml(rotulo)}</span>
        <button class="cb-copy" id="cb-copiar-btn"><i class="ti ti-copy"></i> Copiar</button>
      </div>
      <pre><code class="language-${linguagem}"></code></pre>
    </div>`;

  const elementoCodigo = container.querySelector('code');
  elementoCodigo.textContent = codigo;

  if (window.Prism) {
    Prism.highlightElement(elementoCodigo);
  }

  const botaoCopiar = container.querySelector('#cb-copiar-btn');
  botaoCopiar.addEventListener('click', () => {
    navigator.clipboard.writeText(codigo);
    Aviso.mostrar('Código copiado!');
    botaoCopiar.classList.add('cb-copy-done');
    botaoCopiar.innerHTML = '<i class="ti ti-check"></i> Copiado!';
    setTimeout(() => {
      botaoCopiar.classList.remove('cb-copy-done');
      botaoCopiar.innerHTML = '<i class="ti ti-copy"></i> Copiar';
    }, 2000);
  });
}
