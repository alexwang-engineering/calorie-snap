# Calorie Snap

![Status: Active Development](https://img.shields.io/badge/status-active_development-blue.svg)
[![CI](https://github.com/alexwang-engineering/calorie-snap/actions/workflows/ci.yml/badge.svg)](https://github.com/alexwang-engineering/calorie-snap/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

> 🚧 **Work in progress** — under active development, not medical or dietary
> advice. See `handoff.md` for known limitations and next steps.

A mobile-first React/TypeScript food tracker with natural-language meal logging,
Anthropic tool calling and source-grounded nutrition lookup through Open Food
Facts. It can run as a web/PWA experience and is packaged for Electron,
Capacitor iOS and Android targets.

## What it does

- Track today's meals, calories, protein, carbs, and fat.
- Add food manually when there is no barcode.
- Take/upload a food photo and save it with the meal entry.
- Scan a barcode or QR image when the browser supports `BarcodeDetector`.
- Look up packaged food nutrition through Open Food Facts.
- Describe a meal in natural language and review the AI-generated foods,
  quantities, calories and macros before saving.
- Store entries locally in `localStorage` for a fast first version with no backend.

## AI workflow

The backend proxy keeps the Anthropic API key out of the browser. The meal
parser runs a bounded multi-turn tool-calling loop: it asks the model to
structure the meal, uses Open Food Facts for nutrition grounding when needed,
then returns a reviewable result to the client. Users remain responsible for
checking quantities and nutrition values before saving.

An eight-case evaluation harness compares prompt variants for output structure
and calorie accuracy. The retained baseline produced eight structurally valid
responses with 5.1% mean calorie error on the checked fixture set; this is a
development benchmark, not a clinical accuracy claim.

## Research notes

- Packaged food barcode data: [Open Food Facts API v2](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-v2/).
- Broader food nutrition search for a future backend: [USDA FoodData Central API](https://fdc.nal.usda.gov/api-guide).
- Browser-native scanning: [MDN BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector). This API is not universal, so the app includes manual barcode input as a fallback.

## Run locally

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Then open `http://127.0.0.1:5173/`.

To use natural-language meal logging, copy `.env.example` to `.env`, add your
own `ANTHROPIC_API_KEY`, and run the local proxy in a second terminal:

```bash
npm run proxy
```

## Build & deploy

The app builds to a single web bundle and reuses it across every platform
target. All commands assume `npm install` has already run.

| Target | Command | Output |
|---|---|---|
| Web / PWA | `npm run build` | `dist/` — static, installable bundle (via `vite-plugin-pwa`) |
| macOS (Electron) | `npm run electron:build` | `dist-electron/` — signed-less `.dmg` for `arm64` and `x64` |
| iOS (Capacitor) | `npm run ios` | Builds the web bundle, `cap sync ios`, then opens Xcode |
| Android (Capacitor) | `npm run android` | Builds the web bundle, `cap sync android`, then opens Android Studio |

- **Local Electron dev:** `npm run electron:dev` runs Vite and Electron together
  with hot reload.
- **Resync native shells after a web change:** `npm run cap:sync` rebuilds and
  pushes the bundle into the iOS and Android projects without opening an IDE.
- **AI features on native builds:** the natural-language parser calls the local
  proxy, so a native build must be able to reach a running `npm run proxy`
  instance. The proxy holds the `ANTHROPIC_API_KEY`; it is never bundled into
  the client. `npm run proxy:lan` serves the proxy on the LAN for on-device
  testing.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the frontend, proxy
and platform shells fit together.

## Verify

```bash
npm ci
npm audit --audit-level=high
npm run lint
npm run build
```

The GitHub Actions workflow ([`ci.yml`](.github/workflows/ci.yml)) runs the same
dependency audit, lint and production-build checks on every push and pull
request without requiring an API key. The prompt-evaluation harness
(`npm run eval`) is a separate development benchmark described under
[AI workflow](#ai-workflow) — it is not part of CI because it needs an API key.

## Dependencies

Direct dependencies use caret ranges. The one pinned override is `fast-uri`,
forced to `^3.1.4` in `package.json` `overrides`: it arrives transitively
through `electron-builder → ajv`, and versions `3.0.0–3.1.3` carry a
high-severity advisory ([GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx)).
The override keeps the high-severity `npm audit` in CI clean while staying inside
`ajv`'s supported `^3` range.

## License

Licensed under the [Apache License 2.0](LICENSE).
