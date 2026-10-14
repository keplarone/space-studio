# Space Studio

Space Studio is Keplar's desktop development environment for **Roblox Studio** and **Blender**, with four AI model configurations: **Orbit 3.8**, **Nebula 4.2**, **Solar 5.4** and **Nova 5.5**. It also gives Pro and higher plans Roblox Cloud and Blender Cloud.

- Desktop app: Electron (`src/main`) and a React renderer (`src/renderer`).
- Shared logic: `src/core`, which holds the model registry, plans and entitlements, account-linking rules and routing.
- Server: keplar.one (`keplarone/keplar-live`, routes under `/api/space-studio`), which reuses `src/core`.

Read **[docs/STATUS.md](docs/STATUS.md)** for what works today and what doesn't yet. The security design is in [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md), and the model details in [docs/models.md](docs/models.md).

## Develop

```bash
npm install
npm test          # core + main-process policy tests
npm run typecheck
npm start         # builds main + renderer, launches Electron
```

The Montserrat font is bundled from `@fontsource/montserrat` (SIL Open Font License 1.1).
