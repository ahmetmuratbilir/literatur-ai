import { Resend } from 'resend';
import { logger } from '../utils/logger.js';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'LiteraturAI <onboarding@resend.dev>';

/**
 * Magic Link E-postası Gönderimi
 */
export async function sendMagicLinkEmail({ email, magicLink, appName = 'LiteraturAI' }) {
  if (!resend) {
    logger.warn({ email }, '[EmailService] RESEND_API_KEY tanımlanmamış, e-posta simüle edildi.');
    return { simulated: true, magicLink };
  }

  const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="utf-8"></head>
    <body style="background-color:#0b0f19; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#f3f4f6; padding:40px 15px; margin:0;">
      <div style="max-width:480px; margin:0 auto; background:#111827; border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:36px 28px; text-align:center;">
        <div style="font-size:26px; font-weight:800; color:#ffffff; margin-bottom:18px;">📚 <span style="color:#818cf8;">${appName}</span></div>
        <h2 style="color:#ffffff; margin:0 0 12px 0; font-size:20px;">Giriş Bağlantınız Hazır</h2>
        <p style="color:#9ca3af; font-size:14px; line-height:1.6; margin:0 0 28px 0;">
          Şifreye gerek olmadan hesabınıza tek tıkla erişmek veya kaydınızı tamamlamak için aşağıdaki butona tıklayın:
        </p>
        <a href="${magicLink}" style="display:inline-block; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#ffffff !important; text-decoration:none; padding:13px 32px; border-radius:8px; font-weight:600; font-size:15px; box-shadow:0 4px 14px rgba(99,102,241,0.35);" target="_blank">
          ${appName}'ye Giriş Yap →
        </a>
        <p style="color:#6b7280; font-size:12px; margin:28px 0 0 0; line-height:1.5;">
          Bu bağlantı <strong>15 dakika</strong> geçerlidir ve yalnızca bir kez kullanılabilir.<br>
          Bu isteği siz yapmadıysanız bu e-postayı güvenle yok sayabilirsiniz.
        </p>
      </div>
    </body>
    </html>
  `;

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [email],
    subject: `🔐 ${appName} Giriş Bağlantınız`,
    html,
  });

  if (error) {
    logger.error({ error, email }, '[EmailService] Resend e-posta gönderim hatası');
    throw new Error(error.message);
  }

  return data;
}

/**
 * Yatırımcı & Canlı Demo Karşılama E-postası
 */
export async function sendWelcomeDemoEmail({ email, name = 'Araştırmacı', query = '' }) {
  if (!resend) {
    logger.warn({ email }, '[EmailService] RESEND_API_KEY tanımlanmamış, hoş geldin simüle edildi.');
    return { simulated: true };
  }

  const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="utf-8"></head>
    <body style="background-color:#0b0f19; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#f3f4f6; padding:40px 15px; margin:0;">
      <div style="max-width:500px; margin:0 auto; background:#111827; border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:36px 28px; text-align:left;">
        <div style="text-align:center; margin-bottom:20px;">
          <span style="font-size:32px;">📚</span>
          <h2 style="color:#ffffff; margin:8px 0 4px 0; font-size:22px;">LiteraturAI'ye Hoş Geldiniz!</h2>
          <p style="color:#818cf8; font-size:13px; font-weight:600;">Yapay Zekâ Destekli Akademik Literatür & Sentez Platformu</p>
        </div>

        <p style="color:#cbd5e1; font-size:14px; line-height:1.6;">
          Merhaba <strong>${name}</strong>,
        </p>
        <p style="color:#9ca3af; font-size:14px; line-height:1.6;">
          Canlı demomuzda platformumuzu denediğiniz için teşekkür ederiz! ${query ? `Aradığınız <strong>"${query}"</strong> konusundaki akademik literatür tarama motorumuz başarıyla çalıştı.` : ''}
        </p>

        <div style="background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); border-radius:12px; padding:16px; margin:20px 0;">
          <h4 style="color:#c7d2fe; margin:0 0 8px 0; font-size:14px;">🎁 1 Aylık Pro Deneme Tanımlandı</h4>
          <ul style="color:#94a3b8; font-size:13px; margin:0; padding-left:18px; line-height:1.5;">
            <li>7 Küresel Akademik Veritabanı (Scopus, OpenAlex, CORE vb.)</li>
            <li>AHP (Analitik Hiyerarşi) ile Q1/Q2 Dergi Prestij Sıralaması</li>
            <li>Doğrulanmış Literatür Sentezi & PDF/Word Dışa Aktarımı</li>
          </ul>
        </div>

        <div style="text-align:center; margin:28px 0 10px;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="display:inline-block; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#ffffff !important; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:600; font-size:14px;" target="_blank">
            LiteraturAI'yi Keşfetmeye Devam Edin →
          </a>
        </div>

        <p style="color:#64748b; font-size:12px; margin-top:24px; text-align:center; border-top:1px solid rgba(255,255,255,0.06); padding-top:16px;">
          LiteraturAI Ekibi • Bilimsel Araştırmayı Hızlandırıyoruz
        </p>
      </div>
    </body>
    </html>
  `;

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [email],
    subject: '📚 LiteraturAI Canlı Demo: 1 Aylık Pro Hesabınız ve Raporunuz Hazır!',
    html,
  });

  if (error) {
    logger.error({ error, email }, '[EmailService] Hoş geldin e-posta hatası');
    throw new Error(error.message);
  }

  return data;
}
