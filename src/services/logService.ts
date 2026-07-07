import type { EntrySource, LogEntry, MealType } from '../types'

const ENTRIES_KEY   = 'calorie-snap-entries'
const FAVORITES_KEY = 'calorie-snap-favorites'

// ── Source migration ─────────────────────────────────────────

function migrateSource(raw: unknown): EntrySource {
  if (raw === 'barcode') return 'openfoodfacts'   // old name → new name
  if (raw === 'manual' || raw === 'usda' || raw === 'openfoodfacts' || raw === 'photo') {
    return raw
  }
  return 'manual'
}

function migrateMeal(raw: unknown): MealType {
  if (raw === 'breakfast' || raw === 'lunch' || raw === 'dinner' || raw === 'snack') {
    return raw
  }
  return 'lunch'
}

// ── Entry migration ──────────────────────────────────────────

/**
 * Converts any raw object (old MealEntry or new LogEntry) to LogEntry.
 * Conservative: never throws, always returns something usable.
 * Old fields are preserved; new fields get safe defaults if absent.
 */
function migrateEntry(raw: Record<string, unknown>): LogEntry {
  const name      = typeof raw.name === 'string' && raw.name ? raw.name : 'Unknown food'
  const calories  = Number.isFinite(Number(raw.calories))  ? Number(raw.calories)  : 0
  const protein   = Number.isFinite(Number(raw.protein))   ? Number(raw.protein)   : 0
  const carbs     = Number.isFinite(Number(raw.carbs))     ? Number(raw.carbs)     : 0
  const fat       = Number.isFinite(Number(raw.fat))       ? Number(raw.fat)       : 0

  // Serving fields: keep legacy 'amount' string as-is, add new fields if present
  const amount      = typeof raw.amount === 'string' ? raw.amount : undefined
  const servingSize = Number.isFinite(Number(raw.servingSize)) ? Number(raw.servingSize) : undefined
  const servingUnit = typeof raw.servingUnit === 'string' ? raw.servingUnit : undefined
  const quantity    = Number.isFinite(Number(raw.quantity)) && Number(raw.quantity) > 0
    ? Number(raw.quantity)
    : undefined

  // Date: prefer explicit date field, fall back to slicing createdAt
  const createdAt = typeof raw.createdAt === 'string' && raw.createdAt
    ? raw.createdAt
    : new Date().toISOString()
  const date = typeof raw.date === 'string' && raw.date
    ? raw.date
    : createdAt.slice(0, 10)

  return {
    id:          typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(),
    name,
    brand:       typeof raw.brand === 'string' ? raw.brand : undefined,
    source:      migrateSource(raw.source),
    calories,
    protein,
    carbs,
    fat,
    amount,
    servingSize,
    servingUnit,
    quantity,
    meal:        migrateMeal(raw.meal ?? raw.mealType),
    date,
    image:       typeof raw.image   === 'string' ? raw.image   : undefined,
    barcode:     typeof raw.barcode === 'string' ? raw.barcode : undefined,
    createdAt,
    updatedAt:   typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  }
}

// ── Public API ───────────────────────────────────────────────

export function loadEntries(): LogEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is Record<string, unknown> =>
        item !== null && typeof item === 'object'
      )
      .map(migrateEntry)
  } catch {
    return []
  }
}

export function saveEntries(entries: LogEntry[]): void {
  try {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
  } catch {
    // Storage quota exceeded or private-mode restriction — fail silently
  }
}

export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((f): f is string => typeof f === 'string') : []
  } catch {
    return []
  }
}

export function saveFavorites(favorites: string[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
  } catch {}
}

/**
 * Create a brand-new LogEntry ready to persist.
 * Called from FoodConfirmation after the user clicks "Confirm".
 */
export function createLogEntry(
  fields: Omit<LogEntry, 'id' | 'createdAt' | 'updatedAt'>
): LogEntry {
  const now = new Date().toISOString()
  return {
    ...fields,
    id:        crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Update an existing LogEntry in-place (immutably).
 */
export function updateLogEntry(
  existing: LogEntry,
  patch: Partial<Omit<LogEntry, 'id' | 'createdAt'>>
): LogEntry {
  return {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
}
