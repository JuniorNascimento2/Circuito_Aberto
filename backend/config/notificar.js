const banco = require('./banco');

// Tipos que representam um "estado" (curtir/copiar) e não um evento novo:
// repetir a ação (curtir, descurtir, curtir...) não deve gerar notificação repetida.
const TIPOS_SEM_REPETICAO = ['curtida', 'copia', 'curtida_comentario'];

// Cria uma notificação (ignora se o autor for o dono do projeto)
async function criarNotificacao(usuarioId, autorId, tipo, projetoId) {
  if (usuarioId === autorId) return; // não notifica a si mesmo
  try {
    if (TIPOS_SEM_REPETICAO.includes(tipo)) {
      const [existentes] = await banco.execute(
        'SELECT id FROM notificacoes WHERE usuario_id = ? AND autor_id = ? AND tipo = ? AND projeto_id = ? LIMIT 1',
        [usuarioId, autorId, tipo, projetoId]
      );
      if (existentes.length > 0) return; // já notificado antes
    }
    await banco.execute(
      'INSERT INTO notificacoes (usuario_id, autor_id, tipo, projeto_id) VALUES (?, ?, ?, ?)',
      [usuarioId, autorId, tipo, projetoId]
    );
  } catch (erro) {
    console.error('[notificar] erro:', erro.message);
  }
}

module.exports = { criarNotificacao };