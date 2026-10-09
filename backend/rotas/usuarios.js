const express = require('express');
const rotas = express.Router();
const banco = require('../config/banco');
const autenticacao = require('../middlewares/autenticacao');
const multer = require('multer');
const caminho = require('path');
const fs = require('fs');

// Mimetypes permitidos (mesma lista usada no envio de imagem de projeto)
const MIMETYPES_AVATAR_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Extensão baseada no mimetype real (evita usar a extensão que o cliente
// mandou no nome do arquivo, que pode ser forjada, ex: "avatar.php.png")
const EXTENSAO_AVATAR_POR_MIMETYPE = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
};

// Multer para o avatar
const armazenamento = multer.diskStorage({
  destination: (req, arquivo, cb) => {
    const pasta = caminho.join(__dirname, '../uploads/avatars');
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
    cb(null, pasta);
  },
  filename: (req, arquivo, cb) => {
    const extensao = EXTENSAO_AVATAR_POR_MIMETYPE[arquivo.mimetype] || '.jpg';
    cb(null, `avatar-${req.usuario.id}-${Date.now()}${extensao}`);
  },
});
const envio = multer({
  storage: armazenamento,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, arquivo, cb) => {
    if (MIMETYPES_AVATAR_PERMITIDOS.includes(arquivo.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato inválido. Envie apenas JPG, PNG, WEBP ou GIF.'));
    }
  },
});

// Middleware para tratar erros do multer no envio do avatar
function tratarEnvioAvatar(req, res, proximo) {
  envio.single('avatar')(req, res, (erro) => {
    if (erro instanceof multer.MulterError) {
      if (erro.code === 'LIMIT_FILE_SIZE')
        return res.status(400).json({ erro: 'Imagem muito grande. Máximo 5MB.' });
      return res.status(400).json({ erro: 'Erro no envio: ' + erro.message });
    }
    if (erro) return res.status(400).json({ erro: erro.message });
    proximo();
  });
}

// Atualizar a biografia (deve vir ANTES de /:nomeUsuario)
rotas.put('/eu/perfil', autenticacao, async (req, res) => {
  const { biografia } = req.body;
  if (biografia && biografia.length > 300)
    return res.status(400).json({ erro: 'Bio deve ter no máximo 300 caracteres.' });
  try {
    await banco.execute(
      'UPDATE usuarios SET biografia = ? WHERE id = ?',
      [biografia || null, req.usuario.id]
    );
    res.json({ mensagem: 'Perfil atualizado.' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar perfil.' });
  }
});

// Envio do avatar
rotas.post('/eu/avatar', autenticacao, tratarEnvioAvatar, async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Nenhuma imagem enviada.' });

  const url_avatar = `/uploads/avatars/${req.file.filename}`;
  try {
    // Remove o avatar antigo se existir
    const [linhas] = await banco.execute('SELECT url_avatar FROM usuarios WHERE id = ?', [req.usuario.id]);
    if (linhas[0]?.url_avatar) {
      const caminhoAntigo = caminho.join(__dirname, '..', linhas[0].url_avatar);
      if (fs.existsSync(caminhoAntigo)) fs.unlinkSync(caminhoAntigo);
    }

    await banco.execute('UPDATE usuarios SET url_avatar = ? WHERE id = ?', [url_avatar, req.usuario.id]);
    res.json({ url_avatar });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao salvar avatar.' });
  }
});

// Perfil de qualquer usuário (lista de projetos paginada)
const TAMANHO_PAGINA_PERFIL = 20;

rotas.get('/:nomeUsuario', autenticacao, async (req, res) => {
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const deslocamento = (pagina - 1) * TAMANHO_PAGINA_PERFIL;

  try {
    const [usuarios] = await banco.execute(
      'SELECT id, nome_usuario, biografia, url_avatar, criado_em FROM usuarios WHERE nome_usuario = ?',
      [req.params.nomeUsuario]
    );
    if (usuarios.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const usuario = usuarios[0];
    const [projetos] = await banco.execute(
      `SELECT * FROM projetos WHERE usuario_id = ? AND arquivado = 0
       ORDER BY criado_em DESC LIMIT ${TAMANHO_PAGINA_PERFIL} OFFSET ${deslocamento}`,
      [usuario.id]
    );
    const [[{ total_projetos }]] = await banco.execute(
      'SELECT COUNT(*) as total_projetos FROM projetos WHERE usuario_id = ? AND arquivado = 0',
      [usuario.id]
    );
    const [estatisticas] = await banco.execute(
      `SELECT SUM(total_curtidas) as total_curtidas, SUM(total_copias) as total_copias
       FROM projetos WHERE usuario_id = ?`,
      [usuario.id]
    );
    res.json({
      ...usuario,
      projetos,
      estatisticas: estatisticas[0],
      pagina,
      tem_proxima: deslocamento + TAMANHO_PAGINA_PERFIL < total_projetos,
      total_projetos,
    });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar perfil.' });
  }
});

module.exports = rotas;
