/**
 * Avisos flutuantes (toasts). Cria (ou reaproveita) um container fixo no canto
 * inferior direito e exibe mensagens que somem sozinhas após 3 segundos.
 */
const Aviso = (() => {
  let container = null;

  function garantirContainer() {
    if (container) return container;
    container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function mostrar(mensagem, tipo = 'success', duracaoMs) {
    const raiz = garantirContainer();
    const elemento = document.createElement('div');
    elemento.className = `toast ${tipo}`;

    const icone = document.createElement('i');
    icone.className = `ti ti-${tipo === 'success' ? 'check' : 'alert-circle'}`;
    elemento.appendChild(icone);
    elemento.appendChild(document.createTextNode(mensagem));

    raiz.appendChild(elemento);
    // Mensagens de erro tendem a ser mais longas (ex: motivo de banimento),
    // então ficam mais tempo visíveis por padrão.
    const duracaoPadrao = tipo === 'error' ? 6000 : 3000;
    setTimeout(() => elemento.remove(), duracaoMs || duracaoPadrao);
  }

  return { mostrar };
})();
