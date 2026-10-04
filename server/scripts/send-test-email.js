import 'dotenv/config';
import { sendWelcomeOnboardingEmail } from '../services/emailService.js';

const targetEmail = process.argv[2];
const targetName = process.argv[3] || 'Ahmet';

if (!targetEmail) {
  console.log('Kullanım: node scripts/send-test-email.js <alici-eposta> [isim]');
  process.exit(1);
}

console.log(`[Test] Alıcı: ${targetEmail}`);
console.log(`[Test] Gönderici (FROM): ${process.env.RESEND_FROM_EMAIL || 'LiteraturAI <onboarding@resend.dev>'}`);
console.log(`[Test] RESEND_API_KEY tanımlı mı: ${Boolean(process.env.RESEND_API_KEY)}`);

try {
  const result = await sendWelcomeOnboardingEmail({
    email: targetEmail,
    name: targetName,
  });
  console.log('✅ İşlem Başarılı! Çıktı:', result);
} catch (err) {
  console.error('❌ Hata oluştu:', err.message || err);
}
