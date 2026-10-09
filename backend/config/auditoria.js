const banco = require('./banco');

/**
 * Registra uma ação de administrador no log de auditoria.
 * Nunca deve derrubar a requisição principal se falhar — moderação
 * (banir, deletar, etc) já aconteceu; o log é só o registro dela.
 *
 * @param {object} admin      req.usuario de quem executou a ação (tem id e nome_usuario)
 * @param {string} acao       ex: 'banir', 'desbanir', 'promover', 'rebaixar',
 *                             'deletar_projeto', 'deletar_comentario',
 *                             'resolver_denuncia', 'ignorar_denuncia'
 * @param {string} alvoTipo   'usuario' | 'projeto' | 'comentario' | 'denuncia'
 * @param {number} alvoId     id do alvo da ação
 * @param {string} [alvoDesc] descrição legível do alvo (nome de usuário, título do projeto...)
 * @param {string} [detalhes] contexto extra (motivo do banimento, duração, etc)
 */
async function registrarLog(admin, acao, alvoTipo, alvoId, alvoDesc, detalhes) {
  try {
    await banco.execute(
      `INSERT INTO log_admin (admin_id, admin_nome, acao, alvo_tipo, alvo_id, alvo_desc, detalhes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [admin.id, admin.nome_usuario, acao, alvoTipo, alvoId, alvoDesc || null, detalhes || null]
    );
  } catch (erro) {
    console.error('[auditoria] erro ao registrar log:', erro.message);
  }
}

module.exports = { registrarLog };
