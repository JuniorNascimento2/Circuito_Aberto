const express = require('express');
const rotas = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const banco = require('../config/banco');
const { verificarBanimento, mensagemBanimento } = require('../config/banimento');

// Cadastro
rotas.post('/cadastrar', async (req, res) => {
  const { nome_usuario, email, senha } = req.body;

  // Validações de formato e comprimento
  if (!nome_usuario || !email || !senha)
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  if (nome_usuario.trim().length < 3 || nome_usuario.trim().length > 30)
    return res.status(400).json({ erro: 'Nome de usuário deve ter entre 3 e 30 caracteres.' });
  if (!/^[a-zA-Z0-9_ ]+$/.test(nome_usuario.trim()))
    return res.status(400).json({ erro: 'Nome de usuário não pode conter caracteres especiais.' });
  if (senha.length < 6 || senha.length > 100)
    return res.status(400).json({ erro: 'Senha deve ter entre 6 e 100 caracteres.' });
  if (!/\S+@\S+\.\S+/.test(email))
    return res.status(400).json({ erro: 'E-mail inválido.' });

  try {
    const [existentes] = await banco.execute(
      'SELECT id FROM usuarios WHERE email = ? OR nome_usuario = ?',
      [email, nome_usuario]
    );
    if (existentes.length > 0)
      return res.status(400).json({ erro: 'E-mail ou nome de usuário já em uso.' });

    const hash = await bcrypt.hash(senha, 10);
    const [resultado] = await banco.execute(
      'INSERT INTO usuarios (nome_usuario, email, senha_hash) VALUES (?, ?, ?)',
      [nome_usuario, email, hash]
    );
    const token = jwt.sign(
      { id: resultado.insertId, nome_usuario },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.status(201).json({ token, usuario: { id: resultado.insertId, nome_usuario, email, papel: 'comum' } });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
});

// Entrar
rotas.post('/entrar', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha)
    return res.status(400).json({ erro: 'Preencha todos os campos.' });

  try {
    const [linhas] = await banco.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (linhas.length === 0)
      return res.status(401).json({ erro: 'Credenciais inválidas.' });

    const usuario = linhas[0];
    const valida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!valida)
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    if (usuario.banido_em) {
      const estado = await verificarBanimento(banco, usuario.id, usuario);
      if (estado.banido) {
        return res.status(403).json({ erro: mensagemBanimento(estado) });
      }
    }

    const token = jwt.sign(
      { id: usuario.id, nome_usuario: usuario.nome_usuario },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome_usuario: usuario.nome_usuario,
        email: usuario.email,
        papel: usuario.papel,
        biografia: usuario.biografia,
        url_avatar: usuario.url_avatar,
      },
    });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
});

// Esqueci minha senha
rotas.post('/esqueci-senha', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ erro: 'Informe o e-mail.' });

  // Sempre retorna sucesso para não revelar se o e-mail existe
  res.json({ mensagem: 'Se o e-mail existir, você receberá as instruções.' });

  try {
    const [linhas] = await banco.execute('SELECT id, nome_usuario FROM usuarios WHERE email = ?', [email]);
    if (linhas.length === 0) return;

    const usuario = linhas[0];
    const token = jwt.sign({ id: usuario.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    await banco.execute(
      'UPDATE usuarios SET token_redefinicao = ?, token_redefinicao_expira = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?',
      [token, usuario.id]
    );

    // Envia o e-mail real se as variáveis estiverem configuradas
    if (process.env.MAIL_USER && process.env.MAIL_PASS) {
      const { enviarEmailRedefinicao } = require('../config/email');
      await enviarEmailRedefinicao(email, usuario.nome_usuario, token);
      console.log(`[REDEFINIR] E-mail enviado para ${email}`);
    } else {
      // Fallback para desenvolvimento: mostra no terminal
      const urlRedefinicao = `${process.env.CLIENT_URL || 'http://localhost:4000'}/paginas/redefinir-senha.html?token=${token}`;
      console.log(`[REDEFINIR - DEV] Link para ${email}:\n${urlRedefinicao}`);
    }
  } catch (erro) {
    console.error('[REDEFINIR] Erro ao enviar e-mail:', erro.message);
  }
});

// Redefinir senha
rotas.post('/redefinir-senha', async (req, res) => {
  const { token, senha } = req.body;
  if (!token || !senha)
    return res.status(400).json({ erro: 'Token e nova senha são obrigatórios.' });

  try {
    const decodificado = jwt.verify(token, process.env.JWT_SECRET);
    const [linhas] = await banco.execute(
      'SELECT id FROM usuarios WHERE id = ? AND token_redefinicao = ? AND token_redefinicao_expira > NOW()',
      [decodificado.id, token]
    );
    if (linhas.length === 0)
      return res.status(400).json({ erro: 'Token inválido ou expirado.' });

    const hash = await bcrypt.hash(senha, 10);
    await banco.execute(
      'UPDATE usuarios SET senha_hash = ?, token_redefinicao = NULL, token_redefinicao_expira = NULL WHERE id = ?',
      [hash, decodificado.id]
    );
    res.json({ mensagem: 'Senha redefinida com sucesso.' });
  } catch (erro) {
    res.status(400).json({ erro: 'Token inválido ou expirado.' });
  }
});

module.exports = rotas;
