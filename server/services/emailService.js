import { Resend } from 'resend';
import { logger } from '../utils/logger.js';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'LiteraturAI <onboarding@resend.dev>';

// Kullanıcıdan gelen metin e-postaya ham girerse alıcıya link veya sahte içerik gömülebilir.
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
// Konu satırı ve selamlama için: satır sonlarını kaldır, uzunluğu sınırla.
const plainLine = (value, max = 80) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);

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
        <a href="${magicLink}" style="display:inline-block; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#ffffff !important; text-decoration:none; padding:13px 32px; border-radius:8px; font-weight:600; font-size:15px; box-shadow:0 4px 14px rgba(99,102,241,0.35);" target="_blank" rel="noopener noreferrer">
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
          Merhaba <strong>${escapeHtml(plainLine(name))}</strong>,
        </p>
        <p style="color:#9ca3af; font-size:14px; line-height:1.6;">
          Canlı demomuzda platformumuzu denediğiniz için teşekkür ederiz! ${query ? `Aradığınız <strong>"${escapeHtml(plainLine(query, 160))}"</strong> konusundaki akademik literatür tarama motorumuz başarıyla çalıştı.` : ''}
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
          <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="display:inline-block; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#ffffff !important; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:600; font-size:14px;" target="_blank" rel="noopener noreferrer">
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

/**
 * Kullanıcı Giriş / Kayıt Hoş Geldin E-postası (Primary Inbox Odaklı)
 */
export async function sendWelcomeOnboardingEmail({ email, name = 'Araştırmacı' }) {
  if (!resend) {
    logger.warn({ email }, '[EmailService] RESEND_API_KEY tanımlanmamış, onboarding e-postası simüle edildi.');
    return { simulated: true, email, name };
  }

  const appUrl = process.env.CLIENT_URL || 'https://literatur-ai.com';
  const cleanName = escapeHtml(plainLine(name));
  const subjectLine = `LiteraturAI hesabınız hazır, ${plainLine(name, 40)}`;

  const textVersion = `Merhaba ${plainLine(name)},

LiteraturAI'ye hoş geldiniz!

Akademik araştırmalarınızı hızlandırmak için hesabınız başarıyla oluşturuldu. Artık Scopus, OpenAlex, Crossref, CORE ve arXiv üzerindeki 300 milyondan fazla akademik makaleyi AHP ve yapay zekâ analiz gücüyle tarayabilirsiniz.

Platforma hemen erişmek için:
${appUrl}

Herhangi bir sorunuz veya öneriniz olursa doğrudan bu e-postayı yanıtlayabilirsiniz.

Başarılar dileriz,
LiteraturAI Ekibi
https://literatur-ai.com`;

  const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subjectLine}</title>
    </head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background-color:#f8fafc; color:#1e293b; margin:0; padding:32px 16px; line-height:1.6;">
      <div style="max-width:540px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:32px 28px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        
        <!-- Logo Header -->
        <div style="margin-bottom:28px;">
          <a href="${appUrl}" style="text-decoration:none; display:inline-block;" target="_blank" rel="noopener noreferrer">
            <table cellpadding="0" cellspacing="0" border="0" style="display:inline-table; vertical-align:middle;">
              <tr>
                <td style="width:40px; height:40px; background:linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); border-radius:10px; text-align:center; vertical-align:middle; line-height:40px; box-shadow:0 4px 10px rgba(124,58,237,0.25);">
                  <span style="color:#ffffff; font-size:20px; line-height:1; display:inline-block;">⚡</span>
                </td>
                <td style="padding-left:12px; vertical-align:middle;">
                  <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:22px; font-weight:900; color:#0f172a; letter-spacing:-0.03em;">Literatur <span style="color:#6366f1;">AI</span></span>
                </td>
              </tr>
            </table>
          </a>
        </div>

        <p style="font-size:15px; color:#1e293b; margin:0 0 16px 0;">
          Merhaba <strong>${cleanName}</strong>,
        </p>

        <p style="font-size:14px; color:#334155; margin:0 0 16px 0;">
          LiteraturAI'ye hoş geldiniz! Hesabınız başarıyla oluşturuldu. Artık dünyanın en kapsamlı akademik veri kaynaklarında yapay zekâ ve AHP karar matrisi ile tarama yapabilirsiniz.
        </p>

        <p style="font-size:14px; color:#334155; margin:0 0 24px 0;">
          Scopus, OpenAlex, Crossref ve arXiv gibi 7 global veri tabanındaki 300 milyondan fazla akademik yayına anında erişebilir, Q1/Q2 dergi prestij sıralamaları ve konsensüs analizleriyle literatür taramalarınızı dakikalar içinde tamamlayabilirsiniz.
        </p>

        <!-- CTA Button -->
        <div style="margin:28px 0;">
          <a href="${appUrl}" style="display:inline-block; background:#4f46e5; color:#ffffff !important; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:600; font-size:14px;" target="_blank" rel="noopener noreferrer">
            LiteraturAI'ye Giriş Yap →
          </a>
        </div>

        <p style="font-size:13px; color:#64748b; margin:28px 0 0 0; padding-top:20px; border-top:1px solid #f1f5f9;">
          Bir sorunuz veya geri bildiriminiz olursa doğrudan bu e-postayı yanıtlayarak bize ulaşabilirsiniz.<br><br>
          İyi çalışmalar dileriz,<br>
          <strong>LiteraturAI Ekibi</strong>
        </p>

      </div>
    </body>
    </html>
  `;

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [email],
    replyTo: 'info@literatur-ai.com',
    subject: subjectLine,
    html,
    text: textVersion,
    headers: {
      'X-Entity-Ref-ID': `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    },
  });

  if (error) {
    logger.error({ error, email }, '[EmailService] Kullanıcı karşılama e-postası hatası');
    throw new Error(error.message);
  }

  logger.info({ email }, '[EmailService] Kullanıcı hoş geldin e-postası başarıyla gönderildi.');
  return data;
}

