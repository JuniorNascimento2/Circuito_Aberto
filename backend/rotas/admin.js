const express = require('express');
const rotas = express.Router();
const banco = require('../config/banco');
const caminhoModulo = require('path');
const fs = require('fs');
const autenticacao = require('../middlewares/autenticacao');
const exigirAdmin = require('../middlewares/exigirAdmin');
const { registrarLog } = require('../config/auditoria');

// Todas as rotas deste arquivo exigem estar logado E ser admin
rotas.use(autenticacao, exigirAdmin);

// ── Listar usuários (paginado, com busca) ───────────────────────────────────
const TAMANHO_PAGINA_ADMIN = 20;

rotas.get('/usuarios', async (req, res) => {
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const deslocamento = (pagina - 1) * TAMANHO_PAGINA_ADMIN;
  const busca = req.query.busca ? `%${req.query.busca}%` : null;

  const filtro = busca ? 'WHERE u.nome_usuario LIKE ? OR u.email LIKE ?' : '';
  const parametros = busca ? [busca, busca] : [];

  try {
    const [linhas] = await banco.execute(
      `SELECT u.id, u.nome_usuario, u.email, u.papel, u.banido_em, u.banido_ate, u.motivo_banimento, u.criado_em,
        (SELECT COUNT(*) FROM projetos p WHERE p.usuario_id = u.id) as total_projetos
       FROM usuarios u
       ${filtro}
       ORDER BY u.criado_em DESC
       LIMIT ${TAMANHO_PAGINA_ADMIN} OFFSET ${deslocamento}`,
      parametros
    );
    const [[{ total }]] = await banco.execute(
      `SELECT COUNT(*) as total FROM usuarios u ${filtro}`, parametros
    );
    res.json({
      usuarios: linhas,
      total,
      pagina,
      tem_proxima: deslocamento + TAMANHO_PAGINA_ADMIN < total,
    });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao listar usuários.' });
  }
});

// ── Banir / desbanir uma conta ──────────────────────────────────────────────
// Banir exige um motivo. A duração é opcional: sem "dias", o banimento é
// permanente; com "dias", a conta é desbanida automaticamente ao expirar
// (não precisa o admin voltar aqui pra desbanir).
rotas.post('/usuarios/:id/banir', async (req, res) => {
  const alvoId = Number(req.params.id);
  if (alvoId === req.usuario.id) {
    return res.status(400).json({ erro: 'Você não pode banir a própria conta.' });
  }
  try {
    const [linhas] = await banco.execute('SELECT nome_usuario, banido_em FROM usuarios WHERE id = ?', [alvoId]);
    if (linhas.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const nomeAlvo = linhas[0].nome_usuario;
    const jaBanido = !!linhas[0].banido_em;

    // Já está banido → esta chamada desbane (limpa os 3 campos)
    if (jaBanido) {
      await banco.execute(
        'UPDATE usuarios SET banido_em = NULL, banido_ate = NULL, motivo_banimento = NULL WHERE id = ?',
        [alvoId]
      );
      await registrarLog(req.usuario, 'desbanir', 'usuario', alvoId, nomeAlvo);
      return res.json({ banido: false });
    }

    // Não está banido → esta chamada bane, e exige motivo
    const { motivo, dias } = req.body;
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ erro: 'Informe o motivo do banimento.' });
    }
    if (motivo.trim().length > 500) {
      return res.status(400).json({ erro: 'Motivo deve ter no máximo 500 caracteres.' });
    }

    let diasNumero = null;
    if (dias !== undefined && dias !== null && dias !== '') {
      diasNumero = parseInt(dias, 10);
      if (!Number.isInteger(diasNumero) || diasNumero <= 0 || String(dias).includes('.')) {
        return res.status(400).json({ erro: 'Duração inválida. Use um número inteiro de dias maior que zero.' });
      }
    }

    // diasNumero já foi validado como inteiro positivo acima, então é seguro
    // interpolar direto no INTERVAL (não vem de string livre do usuário).
    const expressaoData = diasNumero ? `DATE_ADD(NOW(), INTERVAL ${diasNumero} DAY)` : 'NULL';
    await banco.execute(
      `UPDATE usuarios SET banido_em = NOW(), banido_ate = ${expressaoData}, motivo_banimento = ? WHERE id = ?`,
      [motivo.trim(), alvoId]
    );

    const [[atualizado]] = await banco.execute(
      'SELECT banido_em, banido_ate, motivo_banimento FROM usuarios WHERE id = ?', [alvoId]
    );
    const detalhesLog = diasNumero ? `Motivo: ${motivo.trim()} · Duração: ${diasNumero} dia(s)` : `Motivo: ${motivo.trim()} · Permanente`;
    await registrarLog(req.usuario, 'banir', 'usuario', alvoId, nomeAlvo, detalhesLog);
    res.json({ banido: true, ...atualizado });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao banir/desbanir usuário.' });
  }
});

