import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react';
import { STORAGE_KEY, isValidSeason } from './theme.js';

const Ctx = createContext({ season: null, setSeason: () => {} });

function readStoredSeason() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isValidSeason(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function SeasonalThemeProvider({ children }) {
  // Le script inline dans menu.html a déjà posé data-season sur <html> avant
  // le rendu : on lit donc directement la même source pour rester aligné.
  const [season, setSeasonState] = useState(() => readStoredSeason());

  useEffect(() => {
    const root = document.documentElement;
    if (season) root.setAttribute('data-season', season);
    else root.removeAttribute('data-season');
  }, [season]);

  const setSeason = useCallback((next) => {
    if (next !== null && !isValidSeason(next)) return;
    setSeasonState(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Stockage indisponible : on garde le choix uniquement pour la session.
    }
  }, []);

  return createElement(Ctx.Provider, { value: { season, setSeason } }, children);
}

export function useSeasonalTheme() {
  return useContext(Ctx);
}

// Hook utilitaire : true si l'utilisateur a demandé de réduire les animations.
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event) => setReduced(event.matches);
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, []);
  return reduced;
}

// Hook utilitaire : true si la fenêtre est cachée (onglet inactif).
export function useDocumentHidden() {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return hidden;
}
