import { useCallback, useState } from 'react';
import axios from 'axios';

const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function useCollections({ getToken, userId }) {
  const [collections, setCollections] = useState([]);

  const fetchCollections = useCallback(async () => {
    if (!userId) return;
    try {
      const token = await getToken();
      const response = await axios.get(`${defaultApiUrl}/api/collections`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCollections(response.data);
    } catch (err) {
      console.error('Failed to fetch collections', err);
    }
  }, [getToken, userId]);

  const getPaperIdentity = useCallback((paper) => {
    const doi = typeof paper?.doi === 'string' ? paper.doi.trim().toLowerCase() : '';
    if (doi) return `doi:${doi}`;
    const title = typeof paper?.title === 'string' ? paper.title.trim().toLowerCase() : '';
    return `title:${title}`;
  }, []);

  const findFavoriteMatch = useCallback((paper) => {
    const favoriteCollection = collections.find((collection) => collection.name === 'Favoriler');
    if (!favoriteCollection) {
      return { favoriteCollection: null, matchedPaper: null };
    }

    const identity = getPaperIdentity(paper);
    const matchedPaper = favoriteCollection.papers?.find((savedPaper) => (
      getPaperIdentity(savedPaper) === identity
    )) || null;

    return { favoriteCollection, matchedPaper };
  }, [collections, getPaperIdentity]);

  const isPaperFavorited = useCallback((paper) => {
    const { matchedPaper } = findFavoriteMatch(paper);
    return Boolean(matchedPaper);
  }, [findFavoriteMatch]);

  const handleSaveToCollection = async (collectionId, paper) => {
    try {
      const token = await getToken();
      const response = await axios.post(`${defaultApiUrl}/api/collections/${collectionId}/add`, {
        paper: {
          title: paper.title,
          year: String(paper.year),
          authors: paper.creator || 'Bilinmeyen',
          url: paper.url,
          doi: paper.doi,
          publicationName: paper.publicationName,
          citedBy: paper.citedBy,
          description: paper.description
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      window.dispatchEvent(new CustomEvent('refreshCollections'));
      return response.data;
    } catch (err) {
      console.error('Kaydetme hatası:', err);
      throw err;
    }
  };

  const handleFavorite = async (paper) => {
    if (!userId) throw new Error('Giriş yapmanız gerekiyor');
    const token = await getToken();
    let { favoriteCollection, matchedPaper } = findFavoriteMatch(paper);

    if (!favoriteCollection) {
      const res = await axios.post(`${defaultApiUrl}/api/collections`, {
        name: 'Favoriler'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      favoriteCollection = res.data;
      setCollections((prev) => [...prev, favoriteCollection]);
    }

    if (matchedPaper?._id) {
      await axios.delete(`${defaultApiUrl}/api/collections/${favoriteCollection._id}/papers/${matchedPaper._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      window.dispatchEvent(new CustomEvent('refreshCollections'));
      return;
    }

    await handleSaveToCollection(favoriteCollection._id, paper);
  };

  return {
    collections,
    setCollections,
    fetchCollections,
    handleSaveToCollection,
    handleFavorite,
    isPaperFavorited
  };
}
