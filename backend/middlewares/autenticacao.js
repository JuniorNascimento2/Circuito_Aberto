const jwt = require('jsonwebtoken');
const banco = require('../config/banco');
const { verificarBanimento, mensagemBanimento } = require('../config/banimento');

// Verifica o token E confere o estado atual da conta no banco (papel e
// banimento). Isso é de propósito: um token válido de 7 dias não pode
// continuar funcionando depois que o usuário foi banido nesse meio tempo —
// e, ao contrário, se o banimento era temporário e já expirou, a conta
// recupera o acesso automaticamente, sem o admin precisar desbanir.
async function autenticacao(req, res, proximo) {
  const cabecalho = req.headers.authorization;
  if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não fornecido.' });
  }
  const token = cabecalho.split(' ')[1];

  let decodificado;
  try {
    decodificado = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }

  try {
    const [linhas] = await banco.execute(
      'SELECT id, nome_usuario, papel, banido_em, banido_ate, motivo_banimento FROM usuarios WHERE id = ?',
      [decodificado.id]
    );
    if (linhas.length === 0) {
      return res.status(401).json({ erro: 'Conta não encontrada.' });
    }
    const usuario = linhas[0];
    const estado = await verificarBanimento(banco, usuario.id, usuario);
    if (estado.banido) {
      return res.status(401).json({ erro: mensagemBanimento(estado) });
    }
    req.usuario = { id: usuario.id, nome_usuario: usuario.nome_usuario, papel: usuario.papel };
    proximo();
  } catch {
    return res.status(500).json({ erro: 'Erro ao validar sessão.' });
  }
}

module.exports = autenticacao;
