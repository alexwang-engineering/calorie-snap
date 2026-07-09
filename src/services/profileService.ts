import type { MacroGoals } from '../types'

// ── User profile types ───────────────────────────────────────

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active'
export type GoalType = 'cut' | 'maintain' | 'bulk'

export interface UserProfile {
  name:      string
  sex:       Sex
  age:       number
  heightCm:  number
  weightKg:  number
  activity:  ActivityLevel
  goal:      GoalType
  createdAt: string
  updatedAt: string
}

export const ACTIVITY_LABELS: Record<ActivityLevel, { label: string; hint: string }> = {
  sedentary: { label: '久坐',   hint: '办公室工作，很少运动' },
  light:     { label: '轻度',   hint: '每周运动 1–3 次' },
  moderate:  { label: '中度',   hint: '每周运动 3–5 次' },
  active:    { label: '高度',   hint: '几乎每天高强度训练' },
}

export const GOAL_LABELS: Record<GoalType, { label: string; hint: string }> = {
  cut:      { label: '减脂', hint: '热量缺口约 15%' },
  maintain: { label: '保持', hint: '维持当前体重' },
  bulk:     { label: '增肌', hint: '热量盈余约 10%' },
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light:     1.375,
  moderate:  1.55,
  active:    1.725,
}

const GOAL_ADJUSTMENTS: Record<GoalType, number> = {
  cut:      0.85,
  maintain: 1,
  bulk:     1.1,
}

// Protein targets in g per kg bodyweight, by goal
const PROTEIN_PER_KG: Record<GoalType, number> = {
  cut:      1.8,
  maintain: 1.6,
  bulk:     1.8,
}

const FAT_KCAL_RATIO = 0.25

// ── Goal computation (Mifflin-St Jeor) ───────────────────────

export function computeGoals(profile: UserProfile): MacroGoals {
  const { sex, age, heightCm, weightKg, activity, goal } = profile
  const bmr =
    10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
  const tdee     = bmr * ACTIVITY_FACTORS[activity]
  const calories = Math.round((tdee * GOAL_ADJUSTMENTS[goal]) / 10) * 10

  const protein  = Math.round(weightKg * PROTEIN_PER_KG[goal])
  const fat      = Math.round((calories * FAT_KCAL_RATIO) / 9)
  const carbs    = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))

  return { calories, protein, carbs, fat }
}

// ── Persistence ──────────────────────────────────────────────

const PROFILE_KEY = 'calorie-snap-profile'

function isValidProfile(raw: unknown): raw is UserProfile {
  if (raw === null || typeof raw !== 'object') return false
  const p = raw as Record<string, unknown>
  return (
    (p.sex === 'male' || p.sex === 'female') &&
    typeof p.age === 'number' && p.age > 0 &&
    typeof p.heightCm === 'number' && p.heightCm > 0 &&
    typeof p.weightKg === 'number' && p.weightKg > 0 &&
    typeof p.activity === 'string' && p.activity in ACTIVITY_FACTORS &&
    typeof p.goal === 'string' && p.goal in GOAL_ADJUSTMENTS
  )
}

export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isValidProfile(parsed)) return null
    return { ...parsed, name: typeof parsed.name === 'string' ? parsed.name : '' }
  } catch {
    return null
  }
}

export function saveProfile(
  fields: Omit<UserProfile, 'createdAt' | 'updatedAt'>,
  existing?: UserProfile | null,
): UserProfile {
  const now = new Date().toISOString()
  const profile: UserProfile = {
    ...fields,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    // Storage quota exceeded or private-mode restriction — fail silently
  }
  return profile
}

// ── Greeting helper ──────────────────────────────────────────

export function greetingForNow(name: string): string {
  const hour = new Date().getHours()
  const timeGreeting =
    hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
  return name ? `${timeGreeting}，${name}` : timeGreeting
}
