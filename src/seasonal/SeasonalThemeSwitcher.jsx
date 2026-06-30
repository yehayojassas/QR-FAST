import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CaretDown, Check } from '@phosphor-icons/react';
import { SEASON_ORDER, SEASONS } from './theme.js';
import { useSeasonalTheme } from './useSeasonalTheme.js';

export function SeasonalThemeSwitcher() {
  const { season, setSeason } = useSeasonalTheme();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const focusReturnRef = useRef(false);
  const menuId = useId();

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    focusReturnRef.current = restoreFocus;
  }, []);

  // Fermeture au clic extérieur + Échap, et restauration du focus au close.
  useEffect(() => {
    if (!open) {
      if (focusReturnRef.current && buttonRef.current) {
        focusReturnRef.current = false;
        buttonRef.current.focus();
      }
      return undefined;
    }
    const onPointerDown = (event) => {
      if (
        menuRef.current && !menuRef.current.contains(event.target) &&
        buttonRef.current && !buttonRef.current.contains(event.target)
      ) {
        close(false);
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(true);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // Focus initial sur l'élément actif à l'ouverture.
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const target = menuRef.current.querySelector('[data-active="true"]') || menuRef.current.querySelector('button');
    if (target) target.focus();
  }, [open]);

  function onMenuKey(event) {
    const items = Array.from(menuRef.current?.querySelectorAll('button') || []);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(index + 1) % items.length].focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length].focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0].focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1].focus();
    }
  }

  function pick(nextId) {
    setSeason(nextId === season ? null : nextId);
    close(true);
  }

  return (
    <div className="season-switcher">
      <button
        ref={buttonRef}
        type="button"
        className={`season-toggle${open ? ' is-open' : ''}${season ? ' has-season' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="season-toggle-label">/ V. BETA /</span>
        <CaretDown size={14} weight="bold" className="season-toggle-caret" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          className="season-menu"
          onKeyDown={onMenuKey}
        >
          {SEASON_ORDER.map((id) => {
            const { label, Icon } = SEASONS[id];
            const active = season === id;
            return (
              <button
                key={id}
                role="menuitemradio"
                aria-checked={active}
                data-active={active}
                className={`season-menu-item${active ? ' is-active' : ''}`}
                onClick={() => pick(id)}
              >
                <Icon size={18} weight="duotone" aria-hidden="true" className="season-menu-icon" />
                <span className="season-menu-label">{label}</span>
                {active && <Check size={14} weight="bold" aria-hidden="true" className="season-menu-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
