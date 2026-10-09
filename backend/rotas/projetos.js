const express = require('express');
const rotas = express.Router();
const banco = require('../config/banco');
const autenticacao = require('../middlewares/autenticacao');
const multer = require('multer');
const caminho = require('path');
const fs = require('fs');
const { criarNotificacao } = require('../config/notificar');
const { criarDenuncia } = require('../config/denuncias');
const { registrarLog } = require('../config/auditoria');

// ── Mimetypes permitidos ──────────────────────────────────────────────────────
const MIMETYPES_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Extensão baseada no mimetype real (evita usar a extensão que o cliente
// mandou no nome do arquivo, que pode ser forjada, ex: "imagem.php.png")
const EXTENSAO_POR_MIMETYPE = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
};

// Multer com validação real de mimetype
const armazenamento = multer.diskStorage({
  destination: (req, arquivo, cb) => {
    const pasta = caminho.join(__dirname, '../uploads');
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
    cb(null, pasta);
  },
  filename: (req, arquivo, cb) => {
    const extensao = EXTENSAO_POR_MIMETYPE[arquivo.mimetype] || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extensao}`);
  },
});

const envio = multer({
  storage: armazenamento,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, arquivo, cb) => {
    if (MIMETYPES_PERMITIDOS.includes(arquivo.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato inválido. Envie apenas JPG, PNG, WEBP ou GIF.'));
    }
  },
});

// Middleware para tratar erros do multer
function tratarEnvio(req, res, proximo) {
  envio.single('imagem')(req, res, (erro) => {
    if (erro instanceof multer.MulterError) {
      if (erro.code === 'LIMIT_FILE_SIZE')
        return res.status(400).json({ erro: 'Imagem muito grande. Máximo 10MB.' });
      return res.status(400).json({ erro: 'Erro no envio: ' + erro.message });
    }
    if (erro) return res.status(400).json({ erro: erro.message });
    proximo();
  });
}

// ── Auxiliar: salva as etiquetas de um projeto ───────────────────────────────
async function salvarEtiquetas(projetoId, etiquetasEntrada) {
  // etiquetasEntrada pode ser string separada por vírgula ou JSON array
  let nomesEtiquetas = [];
  try {
    nomesEtiquetas = JSON.parse(etiquetasEntrada);
  } catch {
    nomesEtiquetas = String(etiquetasEntrada).split(',');
  }
  nomesEtiquetas = nomesEtiquetas
    .map(e => e.trim().toLowerCase().replace(/[^a-z0-9çãàáâêéíóôúü\-_]/gi, ''))
    .filter(e => e.length > 0 && e.length <= 30)
    .slice(0, 10); // máximo 10 etiquetas

  // Remove as etiquetas antigas do projeto
  await banco.execute('DELETE FROM projeto_etiquetas WHERE projeto_id = ?', [projetoId]);

  for (const nome of nomesEtiquetas) {
    // Insere a etiqueta se ainda não existir
    await banco.execute('INSERT IGNORE INTO etiquetas (nome) VALUES (?)', [nome]);
    const [linhas] = await banco.execute('SELECT id FROM etiquetas WHERE nome = ?', [nome]);
    if (linhas.length > 0) {
      await banco.execute(
        'INSERT IGNORE INTO projeto_etiquetas (projeto_id, etiqueta_id) VALUES (?, ?)',
        [projetoId, linhas[0].id]
      );
    }
  }
}

// ── Listar projetos com paginação ─────────────────────────────────────────────
const TAMANHO_PAGINA = 20;

rotas.get('/', autenticacao, async (req, res) => {
  const { plataforma, busca, ordem = 'recentes', pagina = 1 } = req.query;
  const numeroPagina = Math.max(1, parseInt(pagina, 10) || 1);
  const deslocamento = (numeroPagina - 1) * TAMANHO_PAGINA;

  let filtro = 'WHERE 1=1';
  const parametros = [req.usuario.id];
  const parametrosContagem = [];

  const verTodos = req.usuario.papel === 'admin' && req.query.todos === '1';
  if (!verTodos) {
    filtro += ' AND p.arquivado = 0';
  }

  if (plataforma && plataforma !== 'Todos') {
    filtro += ' AND p.plataforma = ?';
    parametros.push(plataforma);
    parametrosContagem.push(plataforma);
  }
  if (busca) {
    filtro += ` AND (p.titulo LIKE ? OR p.descricao LIKE ? OR p.materiais LIKE ?
      OR EXISTS (
        SELECT 1 FROM projeto_etiquetas pe2
        JOIN etiquetas e2 ON e2.id = pe2.etiqueta_id
        WHERE pe2.projeto_id = p.id AND e2.nome LIKE ?
      ))`;
    const termo = `%${busca}%`;
    parametros.push(termo, termo, termo, termo);
    parametrosContagem.push(termo, termo, termo, termo);
  }

  const ordenacoes = {
    recentes:    'p.criado_em DESC',
    curtidas:    'p.total_curtidas DESC, p.criado_em DESC',
    copias:      'p.total_copias DESC, p.criado_em DESC',
    // Algoritmo de recomendação: pontuação = curtidas*3 + cópias*5 + views*0.1
    // com decaimento temporal
    recomendados: `(
      (p.total_curtidas * 3 + p.total_copias * 5 + p.total_visualizacoes * 0.1)
      / (1 + TIMESTAMPDIFF(HOUR, p.criado_em, NOW()) / 48)
    ) DESC, p.criado_em DESC`,
  };
  const ordenacao = ordenacoes[ordem] || 'p.criado_em DESC';

  const sqlDados = `
    SELECT p.*, u.nome_usuario, u.url_avatar,
      (SELECT COUNT(*) FROM projeto_curtidas pc
       WHERE pc.projeto_id = p.id AND pc.usuario_id = ?) as curtido_por_mim,
      (SELECT GROUP_CONCAT(e.nome ORDER BY e.nome SEPARATOR ',')
       FROM projeto_etiquetas pe JOIN etiquetas e ON e.id = pe.etiqueta_id
       WHERE pe.projeto_id = p.id) as etiquetas
    FROM projetos p
    JOIN usuarios u ON u.id = p.usuario_id
    ${filtro}
    ORDER BY ${ordenacao}
    LIMIT ${TAMANHO_PAGINA} OFFSET ${deslocamento}
  `;

  const sqlContagem = `
    SELECT COUNT(*) as total
    FROM projetos p
    JOIN usuarios u ON u.id = p.usuario_id
    ${filtro}
  `;

  try {
    const [linhas]    = await banco.execute(sqlDados, parametros);
    const [contagem]  = await banco.execute(sqlContagem, parametrosContagem);
    const total       = contagem[0].total;

    // Converte as etiquetas de string para array
    const projetos = linhas.map(l => ({
      ...l,
      etiquetas: l.etiquetas ? l.etiquetas.split(',') : []
    }));

    res.json({
      projetos,
      total,
      pagina:        numeroPagina,
      total_paginas: Math.ceil(total / TAMANHO_PAGINA),
      tem_proxima:   deslocamento + TAMANHO_PAGINA < total,
      tem_anterior:  numeroPagina > 1,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar projetos.' });
  }
});

// ── Buscar projeto por ID ─────────────────────────────────────────────────────
rotas.get('/:id', autenticacao, async (req, res) => {
  try {
    // Conta apenas visualizações únicas (primeira vez que esse usuário acessa esse projeto)
    const [visualizado] = await banco.execute(
      'SELECT 1 FROM projeto_visualizacoes WHERE usuario_id = ? AND projeto_id = ?',
      [req.usuario.id, req.params.id]
    );
    if (visualizado.length === 0) {
      await banco.execute(
        'INSERT INTO projeto_visualizacoes (usuario_id, projeto_id) VALUES (?, ?)',
        [req.usuario.id, req.params.id]
      );
      await banco.execute(
        'UPDATE projetos SET total_visualizacoes = total_visualizacoes + 1 WHERE id = ?',
        [req.params.id]
      );
    }
    const [linhas] = await banco.execute(
      `SELECT p.*, u.nome_usuario, u.url_avatar,
        (SELECT COUNT(*) FROM projeto_curtidas pc
         WHERE pc.projeto_id = p.id AND pc.usuario_id = ?) as curtido_por_mim,
        (SELECT GROUP_CONCAT(e.nome ORDER BY e.nome SEPARATOR ',')
         FROM projeto_etiquetas pe JOIN etiquetas e ON e.id = pe.etiqueta_id
         WHERE pe.projeto_id = p.id) as etiquetas
       FROM projetos p JOIN usuarios u ON u.id = p.usuario_id WHERE p.id = ?`,
      [req.usuario.id, req.params.id]
    );
    if (linhas.length === 0) return res.status(404).json({ erro: 'Projeto não encontrado.' });
    const projeto = { ...linhas[0], etiquetas: linhas[0].etiquetas ? linhas[0].etiquetas.split(',') : [] };
    const ehDonoOuAdmin = projeto.usuario_id === req.usuario.id || req.usuario.papel === 'admin';
    if (projeto.arquivado && !ehDonoOuAdmin) return res.status(404).json({ erro: 'Projeto não encontrado.' });
    res.json(projeto);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar projeto.' });
  }
});

// ── Criar projeto ─────────────────────────────────────────────────────────────
rotas.post('/', autenticacao, tratarEnvio, async (req, res) => {
  const { titulo, descricao, plataforma, dificuldade, materiais, montagem, codigo, etiquetas } = req.body;
  if (!titulo || !descricao || !plataforma)
    return res.status(400).json({ erro: 'Título, descrição e plataforma são obrigatórios.' });
  if (titulo.trim().length > 200)
    return res.status(400).json({ erro: 'Título deve ter no máximo 200 caracteres.' });
  if (!req.file)
    return res.status(400).json({ erro: 'É obrigatório enviar ao menos 1 foto do projeto.' });

  const url_imagem = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const [resultado] = await banco.execute(
      `INSERT INTO projetos
        (usuario_id, titulo, descricao, plataforma, dificuldade, materiais, montagem, codigo, url_imagem)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        req.usuario.id, titulo, descricao, plataforma,
        dificuldade || 'Iniciante', materiais || null, montagem || null, codigo || null, url_imagem,
      ]
    );
    const projetoId = resultado.insertId;

    // Salva as etiquetas
    if (etiquetas) await salvarEtiquetas(projetoId, etiquetas);

    const [linhas] = await banco.execute(
      `SELECT p.*, u.nome_usuario,
        (SELECT GROUP_CONCAT(e.nome ORDER BY e.nome SEPARATOR ',')
         FROM projeto_etiquetas pe JOIN etiquetas e ON e.id = pe.etiqueta_id
         WHERE pe.projeto_id = p.id) as etiquetas
       FROM projetos p JOIN usuarios u ON u.id = p.usuario_id WHERE p.id = ?`,
      [projetoId]
    );
    const projeto = { ...linhas[0], etiquetas: linhas[0].etiquetas ? linhas[0].etiquetas.split(',') : [] };
    res.status(201).json(projeto);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar projeto.' });
  }
});

