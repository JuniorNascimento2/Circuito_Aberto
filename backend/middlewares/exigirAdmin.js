// Deve ser usado SEMPRE depois do middleware de autenticação, que já
// preenche req.usuario.papel a partir do banco (não do token, então está
// sempre atualizado).
function exigirAdmin(req, res, proximo) {
  if (!req.usuario || req.usuario.papel !== 'admin') {
    return res.status(403).json({ erro: 'Apenas administradores podem acessar este recurso.' });
  }
  proximo();
}

module.exports = exigirAdmin;
