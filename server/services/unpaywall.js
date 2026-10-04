import axios from 'axios';
import { logger } from '../utils/logger.js';

/**
 * Unpaywall API - DOI üzerinden yasal açık erişim PDF linkini bulur.
 */
export async function getOpenAccessPdf(doi) {
  if (!doi || typeof doi !== 'string' || !doi.trim()) return null;
  try {
    const email = process.env.CONTACT_EMAIL || 'info@literatur-ai.com';
    const cleanDoi = encodeURIComponent(doi.trim());
    const response = await axios.get(`https://api.unpaywall.org/v2/${cleanDoi}?email=${email}`, {
      timeout: 3500
    });

    if (response.data?.is_oa && response.data?.best_oa_location) {
      const loc = response.data.best_oa_location;
      return {
        isOa: true,
        pdfUrl: loc.url_for_pdf || loc.url,
        landingPage: loc.url_for_landing_page,
        license: loc.license || 'Open Access',
        version: loc.version || 'publishedVersion'
      };
    }
    return null;
  } catch (error) {
    // Unpaywall bulunamadığında (404) ana akışı bozmaz
    return null;
  }
}
