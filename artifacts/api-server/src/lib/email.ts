import { Resend } from "resend";
import { logger } from "./logger";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.FROM_EMAIL ?? "Klaro <onboarding@resend.dev>";
const APP_URL = (process.env.FRONTEND_URL ?? "http://localhost:5173").replace(/\/$/, "");

// ─── Verification email ────────────────────────────────────────────────────────

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const url = `${APP_URL}/verify-email?token=${token}`;

  if (!resend) {
    logger.info({ to, url }, "[email] RESEND_API_KEY not set — verification link logged");
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Confirme seu e-mail — Klaro",
    html: verificationHtml(name, url),
  });
}

// ─── Password reset email ──────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const url = `${APP_URL}/reset-password?token=${token}`;

  if (!resend) {
    logger.info({ to, url }, "[email] RESEND_API_KEY not set — reset link logged");
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Recuperação de senha — Klaro",
    html: resetHtml(name, url),
  });
}

// ─── HTML templates ────────────────────────────────────────────────────────────

function baseHtml(content: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Klaro</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:'Inter',ui-sans-serif,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <!-- Logo -->
        <tr><td style="padding-bottom:32px;text-align:center;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:14px;background:#6af82f;">
            <span style="font-size:24px;font-weight:700;color:#09090b;line-height:1;">K</span>
          </div>
        </td></tr>
        <!-- Card -->
        <tr><td style="background:linear-gradient(180deg,rgba(26,26,31,0.98),rgba(20,20,24,0.95));border:1px solid #26262c;border-radius:20px;padding:40px 36px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;color:#52525b;font-size:11px;line-height:1.6;">
          Klaro · Gestão inteligente para o seu negócio<br/>
          Se você não solicitou este e-mail, pode ignorá-lo com segurança.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;background:linear-gradient(180deg,#6af82f,#4de020);color:#09090b;font-size:14px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:12px;letter-spacing:-0.01em;">${label}</a>`;
}

function verificationHtml(name: string, url: string) {
  return baseHtml(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f4f4f5;letter-spacing:-0.03em;">
      Confirme seu e-mail
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#8a8a95;line-height:1.6;">
      Olá, ${name}. Clique no botão abaixo para confirmar seu e-mail e ativar sua conta no Klaro.
    </p>
    <div style="text-align:center;margin:32px 0;">
      ${btn(url, "Confirmar e-mail")}
    </div>
    <p style="margin:24px 0 0;font-size:12px;color:#52525b;line-height:1.6;text-align:center;">
      Este link é válido por 24 horas.<br/>
      Ou copie o link: <span style="color:#6af82f;">${url}</span>
    </p>
  `);
}

function resetHtml(name: string, url: string) {
  return baseHtml(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f4f4f5;letter-spacing:-0.03em;">
      Recuperação de senha
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#8a8a95;line-height:1.6;">
      Olá, ${name}. Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha.
    </p>
    <div style="text-align:center;margin:32px 0;">
      ${btn(url, "Redefinir senha")}
    </div>
    <p style="margin:24px 0 0;font-size:12px;color:#52525b;line-height:1.6;text-align:center;">
      Este link é válido por 1 hora.<br/>
      Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece inalterada.
    </p>
  `);
}
