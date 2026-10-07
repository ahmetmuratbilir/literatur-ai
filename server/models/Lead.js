import mongoose from 'mongoose';

// Tanıtım sayfasındaki (/tanitim) formdan gelen iletişim talebi.
// Bir kayıt: ad(120) + e-posta(200) + rol(60) + kurum(120) ≈ 0.6KB.
//
// KVKK aydınlatma metni "en geç bir yıl içinde silinir" diyor; bu sözü elle
// takip etmek yerine createdAt üzerindeki TTL indeksi kaydı 365 gün sonra
// MongoDB'ye sildiriyor. IP ya da cihaz bilgisi bilerek tutulmuyor: metin
// yalnızca formdaki alanların işlendiğini söylüyor.
const LeadSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 120 },
  email: { type: String, required: true, maxlength: 200 },
  role: { type: String, maxlength: 60 },
  org: { type: String, maxlength: 120 },
  source: { type: String, maxlength: 40, default: 'tanitim-qr' },
  // Mail gerçekten iletildi mi: RESEND_API_KEY yokken kayıt yine tutulur,
  // hangilerinin hiç mail olarak gelmediği buradan görülür.
  emailed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 365 },
});

export default mongoose.model('Lead', LeadSchema);
