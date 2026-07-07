import { CheckCircle2, ChevronLeft, Utensils } from 'lucide-react'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { LogEntry, MealType, PendingFood } from '../types'
import { createLogEntry, updateLogEntry } from '../services/logService'
import { todayDateKey } from '../types'

// ── Props ────────────────────────────────────────────────────

type ConfirmCreate = {
  mode:        'create'
  pendingFood: PendingFood
  initialMeal: MealType
  onConfirm:   (entry: LogEntry) => void
  onCancel:    () => void
}

type ConfirmEdit = {
  mode:      'edit'
  entry:     LogEntry
  onConfirm: (entry: LogEntry) => void
  onCancel:  () => void
}

type Props = ConfirmCreate | ConfirmEdit

// ── Constants ────────────────────────────────────────────────

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch:     '午餐',
  dinner:    '晚餐',
  snack:     '加餐',
}

const SERVING_UNITS = ['g', 'ml', 'piece', 'cup', 'tbsp', 'oz', 'serving']

// ── Helper ───────────────────────────────────────────────────

function num(v: FormDataEntryValue | null, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

// ── Component ────────────────────────────────────────────────

export function FoodConfirmation(props: Props) {
  const { onConfirm, onCancel } = props

  // Derive initial values from either create or edit mode
  const init = props.mode === 'create'
    ? {
        name:        props.pendingFood.name,
        brand:       props.pendingFood.brand ?? '',
        calories:    props.pendingFood.calories,
        protein:     props.pendingFood.protein,
        carbs:       props.pendingFood.carbs,
        fat:         props.pendingFood.fat,
        servingSize: props.pendingFood.servingSize,
        servingUnit: props.pendingFood.servingUnit,
        quantity:    1,
        meal:        props.initialMeal,
        date:        todayDateKey(),
        image:       props.pendingFood.image,
        source:      props.pendingFood.source,
        barcode:     props.pendingFood.barcode,
      }
    : {
        name:        props.entry.name,
        brand:       props.entry.brand ?? '',
        calories:    props.entry.calories,
        protein:     props.entry.protein,
        carbs:       props.entry.carbs,
        fat:         props.entry.fat,
        servingSize: props.entry.servingSize ?? 1,
        servingUnit: props.entry.servingUnit ?? 'g',
        quantity:    props.entry.quantity ?? 1,
        meal:        props.entry.meal,
        date:        props.entry.date ?? todayDateKey(),
        image:       props.entry.image,
        source:      props.entry.source,
        barcode:     props.entry.barcode,
      }

  const [meal, setMeal] = useState<MealType>(init.meal)
  const formRef = useRef<HTMLFormElement | null>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd   = new FormData(e.currentTarget)
    const name = String(fd.get('name') ?? '').trim()
    if (!name) return

    const fields: Omit<LogEntry, 'id' | 'createdAt' | 'updatedAt'> = {
      name,
      brand:       String(fd.get('brand') ?? '').trim() || undefined,
      source:      init.source,
      calories:    num(fd.get('calories')),
      protein:     num(fd.get('protein')),
      carbs:       num(fd.get('carbs')),
      fat:         num(fd.get('fat')),
      servingSize: num(fd.get('servingSize'), 1),
      servingUnit: String(fd.get('servingUnit') ?? 'g'),
      quantity:    num(fd.get('quantity'), 1),
      // Keep legacy amount field for backward compat display
      amount:      `${fd.get('quantity') ?? 1} × ${fd.get('servingSize') ?? 1}${fd.get('servingUnit') ?? 'g'}`,
      meal,
      date:        String(fd.get('date') ?? todayDateKey()),
      image:       init.image,
      barcode:     init.barcode,
    }

    const result = props.mode === 'create'
      ? createLogEntry(fields)
      : updateLogEntry(props.entry, fields)

    onConfirm(result)
  }

  return (
    <div className="food-confirmation">
      {/* Header */}
      <div className="fc-header">
        <div>
          <h2 className="fc-title">
            {props.mode === 'create' ? '确认这餐' : '编辑记录'}
          </h2>
          <p className="fc-subtitle">
            {props.mode === 'create'
              ? '保存前检查一下份量和营养，结果不会直接保存。'
              : '修改后会更新今天的热量和营养统计。'}
          </p>
        </div>
        <button type="button" className="fc-back" onClick={onCancel} aria-label="返回">
          <ChevronLeft size={16} />
          {props.mode === 'create' ? '返回修改' : '取消'}
        </button>
      </div>

      {/* Food image preview */}
      {init.image && (
        <img src={init.image} alt={init.name} className="fc-image" />
      )}
      {!init.image && (
        <div className="fc-image-placeholder">
          <Utensils size={32} />
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="fc-form">
        {/* Name + brand */}
        <div className="fc-row">
          <label className="fc-label--grow">
            食物名称 *
            <input name="name" required defaultValue={init.name} placeholder="食物名称" />
          </label>
          <label>
            品牌（可选）
            <input name="brand" defaultValue={init.brand} placeholder="品牌" />
          </label>
        </div>

        {/* Serving */}
        <div className="fc-row fc-row--serving">
          <label>
            每份量
            <input
              name="servingSize"
              type="number"
              min="0.1"
              step="0.1"
              defaultValue={init.servingSize}
            />
          </label>
          <label>
            单位
            <select name="servingUnit" defaultValue={init.servingUnit}>
              {SERVING_UNITS.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>
          <label>
            份数
            <input
              name="quantity"
              type="number"
              min="0.1"
              step="0.1"
              defaultValue={init.quantity}
            />
          </label>
        </div>

        {/* Nutrition */}
        <div className="fc-nutrition-grid">
          <label>
            热量 (kcal)
            <input name="calories" type="number" min="0" defaultValue={init.calories} />
          </label>
          <label>
            蛋白质 (g)
            <input name="protein" type="number" min="0" step="0.1" defaultValue={init.protein} />
          </label>
          <label>
            碳水 (g)
            <input name="carbs" type="number" min="0" step="0.1" defaultValue={init.carbs} />
          </label>
          <label>
            脂肪 (g)
            <input name="fat" type="number" min="0" step="0.1" defaultValue={init.fat} />
          </label>
        </div>

        {/* Meal selector */}
        <div className="fc-meal-row">
          {(Object.keys(MEAL_LABELS) as MealType[]).map(m => (
            <button
              key={m}
              type="button"
              className={`fc-meal-btn${meal === m ? ' fc-meal-btn--active' : ''}`}
              onClick={() => setMeal(m)}
            >
              {MEAL_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Date */}
        <label className="fc-date-label">
          日期
          <input name="date" type="date" defaultValue={init.date} />
        </label>

        {/* Source tag */}
        <p className="fc-source-tag">
          来源：{init.source === 'usda' ? 'USDA 数据库' : init.source === 'openfoodfacts' ? 'Open Food Facts' : init.source === 'photo' ? 'AI 识别' : '手动录入'}
        </p>

        <button type="submit" className="fc-submit">
          <CheckCircle2 size={17} />
          {props.mode === 'create' ? '保存到今天' : '保存修改'}
        </button>
      </form>
    </div>
  )
}
