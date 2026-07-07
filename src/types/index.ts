// ── Core domain types ───────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/**
 * Source of a food entry. 'barcode' is intentionally excluded:
 * barcode lookups go through Open Food Facts, so they are 'openfoodfacts'.
 */
export type EntrySource = 'manual' | 'usda' | 'openfoodfacts' | 'photo'

/**
 * A food entry stored in the daily log.
 *
 * Backward-compatible with the old MealEntry shape:
 *  - `meal` is kept (old field, not renamed)
 *  - `amount` is kept as an optional legacy string
 *  - `barcode` is kept as an optional legacy string
 * New optional fields are added alongside old ones so existing
 * localStorage data deserialises without errors.
 */
export interface LogEntry {
  id:          string
  name:        string
  brand?:      string
  source:      EntrySource
  calories:    number
  protein:     number
  carbs:       number
  fat:         number

  // Legacy freeform string from old MealEntry (e.g. "1 bowl", "250g")
  amount?:     string

  // New structured serving fields (optional for backward compat)
  servingSize?: number   // numeric size of one serving, e.g. 100
  servingUnit?: string   // unit string, e.g. 'g', 'ml', 'piece'
  quantity?:    number   // user multiplier (how many servings), default 1

  meal:        MealType  // kept as 'meal' (not renamed) for compat
  date?:       string    // 'YYYY-MM-DD', optional for compat with old data

  image?:      string
  barcode?:    string

  createdAt:   string    // ISO timestamp
  updatedAt?:  string    // ISO timestamp, optional for compat
}

/**
 * The universal intermediate type produced by any food-input method
 * (Search / Barcode / Photo / Manual) before the user confirms.
 *
 * PendingFood flows into FoodConfirmation, where the user can edit
 * any field before it becomes a LogEntry.
 */
export interface PendingFood {
  name:        string
  brand?:      string
  source:      EntrySource
  calories:    number
  protein:     number
  carbs:       number
  fat:         number
  servingSize: number
  servingUnit: string
  image?:      string
  barcode?:    string
}

// ── Macro goal type (for Dashboard) ─────────────────────────

export interface MacroGoals {
  calories: number
  protein:  number
  carbs:    number
  fat:      number
}

export const DEFAULT_GOALS: MacroGoals = {
  calories: 2100,
  protein:  120,
  carbs:    260,
  fat:      70,
}

// ── Helper: today as YYYY-MM-DD ──────────────────────────────

export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10)
}