// ── Editar projeto ────────────────────────────────────────────────────────────
rotas.put('/:id', autenticacao, tratarEnvio, async (req, res) => {
  const { titulo, descricao, plataforma, dificuldade, materiais, montagem, codigo, etiquetas } = req.body;

  // Mesma validação de campos obrigatórios usada na criação do projeto
  if (!titulo || !titulo.trim() || !descricao || !descricao.trim() || !plataforma)
    return res.status(400).json({ erro: 'Título, descrição e plataforma são obrigatórios.' });
  if (titulo.trim().length > 200)
    return res.status(400).json({ erro: 'Título deve ter no máximo 200 caracteres.' });

  try {
    const [linhas] = await banco.execute('SELECT * FROM projetos WHERE id = ?', [req.params.id]);
    if (linhas.length === 0) return res.status(404).json({ erro: 'Projeto não encontrado.' });
    const ehDono = linhas[0].usuario_id === req.usuario.id;
    const ehAdmin = req.usuario.papel === 'admin';
    if (!ehDono && !ehAdmin) return res.status(403).json({ erro: 'Sem permissão.' });

    // Se algum campo opcional não vier no corpo da requisição, mantém o valor atual
    // em vez de apagá-lo (evita sobrescrever com NULL/undefined sem querer).
    const atual = linhas[0];
    // Se uma nova imagem foi enviada, remove a antiga do disco (evita
    // arquivos órfãos acumulando em /uploads, mesmo tratamento já usado no avatar)
    if (req.file && atual.url_imagem) {
      const caminhoAntigo = caminho.join(__dirname, '..', atual.url_imagem);
      if (fs.existsSync(caminhoAntigo)) fs.unlinkSync(caminhoAntigo);
    }
    const url_imagem       = req.file ? `/uploads/${req.file.filename}` : atual.url_imagem;
    const novaDificuldade  = dificuldade !== undefined ? dificuldade : atual.dificuldade;
    const novosMateriais   = materiais   !== undefined ? materiais   : atual.materiais;
    const novaMontagem     = montagem    !== undefined ? montagem    : atual.montagem;
    const novoCodigo       = codigo      !== undefined ? codigo      : atual.codigo;

    await banco.execute(
      `UPDATE projetos
       SET titulo=?, descricao=?, plataforma=?, dificuldade=?, materiais=?, montagem=?, codigo=?, url_imagem=?
       WHERE id=?`,
      [
        titulo.trim(), descricao.trim(), plataforma,
        novaDificuldade || 'Iniciante', novosMateriais || null, novaMontagem || null, novoCodigo || null,
        url_imagem, req.params.id,
      ]
    );

    // Atualiza as etiquetas
    if (etiquetas !== undefined) await salvarEtiquetas(req.params.id, etiquetas);

    res.json({ mensagem: 'Projeto atualizado.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar projeto.' });
  }
});

