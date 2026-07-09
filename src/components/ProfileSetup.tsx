import { Salad, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  computeGoals,
  type ActivityLevel,
  type GoalType,
  type Sex,
  type UserProfile,
} from '../services/profileService'

type ProfileSetupProps = {
  // null = first run (onboarding, not dismissible); existing profile = editing
  profile: UserProfile | null
  onSave: (fields: Omit<UserProfile, 'createdAt' | 'updatedAt'>) => void
  onCancel?: () => void
}

const SEX_OPTIONS: Array<{ value: Sex; label: string }> = [
  { value: 'male',   label: '男' },
  { value: 'female', label: '女' },
]

export function ProfileSetup({ profile, onSave, onCancel }: ProfileSetupProps) {
  const isFirstRun = profile === null

  const [name, setName]         = useState(profile?.name ?? '')
  const [sex, setSex]           = useState<Sex>(profile?.sex ?? 'male')
  const [age, setAge]           = useState(profile ? String(profile.age) : '')
  const [heightCm, setHeightCm] = useState(profile ? String(profile.heightCm) : '')
  const [weightKg, setWeightKg] = useState(profile ? String(profile.weightKg) : '')
  const [activity, setActivity] = useState<ActivityLevel>(profile?.activity ?? 'light')
  const [goal, setGoal]         = useState<GoalType>(profile?.goal ?? 'maintain')

  const parsed = useMemo(() => {
    const ageNum    = Number(age)
    const heightNum = Number(heightCm)
    const weightNum = Number(weightKg)
    const valid =
      Number.isFinite(ageNum) && ageNum >= 10 && ageNum <= 100 &&
      Number.isFinite(heightNum) && heightNum >= 100 && heightNum <= 250 &&
      Number.isFinite(weightNum) && weightNum >= 25 && weightNum <= 300
    return { ageNum, heightNum, weightNum, valid }
  }, [age, heightCm, weightKg])

  // Live goal preview so the user sees their targets before saving
  const previewGoals = useMemo(() => {
    if (!parsed.valid) return null
    return computeGoals({
      name, sex, age: parsed.ageNum, heightCm: parsed.heightNum, weightKg: parsed.weightNum,
      activity, goal, createdAt: '', updatedAt: '',
    })
  }, [name, sex, parsed, activity, goal])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!parsed.valid) return
    onSave({
      name: name.trim(),
      sex,
      age: parsed.ageNum,
      heightCm: parsed.heightNum,
      weightKg: parsed.weightNum,
      activity,
      goal,
    })
  }

  return (
    <div className="profile-overlay" role="dialog" aria-modal="true" aria-label="设置个人信息">
      <form className="profile-modal" onSubmit={handleSubmit}>
        <div className="profile-modal-head">
          <span className="profile-modal-mark"><Salad size={18} aria-hidden="true" /></span>
          <div>
            <h2>{isFirstRun ? '欢迎使用 Calorie Snap' : '编辑个人信息'}</h2>
            <p>{isFirstRun ? '花 30 秒告诉我们你的情况，热量和营养目标将为你量身计算。' : '修改后目标会立即重新计算。'}</p>
          </div>
        </div>

        <label className="profile-field">
          怎么称呼你（可选）
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例如：小李"
            maxLength={20}
          />
        </label>

        <div className="profile-field-row">
          <div className="profile-field">
            <span className="profile-field-label">性别</span>
            <div className="profile-segment">
              {SEX_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={sex === opt.value ? 'segment--active' : ''}
                  onClick={() => setSex(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <label className="profile-field">
            年龄
            <input
              type="number" inputMode="numeric" min={10} max={100} required
              value={age} onChange={e => setAge(e.target.value)} placeholder="25"
            />
          </label>
        </div>

        <div className="profile-field-row">
          <label className="profile-field">
            身高 (cm)
            <input
              type="number" inputMode="decimal" min={100} max={250} required
              value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175"
            />
          </label>
          <label className="profile-field">
            体重 (kg)
            <input
              type="number" inputMode="decimal" min={25} max={300} step="0.1" required
              value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="65"
            />
          </label>
        </div>

        <div className="profile-field">
          <span className="profile-field-label">日常活动量</span>
          <div className="profile-option-grid">
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(level => (
              <button
                key={level}
                type="button"
                className={`profile-option${activity === level ? ' profile-option--active' : ''}`}
                onClick={() => setActivity(level)}
              >
                <strong>{ACTIVITY_LABELS[level].label}</strong>
                <span>{ACTIVITY_LABELS[level].hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="profile-field">
          <span className="profile-field-label">目标</span>
          <div className="profile-option-grid profile-option-grid--three">
            {(Object.keys(GOAL_LABELS) as GoalType[]).map(g => (
              <button
                key={g}
                type="button"
                className={`profile-option${goal === g ? ' profile-option--active' : ''}`}
                onClick={() => setGoal(g)}
              >
                <strong>{GOAL_LABELS[g].label}</strong>
                <span>{GOAL_LABELS[g].hint}</span>
              </button>
            ))}
          </div>
        </div>

        {previewGoals && (
          <div className="profile-preview" aria-live="polite">
            <Sparkles size={14} aria-hidden="true" />
            <span>
              每日目标 <strong>{previewGoals.calories} kcal</strong>
              &nbsp;·&nbsp;蛋白 {previewGoals.protein}g
              &nbsp;·&nbsp;碳水 {previewGoals.carbs}g
              &nbsp;·&nbsp;脂肪 {previewGoals.fat}g
            </span>
          </div>
        )}

        <div className="profile-modal-actions">
          {!isFirstRun && onCancel && (
            <button type="button" className="profile-cancel" onClick={onCancel}>取消</button>
          )}
          <button type="submit" className="profile-save" disabled={!parsed.valid}>
            {isFirstRun ? '开始记录' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}
