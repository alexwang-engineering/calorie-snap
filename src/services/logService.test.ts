import { beforeEach, describe, expect, it } from 'vitest'
import {
  createLogEntry,
  loadEntries,
  loadFavorites,
  saveEntries,
  saveFavorites,
  updateLogEntry,
} from './logService'
import type { LogEntry } from '../types'

beforeEach(() => {
  localStorage.clear()
})

describe('loadEntries', () => {
  it('returns an empty array when nothing is stored', () => {
    expect(loadEntries()).toEqual([])
  })

  it('returns an empty array for corrupted JSON instead of throwing', () => {
    localStorage.setItem('calorie-snap-entries', '{not json')
    expect(loadEntries()).toEqual([])
  })

  it('returns an empty array when the stored value is not an array', () => {
    localStorage.setItem('calorie-snap-entries', JSON.stringify({ foo: 'bar' }))
    expect(loadEntries()).toEqual([])
  })

  it('migrates legacy "barcode" source to "openfoodfacts"', () => {
    localStorage.setItem(
      'calorie-snap-entries',
      JSON.stringify([{ name: 'Milk', source: 'barcode', calories: 100 }]),
    )
    expect(loadEntries()[0].source).toBe('openfoodfacts')
  })

  it('falls back to "manual" for an unrecognized source', () => {
    localStorage.setItem(
      'calorie-snap-entries',
      JSON.stringify([{ name: 'Mystery', source: 'ocr', calories: 50 }]),
    )
    expect(loadEntries()[0].source).toBe('manual')
  })

  it('falls back to "lunch" for a missing or invalid meal type', () => {
    localStorage.setItem('calorie-snap-entries', JSON.stringify([{ name: 'X', calories: 10 }]))
    expect(loadEntries()[0].meal).toBe('lunch')
  })

  it('reads meal from the legacy "mealType" field when "meal" is absent', () => {
    localStorage.setItem(
      'calorie-snap-entries',
      JSON.stringify([{ name: 'X', calories: 10, mealType: 'breakfast' }]),
    )
    expect(loadEntries()[0].meal).toBe('breakfast')
  })

  it('coerces non-numeric calorie/macro fields to 0 instead of NaN', () => {
    localStorage.setItem(
      'calorie-snap-entries',
      JSON.stringify([{ name: 'X', calories: 'lots', protein: null }]),
    )
    const [entry] = loadEntries()
    expect(entry.calories).toBe(0)
    expect(entry.protein).toBe(0)
  })

  it('derives date from createdAt when date is absent', () => {
    localStorage.setItem(
      'calorie-snap-entries',
      JSON.stringify([{ name: 'X', calories: 10, createdAt: '2026-03-05T08:00:00.000Z' }]),
    )
    expect(loadEntries()[0].date).toBe('2026-03-05')
  })

  it('generates an id when the stored entry has none', () => {
    localStorage.setItem('calorie-snap-entries', JSON.stringify([{ name: 'X', calories: 10 }]))
    expect(loadEntries()[0].id).toMatch(/[0-9a-f-]{36}/)
  })

  it('filters out non-object array items', () => {
    localStorage.setItem('calorie-snap-entries', JSON.stringify([null, 'oops', 42, { name: 'X', calories: 10 }]))
    expect(loadEntries()).toHaveLength(1)
  })
})

describe('saveEntries / loadEntries round-trip', () => {
  it('persists and reloads entries unchanged', () => {
    const entry = createLogEntry({
      name: 'Chicken',
      source: 'manual',
      calories: 300,
      protein: 30,
      carbs: 0,
      fat: 10,
      meal: 'dinner',
    })
    saveEntries([entry])
    const [loaded] = loadEntries()
    expect(loaded.name).toBe('Chicken')
    expect(loaded.meal).toBe('dinner')
  })
})

describe('favorites', () => {
  it('returns an empty array when nothing is stored', () => {
    expect(loadFavorites()).toEqual([])
  })

  it('round-trips saved favorites', () => {
    saveFavorites(['Chicken', 'Rice'])
    expect(loadFavorites()).toEqual(['Chicken', 'Rice'])
  })

  it('filters non-string entries from corrupted favorites data', () => {
    localStorage.setItem('calorie-snap-favorites', JSON.stringify(['Rice', 42, null]))
    expect(loadFavorites()).toEqual(['Rice'])
  })

  it('returns an empty array for corrupted JSON instead of throwing', () => {
    localStorage.setItem('calorie-snap-favorites', '{not json')
    expect(loadFavorites()).toEqual([])
  })
})

describe('createLogEntry', () => {
  it('assigns a fresh id and matching createdAt/updatedAt', () => {
    const entry = createLogEntry({
      name: 'Toast', source: 'manual', calories: 100, protein: 3, carbs: 20, fat: 1, meal: 'breakfast',
    })
    expect(entry.id).toBeTruthy()
    expect(entry.createdAt).toBe(entry.updatedAt)
  })
})

describe('updateLogEntry', () => {
  it('applies a patch immutably without mutating the original', () => {
    const original: LogEntry = createLogEntry({
      name: 'Toast', source: 'manual', calories: 100, protein: 3, carbs: 20, fat: 1, meal: 'breakfast',
    })
    const updated = updateLogEntry(original, { calories: 150 })
    expect(updated.calories).toBe(150)
    expect(original.calories).toBe(100)
    expect(updated.id).toBe(original.id)
  })

  it('keeps the original id and createdAt even if a patch tries to override them', () => {
    const original = createLogEntry({
      name: 'Toast', source: 'manual', calories: 100, protein: 3, carbs: 20, fat: 1, meal: 'breakfast',
    })
    const updated = updateLogEntry(original, {} as Partial<LogEntry>)
    expect(updated.id).toBe(original.id)
    expect(updated.createdAt).toBe(original.createdAt)
  })
})
