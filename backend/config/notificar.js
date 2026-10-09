const banco = require('./banco');

// Cria uma notificação (ignora se o autor for o dono do projeto)
async function criarNotificacao(usuarioId, autorId, tipo, projetoId) {
  if (usuarioId === autorId) return; // não notifica a si mesmo
  try {
    await banco.execute(
      'INSERT INTO notificacoes (usuario_id, autor_id, tipo, projeto_id) VALUES (?, ?, ?, ?)',
      [usuarioId, autorId, tipo, projetoId]
    );
  } catch (erro) {
    console.error('[notificar] erro:', erro.message);
  }
}

module.exports = { criarNotificacao };
