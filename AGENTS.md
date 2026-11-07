TrailPacer is an Expo (React Native) app that builds and runs a trail race pacing plan. UI and docs are in French.

## Expo has changed — do not trust your training data

This project uses Expo SDK 58. Before touching an Expo / React Native API, check the installed type definitions in `node_modules/<package>/build/*.d.ts` or the versioned docs at `https://docs.expo.dev/versions/v58.0.0/`. Notably: `expo-av` is replaced by `expo-audio`; `expo-file-system` uses the `File` / `Paths` API.

## Layout

- `src/core/` — pure TypeScript domain logic (GPX, pacing model, plan, positioning, events). No React Native imports. Covered by Vitest.
- `src/services/` — native side effects (notifications, speech, background location, file I/O).
- `src/state/` — persistent store shared by the UI and the background location task.
- `src/screens/`, `src/ui/` — UI. Navigation is a simple tab state in `App.tsx` (no router).
- `index.ts` must import `src/services/location` before registering the app (background task definition).

## Commands

```bash
npx expo install <package>   # never plain npm install for Expo modules
npm test                     # vitest
npm run typecheck            # tsc --noEmit
npx expo export --platform ios --platform android   # bundling smoke test
```

Run tests and typecheck before declaring a task done. Never edit `ios/` or `android/` by hand (Continuous Native Generation): configure them in `app.json`.
