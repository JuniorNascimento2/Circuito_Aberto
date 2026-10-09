/**
 * Página inicial (visitante) — carrega as estatísticas públicas.
 */
function iniciarPaginaInicio() {
  API.obter('/estatisticas').then(({ dados }) => {
    const formatar = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
    document.getElementById('inicio-total-projetos').textContent = formatar(dados.projetos);
    document.getElementById('inicio-total-makers').textContent   = formatar(dados.makers);
    document.getElementById('inicio-total-copias').textContent   = formatar(dados.copias);
  }).catch(() => {});
}
