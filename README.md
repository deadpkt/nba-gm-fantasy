# FULL COURT

A multiplayer basketball general-manager experience built with React, Vite, and Firebase.

FULL COURT supports authenticated dynasty leagues, synchronized drafts, roster and contract management, official scheduled games, standings, playoffs, offseason progression, notifications, and trusted player-catalog administration.

## Technology

- React and Vite frontend
- Firebase Authentication and Firestore
- Trusted Firebase Cloud Functions
- Vercel frontend deployment

## Project structure

- `src/` — frontend routes, UI features, contexts, and client repositories.
- `functions/` — trusted Firebase backend, provider adapters, and shared domain logic.
- `scripts/` — local admin, data, ratings, simulation, and maintenance tooling.
- `docs/` — architecture, data, and ratings documentation.
- `test/` — Firestore security and integration-oriented tests.
- `local-data/` — ignored generated inputs, previews, archives, and provider caches.

See [Repository layout](docs/architecture/repository-layout.md) for ownership rules and placement guidance.

## Development

```bash
npm install
npm run dev
```

Validation:

```bash
npm run lint
npm run build
npm run test:routes
npm --prefix functions test
```
