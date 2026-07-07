# Calorie Snap Handoff

## Project

Calorie Snap is a mobile-first food and calorie tracker built in React, TypeScript, and Vite.

Project path:

`/Users/wjl/Github/calorie-snap`

Current local dev URL:

`http://127.0.0.1:5173/`

## User Goal

The user wants an app to track food and calories, including:

- Food and calorie logging.
- Photo-based meal capture.
- Barcode / QR code capture.
- Nutrition lookup for scanned packaged food.
- A clear handoff file so other AI models can continue development.

## Current Implementation

Main files:

- `src/App.tsx`: React app logic, local state, meal entries, barcode lookup, image upload, camera access.
- `src/App.css`: App-specific responsive UI styles.
- `src/index.css`: Global reset, tokens, focus styles.
- `README.md`: Project overview, research notes, run and verify commands.
- `handoff.md`: This file.

Implemented features:

- Meal categories: breakfast, lunch, dinner, snack.
- Daily calories and macros summary.
- Manual food entry with calories, protein, carbs, fat, and serving amount.
- Photo upload / capture through file input.
- Camera open/close flow for barcode scanning.
- Barcode image scan path using browser `BarcodeDetector` when available.
- Manual barcode input fallback.
- Open Food Facts API lookup for packaged food.
- Local persistence via `localStorage`.
- Responsive desktop/mobile layout.

## Dependencies

Runtime:

- React 19
- React DOM 19
- Vite 8
- TypeScript 6
- lucide-react

Install:

```bash
npm install
```

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Verify:

```bash
npm run lint
npm run build
```

## Validation Already Done

The following checks passed:

```bash
npm run lint
npm run build
```

Browser verification:

- Desktop render loaded.
- Mobile viewport at 390px width had no horizontal overflow.
- Main sections appeared: Calorie Snap, manual entry, today's food list.
- Browser console had no app errors during the checked render.

Known environment note:

- The tested in-app browser did not support `BarcodeDetector`, so scan fallback matters.

## APIs And Research Notes

Open Food Facts:

- Used for barcode-based packaged food lookup.
- Current endpoint shape:

```text
https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields=product_name,brands,nutriments,serving_size,image_front_url
```

USDA FoodData Central:

- Good next data source for generic food search and broader nutrition data.
- Not implemented yet.

BarcodeDetector:

- Browser-native barcode detection.
- Not universally supported, so keep manual barcode entry and photo/manual fallback.

## Known Limitations

- No backend yet.
- No login or cloud sync.
- Photos are stored as object URLs for the current browser session, not durable uploaded assets.
- Manual calorie values are user-entered; no AI food-photo nutrition estimate yet.
- Barcode lookup only covers products present in Open Food Facts.
- Camera permissions and barcode scanning depend on browser support and HTTPS/local secure context behavior.
- Current app is Chinese-facing in the UI, but code comments and docs are mostly English for handoff clarity.

## Recommended Next Steps

1. Make photo entries durable.
   - Convert uploaded images to base64 or store via IndexedDB.
   - Later replace with cloud object storage.

2. Add USDA search.
   - Add a food search field for non-packaged foods.
   - Use USDA FoodData Central through a small backend proxy so API keys are not exposed.

3. Add a backend.
   - Suggested stack: Supabase, Firebase, or a small Node/Express API.
   - Add user accounts and cloud sync.

4. Improve scanning.
   - Add a library fallback such as ZXing if native `BarcodeDetector` is unavailable.
   - Keep manual input as a reliable fallback.

5. Add goals and history.
   - User-configurable calorie target.
   - Weekly trends.
   - Search/filter past entries.

6. Add tests.
   - Unit tests for entry totals and API mapping.
   - E2E tests for manual add, delete, and barcode fallback flow.

7. Consider AI photo recognition.
   - Use a vision model to identify likely foods.
   - Treat generated nutrition estimates as editable suggestions, not medical-grade truth.

## Suggested Prompt For Another AI

Continue work on `/Users/wjl/Github/calorie-snap`, a React TypeScript Vite app called Calorie Snap. Read `README.md`, `handoff.md`, `src/App.tsx`, `src/App.css`, and `src/index.css` first. Preserve the current mobile-first UI and localStorage behavior unless changing it intentionally. The app currently tracks meals, calories, macros, photos, and barcode lookup through Open Food Facts. Next useful improvements are durable image storage, USDA food search, native barcode fallback with ZXing, backend sync, and tests. Run `npm run lint` and `npm run build` before finishing.

## Current Status

The app is usable as a first prototype and ready for iterative development.
