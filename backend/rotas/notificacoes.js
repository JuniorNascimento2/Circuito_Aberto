const express = require('express');
const rotas = express.Router();
const banco = require('../config/banco');
const autenticacao = require('../middlewares/autenticacao');

// Listar notificações do usuário logado
rotas.get('/', autenticacao, async (req, res) => {
  try {
    const [linhas] = await banco.execute(
      `SELECT n.*,
        a.nome_usuario as autor_nome_usuario, a.url_avatar as autor_url_avatar,
        p.titulo as projeto_titulo
       FROM notificacoes n
       JOIN usuarios a ON a.id = n.autor_id
       JOIN projetos p ON p.id = n.projeto_id
       WHERE n.usuario_id = ?
       ORDER BY n.criado_em DESC
       LIMIT 50`,
      [req.usuario.id]
    );
    res.json(linhas);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar notificações.' });
  }
});

// Contar não lidas
rotas.get('/nao-lidas', autenticacao, async (req, res) => {
  try {
    const [[{ total }]] = await banco.execute(
      'SELECT COUNT(*) as total FROM notificacoes WHERE usuario_id = ? AND lida_em IS NULL',
      [req.usuario.id]
    );
    res.json({ total });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao contar notificações.' });
  }
});

// Marcar todas como lidas
rotas.put('/marcar-todas', autenticacao, async (req, res) => {
  try {
    await banco.execute(
      'UPDATE notificacoes SET lida_em = NOW() WHERE usuario_id = ? AND lida_em IS NULL',
      [req.usuario.id]
    );
    res.json({ mensagem: 'Todas marcadas como lidas.' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao marcar notificações.' });
  }
});

// Marcar uma como lida
rotas.put('/:id/marcar', autenticacao, async (req, res) => {
  try {
    await banco.execute(
      'UPDATE notificacoes SET lida_em = NOW() WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuario.id]
    );
    res.json({ mensagem: 'Notificação marcada como lida.' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao marcar notificação.' });
  }
});

module.exports = rotas;
