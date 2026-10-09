const express = require('express');
const rotas = express.Router();
const banco = require('../config/banco');
const autenticacao = require('../middlewares/autenticacao');

rotas.get('/', autenticacao, async (req, res) => {
  const usuarioId = req.usuario.id;
  try {
    // Totais gerais
    const [[totais]] = await banco.execute(`
      SELECT
        COUNT(*) as total_projetos,
        COALESCE(SUM(total_curtidas), 0)      as total_curtidas,
        COALESCE(SUM(total_copias), 0)        as total_copias,
        COALESCE(SUM(total_visualizacoes), 0) as total_visualizacoes
      FROM projetos WHERE usuario_id = ?`, [usuarioId]);

    // Top 5 projetos por visualizações
    const [topProjetos] = await banco.execute(`
      SELECT id, titulo, total_curtidas, total_copias, total_visualizacoes, criado_em
      FROM projetos WHERE usuario_id = ?
      ORDER BY total_visualizacoes DESC LIMIT 5`, [usuarioId]);

    // Projetos por plataforma
    const [porPlataforma] = await banco.execute(`
      SELECT plataforma, COUNT(*) as total
      FROM projetos WHERE usuario_id = ?
      GROUP BY plataforma ORDER BY total DESC`, [usuarioId]);

    // Projetos por dificuldade
    const [porDificuldade] = await banco.execute(`
      SELECT dificuldade, COUNT(*) as total
      FROM projetos WHERE usuario_id = ?
      GROUP BY dificuldade`, [usuarioId]);

    // Atividade dos últimos 6 meses (projetos publicados)
    const [atividade] = await banco.execute(`
      SELECT DATE_FORMAT(criado_em, '%Y-%m') as mes, COUNT(*) as total
      FROM projetos WHERE usuario_id = ?
        AND criado_em >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY mes ORDER BY mes ASC`, [usuarioId]);

    // Total de comentários recebidos
    const [[{ total_comentarios }]] = await banco.execute(`
      SELECT COUNT(*) as total_comentarios
      FROM projeto_comentarios c
      JOIN projetos p ON p.id = c.projeto_id
      WHERE p.usuario_id = ? AND c.usuario_id != ?`, [usuarioId, usuarioId]);

    res.json({
      totais,
      top_projetos:   topProjetos,
      por_plataforma: porPlataforma,
      por_dificuldade: porDificuldade,
      atividade,
      total_comentarios,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar estatísticas.' });
  }
});

module.exports = rotas;
