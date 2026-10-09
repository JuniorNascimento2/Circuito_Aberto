const express = require('express');
const rotas = express.Router({ mergeParams: true });
const banco = require('../config/banco');
const autenticacao = require('../middlewares/autenticacao');
const { criarNotificacao } = require('../config/notificar');
const { criarDenuncia } = require('../config/denuncias');
const { registrarLog } = require('../config/auditoria');

// Listar comentários de um projeto
rotas.get('/', autenticacao, async (req, res) => {
  try {
    const [linhas] = await banco.execute(
      `SELECT c.id, c.conteudo, c.criado_em, u.nome_usuario, u.url_avatar,
        (SELECT COUNT(*) FROM comentario_curtidas cc
         WHERE cc.comentario_id = c.id) AS total_curtidas,
        EXISTS(SELECT 1 FROM comentario_curtidas cc2
               WHERE cc2.comentario_id = c.id AND cc2.usuario_id = ?) AS curtido
       FROM projeto_comentarios c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.projeto_id = ?
       ORDER BY c.criado_em ASC`,
      [req.usuario.id, req.params.projetoId]
    );
    res.json(linhas);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar comentários.' });
  }
});

// Adicionar comentário
rotas.post('/', autenticacao, async (req, res) => {
  const { conteudo } = req.body;
  if (!conteudo || !conteudo.trim())
    return res.status(400).json({ erro: 'Comentário não pode ser vazio.' });
  if (conteudo.length > 1000)
    return res.status(400).json({ erro: 'Comentário muito longo. Máximo 1000 caracteres.' });

  try {
    const [resultado] = await banco.execute(
      'INSERT INTO projeto_comentarios (projeto_id, usuario_id, conteudo) VALUES (?, ?, ?)',
      [req.params.projetoId, req.usuario.id, conteudo.trim()]
    );
    const [linhas] = await banco.execute(
      `SELECT c.id, c.conteudo, c.criado_em, u.nome_usuario, u.url_avatar
       FROM projeto_comentarios c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.id = ?`,
      [resultado.insertId]
    );
    // Notifica o dono do projeto
    const [projeto] = await banco.execute(
      'SELECT usuario_id FROM projetos WHERE id = ?',
      [req.params.projetoId]
    );
    if (projeto.length > 0) {
      await criarNotificacao(projeto[0].usuario_id, req.usuario.id, 'comentario', req.params.projetoId);
    }
    res.status(201).json(linhas[0]);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao comentar.' });
  }
});

// Curtir / descurtir um comentário
rotas.post('/:comentarioId/curtir', autenticacao, async (req, res) => {
  try {
    const [comentario] = await banco.execute(
      'SELECT * FROM projeto_comentarios WHERE id = ? AND projeto_id = ?',
      [req.params.comentarioId, req.params.projetoId]
    );
    if (comentario.length === 0) return res.status(404).json({ erro: 'Comentário não encontrado.' });

    const [existente] = await banco.execute(
      'SELECT * FROM comentario_curtidas WHERE usuario_id = ? AND comentario_id = ?',
      [req.usuario.id, req.params.comentarioId]
    );

    let curtido;
    if (existente.length > 0) {
      await banco.execute(
        'DELETE FROM comentario_curtidas WHERE usuario_id = ? AND comentario_id = ?',
        [req.usuario.id, req.params.comentarioId]
      );
      curtido = false;
    } else {
      await banco.execute(
        'INSERT INTO comentario_curtidas (usuario_id, comentario_id) VALUES (?, ?)',
        [req.usuario.id, req.params.comentarioId]
      );
      curtido = true;
      await criarNotificacao(
        comentario[0].usuario_id, req.usuario.id, 'curtida_comentario', req.params.projetoId
      );
    }

    const [[{ total }]] = await banco.execute(
      'SELECT COUNT(*) as total FROM comentario_curtidas WHERE comentario_id = ?',
      [req.params.comentarioId]
    );
    res.json({ curtido, total_curtidas: total });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao curtir comentário.' });
  }
});

// Deletar comentário (o dono OU um admin)
rotas.delete('/:comentarioId', autenticacao, async (req, res) => {
  try {
    const [linhas] = await banco.execute(
      'SELECT * FROM projeto_comentarios WHERE id = ?',
      [req.params.comentarioId]
    );
    if (linhas.length === 0) return res.status(404).json({ erro: 'Comentário não encontrado.' });
    const ehDono = linhas[0].usuario_id === req.usuario.id;
    const ehAdmin = req.usuario.papel === 'admin';
    if (!ehDono && !ehAdmin) return res.status(403).json({ erro: 'Sem permissão.' });

    await banco.execute('DELETE FROM projeto_comentarios WHERE id = ?', [req.params.comentarioId]);
    // Registra no log de auditoria só quando é uma remoção de moderação
    if (ehAdmin && !ehDono) {
      const resumo = linhas[0].conteudo.length > 80 ? linhas[0].conteudo.slice(0, 80) + '…' : linhas[0].conteudo;
      await registrarLog(req.usuario, 'deletar_comentario', 'comentario', Number(req.params.comentarioId), resumo);
    }
    res.json({ mensagem: 'Comentário deletado.' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao deletar comentário.' });
  }
});

// ── Denunciar comentário ────────────────────────────────────────────────────
rotas.post('/:comentarioId/denunciar', autenticacao, async (req, res) => {
  try {
    const [linhas] = await banco.execute(
      'SELECT usuario_id FROM projeto_comentarios WHERE id = ? AND projeto_id = ?',
      [req.params.comentarioId, req.params.projetoId]
    );
    if (linhas.length === 0) return res.status(404).json({ erro: 'Comentário não encontrado.' });

    await criarDenuncia({
      denuncianteId: req.usuario.id,
      alvoTipo: 'comentario',
      alvoId: Number(req.params.comentarioId),
      donoId: linhas[0].usuario_id,
      motivo: req.body.motivo,
    });
    res.status(201).json({ mensagem: 'Denúncia enviada. Nossa equipe vai analisar.' });
  } catch (erro) {
    if (erro.publico) return res.status(erro.status).json({ erro: erro.message });
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao enviar denúncia.' });
  }
});

module.exports = rotas;
