import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeGoals, greetingForNow, loadProfile, saveProfile, type UserProfile } from './profileService'

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    name: 'Alex',
    sex: 'male',
    age: 30,
    heightCm: 180,
    weightKg: 80,
    activity: 'moderate',
    goal: 'maintain',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('computeGoals', () => {
  it('computes higher BMR for male than female at the same stats', () => {
    const male = computeGoals(makeProfile({ sex: 'male' }))
    const female = computeGoals(makeProfile({ sex: 'female' }))
    expect(male.calories).toBeGreaterThan(female.calories)
  })

  it('scales calories down for a cut goal relative to maintain', () => {
    const maintain = computeGoals(makeProfile({ goal: 'maintain' }))
    const cut = computeGoals(makeProfile({ goal: 'cut' }))
    expect(cut.calories).toBeLessThan(maintain.calories)
  })

  it('scales calories up for a bulk goal relative to maintain', () => {
    const maintain = computeGoals(makeProfile({ goal: 'maintain' }))
    const bulk = computeGoals(makeProfile({ goal: 'bulk' }))
    expect(bulk.calories).toBeGreaterThan(maintain.calories)
  })

  it('rounds calories to the nearest 10', () => {
    const { calories } = computeGoals(makeProfile())
    expect(calories % 10).toBe(0)
  })

  it('never returns negative carbs when protein and fat consume the whole budget', () => {
    // Very low bodyweight + high protein target can otherwise drive carbs negative.
    const { carbs } = computeGoals(makeProfile({ weightKg: 40, heightCm: 150, age: 60, activity: 'sedentary', goal: 'cut' }))
    expect(carbs).toBeGreaterThanOrEqual(0)
  })

  it('derives protein directly from bodyweight and goal', () => {
    const { protein } = computeGoals(makeProfile({ weightKg: 80, goal: 'cut' }))
    expect(protein).toBe(Math.round(80 * 1.8))
  })
})

describe('greetingForNow', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('includes the name when provided', () => {
    vi.setSystemTime(new Date('2026-01-01T10:00:00'))
    expect(greetingForNow('Alex')).toContain('Alex')
  })

  it('omits the name when empty', () => {
    vi.setSystemTime(new Date('2026-01-01T10:00:00'))
    expect(greetingForNow('')).not.toContain('，')
  })

  it('greets differently at night than at midday', () => {
    vi.setSystemTime(new Date('2026-01-01T02:00:00'))
    const night = greetingForNow('')
    vi.setSystemTime(new Date('2026-01-01T12:00:00'))
    const noon = greetingForNow('')
    expect(night).not.toBe(noon)
  })
})

describe('profile persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing is stored', () => {
    expect(loadProfile()).toBeNull()
  })

  it('round-trips a saved profile through localStorage', () => {
    const fields = makeProfile()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { createdAt, updatedAt, ...rest } = fields
    const saved = saveProfile(rest)
    const loaded = loadProfile()
    expect(loaded).toMatchObject(rest)
    expect(loaded?.createdAt).toBe(saved.createdAt)
  })

  it('preserves the original createdAt when updating an existing profile', () => {
    const fields = makeProfile()
    const { createdAt: _c, updatedAt: _u, ...rest } = fields
    const first = saveProfile(rest)
    const second = saveProfile({ ...rest, weightKg: 82 }, first)
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.weightKg).toBe(82)
  })

  it('rejects malformed stored data and returns null', () => {
    localStorage.setItem('calorie-snap-profile', JSON.stringify({ sex: 'male' }))
    expect(loadProfile()).toBeNull()
  })

  it('rejects invalid JSON and returns null', () => {
    localStorage.setItem('calorie-snap-profile', '{not json')
    expect(loadProfile()).toBeNull()
  })
})
