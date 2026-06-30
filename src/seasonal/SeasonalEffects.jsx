import { useEffect, useRef } from 'react';
import { SEASONS } from './theme.js';
import { useDocumentHidden, usePrefersReducedMotion, useSeasonalTheme } from './useSeasonalTheme.js';

// Couche d'animations saisonnières peinte sur <canvas>, derrière les modales
// mais au-dessus du fond. `pointer-events: none` au niveau CSS.
export function SeasonalEffects() {
  const { season } = useSeasonalTheme();
  const canvasRef = useRef(null);
  const reduced = usePrefersReducedMotion();
  const hidden = useDocumentHidden();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const config = season ? SEASONS[season]?.particles : null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let particles = [];
    let raf = 0;
    let resizeRaf = 0;
    let last = performance.now();
    let stopped = !config || reduced || hidden;

    const isMobile = () => window.matchMedia('(max-width: 700px)').matches;
    function getCount() {
      if (!config) return 0;
      return isMobile() ? config.mobile : config.desktop;
    }

    function rand(min, max) { return min + Math.random() * (max - min); }

    function spawn(p, fromTop = false) {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      p.x = rand(-20, W + 20);
      p.y = fromTop ? rand(-40, -4) : rand(-40, H);
      p.size = rand(config.sizeRange[0], config.sizeRange[1]);
      p.opacity = rand(config.opacityRange[0], config.opacityRange[1]);
      p.drift = rand(-10, 10);
      p.driftPhase = rand(0, Math.PI * 2);
      p.driftSpeed = rand(0.3, 0.9);
      p.rotation = rand(0, Math.PI * 2);
      p.spin = rand(-0.4, 0.4);
      const duration = rand(config.durationRange[0], config.durationRange[1]);
      p.vy = (H + 80) / (duration / 1000);
      p.hue = rand(0, 1);
    }

    function ensureParticles() {
      const target = getCount();
      if (particles.length < target) {
        while (particles.length < target) {
          const p = {};
          spawn(p, particles.length === 0);
          particles.push(p);
        }
      } else if (particles.length > target) {
        particles.length = target;
      }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ensureParticles();
    }

    function drawSnow(p) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(245, 250, 255, ${p.opacity})`;
      ctx.shadowColor = 'rgba(180, 210, 255, 0.45)';
      ctx.shadowBlur = p.size * 1.6;
      ctx.arc(p.x, p.y, p.size * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function drawDust(p) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 215, 130, ${p.opacity})`;
      ctx.shadowColor = 'rgba(255, 200, 100, 0.5)';
      ctx.shadowBlur = p.size * 2;
      ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function drawPetal(p) {
      const palette = [
        [220, 169, 178],
        [232, 196, 200],
        [200, 152, 165],
      ];
      const [r, g, b] = palette[Math.floor(p.hue * palette.length) % palette.length];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.opacity})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.55, p.size * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawLeaf(p) {
      const palette = [
        [169, 87, 50],
        [200, 113, 56],
        [120, 64, 40],
        [156, 79, 34],
      ];
      const [r, g, b] = palette[Math.floor(p.hue * palette.length) % palette.length];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.opacity})`;
      ctx.beginPath();
      ctx.moveTo(0, -p.size * 0.5);
      ctx.quadraticCurveTo(p.size * 0.55, 0, 0, p.size * 0.5);
      ctx.quadraticCurveTo(-p.size * 0.55, 0, 0, -p.size * 0.5);
      ctx.fill();
      // Nervure centrale.
      ctx.strokeStyle = `rgba(60, 35, 20, ${p.opacity * 0.55})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, -p.size * 0.45);
      ctx.lineTo(0, p.size * 0.45);
      ctx.stroke();
      ctx.restore();
    }

    function draw(p) {
      switch (config.type) {
        case 'snow': return drawSnow(p);
        case 'dust': return drawDust(p);
        case 'petal': return drawPetal(p);
        case 'leaf': return drawLeaf(p);
        default: return null;
      }
    }

    function step(now) {
      raf = requestAnimationFrame(step);
      const dt = Math.min(80, now - last) / 1000; // s, plafonné
      last = now;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.driftPhase += dt * p.driftSpeed;
        p.x += Math.sin(p.driftPhase) * p.drift * dt;
        p.y += p.vy * dt;
        p.rotation += p.spin * dt;
        if (p.y - p.size > H || p.x < -60 || p.x > W + 60) {
          spawn(p, true);
        }
        draw(p);
      }
    }

    function start() {
      if (!stopped) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    const onResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(resize);
    };

    if (!config) {
      // Nettoyage du canvas si aucune saison ou animations désactivées.
      resize();
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      return undefined;
    }

    resize();
    if (reduced) {
      // En mode "réduire animations" on dessine un seul cadre statique discret.
      for (const p of particles) draw(p);
      return undefined;
    }
    if (!hidden) start();
    window.addEventListener('resize', onResize);

    return () => {
      stopped = true;
      stop();
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      window.removeEventListener('resize', onResize);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    };
  }, [season, reduced, hidden]);

  return (
    <canvas
      ref={canvasRef}
      className="seasonal-effects"
      aria-hidden="true"
    />
  );
}
