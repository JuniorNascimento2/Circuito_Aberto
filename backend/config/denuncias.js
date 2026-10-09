const banco = require('./banco');

/**
 * Cria uma denúncia de projeto ou comentário, com as validações:
 *  - motivo obrigatório (máx. 500 caracteres)
 *  - não é possível denunciar o próprio conteúdo
 *  - não é possível denunciar de novo algo que já está pendente de análise
 *
 * Erros de validação são lançados com `.publico = true` e `.status`, para
 * a rota devolver a mensagem direto ao cliente em vez de um erro genérico.
 */
async function criarDenuncia({ denuncianteId, alvoTipo, alvoId, donoId, motivo }) {
  if (!motivo || !motivo.trim()) {
    const erro = new Error('Informe o motivo da denúncia.');
    erro.publico = true; erro.status = 400; throw erro;
  }
  if (motivo.trim().length > 500) {
    const erro = new Error('Motivo deve ter no máximo 500 caracteres.');
    erro.publico = true; erro.status = 400; throw erro;
  }
  if (donoId === denuncianteId) {
    const erro = new Error('Você não pode denunciar seu próprio conteúdo.');
    erro.publico = true; erro.status = 400; throw erro;
  }

  const [existente] = await banco.execute(
    `SELECT id FROM denuncias
     WHERE denunciante_id = ? AND alvo_tipo = ? AND alvo_id = ? AND status = 'pendente'`,
    [denuncianteId, alvoTipo, alvoId]
  );
  if (existente.length > 0) {
    const erro = new Error('Você já denunciou este conteúdo. Aguarde a análise da equipe.');
    erro.publico = true; erro.status = 400; throw erro;
  }

  await banco.execute(
    'INSERT INTO denuncias (denunciante_id, alvo_tipo, alvo_id, motivo) VALUES (?, ?, ?, ?)',
    [denuncianteId, alvoTipo, alvoId, motivo.trim()]
  );
}

module.exports = { criarDenuncia };
