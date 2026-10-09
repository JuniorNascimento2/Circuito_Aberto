// Formata uma data no padrão brasileiro (DD/MM/AAAA às HH:MM)
function formatarDataHoraBr(data) {
  const d = new Date(data);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} às ${hora}:${min}`;
}

/**
 * Confere se a conta está banida. Se o banimento era temporário e já
 * expirou, desbane automaticamente no banco (o usuário recupera o acesso
 * sem precisar de nenhuma ação do admin) e retorna { banido: false }.
 */
async function verificarBanimento(banco, usuarioId, dadosUsuario) {
  if (!dadosUsuario.banido_em) return { banido: false };

  const expirado = dadosUsuario.banido_ate && new Date(dadosUsuario.banido_ate) <= new Date();
  if (expirado) {
    await banco.execute(
      'UPDATE usuarios SET banido_em = NULL, banido_ate = NULL, motivo_banimento = NULL WHERE id = ?',
      [usuarioId]
    );
    return { banido: false };
  }

  return {
    banido: true,
    motivo: dadosUsuario.motivo_banimento,
    banido_ate: dadosUsuario.banido_ate,
  };
}

// Monta a mensagem exibida para o usuário banido (na tela de login)
function mensagemBanimento({ motivo, banido_ate }) {
  let msg = banido_ate
    ? `Sua conta foi banida até ${formatarDataHoraBr(banido_ate)}.`
    : 'Sua conta foi banida permanentemente.';
  if (motivo) msg += ` Motivo: ${motivo}.`;
  msg += ' Entre em contato com a coordenação.';
  return msg;
}

module.exports = { verificarBanimento, mensagemBanimento, formatarDataHoraBr };
