# ORBITE 🪐

Un seul geste : lâche au bon moment. Enchaîne les planètes, frôle-les pour des
bonus, repars avant un tour complet pour un ÉCLAIR.

**Jeu web mobile-first** : jouable instantanément sur téléphone via un simple
lien, et installable sur l'écran d'accueil (PWA).

## Jouer en ligne (GitHub Pages, gratuit)

Une version statique sans build est dans `docs/` (React + Tailwind via CDN).
Activer Pages : **Settings → Pages → Source « Deploy from a branch » →
branche `main`, dossier `/docs` → Save**.
Le jeu est alors sur `https://loul18.github.io/orbite/`.

## Lancer en local (version build)

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173

## Publier sur Vercel (gratuit, recommandé pour la prod)

1. Aller sur vercel.com → « Add New Project » → importer ce dépôt.
2. Vercel détecte Vite tout seul → Deploy.
3. Le jeu est en ligne sur `orbite.vercel.app` (à partager !).

## Contrôles

- Taper n'importe où sur le terrain (tactile / souris) ou **Espace** pour se
  lancer hors d'orbite.

## PWA

La version build inclut `manifest.webmanifest`, `sw.js` (cache hors ligne)
et des icônes : sur Android, le navigateur propose « Ajouter à l'écran
d'accueil », et le jeu s'ouvre en plein écran comme une application native.

## Structure

- `docs/index.html` — version jouable sans build (Pages)
- `src/App.tsx` — tout le jeu (logique, rendu canvas, sons, UI)
- `public/` — manifest PWA, service worker
- `make-icons.mjs` — génère les icônes à la construction
