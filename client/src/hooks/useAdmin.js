import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Oturum sahibinin yönetici olup olmadığını sunucuya sorar.
 *
 * Karar istemcide verilmiyor: arayüz yalnızca düğmeyi gizler, asıl yetki
 * kontrolü her admin ucunda sunucuda tekrar yapılır. Bu yüzden buradaki
 * yanıtı kaybetmek bir güvenlik sorunu değil, sadece görünürlük sorunudur.
 */
export function useAdmin({ getToken, userId }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  const check = useCallback(async () => {
    if (!userId) {
      setIsAdmin(false);
      setChecked(true);
      return;
    }
    try {
      const token = await getToken();
      const res = await axios.get(`${defaultApiUrl}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsAdmin(Boolean(res.data?.isAdmin));
    } catch {
      // Yetki sorgusu başarısızsa yönetici sayma.
      setIsAdmin(false);
    } finally {
      setChecked(true);
    }
  }, [getToken, userId]);

  useEffect(() => { check(); }, [check]);

  return { isAdmin, checked };
}
