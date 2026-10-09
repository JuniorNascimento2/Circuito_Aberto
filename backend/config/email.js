const nodemailer = require('nodemailer');

const transportador = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, // Senha de app do Gmail (não a senha normal)
  },
});

async function enviarEmailRedefinicao(emailDestino, nomeUsuario, tokenRedefinicao) {
  const urlRedefinicao = `${process.env.CLIENT_URL}/paginas/redefinir-senha.html?token=${tokenRedefinicao}`;

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#0e0e10;font-family:'DM Sans',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e10;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#16161a;border:1px solid #2a2a32;border-radius:16px;overflow:hidden;">

              <!-- Cabeçalho -->
              <tr>
                <td style="background:#1a9e72;padding:28px 32px;">
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.5px;">
                    ⚡ Circuito Aberto
                  </h1>
                  <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">
                    Plataforma maker brasileira
                  </p>
                </td>
              </tr>

              <!-- Corpo -->
              <tr>
                <td style="padding:32px;">
                  <h2 style="margin:0 0 12px;color:#e8e8f0;font-size:20px;font-weight:600;">
                    Redefinir sua senha
                  </h2>
                  <p style="margin:0 0 8px;color:#8888a0;font-size:14px;line-height:1.6;">
                    Olá, <strong style="color:#e8e8f0;">${nomeUsuario}</strong>!
                  </p>
                  <p style="margin:0 0 28px;color:#8888a0;font-size:14px;line-height:1.6;">
                    Recebemos uma solicitação para redefinir a senha da sua conta no Circuito Aberto. Clique no botão abaixo para criar uma nova senha:
                  </p>

                  <!-- Botão -->
                  <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                    <tr>
                      <td style="background:#1a9e72;border-radius:10px;">
                        <a href="${urlRedefinicao}"
                           style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:-0.3px;">
                          Redefinir minha senha →
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Aviso de expiração -->
                  <div style="background:#1e1e24;border:1px solid #2a2a32;border-radius:10px;padding:16px;margin-bottom:24px;">
                    <p style="margin:0;color:#8888a0;font-size:13px;line-height:1.5;">
                      ⏱ <strong style="color:#e8e8f0;">Este link expira em 1 hora.</strong><br>
                      Se você não solicitou a redefinição de senha, ignore este e-mail. Sua conta continua segura.
                    </p>
                  </div>

                  <!-- Link alternativo -->
                  <p style="margin:0;color:#55556a;font-size:12px;line-height:1.6;">
                    Ou copie e cole este link no navegador:<br>
                    <a href="${urlRedefinicao}" style="color:#1a9e72;word-break:break-all;">${urlRedefinicao}</a>
                  </p>
                </td>
              </tr>

              <!-- Rodapé -->
              <tr>
                <td style="padding:20px 32px;border-top:1px solid #2a2a32;">
                  <p style="margin:0;color:#55556a;font-size:12px;text-align:center;">
                    © ${new Date().getFullYear()} Circuito Aberto · Desenvolvido por Júnior Nascimento
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await transportador.sendMail({
    from: `"Circuito Aberto" <${process.env.MAIL_USER}>`,
    to: emailDestino,
    subject: '🔑 Redefinição de senha — Circuito Aberto',
    html,
  });
}

module.exports = { enviarEmailRedefinicao };
