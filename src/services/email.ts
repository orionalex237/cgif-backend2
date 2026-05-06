// ─── src/services/email.ts ────────────────────────────────────────────────────
// Service d'envoi d'email centralisé (Nodemailer)
// ─────────────────────────────────────────────────────────────────────────────

import nodemailer from 'nodemailer';

const transport = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.EMAIL_FROM || 'CGIF SA <noreply@cgif.cm>';
const BASE = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── Envoi générique ───────────────────────────────────────────────────────────

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[Email simulé] → ${to} | ${subject}`);
    return;
  }
  try {
    await transport.sendMail({ from: FROM, to, subject, html });
  } catch (err: any) {
    console.error(`[Email error] ${to}: ${err.message}`);
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

function layout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f5f5;margin:0;padding:32px 0;}
  .card{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);}
  .header{background:#0D2818;padding:28px 32px;text-align:center;}
  .header h1{color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:.5px;}
  .body{padding:32px;}
  .body p{font-size:15px;line-height:1.7;color:#374151;margin:0 0 16px;}
  .btn{display:inline-block;padding:13px 28px;background:#0D2818;color:#fff !important;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;margin:12px 0;}
  .footer{padding:20px 32px;text-align:center;font-size:12px;color:#9CA3AF;border-top:1px solid #F3F4F6;}
</style></head>
<body>
<div class="card">
  <div class="header"><h1>CGIF — Cameroon Global Intelligence Forum</h1></div>
  <div class="body">${content}</div>
  <div class="footer">© ${new Date().getFullYear()} CGIF SA — Tous droits réservés</div>
</div>
</body></html>`;
}

export const emailService = {

  async welcomePending(to: string, name: string): Promise<void> {
    await send(to, 'Bienvenue sur CGIF — Compte en attente de validation', layout(`
      <p>Bonjour <strong>${name}</strong>,</p>
      <p>Votre demande d'adhésion à CGIF a bien été reçue. Notre équipe va examiner votre dossier dans les meilleurs délais.</p>
      <p>Vous recevrez un email de confirmation dès que votre compte sera activé.</p>
      <p style="color:#6B7280;font-size:13px;">Si vous n'avez pas créé ce compte, ignorez cet email.</p>
    `));
  },

  async accountActivated(to: string, name: string): Promise<void> {
    await send(to, '✅ Votre compte CGIF est activé', layout(`
      <p>Bonjour <strong>${name}</strong>,</p>
      <p>Bonne nouvelle ! Votre compte CGIF a été validé par notre équipe.</p>
      <p>Vous pouvez maintenant accéder à la plateforme et explorer les projets d'investissement.</p>
      <a href="${BASE}/login" class="btn">Accéder à la plateforme</a>
    `));
  },

  async kycApproved(to: string, name: string): Promise<void> {
    await send(to, '✅ KYC validé — Vous pouvez investir', layout(`
      <p>Bonjour <strong>${name}</strong>,</p>
      <p>Votre dossier KYC a été vérifié et approuvé. Vous avez maintenant accès à toutes les fonctionnalités d'investissement sur CGIF.</p>
      <a href="${BASE}/invest" class="btn">Voir les projets</a>
    `));
  },

  async kycRejected(to: string, name: string, reason: string): Promise<void> {
    await send(to, '⚠️ KYC — Action requise', layout(`
      <p>Bonjour <strong>${name}</strong>,</p>
      <p>Votre dossier KYC n'a pas pu être validé pour la raison suivante :</p>
      <p style="background:#FEF3C7;padding:12px 16px;border-radius:8px;border-left:4px solid #F59E0B;color:#92400E;">${reason}</p>
      <p>Vous pouvez soumettre un nouveau dossier en corrigeant le problème mentionné.</p>
      <a href="${BASE}/kyc" class="btn">Corriger mon dossier</a>
    `));
  },

  async investmentBankInfo(to: string, name: string, ref: string, amount: number): Promise<void> {
    await send(to, `💼 Coordonnées bancaires CGIF — Réf ${ref}`, layout(`
      <p>Bonjour <strong>${name}</strong>,</p>
      <p>Votre vœu d'investissement de <strong>${amount.toLocaleString('fr-FR')} FCFA</strong> a été enregistré.</p>
      <p>Veuillez effectuer votre virement dans les <strong>5 jours ouvrés</strong> avec la référence suivante :</p>
      <p style="background:#F0FDF4;padding:12px 16px;border-radius:8px;border-left:4px solid #22C55E;font-family:monospace;font-size:16px;font-weight:700;color:#15803D;">${ref}</p>
      <p><strong>Coordonnées bancaires :</strong></p>
      <p style="font-size:13px;color:#6B7280;">Titulaire : CGIF SA<br>IBAN Europe : FR76 3000 6000 0112 3456 7890 189<br>Orange Money : +237 699 000 001<br>MTN MoMo : +237 677 000 001</p>
    `));
  },

  async investmentActivated(to: string, name: string, project: string, shares: number): Promise<void> {
    await send(to, '🏆 Investissement activé — Félicitations !', layout(`
      <p>Bonjour <strong>${name}</strong>,</p>
      <p>Votre investissement dans le projet <strong>"${project}"</strong> a été confirmé et activé.</p>
      <p>Vous êtes maintenant détenteur de <strong>${shares} part(s)</strong> dans ce projet.</p>
      <p>Votre certificat d'investissement est disponible dans votre espace membre.</p>
      <a href="${BASE}/portfolio" class="btn">Voir mon portfolio</a>
    `));
  },
};
