# Calorie Snap

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

## Verify

```bash
npm ci
npm audit --audit-level=high
npm run lint
npm run build
```

The GitHub Actions workflow runs the same dependency audit, lint and
production-build checks on every push and pull request without requiring an
API key.
