
import React, { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────
// ORBITE v2 — environnement enrichi : nébuleuses, parallaxe,
// anneaux planétaires, lunes, visée tangente, sons, combos.
// ─────────────────────────────────────────────────────────────

const W = 400;
const H = 640;
const CAPTURE_PAD = 18;
const ORBIT_PAD = 16;
const AHEAD = 4;

type Moon = { dist: number; speed: number; angle: number; r: number };
type Planet = {
  x: number;
  y: number;
  r: number;
  hue: string;
  ring: boolean;
  ringTilt: number;
  moons: Moon[];
  craters: { a: number; d: number; s: number }[];
};
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
};
type Popup = { x: number; y: number; text: string; life: number; color: string };
type Pickup = { x: number; y: number; kind: "star" | "shield"; t: number };
type Star = { x: number; y: number; s: number; layer: number; tw: number };
type Nebula = { x: number; y: number; r: number; color: string; drift: number };
type Phase = "menu" | "play" | "over";

const HUES = ["#f59e0b", "#38bdf8", "#a78bfa", "#34d399", "#fb7185", "#facc15"];

// Secteurs : l'ambiance change au fil de la progression
const SECTORS = [
  { name: "CEINTURE CENDRE", tint: "rgba(99,102,241,0.10)" },
  { name: "NUÉE CORAIL", tint: "rgba(236,72,153,0.12)" },
  { name: "MER TURQUOISE", tint: "rgba(45,212,191,0.12)" },
  { name: "CŒUR AMBRE", tint: "rgba(245,158,11,0.13)" },
  { name: "ABYSSE ÉMERAUDE", tint: "rgba(52,211,153,0.13)" },
  { name: "AU-DELÀ", tint: "rgba(167,139,250,0.15)" },
];

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function makePlanet(prev: Planet): Planet {
  const dy = rand(170, 300);
  const dx = rand(-170, 170);
  const p: Planet = {
    x: Math.max(70, Math.min(W - 70, prev.x + dx)),
    y: prev.y - dy,
    r: rand(15, 32),
    hue: HUES[Math.floor(Math.random() * HUES.length)],
    ring: Math.random() < 0.35,
    ringTilt: rand(-0.4, 0.4),
    moons: [],
    craters: [],
  };
  const nMoons = Math.random() < 0.45 ? (Math.random() < 0.7 ? 1 : 2) : 0;
  for (let i = 0; i < nMoons; i++) {
    p.moons.push({
      dist: p.r + rand(8, 16),
      speed: rand(0.4, 1.1) * (Math.random() < 0.5 ? 1 : -1),
      angle: rand(0, Math.PI * 2),
      r: rand(2, 4),
    });
  }
  const nCraters = Math.floor(rand(2, 5));
  for (let i = 0; i < nCraters; i++) {
    p.craters.push({ a: rand(0, Math.PI * 2), d: rand(0.2, 0.75), s: rand(2, 5) });
  }
  return p;
}

function makeStars(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < 110; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      s: rand(0.4, 1.6),
      layer: Math.floor(rand(0, 3)),
      tw: rand(0, Math.PI * 2),
    });
  }
  return stars;
}

function hexToRgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const gg = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${gg},${b},${a})`;
}

function makeNebulas(): Nebula[] {
  return [
    { x: W * 0.2, y: H * 0.25, r: 170, color: "rgba(99,102,241,0.10)", drift: 0.4 },
    { x: W * 0.85, y: H * 0.55, r: 200, color: "rgba(236,72,153,0.07)", drift: 0.7 },
    { x: W * 0.5, y: H * 0.9, r: 180, color: "rgba(45,212,191,0.07)", drift: 1.0 },
    { x: W * 0.75, y: H * 0.1, r: 150, color: "rgba(56,189,248,0.08)", drift: 1.3 },
  ];
}

// petit moteur audio synthétisé, silencieux si indisponible
function makeAudio() {
  let ctx: AudioContext | null = null;
  const ensure = () => {
    if (!ctx) {
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        ctx = new AC();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  };
  const beep = (
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slide = 0
  ) => {
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const gn = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + dur);
    gn.gain.setValueAtTime(vol, c.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(gn);
    gn.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  };
  return {
    // à appeler dans un vrai geste utilisateur pour débloquer l'audio
    warmup: () => {
      const c = ensure();
      if (!c) return;
      // note silencieuse pour confirmer le déblocage
      const o = c.createOscillator();
      const gn = c.createGain();
      gn.gain.value = 0.0001;
      o.connect(gn);
      gn.connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.01);
    },
    launch: () => beep(180, 0.18, "sawtooth", 0.09, 120),
    capture: (perfect: boolean) => {
      beep(perfect ? 660 : 440, 0.12, "triangle", 0.14);
      window.setTimeout(() => beep(perfect ? 880 : 550, 0.14, "triangle", 0.12), 90);
    },
    death: () => {
      // glissando descendant doux, sans agressivité
      beep(330, 0.5, "sine", 0.16, -200);
      window.setTimeout(() => beep(110, 0.55, "triangle", 0.18, -40), 130);
    },
  };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<Phase>("menu");
  const [hud, setHud] = useState({ score: 0, best: 0, combo: 0 });
  const [ad, setAd] = useState(0); // compte à rebours de la fausse pub (prototype)

  useEffect(() => {
    if (ad <= 0) return;
    const t = window.setInterval(() => {
      setAd((a) => {
        if (a <= 1) {
          start(true);
          return 0;
        }
        return a - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad > 0]);

  const g = useRef({
    phase: "menu" as Phase,
    running: false,
    planets: [] as Planet[],
    cur: 0,
    orbitR: 40,
    angle: 0,
    dir: 1,
    flying: false,
    fx: 0,
    fy: 0,
    vx: 0,
    vy: 0,
    flyDist: 0,
    score: 0,
    best: 0,
    combo: 0,
    maxCombo: 0,
    perfectT: 0,
    shakeT: 0,
    px: 0,
    py: 0,
    pos: false,
    time: 0,
    heading: 0,
    shield: 0,
    sector: 0,
    bannerT: 0,
    banner: "",
    captures: 0,
    pickups: [] as Pickup[],
    tScale: 1,
    dying: false,
    over: false,
    deathX: 0,
    deathY: 0,
    hitstop: 0,
    fr: false,
    pulse: 0,
    revAcc: 0,
    launchLaps: 99,
    exT: 0,
    camRemX: 0,
    camRemY: 0,
    trail: [] as { x: number; y: number }[],
    particles: [] as Particle[],
    popups: [] as Popup[],
    stars: makeStars(),
    nebulas: makeNebulas(),
    shooting: null as { x: number; y: number; vx: number; vy: number; life: number } | null,
    shootT: 2,
    audio: makeAudio(),
  });

  useEffect(() => {
    try {
      const b = window.localStorage.getItem("orbite-best");
      if (b) {
        g.current.best = parseInt(b, 10) || 0;
        setHud((h) => ({ ...h, best: g.current.best }));
      }
    } catch {
      /* localStorage indisponible */
    }
  }, []);

  useEffect(() => {
    g.current.phase = phase;
    if (phase === "play") g.current.running = true;
  }, [phase]);

  const start = (withShield = false) => {
    const s = g.current;
    s.audio.warmup();
    const first: Planet = {
      x: W / 2,
      y: H * 0.75,
      r: 24,
      hue: "#38bdf8",
      ring: false,
      ringTilt: 0,
      moons: [],
      craters: [],
    };
    s.planets = [first];
    for (let i = 0; i < AHEAD; i++) {
      s.planets.push(makePlanet(s.planets[s.planets.length - 1]));
    }
    s.cur = 0;
    s.orbitR = first.r + ORBIT_PAD;
    s.angle = Math.PI / 2;
    s.dir = 1;
    s.flying = false;
    s.dying = false;
    s.over = false;
    // reprise après pub : on garde le score en cours
    if (!withShield) s.score = 0;
    s.combo = 0;
    s.maxCombo = 0;
    s.perfectT = 0;
    s.shakeT = 0;
    s.pos = false;
    s.trail = [];
    s.particles = [];
    s.popups = [];
    s.pickups = [];
    s.heading = 0;
    s.shield = withShield ? 1 : 0;
    s.sector = 0;
    s.captures = 0;
    s.bannerT = 0;
    s.banner = "";
    s.tScale = 1;
    s.dying = false;
    s.over = false;
    s.hitstop = 0;
    s.fr = false;
    s.pulse = 0;
    s.revAcc = 0;
    s.launchLaps = 99;
    s.camRemX = 0;
    s.camRemY = 0;
    applySector(0);
    setHud((h) => ({ ...h, score: withShield ? s.score : 0, combo: 0 }));
    setPhase("play");
  };

  const applySector = (idx: number) => {
    const s = g.current;
    const sec = SECTORS[idx % SECTORS.length];
    s.nebulas = s.nebulas.map((n, i) => ({
      ...n,
      color: i % 2 === 0 ? sec.tint : n.color,
    }));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let last = performance.now();

    const burst = (x: number, y: number, color: string, n = 16, size = 2.2) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 4;
        g.current.particles.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 1,
          color,
          size,
        });
      }
    };

    const startDeath = (x: number, y: number) => {
      const s = g.current;
      if (s.dying) return;
      s.dying = true;
      s.over = false;
      s.deathX = x;
      s.deathY = y;
      s.audio.death();
      s.shakeT = 14;
      burst(x, y, "#f87171", 12, 2.2);
    };

    const gameOver = (x: number, y: number) => {
      const s = g.current;
      s.running = false;
      s.flying = false;
      burst(x, y, "#f87171", 34, 2.6);
      s.shakeT = 16;
      s.audio.death();
      const final = s.score;
      if (final > s.best) {
        s.best = final;
        try {
          window.localStorage.setItem("orbite-best", String(final));
        } catch {
          /* ignore */
        }
      }
      setHud((h) => ({ ...h, score: final, best: s.best, combo: 0 }));
      window.setTimeout(() => setPhase("over"), 600);
    };

    const capture = (idx: number, x: number, y: number) => {
      const s = g.current;
      const p = s.planets[idx];
      const dx = x - p.x;
      const dy = y - p.y;
      const dist = Math.hypot(dx, dy);
      const perfect = dist <= p.r + 8;
      const gain = perfect ? 2 : 1;
      s.score += gain;
      if (perfect) {
        s.combo++;
        s.maxCombo = Math.max(s.maxCombo, s.combo);
        s.perfectT = 1.4;
      } else {
        s.combo = 0;
      }
      s.popups.push({
        x: p.x,
        y: p.y - p.r - 24,
        text: perfect ? `+${gain} PARFAIT` : `+${gain}`,
        life: 1.2,
        color: perfect ? "#fbbf24" : "#e2e8f0",
      });

      // bonus de rapidité : parti avant 1 tour complet (ou 2) d'orbite
      const laps = s.launchLaps;
      if (laps <= 1.08) {
        s.score += 2;
        s.popups.push({
          x: p.x,
          y: p.y - p.r - 40,
          text: "ÉCLAIR +2",
          life: 1.3,
          color: "#22d3ee",
        });
        burst(p.x, p.y, "#22d3ee", 10, 2);
      } else if (laps <= 2.08) {
        s.score += 1;
        s.popups.push({
          x: p.x,
          y: p.y - p.r - 40,
          text: "VIF +1",
          life: 1.2,
          color: "#38bdf8",
        });
      }
      s.revAcc = 0;
      burst(x, y, p.hue, perfect ? 24 : 12, perfect ? 2.6 : 2.2);
      s.audio.capture(perfect);
      const cross = dx * s.vy - dy * s.vx;
      s.dir = cross > 0 ? 1 : -1;
      s.cur = idx;
      s.orbitR = p.r + ORBIT_PAD;
      s.angle = Math.atan2(dy, dx);
      s.flying = false;

      // recentrage fluide : le monde glisse au lieu de sauter
      s.camRemY += H * 0.75 - p.y;
      s.camRemX += Math.max(-60, Math.min(60, W / 2 - p.x));

      // bonus de frôlement : tu es passé ras d'une autre planète
      if (s.fr) {
        s.score += 1;
        s.popups.push({
          x: s.px,
          y: s.py - 18,
          text: "FRÔLÉ +1",
          life: 1.1,
          color: "#f472b6",
        });
        s.fr = false;
      }
      // arrêt sur image sur capture parfaite (le punch du jeu)
      if (perfect) s.hitstop = 0.07;
      s.pulse = 1;

      // petites récompenses entre les planètes : ça casse la routine
      s.captures++;
      const prev = s.planets[s.cur - 1] ?? s.planets[s.cur + 1];
      if (prev && Math.random() < 0.4) {
        const mx = (prev.x + p.x) / 2 + rand(-36, 36);
        const my = (prev.y + p.y) / 2 + rand(-36, 36);
        const kind: "star" | "shield" =
          s.captures % 12 === 0 && s.shield === 0 ? "shield" : "star";
        s.pickups.push({ x: mx, y: my, kind, t: rand(0, Math.PI * 2) });
      }

      // changement de secteur tous les 8 enchaînements
      if (s.captures % 8 === 0) {
        s.sector++;
        applySector(s.sector);
        s.banner = SECTORS[s.sector % SECTORS.length].name;
        s.bannerT = 2.2;
      }

      while (s.planets.length - s.cur <= AHEAD) {
        s.planets.push(makePlanet(s.planets[s.planets.length - 1]));
      }
      const drop = Math.max(0, s.cur - 2);
      s.planets = s.planets.slice(drop);
      s.cur -= drop;
    };

    const launch = () => {
      const s = g.current;
      if (!s.running || s.flying || s.dying) return;
      s.fr = false;
      const p = s.planets[s.cur];
      const a = s.angle;
      const tx = -Math.sin(a) * s.dir;
      const ty = Math.cos(a) * s.dir;
      s.vx = tx * 5.6;
      s.vy = ty * 5.6;
      s.fx = p.x + Math.cos(a) * s.orbitR;
      s.fy = p.y + Math.sin(a) * s.orbitR;
      s.flying = true;
      s.flyDist = 0;
      s.launchLaps = s.revAcc / (Math.PI * 2);
      s.trail = [];
      s.audio.launch();
    };

    const update = (dt: number) => {
      const s = g.current;
      s.time += dt;

      // arrêt sur image : gel court, puis tout reprend
      if (s.hitstop > 0) {
        s.hitstop -= dt;
        return;
      }

      // mort en slow-motion
      if (s.dying) {
        s.tScale = Math.max(0, s.tScale - dt * 1.7);
        if (s.tScale <= 0.02 && !s.over) {
          s.over = true;
          s.running = false;
          gameOver(s.deathX, s.deathY);
        }
      }
      const gdt = dt * s.tScale;

      if (s.pulse > 0) s.pulse -= dt * 2.5;
      if (s.perfectT > 0) s.perfectT -= dt;
      if (s.shakeT > 0) s.shakeT--;

      // décor : dérive des nébuleuses et étoiles
      for (const n of s.nebulas) {
        n.y += 4 * dt * n.drift;
        if (n.y - n.r > H) n.y = -n.r;
      }
      for (const st of s.stars) {
        st.y += (3 + st.layer * 5) * dt;
        st.tw += dt * 2;
        if (st.y > H) {
          st.y = -2;
          st.x = Math.random() * W;
        }
      }
      // étoile filante de temps en temps
      s.shootT -= dt;
      if (s.shootT <= 0 && !s.shooting) {
        s.shooting = {
          x: rand(40, W - 40),
          y: -10,
          vx: rand(-60, 60),
          vy: rand(180, 260),
          life: 1,
        };
        s.shootT = rand(4, 10);
      }
      if (s.shooting) {
        const sh = s.shooting;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        sh.life -= dt * 0.5;
        if (sh.y > H || sh.life <= 0) s.shooting = null;
      }

      // particules & pop-ups (en vitesse réelle une fois la partie finie)
      const pdt = s.running ? gdt : dt;
      s.particles = s.particles.filter((p) => {
        p.x += p.vx * pdt * 60;
        p.y += p.vy * pdt * 60;
        p.vy += 0.08 * pdt * 60;
        p.life -= pdt * 1.8;
        return p.life > 0;
      });
      s.popups = s.popups.filter((p) => {
        p.y -= 26 * dt;
        p.life -= dt;
        return p.life > 0;
      });

      if (!s.running) return;

      // caméra fluide : le monde glisse doucement après une capture
      if (Math.abs(s.camRemY) > 0.4 || Math.abs(s.camRemX) > 0.4) {
        const k = Math.min(1, 5.5 * dt);
        const mx = s.camRemX * k;
        const my = s.camRemY * k;
        s.camRemX -= mx;
        s.camRemY -= my;
        const shiftXY = (o: { x: number; y: number }) => {
          o.x += mx;
          o.y += my;
        };
        s.planets.forEach(shiftXY);
        s.pickups.forEach(shiftXY);
        s.popups.forEach(shiftXY);
        s.particles.forEach(shiftXY);
        s.trail.forEach(shiftXY);
        s.fx += mx;
        s.fy += my;
        s.px += mx;
        s.py += my;
        // parallaxe : le décor bouge aussi, mais moins vite
        s.stars.forEach((st) => {
          st.y += my * (0.15 + st.layer * 0.14);
        });
        s.nebulas.forEach((n) => {
          n.y += my * 0.06;
          n.x += mx * 0.06;
        });
        s.pickups = s.pickups.filter((p2) => p2.y > -120 && p2.y < H + 120);
      }

      // lunes en rotation
      for (const p of s.planets) {
        for (const m of p.moons) m.angle += m.speed * gdt;
      }

      if (s.bannerT > 0) s.bannerT -= dt;
      for (const p of s.pickups) p.t += dt * 3;

      if (!s.flying) {
        const p = s.planets[s.cur];
        const omega = Math.min(5.2, 2.3 + s.score * 0.11);
        s.angle += omega * s.dir * gdt;
        s.revAcc += omega * gdt;
        if (s.score >= 3) s.orbitR -= (0.35 + s.score * 0.04) * gdt * 60 * 0.06;
        const x = p.x + Math.cos(s.angle) * s.orbitR;
        const y = p.y + Math.sin(s.angle) * s.orbitR;
        if (s.orbitR <= p.r + 2) {
          if (s.shield > 0) {
            // le bouclier te repose en orbite
            s.shield--;
            s.orbitR = p.r + ORBIT_PAD + 8;
            burst(x, y, "#22d3ee", 20, 2.6);
            s.shakeT = 10;
            s.audio.capture(false);
            s.popups.push({
              x: p.x,
              y: p.y - p.r - 24,
              text: "BOUCLIER !",
              life: 1.2,
              color: "#22d3ee",
            });
          } else {
            startDeath(x, y);
            return;
          }
        }
        // cap de la fusée : tangente à l'orbite
        const tx = -Math.sin(s.angle) * s.dir;
        const ty = Math.cos(s.angle) * s.dir;
        const target = Math.atan2(ty, tx);
        let diff = target - s.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        s.heading += diff * Math.min(1, 12 * gdt);
        s.trail.unshift({ x, y });
        if (s.trail.length > 18) s.trail.pop();
        s.px = x;
        s.py = y;
        s.pos = true;
      } else {
        s.fx += s.vx * gdt * 60;
        s.fy += s.vy * gdt * 60;
        s.flyDist += Math.hypot(s.vx, s.vy) * gdt * 60;
        s.trail.unshift({ x: s.fx, y: s.fy });
        if (s.trail.length > 18) s.trail.pop();
        s.px = s.fx;
        s.py = s.fy;
        s.pos = true;
        s.heading = Math.atan2(s.vy, s.vx);
        // fumée de propulsion
        s.exT += gdt;
        if (s.exT > 0.02) {
          s.exT = 0;
          s.particles.push({
            x: s.fx - Math.cos(s.heading) * 9,
            y: s.fy - Math.sin(s.heading) * 9,
            vx: -Math.cos(s.heading) * 0.8 + rand(-0.3, 0.3),
            vy: -Math.sin(s.heading) * 0.8 + rand(-0.3, 0.3),
            life: 0.5,
            color: "rgba(148,163,184,0.55)",
            size: 1.6,
          });
        }
        // ramassage en plein vol
        s.pickups = s.pickups.filter((pk) => {
          const d = Math.hypot(s.fx - pk.x, s.fy - pk.y);
          if (d < 14) {
            if (pk.kind === "star") {
              s.score += 1;
              s.popups.push({
                x: pk.x,
                y: pk.y - 14,
                text: "+1",
                life: 1,
                color: "#fbbf24",
              });
              burst(pk.x, pk.y, "#fbbf24", 10, 2);
              s.audio.capture(false);
            } else {
              s.shield++;
              s.popups.push({
                x: pk.x,
                y: pk.y - 14,
                text: "BOUCLIER",
                life: 1.4,
                color: "#22d3ee",
              });
              burst(pk.x, pk.y, "#22d3ee", 16, 2.4);
              s.audio.capture(true);
            }
            return false;
          }
          return true;
        });
        for (let i = 0; i < s.planets.length; i++) {
          if (i === s.cur) continue;
          const p = s.planets[i];
          const d = Math.hypot(s.fx - p.x, s.fy - p.y);
          if (d <= p.r + CAPTURE_PAD) {
            capture(i, s.fx, s.fy);
            return;
          }
          // frôlement : passer tout près d'une planète sans se capturer
          if (d < p.r + CAPTURE_PAD + 9) s.fr = true;
        }
        if (
          s.flyDist > 560 ||
          s.fy < -40 ||
          s.fy > H + 40 ||
          s.fx < -40 ||
          s.fx > W + 40
        ) {
          startDeath(s.fx, s.fy);
          return;
        }
      }
    };

    const drawPlanet = (p: Planet, isCur: boolean) => {
      const s = g.current;
      // halo atmosphérique
      ctx.save();
      ctx.shadowColor = p.hue;
      ctx.shadowBlur = isCur ? 30 : 14;
      const grad = ctx.createRadialGradient(
        p.x - p.r * 0.35,
        p.y - p.r * 0.35,
        p.r * 0.1,
        p.x,
        p.y,
        p.r
      );
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.35, p.hue);
      grad.addColorStop(1, "#0c0a20");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // bandes atmosphériques subtiles (clip cercle)
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#000";
      for (let b = 1; b <= 2; b++) {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + (b - 1.5) * p.r * 0.6, p.r * 1.3, p.r * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // nuit : croissant d'ombre côté opposé au soleil
      const night = ctx.createRadialGradient(
        p.x - p.r * 0.5,
        p.y - p.r * 0.5,
        p.r * 0.2,
        p.x,
        p.y,
        p.r * 1.4
      );
      night.addColorStop(0, "rgba(0,0,0,0)");
      night.addColorStop(0.55, "rgba(0,0,0,0)");
      night.addColorStop(1, "rgba(2,4,15,0.65)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = night;
      ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      ctx.restore();

      // liseré atmosphérique
      ctx.strokeStyle = hexToRgba(p.hue, 0.55);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 1, 0, Math.PI * 2);
      ctx.stroke();

      // cratères
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      for (const c of p.craters) {
        ctx.beginPath();
        ctx.arc(
          p.x + Math.cos(c.a) * p.r * c.d,
          p.y + Math.sin(c.a) * p.r * c.d,
          c.s,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // lune(s) — orbite légèrement aplatie (effet de profondeur)
      for (const m of p.moons) {
        ctx.fillStyle = "rgba(226,232,240,0.85)";
        ctx.beginPath();
        ctx.arc(
          p.x + Math.cos(m.angle) * (p.r + m.dist),
          p.y + Math.sin(m.angle) * (p.r + m.dist) * 0.6,
          m.r,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // anneau
      if (p.ring) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.ringTilt);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 1.75, p.r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      void s;
    };

    const draw = () => {
      const s = g.current;
      ctx.save();
      if (s.shakeT > 0) {
        ctx.translate(
          (Math.random() - 0.5) * s.shakeT * 0.7,
          (Math.random() - 0.5) * s.shakeT * 0.7
        );
      }

      // fond : dégradé + nébuleuses
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#05070f");
      bg.addColorStop(1, "#0b0f2a");
      ctx.fillStyle = bg;
      ctx.fillRect(-20, -20, W + 40, H + 40);

      // soleil lointain avec corone palpitante
      const sx0 = W * 0.16;
      const sy0 = H * 0.1;
      const cor = 60 + Math.sin(s.time * 1.4) * 6;
      const sun = ctx.createRadialGradient(sx0, sy0, 0, sx0, sy0, cor);
      sun.addColorStop(0, "rgba(253,224,71,0.55)");
      sun.addColorStop(0.25, "rgba(251,146,60,0.25)");
      sun.addColorStop(1, "rgba(251,146,60,0)");
      ctx.fillStyle = sun;
      ctx.fillRect(sx0 - cor, sy0 - cor, cor * 2, cor * 2);

      // rubans d'aurore
      ctx.lineWidth = 10;
      for (let band = 0; band < 2; band++) {
        ctx.strokeStyle =
          band === 0 ? "rgba(94,234,212,0.05)" : "rgba(167,139,250,0.05)";
        ctx.beginPath();
        for (let x = -10; x <= W + 10; x += 12) {
          const y =
            H * 0.42 +
            band * 46 +
            Math.sin(x * 0.02 + s.time * 0.5 + band * 2) * 16 +
            Math.sin(x * 0.007 - s.time * 0.3) * 10;
          if (x === -10) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      for (const n of s.nebulas) {
        const nb = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        nb.addColorStop(0, n.color);
        nb.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = nb;
        ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
      }

      // onde de pulse à la capture
      if (s.pulse > 0 && s.planets[s.cur]) {
        const p = s.planets[s.cur];
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 170);
        glow.addColorStop(0, `rgba(255,255,255,${0.10 * s.pulse})`);
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(p.x - 170, p.y - 170, 340, 340);
      }

      // étoiles (3 profondeurs, scintillement)
      for (const st of s.stars) {
        const a = 0.3 + st.layer * 0.25 + Math.sin(st.tw) * 0.18;
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0.08, a)})`;
        const sz = st.s * (0.7 + st.layer * 0.5);
        ctx.fillRect(st.x, st.y, sz, sz);
      }

      // étoile filante
      if (s.shooting) {
        const sh = s.shooting;
        ctx.strokeStyle = `rgba(255,255,255,${0.6 * Math.max(0, sh.life)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x - sh.vx * 0.08, sh.y - sh.vy * 0.08);
        ctx.stroke();
      }

      // zone de capture de la prochaine planète (animée)
      const next = s.planets[s.cur + 1];
      if (next && s.running) {
        ctx.save();
        ctx.strokeStyle = hexToRgba(next.hue, 0.35);
        ctx.setLineDash([4, 8]);
        ctx.lineDashOffset = -s.time * 30;
        ctx.beginPath();
        ctx.arc(next.x, next.y, next.r + CAPTURE_PAD, 0, Math.PI * 2);
        ctx.stroke();
        // halo respirant autour de la cible
        const breathe = 0.12 + 0.08 * Math.sin(s.time * 3);
        ctx.setLineDash([]);
        ctx.strokeStyle = hexToRgba(next.hue, breathe);
        ctx.beginPath();
        ctx.arc(next.x, next.y, next.r + CAPTURE_PAD + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // planètes
      for (let i = 0; i < s.planets.length; i++) {
        drawPlanet(s.planets[i], i === s.cur);
      }

      // orbite courante + visée tangente
      const curP = s.planets[s.cur];
      if (curP && s.running && !s.flying) {
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(curP.x, curP.y, s.orbitR, 0, Math.PI * 2);
        ctx.stroke();

        // ligne de visée : là où tu iras si tu tapes maintenant
        const a = s.angle;
        const sx = curP.x + Math.cos(a) * s.orbitR;
        const sy = curP.y + Math.sin(a) * s.orbitR;
        const dxv = -Math.sin(a) * s.dir;
        const dyv = Math.cos(a) * s.dir;
        const pulse = 0.25 + 0.2 * Math.sin(s.time * 6);
        ctx.strokeStyle = `rgba(224,242,254,${pulse})`;
        ctx.setLineDash([5, 7]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + dxv * 85, sy + dyv * 85);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // trainée : comète qui dégrade du cyan vers le rose
      for (let i = s.trail.length - 1; i >= 0; i--) {
        const t = s.trail[i];
        const f = i / s.trail.length;
        ctx.globalAlpha = (1 - f) * 0.45;
        ctx.fillStyle = `hsl(${200 - f * 90}, 90%, ${72 + f * 8}%)`;
        ctx.shadowColor = "rgba(125,211,252,0.8)";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 4.5 * (1 - i / (s.trail.length * 1.5)), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // bonus flottants
      for (const pk of s.pickups) {
        const bob = Math.sin(pk.t) * 3;
        if (pk.kind === "star") {
          ctx.save();
          ctx.translate(pk.x, pk.y + bob);
          ctx.rotate(pk.t * 0.5);
          ctx.shadowColor = "#fbbf24";
          ctx.shadowBlur = 10;
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            if (i === 0) ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7);
            else ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          ctx.save();
          ctx.translate(pk.x, pk.y + bob);
          ctx.shadowColor = "#22d3ee";
          ctx.shadowBlur = 14;
          ctx.strokeStyle = "#22d3ee";
          ctx.lineWidth = 2.5;
          ctx.fillStyle = "rgba(34,211,238,0.25)";
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
            const x = Math.cos(a) * 9;
            const y = Math.sin(a) * 9;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // lignes de vitesse en plein vol
      if (s.running && s.flying) {
        ctx.strokeStyle = "rgba(224,242,254,0.22)";
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 6; i++) {
          const off = (Math.random() - 0.5) * 48;
          const ox = Math.cos(s.heading + Math.PI / 2) * off;
          const oy = Math.sin(s.heading + Math.PI / 2) * off;
          const bx = s.px + ox - Math.cos(s.heading) * (22 + Math.random() * 34);
          const by = s.py + oy - Math.sin(s.heading) * (22 + Math.random() * 34);
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx - Math.cos(s.heading) * 15, by - Math.sin(s.heading) * 15);
          ctx.stroke();
        }
      }

      // la fusée
      if (s.pos) {
        ctx.save();
        ctx.translate(s.px, s.py);
        ctx.rotate(s.heading);
        // flamme de propulsion (forte en vol, veilleuse en orbite)
        const thrust = s.flying && s.running ? 1 : 0.35;
        const flick = 0.8 + Math.sin(s.time * 40) * 0.2;
        ctx.save();
        ctx.scale(1, flick);
        const flame = ctx.createLinearGradient(-8, 0, -8 - 16 * thrust, 0);
        flame.addColorStop(0, "rgba(251,191,36,0.95)");
        flame.addColorStop(0.5, "rgba(249,115,22,0.7)");
        flame.addColorStop(1, "rgba(239,68,68,0)");
        ctx.fillStyle = flame;
        ctx.beginPath();
        ctx.moveTo(-7, 3.2);
        ctx.lineTo(-8 - 16 * thrust, 0);
        ctx.lineTo(-7, -3.2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // ailerons
        ctx.fillStyle = "#f43f5e";
        ctx.beginPath();
        ctx.moveTo(-3, 3.5);
        ctx.lineTo(-8, 8);
        ctx.lineTo(-7, 3);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-3, -3.5);
        ctx.lineTo(-8, -8);
        ctx.lineTo(-7, -3);
        ctx.closePath();
        ctx.fill();
        // corps
        ctx.shadowColor = "#e0f2fe";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.quadraticCurveTo(4, 5.5, -7, 4);
        ctx.lineTo(-7, -4);
        ctx.quadraticCurveTo(4, -5.5, 11, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // hublot
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.arc(1, 0, 2.4, 0, Math.PI * 2);
        ctx.fill();
        // bouclier : halo cyan
        if (s.shield > 0 && s.running) {
          ctx.strokeStyle = `rgba(34,211,238,${0.5 + Math.sin(s.time * 5) * 0.2})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // particules
      for (const p of s.particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // pop-ups de score
      ctx.textAlign = "center";
      ctx.font = "bold 13px sans-serif";
      for (const p of s.popups) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.globalAlpha = 1;

      // annonce combo parfait
      if (s.perfectT > 0) {
        ctx.globalAlpha = Math.min(1, s.perfectT);
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText("PARFAIT ×" + s.combo, W / 2, 104);
        ctx.globalAlpha = 1;
      }
      // bannière de secteur
      if (s.bannerT > 0) {
        const a = Math.min(1, s.bannerT, (2.2 - s.bannerT) * 2);
        ctx.globalAlpha = a;
        ctx.fillStyle = "#94a3b8";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("— SECTEUR —", W / 2, 68);
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(s.banner, W / 2, 92);
        ctx.globalAlpha = 1;
      }
      ctx.textAlign = "start";
      ctx.font = "10px sans-serif";

      // vignette cinéma
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      ctx.restore();
    };

    let hudT = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      hudT += dt;
      if (hudT > 0.12) {
        hudT = 0;
        const s = g.current;
        setHud((h) =>
          s.score !== h.score || s.combo !== h.combo
            ? { ...h, score: s.score, combo: s.combo }
            : h
        );
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const tap = (e: Event) => {
      e.preventDefault();
      g.current.audio.warmup();
      launch();
    };
    canvas.addEventListener("pointerdown", tap);
    const key = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        launch();
      }
    };
    window.addEventListener("keydown", key);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", tap);
      window.removeEventListener("keydown", key);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1e1b4b,#020617)] px-4 py-6 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
        <div className="flex w-full items-end justify-between">
          <div>
            <h1 className="bg-gradient-to-r from-amber-300 via-sky-300 to-pink-300 bg-clip-text text-3xl font-black tracking-[0.2em] text-transparent drop-shadow-[0_0_12px_rgba(56,189,248,0.4)]">
              ORBITE
            </h1>
            <p className="text-xs text-white/50">
              Lâche au bon moment. Ne t'arrête jamais.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-xl bg-white/5 px-3 py-1.5 text-sm font-semibold text-sky-300 ring-1 ring-inset ring-sky-400/30 backdrop-blur-sm">
              {hud.score} pts
            </span>
            {hud.combo > 0 && (
              <span className="rounded-xl bg-amber-400/10 px-3 py-1.5 text-sm font-semibold text-amber-300 ring-1 ring-inset ring-amber-400/40 backdrop-blur-sm">
                combo ×{hud.combo}
              </span>
            )}
            <span className="rounded-xl bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/60 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
              🏆 {hud.best}
            </span>
          </div>
        </div>

        <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-indigo-950/40 shadow-[0_0_60px_rgba(56,189,248,0.25),inset_0_0_60px_rgba(2,6,23,0.4)] ring-1 ring-inset ring-white/5">
          <canvas
            ref={canvasRef}
            className="block w-full touch-none select-none"
            style={{ aspectRatio: `${W} / ${H}` }}
          />

          {phase !== "play" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/70 px-6 text-center backdrop-blur-sm">
              {phase === "menu" && (
                <>
                  <div className="text-5xl">🪐</div>
                  <h2 className="text-2xl font-bold">ORBITE</h2>
                  <p className="max-w-xs text-sm leading-relaxed text-white/70">
                    Tu tournes autour d'une planète.{" "}
                    <b className="text-white">Tape</b> pour te lancer en ligne
                    droite, tangentiellement. Entre dans le halo de gravité
                    d'une autre planète pour t'y orbiter.
                  </p>
                  <p className="text-xs text-white/50">
                    ⚠ Ton orbite se resserre. Vise près de la surface pour un{" "}
                    <b className="text-amber-300">PARFAIT</b> (×2, combo).
                    Pars avant 1 tour complet :{" "}
                    <b className="text-sky-300">ÉCLAIR</b> +2.
                  </p>
                  <button
                    onClick={start}
                    className="mt-2 rounded-full bg-gradient-to-r from-amber-400 to-sky-400 px-8 py-3 text-base font-bold text-slate-900 shadow-lg transition hover:scale-105 active:scale-95"
                  >
                    LANCER
                  </button>
                  {hud.best > 0 && (
                    <p className="text-xs text-white/50">
                      Record :{" "}
                      <b className="text-amber-300">{hud.best} planètes</b>
                    </p>
                  )}
                </>
              )}
              {phase === "over" && (
                <>
                  <div className="text-4xl">🌌</div>
                  <h2 className="text-2xl font-bold">Perdu dans l'espace</h2>
                  <p className="text-4xl font-black text-amber-300">
                    {hud.score}
                  </p>
                  <p className="text-sm text-white/60">
                    Record :{" "}
                    <b className="text-amber-300">{hud.best} planètes</b>
                  </p>
                  <button
                    onClick={() => setAd(3)}
                    className="mt-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-2.5 text-sm font-bold text-slate-900 shadow-lg transition hover:scale-105 active:scale-95"
                  >
                    ▶ Regarder une pub · reprendre avec 1 bouclier
                  </button>
                  <button
                    onClick={() => start(false)}
                    className="rounded-full bg-gradient-to-r from-amber-400 to-sky-400 px-8 py-3 text-base font-bold text-slate-900 shadow-lg transition hover:scale-105 active:scale-95"
                  >
                    REJOUER
                  </button>
                  <p className="max-w-xs text-[10px] leading-relaxed text-white/30">
                    Prototype : la pub est simulée (compte à rebours). Dans la
                    version publiée, l'emplacement appelle le SDK du portail
                    (vidéo récompensée).
                  </p>
                </>
              )}
              {ad > 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 text-center">
                  <p className="text-xs uppercase tracking-widest text-white/40">
                    Emplacement publicitaire — démo
                  </p>
                  <div className="text-5xl font-black text-white/80">{ad}</div>
                  <p className="text-xs text-white/40">
                    (Ici, la vidéo récompensée du SDK se joue.)
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] leading-relaxed text-white/35">
          Tape le terrain (ou Espace) pour te libérer. La ligne pointillée
          montre ta trajectoire si tu tapes maintenant.
        </p>
      </div>
    </div>
  );
}