// ── Deletar projeto ───────────────────────────────────────────────────────────
rotas.delete('/:id', autenticacao, async (req, res) => {
  try {
    const [linhas] = await banco.execute('SELECT * FROM projetos WHERE id = ?', [req.params.id]);
    if (linhas.length === 0) return res.status(404).json({ erro: 'Projeto não encontrado.' });
    const ehDono = linhas[0].usuario_id === req.usuario.id;
    const ehAdmin = req.usuario.papel === 'admin';
    if (!ehDono && !ehAdmin) return res.status(403).json({ erro: 'Sem permissão.' });

    // Remove a imagem do disco se existir
    if (linhas[0].url_imagem) {
      const caminhoImagem = caminho.join(__dirname, '..', linhas[0].url_imagem);
      if (fs.existsSync(caminhoImagem)) fs.unlinkSync(caminhoImagem);
    }

    await banco.execute('DELETE FROM projetos WHERE id = ?', [req.params.id]);
    // Registra no log de auditoria só quando é uma remoção de moderação
    // (admin removendo projeto de outra pessoa), não quando o dono apaga o próprio.
    if (ehAdmin && !ehDono) {
      await registrarLog(req.usuario, 'deletar_projeto', 'projeto', Number(req.params.id), linhas[0].titulo);
    }
    res.json({ mensagem: 'Projeto deletado.' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao deletar projeto.' });
  }
});

// ── Arquivar / desarquivar projeto ────────────────────────────────────────────
// Esconde o projeto da plataforma (Explorar, perfil) sem excluí-lo — reversível.
rotas.post('/:id/arquivar', autenticacao, async (req, res) => {
  try {
    const [linhas] = await banco.execute('SELECT * FROM projetos WHERE id = ?', [req.params.id]);
    if (linhas.length === 0) return res.status(404).json({ erro: 'Projeto não encontrado.' });
    const ehDono = linhas[0].usuario_id === req.usuario.id;
    const ehAdmin = req.usuario.papel === 'admin';
    if (!ehDono && !ehAdmin) return res.status(403).json({ erro: 'Sem permissão.' });

    const novoEstado = linhas[0].arquivado ? 0 : 1;
    await banco.execute('UPDATE projetos SET arquivado = ? WHERE id = ?', [novoEstado, req.params.id]);
    if (ehAdmin && !ehDono) {
      await registrarLog(
        req.usuario,
        novoEstado ? 'arquivar_projeto' : 'desarquivar_projeto',
        'projeto',
        Number(req.params.id),
        linhas[0].titulo
      );
    }
    res.json({
      mensagem: novoEstado ? 'Projeto arquivado.' : 'Projeto desarquivado.',
      arquivado: !!novoEstado,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao arquivar projeto.' });
  }
});

// ── Denunciar projeto ─────────────────────────────────────────────────────────
rotas.post('/:id/denunciar', autenticacao, async (req, res) => {
  try {
    const [linhas] = await banco.execute('SELECT usuario_id FROM projetos WHERE id = ?', [req.params.id]);
    if (linhas.length === 0) return res.status(404).json({ erro: 'Projeto não encontrado.' });

    await criarDenuncia({
      denuncianteId: req.usuario.id,
      alvoTipo: 'projeto',
      alvoId: Number(req.params.id),
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

// ── Curtir / descurtir ────────────────────────────────────────────────────────
rotas.post('/:id/curtir', autenticacao, async (req, res) => {
  try {
    const [existente] = await banco.execute(
      'SELECT * FROM projeto_curtidas WHERE usuario_id = ? AND projeto_id = ?',
      [req.usuario.id, req.params.id]
    );
    if (existente.length > 0) {
      await banco.execute(
        'DELETE FROM projeto_curtidas WHERE usuario_id = ? AND projeto_id = ?',
        [req.usuario.id, req.params.id]
      );
      await banco.execute(
        'UPDATE projetos SET total_curtidas = total_curtidas - 1 WHERE id = ?',
        [req.params.id]
      );
      return res.json({ curtido: false });
    }
    await banco.execute(
      'INSERT INTO projeto_curtidas (usuario_id, projeto_id) VALUES (?,?)',
      [req.usuario.id, req.params.id]
    );
    await banco.execute(
      'UPDATE projetos SET total_curtidas = total_curtidas + 1 WHERE id = ?',
      [req.params.id]
    );
    // Notifica o dono do projeto
    const [projeto] = await banco.execute('SELECT usuario_id FROM projetos WHERE id = ?', [req.params.id]);
    if (projeto.length > 0) {
      await criarNotificacao(projeto[0].usuario_id, req.usuario.id, 'curtida', req.params.id);
    }
    res.json({ curtido: true });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao curtir.' });
  }
});

// ── Copiar projeto ────────────────────────────────────────────────────────────
rotas.post('/:id/copiar', autenticacao, async (req, res) => {
  try {
    const [existente] = await banco.execute(
      'SELECT * FROM projeto_copias WHERE usuario_id = ? AND projeto_id = ?',
      [req.usuario.id, req.params.id]
    );
    if (existente.length > 0) return res.json({ mensagem: 'Já copiado.' });

    await banco.execute(
      'INSERT INTO projeto_copias (usuario_id, projeto_id) VALUES (?,?)',
      [req.usuario.id, req.params.id]
    );
    await banco.execute(
      'UPDATE projetos SET total_copias = total_copias + 1 WHERE id = ?',
      [req.params.id]
    );
    // Notifica o dono do projeto
    const [projeto] = await banco.execute('SELECT usuario_id FROM projetos WHERE id = ?', [req.params.id]);
    if (projeto.length > 0) {
      await criarNotificacao(projeto[0].usuario_id, req.usuario.id, 'copia', req.params.id);
    }
    res.json({ copiado: true });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao copiar.' });
  }
});

module.exports = rotas;
