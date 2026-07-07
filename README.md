# Calorie Snap

A mobile-first food and calorie tracker built with React, TypeScript, and Vite.

## What it does

- Track today's meals, calories, protein, carbs, and fat.
- Add food manually when there is no barcode.
- Take/upload a food photo and save it with the meal entry.
- Scan a barcode or QR image when the browser supports `BarcodeDetector`.
- Look up packaged food nutrition through Open Food Facts.
- Store entries locally in `localStorage` for a fast first version with no backend.

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

## Verify

```bash
npm run lint
npm run build
```