// ── Promover / rebaixar (papel comum <-> admin) ─────────────────────────────
rotas.post('/usuarios/:id/promover', async (req, res) => {
  const alvoId = Number(req.params.id);
  try {
    const [linhas] = await banco.execute('SELECT nome_usuario, papel FROM usuarios WHERE id = ?', [alvoId]);
    if (linhas.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const nomeAlvo = linhas[0].nome_usuario;
    const ehAdminAtualmente = linhas[0].papel === 'admin';

    // Trava de segurança: nunca deixar a plataforma sem nenhum admin
    if (ehAdminAtualmente) {
      const [[{ total }]] = await banco.execute(
        "SELECT COUNT(*) as total FROM usuarios WHERE papel = 'admin'"
      );
      if (total <= 1) {
        return res.status(400).json({ erro: 'Não é possível rebaixar o último administrador da plataforma.' });
      }
    }

    const novoPapel = ehAdminAtualmente ? 'comum' : 'admin';
    await banco.execute('UPDATE usuarios SET papel = ? WHERE id = ?', [novoPapel, alvoId]);
    await registrarLog(req.usuario, novoPapel === 'admin' ? 'promover' : 'rebaixar', 'usuario', alvoId, nomeAlvo);
    res.json({ papel: novoPapel });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao alterar papel do usuário.' });
  }
});

// ── Log de auditoria ─────────────────────────────────────────────────────────
const TAMANHO_PAGINA_LOG = 25;

rotas.get('/logs', async (req, res) => {
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const deslocamento = (pagina - 1) * TAMANHO_PAGINA_LOG;
  try {
    const [linhas] = await banco.execute(
      `SELECT id, admin_id, admin_nome, acao, alvo_tipo, alvo_id, alvo_desc, detalhes, criado_em
       FROM log_admin
       ORDER BY criado_em DESC
       LIMIT ${TAMANHO_PAGINA_LOG} OFFSET ${deslocamento}`
    );
    const [[{ total }]] = await banco.execute('SELECT COUNT(*) as total FROM log_admin');
    res.json({
      logs: linhas,
      total,
      pagina,
      tem_proxima: deslocamento + TAMANHO_PAGINA_LOG < total,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar log de auditoria.' });
  }
});

// ── Denúncias ────────────────────────────────────────────────────────────────
const TAMANHO_PAGINA_DENUNCIAS = 20;

// Preenche cada denúncia com um resumo legível do alvo (título do projeto ou
// trecho do comentário), buscando nas duas tabelas possíveis de uma vez.
async function anexarResumoAlvo(denunciasLinhas) {
  const idsProjeto = denunciasLinhas.filter(d => d.alvo_tipo === 'projeto').map(d => d.alvo_id);
  const idsComentario = denunciasLinhas.filter(d => d.alvo_tipo === 'comentario').map(d => d.alvo_id);

  const mapaProjetos = new Map();
  if (idsProjeto.length > 0) {
    const [linhas] = await banco.query(
      `SELECT id, titulo, usuario_id, (SELECT nome_usuario FROM usuarios WHERE id = p.usuario_id) as autor
       FROM projetos p WHERE id IN (?)`,
      [idsProjeto]
    );
    linhas.forEach(p => mapaProjetos.set(p.id, p));
  }

  const mapaComentarios = new Map();
  if (idsComentario.length > 0) {
    const [linhas] = await banco.query(
      `SELECT id, conteudo, projeto_id, usuario_id, (SELECT nome_usuario FROM usuarios WHERE id = c.usuario_id) as autor
       FROM projeto_comentarios c WHERE id IN (?)`,
      [idsComentario]
    );
    linhas.forEach(c => mapaComentarios.set(c.id, c));
  }

  return denunciasLinhas.map(d => {
    if (d.alvo_tipo === 'projeto') {
      const p = mapaProjetos.get(d.alvo_id);
      return {
        ...d,
        alvo_existe: !!p,
        alvo_resumo: p ? p.titulo : null,
        alvo_autor: p ? p.autor : null,
        alvo_link: p ? `projeto.html?id=${p.id}` : null,
      };
    }
    const c = mapaComentarios.get(d.alvo_id);
    return {
      ...d,
      alvo_existe: !!c,
      alvo_resumo: c ? c.conteudo : null,
      alvo_autor: c ? c.autor : null,
      alvo_link: c ? `projeto.html?id=${c.projeto_id}` : null,
    };
  });
}

rotas.get('/denuncias', async (req, res) => {
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const deslocamento = (pagina - 1) * TAMANHO_PAGINA_DENUNCIAS;
  const status = ['pendente', 'resolvida', 'ignorada'].includes(req.query.status) ? req.query.status : 'pendente';

  try {
    const [linhas] = await banco.execute(
      `SELECT d.id, d.alvo_tipo, d.alvo_id, d.motivo, d.status, d.criado_em, d.resolvida_em,
        u.nome_usuario as denunciante_nome
       FROM denuncias d
       JOIN usuarios u ON u.id = d.denunciante_id
       WHERE d.status = ?
       ORDER BY d.criado_em ASC
       LIMIT ${TAMANHO_PAGINA_DENUNCIAS} OFFSET ${deslocamento}`,
      [status]
    );
    const [[{ total }]] = await banco.execute('SELECT COUNT(*) as total FROM denuncias WHERE status = ?', [status]);

    const denuncias = await anexarResumoAlvo(linhas);

    res.json({
      denuncias,
      total,
      pagina,
      tem_proxima: deslocamento + TAMANHO_PAGINA_DENUNCIAS < total,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar denúncias.' });
  }
});

// Marca uma denúncia como resolvida. Opcionalmente remove o conteúdo
// denunciado no mesmo passo (excluir_conteudo: true), reaproveitando a
// mesma lógica de remoção usada nas rotas normais de projeto/comentário.
rotas.post('/denuncias/:id/resolver', async (req, res) => {
  await concluirDenuncia(req, res, 'resolvida', !!req.body.excluir_conteudo);
});

rotas.post('/denuncias/:id/ignorar', async (req, res) => {
  await concluirDenuncia(req, res, 'ignorada', false);
});

async function concluirDenuncia(req, res, novoStatus, excluirConteudo) {
  const denunciaId = Number(req.params.id);
  try {
    const [linhas] = await banco.execute('SELECT * FROM denuncias WHERE id = ?', [denunciaId]);
    if (linhas.length === 0) return res.status(404).json({ erro: 'Denúncia não encontrada.' });
    const denuncia = linhas[0];
    if (denuncia.status !== 'pendente') {
      return res.status(400).json({ erro: 'Esta denúncia já foi analisada.' });
    }

    let alvoDesc = `#${denuncia.alvo_id}`;
    if (excluirConteudo) {
      if (denuncia.alvo_tipo === 'projeto') {
        const [projeto] = await banco.execute('SELECT * FROM projetos WHERE id = ?', [denuncia.alvo_id]);
        if (projeto.length > 0) {
          alvoDesc = projeto[0].titulo;
          if (projeto[0].url_imagem) {
            const caminhoImagem = caminhoModulo.join(__dirname, '..', projeto[0].url_imagem);
            if (fs.existsSync(caminhoImagem)) fs.unlinkSync(caminhoImagem);
          }
          await banco.execute('DELETE FROM projetos WHERE id = ?', [denuncia.alvo_id]);
          await registrarLog(req.usuario, 'deletar_projeto', 'projeto', denuncia.alvo_id, alvoDesc, 'Removido via denúncia');
        }
      } else {
        const [comentario] = await banco.execute('SELECT * FROM projeto_comentarios WHERE id = ?', [denuncia.alvo_id]);
        if (comentario.length > 0) {
          alvoDesc = comentario[0].conteudo.length > 80 ? comentario[0].conteudo.slice(0, 80) + '…' : comentario[0].conteudo;
          await banco.execute('DELETE FROM projeto_comentarios WHERE id = ?', [denuncia.alvo_id]);
          await registrarLog(req.usuario, 'deletar_comentario', 'comentario', denuncia.alvo_id, alvoDesc, 'Removido via denúncia');
        }
      }
    }

    await banco.execute(
      `UPDATE denuncias SET status = ?, resolvida_por = ?, resolvida_em = NOW() WHERE id = ?`,
      [novoStatus, req.usuario.id, denunciaId]
    );
    await registrarLog(
      req.usuario,
      novoStatus === 'resolvida' ? 'resolver_denuncia' : 'ignorar_denuncia',
      'denuncia', denunciaId, alvoDesc, `Motivo original: ${denuncia.motivo}`
    );

    res.json({ status: novoStatus, conteudo_removido: excluirConteudo });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao concluir denúncia.' });
  }
}

// ── Estatísticas gerais da plataforma ───────────────────────────────────────
rotas.get('/estatisticas', async (req, res) => {
  try {
    const [[geral]] = await banco.execute(`
      SELECT
        (SELECT COUNT(*) FROM usuarios)                       as total_usuarios,
        (SELECT COUNT(*) FROM usuarios WHERE papel = 'admin')  as total_admins,
        (SELECT COUNT(*) FROM usuarios WHERE banido_em IS NOT NULL AND (banido_ate IS NULL OR banido_ate > NOW())) as total_banidos,
        (SELECT COUNT(*) FROM projetos)                        as total_projetos,
        (SELECT COUNT(*) FROM projeto_comentarios)             as total_comentarios,
        (SELECT COALESCE(SUM(total_curtidas), 0) FROM projetos) as total_curtidas,
        (SELECT COALESCE(SUM(total_copias), 0) FROM projetos)   as total_copias,
        (SELECT COUNT(*) FROM denuncias WHERE status = 'pendente') as total_denuncias_pendentes
    `);

    const [porPlataforma] = await banco.execute(`
      SELECT plataforma, COUNT(*) as total FROM projetos
      GROUP BY plataforma ORDER BY total DESC`);

    const [cadastrosRecentes] = await banco.execute(`
      SELECT DATE_FORMAT(criado_em, '%Y-%m') as mes, COUNT(*) as total
      FROM usuarios WHERE criado_em >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY mes ORDER BY mes ASC`);

    res.json({ geral, por_plataforma: porPlataforma, cadastros_recentes: cadastrosRecentes });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar estatísticas gerais.' });
  }
});

module.exports = rotas;
