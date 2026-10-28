# ORBITE 🪐

Un seul geste : lâche au bon moment. Enchaîne les planètes, frôle-les pour des
bonus, repars avant un tour complet pour un ÉCLAIR.

**Jeu web mobile-first** : jouable instantanément sur téléphone via un simple
lien, et installable sur l'écran d'accueil (PWA).

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173

## Publier sur Vercel (gratuit, recommandé)

1. Aller sur vercel.com → « Add New Project » → importer ce dépôt.
2. Vercel détecte Vite tout seul → Deploy.
3. Le jeu est en ligne sur `orbite.vercel.app` (à partager !).

## Contrôles

- Taper n'importe où sur le terrain (tactile / souris) ou **Espace** pour se
  lancer hors d'orbite.

## PWA

Le jeu inclut `manifest.webmanifest`, `sw.js` (cache hors ligne) et des
icônes : sur Android, le navigateur propose « Ajouter à l'écran d'accueil »,
et le jeu s'ouvre alors en plein écran comme une application native.

## Structure

- `src/App.tsx` — tout le jeu (logique, rendu canvas, sons, UI)
- `public/` — manifest PWA, service worker
- `make-icons.mjs` — génère les icônes à la construction
