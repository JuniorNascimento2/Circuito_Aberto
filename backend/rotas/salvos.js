const express = require('express');
const rotas = express.Router();
const banco = require('../config/banco');
const autenticacao = require('../middlewares/autenticacao');

// Listar projetos salvos do usuário (paginado)
const TAMANHO_PAGINA_SALVOS = 20;

rotas.get('/', autenticacao, async (req, res) => {
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const deslocamento = (pagina - 1) * TAMANHO_PAGINA_SALVOS;

  try {
    const [linhas] = await banco.execute(
      `SELECT p.*, u.nome_usuario, u.url_avatar,
        (SELECT GROUP_CONCAT(e.nome ORDER BY e.nome SEPARATOR ',')
         FROM projeto_etiquetas pe JOIN etiquetas e ON e.id = pe.etiqueta_id
         WHERE pe.projeto_id = p.id) as etiquetas,
        (SELECT COUNT(*) FROM projeto_curtidas pc
         WHERE pc.projeto_id = p.id AND pc.usuario_id = ?) as curtido_por_mim,
        ps.criado_em as salvo_em
       FROM projetos_salvos ps
       JOIN projetos p ON p.id = ps.projeto_id
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE ps.usuario_id = ?
       ORDER BY ps.criado_em DESC
       LIMIT ${TAMANHO_PAGINA_SALVOS} OFFSET ${deslocamento}`,
      [req.usuario.id, req.usuario.id]
    );
    const [[{ total }]] = await banco.execute(
      'SELECT COUNT(*) as total FROM projetos_salvos WHERE usuario_id = ?',
      [req.usuario.id]
    );
    const projetos = linhas.map(l => ({ ...l, etiquetas: l.etiquetas ? l.etiquetas.split(',') : [] }));
    res.json({
      projetos,
      total,
      pagina,
      tem_proxima: deslocamento + TAMANHO_PAGINA_SALVOS < total,
    });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar projetos salvos.' });
  }
});

// Salvar / remover projeto salvo (alterna)
rotas.post('/:projetoId', autenticacao, async (req, res) => {
  try {
    const [existente] = await banco.execute(
      'SELECT * FROM projetos_salvos WHERE usuario_id = ? AND projeto_id = ?',
      [req.usuario.id, req.params.projetoId]
    );
    if (existente.length > 0) {
      await banco.execute(
        'DELETE FROM projetos_salvos WHERE usuario_id = ? AND projeto_id = ?',
        [req.usuario.id, req.params.projetoId]
      );
      return res.json({ salvo: false });
    }
    await banco.execute(
      'INSERT INTO projetos_salvos (usuario_id, projeto_id) VALUES (?, ?)',
      [req.usuario.id, req.params.projetoId]
    );
    res.json({ salvo: true });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao salvar projeto.' });
  }
});

// Verificar se um projeto está salvo
rotas.get('/:projetoId/verificar', autenticacao, async (req, res) => {
  try {
    const [linhas] = await banco.execute(
      'SELECT 1 FROM projetos_salvos WHERE usuario_id = ? AND projeto_id = ?',
      [req.usuario.id, req.params.projetoId]
    );
    res.json({ salvo: linhas.length > 0 });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao verificar.' });
  }
});

module.exports = rotas;
