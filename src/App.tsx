import {
  Apple,
  BarChart3,
  Camera,
  CheckCircle2,
  Clock,
  Flame,
  ImagePlus,
  Loader2,
  Pencil,
  QrCode,
  Salad,
  Search,
  Sparkles,
  Star,
  Trash2,
  Utensils,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import type { LogEntry, MealType, PendingFood } from './types'
import { loadEntries, loadFavorites, saveEntries, saveFavorites } from './services/logService'
import { FoodConfirmation } from './components/FoodConfirmation'

const USDA_API_KEY = 'DEMO_KEY'

type FoodResult = {
  fdcId: number
  description: string
  brandOwner?: string
  calories: number
  protein: number
  carbs: number
  fat: number
  servingSize?: string
}

function parseNutrients(foodNutrients: Array<{ nutrientName: string; value: number }>): Pick<FoodResult, 'calories' | 'protein' | 'carbs' | 'fat'> {
  const find = (...keys: string[]) => {
    const hit = foodNutrients.find(n => keys.some(k => n.nutrientName.toLowerCase().includes(k.toLowerCase())))
    return Math.round(hit?.value ?? 0)
  }
  return {
    calories: find('Energy'),
    protein: find('Protein'),
    carbs: find('Carbohydrate'),
    fat: find('Total lipid'),
  }
}

type AiEstimate = {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  amount: string
}

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[]
}) => {
  detect: (
    source: HTMLImageElement | HTMLVideoElement | ImageBitmap,
  ) => Promise<Array<{ rawValue: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor
  }
}

const mealLabels: Record<MealType, string> = {
  breakfast: '早餐',
  lunch:     '午餐',
  dinner:    '晚餐',
  snack:     '加餐',
}

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
const MANUAL_UNITS = ['g', 'ml', 'piece', 'cup', 'tbsp', 'oz', 'scoop']

const todayKey = new Date().toISOString().slice(0, 10)

const todayLabel = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day:   'numeric',
  weekday: 'long',
}).format(new Date())

function dateKey(iso: string) {
  return iso.slice(0, 10)
}

function shortWeekday(dateStr: string) {
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(new Date(dateStr + 'T12:00:00'))
}

function numberFromForm(value: FormDataEntryValue | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

type ActiveMethod = 'photo' | 'barcode' | 'search' | 'manual' | null

function App() {
  const [entries, setEntries]               = useState<LogEntry[]>(loadEntries)
  const [favorites, setFavorites]           = useState<string[]>(loadFavorites)
  const [activeMeal, setActiveMeal]         = useState<MealType>('lunch')
  const [activeMethod, setActiveMethod]     = useState<ActiveMethod>(null)
  const [pendingFood, setPendingFood]       = useState<PendingFood | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editingEntry, setEditingEntry]     = useState<LogEntry | null>(null)
  const [barcode, setBarcode]               = useState('')
  const [status, setStatus]                 = useState('')
  const [previewImage, setPreviewImage]     = useState('')
  const [cameraOn, setCameraOn]             = useState(false)
  const [isScanning, setIsScanning]         = useState(false)
  const [isAnalyzing, setIsAnalyzing]       = useState(false)
  const [foodQuery, setFoodQuery]           = useState('')
  const [foodResults, setFoodResults]       = useState<FoodResult[]>([])
  const [isSearching, setIsSearching]       = useState(false)
  const [showResults, setShowResults]       = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef       = useRef<HTMLVideoElement | null>(null)
  const streamRef      = useRef<MediaStream | null>(null)
  const formRef        = useRef<HTMLFormElement | null>(null)

  useEffect(() => { saveEntries(entries) }, [entries])
  useEffect(() => { saveFavorites(favorites) }, [favorites])

  useEffect(() => {
    return () => {
      stopCamera()
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  // ── USDA search ──────────────────────────────────────────────
  const searchFood = useCallback(async (query: string) => {
    const q = query.trim()
    if (!q) { setFoodResults([]); setShowResults(false); return }
    setIsSearching(true)
    setShowResults(true)
    try {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&pageSize=8&dataType=Survey%20(FNDDS),SR%20Legacy,Branded&api_key=${USDA_API_KEY}`
      const res  = await fetch(url)
      const data = await res.json() as { foods?: Array<{ fdcId: number; description: string; brandOwner?: string; servingSize?: number; servingSizeUnit?: string; foodNutrients: Array<{ nutrientName: string; value: number }> }> }
      const results: FoodResult[] = (data.foods ?? []).map(f => ({
        fdcId:       f.fdcId,
        description: f.description,
        brandOwner:  f.brandOwner,
        servingSize: f.servingSize ? `${f.servingSize}${f.servingSizeUnit ?? 'g'}` : undefined,
        ...parseNutrients(f.foodNutrients),
      }))
      setFoodResults(results)
    } catch {
      setFoodResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  function handleFoodQueryChange(value: string) {
    setFoodQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => void searchFood(value), 400)
  }

  function selectFood(food: FoodResult) {
    const sizeStr = food.servingSize ?? '100g'
    const sizeNum = parseFloat(sizeStr) || 100
    setPendingFood({
      name:        food.description,
      brand:       food.brandOwner,
      source:      'usda',
      calories:    food.calories,
      protein:     food.protein,
      carbs:       food.carbs,
      fat:         food.fat,
      servingSize: sizeNum,
      servingUnit: sizeStr.replace(/[\d.]+\s*/, '') || 'g',
    })
    setFoodQuery('')
    setFoodResults([])
    setShowResults(false)
  }

  // ── Derived data ─────────────────────────────────────────────
  const entriesByDate = useMemo(() => {
    const map = new Map<string, LogEntry[]>()
    for (const entry of entries) {
      const d = dateKey(entry.createdAt)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(entry)
    }
    return map
  }, [entries])

  const todayEntries = useMemo(() => entriesByDate.get(todayKey) ?? [], [entriesByDate])

  const todayByMeal = useMemo(() => {
    const map: Partial<Record<MealType, LogEntry[]>> = {}
    for (const entry of todayEntries) {
      if (!map[entry.meal]) map[entry.meal] = []
      map[entry.meal]!.push(entry)
    }
    return MEAL_ORDER.filter(m => (map[m]?.length ?? 0) > 0).map(m => {
      const mealEntries = map[m]!
      return {
        meal: m,
        entries: mealEntries,
        subtotal: mealEntries.reduce(
          (s, e) => ({ calories: s.calories + e.calories, protein: s.protein + e.protein, carbs: s.carbs + e.carbs, fat: s.fat + e.fat }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        ),
      }
    })
  }, [todayEntries])

  const last7Days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  }), [])

  const totals = useMemo(
    () => todayEntries.reduce(
      (sum, item) => ({
        calories: sum.calories + item.calories,
        protein:  sum.protein  + item.protein,
        carbs:    sum.carbs    + item.carbs,
        fat:      sum.fat      + item.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    ),
    [todayEntries],
  )

  const recentFoods = useMemo(() => {
    const seen   = new Set<string>()
    const result: LogEntry[] = []
    const favSet = new Set(favorites)
    const sorted = [...entries].sort((a, b) => {
      const aFav = favSet.has(a.name) ? 0 : 1
      const bFav = favSet.has(b.name) ? 0 : 1
      return aFav - bFav
    })
    for (const entry of sorted) {
      const key = entry.name.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        result.push(entry)
        if (result.length >= 8) break
      }
    }
    return result
  }, [entries, favorites])

  function toggleFavorite(name: string) {
    setFavorites(prev => prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name])
  }

  function quickAdd(entry: LogEntry) {
    addEntry({
      name:     entry.name,
      meal:     activeMeal,
      calories: entry.calories,
      protein:  entry.protein,
      carbs:    entry.carbs,
      fat:      entry.fat,
      amount:   entry.amount,
      source:   entry.source,
      image:    entry.image,
    })
  }

  const calorieGoal = 2100
  const progress    = Math.min(100, Math.round((totals.calories / calorieGoal) * 100))

  const streakInfo = useMemo(() => {
    let hitDays = 0
    let streak  = 0
    let inStreak = true
    for (const date of [...last7Days].reverse()) {
      const dayCals = (entriesByDate.get(date) ?? []).reduce((s, e) => s + e.calories, 0)
      const hit = dayCals >= calorieGoal * 0.85 && dayCals <= calorieGoal * 1.2
      if (hit) { hitDays++ }
      if (date !== todayKey) {
        if (hit && inStreak) { streak++ } else { inStreak = false }
      }
    }
    return { hitDays, streak }
  }, [entriesByDate, last7Days])

  // ── Entry CRUD ───────────────────────────────────────────────
  function addEntry(entry: Omit<LogEntry, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString()
    setEntries(current => [
      { ...entry, id: crypto.randomUUID(), createdAt: now, updatedAt: now },
      ...current,
    ])
  }

  function removeEntry(id: string) {
    setEntries(current => current.filter(entry => entry.id !== id))
    setConfirmDeleteId(null)
  }

  function startEdit(entry: LogEntry) {
    setPendingFood(null)
    setEditingEntry(entry)
    setActiveMeal(entry.meal)
  }

  function cancelEdit() {
    setEditingEntry(null)
    setPendingFood(null)
    setStatus('')
    formRef.current?.reset()
  }

  function handleConfirmFood(entry: LogEntry) {
    if (editingEntry) {
      setEntries(prev => prev.map(e => e.id === editingEntry.id ? entry : e))
      setEditingEntry(null)
    } else {
      setEntries(prev => [entry, ...prev])
      setPendingFood(null)
      setPreviewImage('')
    }
    setActiveMethod(null)
    setStatus('')
  }

  // ── Manual form submit ────────────────────────────────────────
  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    if (!name) return

    const servingSize = parseFloat(String(form.get('servingSize') || '100')) || 100
    const servingUnit = String(form.get('servingUnit') || 'g')
    const brand       = String(form.get('brand') || '').trim() || undefined

    setPendingFood({
      name,
      brand,
      source:      'manual',
      calories:    numberFromForm(form.get('calories')),
      protein:     numberFromForm(form.get('protein')),
      carbs:       numberFromForm(form.get('carbs')),
      fat:         numberFromForm(form.get('fat')),
      servingSize,
      servingUnit,
    })
    event.currentTarget.reset()
  }

  // ── Barcode lookup ───────────────────────────────────────────
  async function lookupBarcode(code = barcode.trim()) {
    if (!code) { setStatus('请输入或扫描一个条码'); return }
    setStatus(`正在查询 ${code} …`)
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json` +
        `?fields=product_name,brands,nutriments,serving_size,image_front_url`,
      )
      const data = await response.json()
      if (!data.product) {
        setStatus('没有找到这个条码。你可以手动输入营养信息。')
        return
      }
      const product    = data.product
      const nutriments = product.nutriments ?? {}
      const name       = [product.brands, product.product_name].filter(Boolean).join(' ') || `Barcode ${code}`
      const servingStr: string = product.serving_size || '100g'
      const servingNum = parseFloat(servingStr) || 1
      setPendingFood({
        name,
        brand:       product.brands || undefined,
        source:      'openfoodfacts',
        calories:    Math.round(Number(nutriments['energy-kcal_serving']) || Number(nutriments['energy-kcal_100g']) || 0),
        protein:     Math.round(Number(nutriments.proteins_serving)       || Number(nutriments.proteins_100g)       || 0),
        carbs:       Math.round(Number(nutriments.carbohydrates_serving)  || Number(nutriments.carbohydrates_100g)  || 0),
        fat:         Math.round(Number(nutriments.fat_serving)            || Number(nutriments.fat_100g)            || 0),
        servingSize: servingNum,
        servingUnit: servingStr.replace(/[\d.]+\s*/, '') || 'g',
        image:       product.image_front_url || undefined,
        barcode:     code,
      })
      setBarcode('')
      setStatus('')
    } catch {
      setStatus('查询失败，网络或接口暂时不可用')
    }
  }

  // ── AI photo analysis ────────────────────────────────────────
  async function analyzeImageWithAI(file: File) {
    setIsAnalyzing(true)
    setStatus('正在估算食物和营养...')
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => { resolve((reader.result as string).split(',')[1]) }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const mediaType = file.type || 'image/jpeg'
      const response  = await fetch('/api/analyze-food', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageBase64: base64, mediaType }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const estimate = await response.json() as AiEstimate
      setPendingFood({
        name:        estimate.name,
        source:      'photo',
        calories:    estimate.calories,
        protein:     estimate.protein,
        carbs:       estimate.carbs,
        fat:         estimate.fat,
        servingSize: parseFloat(estimate.amount) || 1,
        servingUnit: estimate.amount.replace(/[\d.]+\s*/, '') || 'g',
        image:       previewImage || undefined,
      })
      setStatus('')
    } catch {
      setStatus('暂时无法识别这张图片。你可以换一张照片，或者改用手动输入。')
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function scanImage(file: File) {
    const imageUrl = URL.createObjectURL(file)
    setPreviewImage(imageUrl)
    let foundBarcode = false
    if (window.BarcodeDetector) {
      const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'] })
      const image = new Image()
      image.src = imageUrl
      await image.decode()
      const codes = await detector.detect(image)
      if (codes[0]?.rawValue) {
        foundBarcode = true
        setBarcode(codes[0].rawValue)
        await lookupBarcode(codes[0].rawValue)
      }
    }
    if (!foundBarcode) { await analyzeImageWithAI(file) }
  }

  // ── Camera ───────────────────────────────────────────────────
  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus('当前浏览器不支持相机访问'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
      setStatus('相机已打开，把条码放进取景框')
    } catch {
      setStatus('无法打开相机，请检查浏览器权限')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  async function scanCameraFrame() {
    if (!videoRef.current || !window.BarcodeDetector) {
      setStatus('这个浏览器不支持实时扫码，可在下方手动输入条码')
      return
    }
    setIsScanning(true)
    try {
      const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'] })
      const codes    = await detector.detect(videoRef.current)
      if (codes[0]?.rawValue) {
        setBarcode(codes[0].rawValue)
        stopCamera()
        await lookupBarcode(codes[0].rawValue)
      } else {
        setStatus('这一帧没扫到，靠近一点再试')
      }
    } finally {
      setIsScanning(false)
    }
  }

  function switchMethod(method: ActiveMethod) {
    stopCamera()
    setPreviewImage('')
    setStatus('')
    setActiveMethod(method)
  }

  // ── Macro ratios ─────────────────────────────────────────────
  const proteinKcal    = totals.protein * 4
  const carbsKcal      = totals.carbs * 4
  const fatKcal        = totals.fat * 9
  const macroKcalTotal = proteinKcal + carbsKcal + fatKcal || 1
  const macroRatio     = {
    protein: Math.round(proteinKcal / macroKcalTotal * 100),
    carbs:   Math.round(carbsKcal   / macroKcalTotal * 100),
    fat:     Math.round(fatKcal     / macroKcalTotal * 100),
  }

  const hasTrendData = last7Days.some(d => (entriesByDate.get(d) ?? []).length > 0)

  // ── Render ───────────────────────────────────────────────────
  return (
    <main className="app-shell">

      {/* ── Dark summary band ── */}
      <section className="summary-band" aria-label="今日热量总览">
        <div className="summary-copy">
          <div className="brand-row">
            <span className="brand-mark">
              <Salad size={16} aria-hidden="true" />
            </span>
            Calorie Snap
          </div>
          <p className="summary-page-label">今天的记录</p>
          <p className="brand-date">{todayLabel}</p>
        </div>

        <div className="energy-panel" aria-label="今日摄入">
          {todayEntries.length === 0 ? (
            <>
              <p className="energy-empty-title">今天还没有记录</p>
              <p className="energy-empty-sub">先添加一餐，热量和营养会在这里更新。</p>
              <p className="energy-goal-compact">目标 {calorieGoal} kcal</p>
            </>
          ) : (
            <>
              <span className="panel-label">今日热量</span>
              <div className="energy-top">
                <span className="energy-number">{totals.calories}</span>
                <span className="energy-unit">kcal</span>
              </div>
              <p className="energy-goal">目标 {calorieGoal} kcal · 剩余 {Math.max(0, calorieGoal - totals.calories)} kcal</p>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              {totals.calories > 0 && (
                <div
                  className="macro-ratio-bar"
                  aria-label="三大营养素热量占比"
                  title={`蛋白 ${macroRatio.protein}% · 碳水 ${macroRatio.carbs}% · 脂肪 ${macroRatio.fat}%`}
                >
                  <div className="ratio-seg ratio-seg--protein" style={{ width: `${macroRatio.protein}%` }} />
                  <div className="ratio-seg ratio-seg--carbs"   style={{ width: `${macroRatio.carbs}%` }} />
                  <div className="ratio-seg ratio-seg--fat"     style={{ width: `${macroRatio.fat}%` }} />
                </div>
              )}
              <p className="energy-macro-line">蛋白 {totals.protein}g · 碳水 {totals.carbs}g · 脂肪 {totals.fat}g</p>
            </>
          )}
        </div>
      </section>

      <section className="workspace">

        {/* ── Left column: input ── */}
        <div className="left-column">

          {/* FoodConfirmation overlays everything when active */}
          {(pendingFood || editingEntry) && (
            pendingFood
              ? <FoodConfirmation
                  mode="create"
                  pendingFood={pendingFood}
                  initialMeal={activeMeal}
                  onConfirm={handleConfirmFood}
                  onCancel={cancelEdit}
                />
              : editingEntry
                ? <FoodConfirmation
                    mode="edit"
                    entry={editingEntry}
                    onConfirm={handleConfirmFood}
                    onCancel={cancelEdit}
                  />
                : null
          )}

          <div className={pendingFood || editingEntry ? 'hidden' : ''}>
            <section className="add-food-section" aria-label="添加食物">

              {/* Title + meal pills */}
              <div className="add-food-header">
                <h2 className="add-food-title">添加食物</h2>
                <div className="meal-pill-row">
                  <span className="meal-pill-label">添加到</span>
                  {MEAL_ORDER.map(m => (
                    <button
                      key={m}
                      type="button"
                      className={`meal-pill${activeMeal === m ? ' meal-pill--active' : ''}`}
                      onClick={() => setActiveMeal(m)}
                    >
                      {mealLabels[m]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick-add strip — always shown when recent foods exist */}
              {recentFoods.length > 0 && (
                <div className="quick-add-strip" aria-label="最近吃过的食物">
                  <div className="quick-add-header">
                    <Clock size={13} aria-hidden="true" />
                    <span>最近吃过，快速添加</span>
                  </div>
                  <div className="quick-add-list">
                    {recentFoods.map(food => {
                      const isFav = favorites.includes(food.name)
                      return (
                        <div className="quick-add-chip" key={`${food.id}-recent`}>
                          <button
                            type="button"
                            className="chip-star"
                            aria-label={isFav ? `取消收藏 ${food.name}` : `收藏 ${food.name}`}
                            onClick={() => toggleFavorite(food.name)}
                          >
                            <Star size={12} fill={isFav ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            type="button"
                            className="chip-body"
                            onClick={() => quickAdd(food)}
                            title={`${food.amount} · ${food.calories} kcal`}
                          >
                            <span className="chip-name">{food.name}</span>
                            <span className="chip-cal">{food.calories} kcal</span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Method cards — always visible; selected card gets --active, others --inactive */}
              <div className="method-cards">
                <button
                  type="button"
                  className={`method-card${activeMethod === 'photo' ? ' method-card--active' : activeMethod !== null ? ' method-card--inactive' : ''}`}
                  onClick={() => switchMethod(activeMethod === 'photo' ? null : 'photo')}
                >
                  <div className="method-card-icon"><Camera size={18} aria-hidden="true" /></div>
                  <div className="method-card-text">
                    <strong>拍照识别</strong>
                    {activeMethod === null && <span>拍一张食物照片，先估算，再由你确认。</span>}
                  </div>
                </button>
                <button
                  type="button"
                  className={`method-card${activeMethod === 'barcode' ? ' method-card--active' : activeMethod !== null ? ' method-card--inactive' : ''}`}
                  onClick={() => switchMethod(activeMethod === 'barcode' ? null : 'barcode')}
                >
                  <div className="method-card-icon"><QrCode size={18} aria-hidden="true" /></div>
                  <div className="method-card-text">
                    <strong>扫条码</strong>
                    {activeMethod === null && <span>适合蛋白粉、牛奶、酸奶、能量棒等包装食品。</span>}
                  </div>
                </button>
                <button
                  type="button"
                  className={`method-card${activeMethod === 'search' ? ' method-card--active' : activeMethod !== null ? ' method-card--inactive' : ''}`}
                  onClick={() => switchMethod(activeMethod === 'search' ? null : 'search')}
                >
                  <div className="method-card-icon"><Search size={18} aria-hidden="true" /></div>
                  <div className="method-card-text">
                    <strong>搜索食物</strong>
                    {activeMethod === null && <span>查找鸡胸肉、米饭、牛奶等常见食物。</span>}
                  </div>
                </button>
                <button
                  type="button"
                  className={`method-card${activeMethod === 'manual' ? ' method-card--active' : activeMethod !== null ? ' method-card--inactive' : ''}`}
                  onClick={() => switchMethod(activeMethod === 'manual' ? null : 'manual')}
                >
                  <div className="method-card-icon"><Pencil size={18} aria-hidden="true" /></div>
                  <div className="method-card-text">
                    <strong>手动输入</strong>
                    {activeMethod === null && <span>适合自制餐、外卖或数据库找不到的食物。</span>}
                  </div>
                </button>
              </div>

              {/* ── Expanded: photo ── */}
              {activeMethod === 'photo' && (
                <div className="method-expanded">
                  <div className="camera-stage">
                    {previewImage ? (
                      <img src={previewImage} alt="食物照片预览" />
                    ) : (
                      <div className="empty-camera">
                        <Utensils size={36} aria-hidden="true" />
                        <span>拖入或选择一张食物照片</span>
                      </div>
                    )}
                  </div>
                  {isAnalyzing && (
                    <div className="ai-banner ai-banner--loading">
                      <Sparkles size={15} aria-hidden="true" />
                      <span>正在估算食物和营养...</span>
                    </div>
                  )}
                  {!isAnalyzing && status && <p className="panel-status">{status}</p>}
                  <label className="file-action file-action--full">
                    <ImagePlus size={16} aria-hidden="true" />
                    上传照片
                    <input
                      accept="image/*"
                      type="file"
                      onChange={event => {
                        const file = event.target.files?.[0]
                        if (file) void scanImage(file)
                      }}
                    />
                  </label>
                </div>
              )}

              {/* ── Expanded: barcode ── */}
              {activeMethod === 'barcode' && (
                <div className="method-expanded">
                  {cameraOn && (
                    <div className="camera-stage">
                      <video ref={videoRef} playsInline muted aria-label="扫码相机画面" />
                    </div>
                  )}
                  <div className="action-grid">
                    <button type="button" onClick={cameraOn ? scanCameraFrame : startCamera}>
                      <QrCode size={16} aria-hidden="true" />
                      {cameraOn ? (isScanning ? '扫描中…' : '扫当前画面') : '打开相机扫码'}
                    </button>
                    {cameraOn && (
                      <button className="secondary" onClick={stopCamera} type="button">关闭相机</button>
                    )}
                  </div>
                  <div className="barcode-row">
                    <Search size={16} aria-hidden="true" />
                    <input
                      aria-label="输入条码或二维码内容"
                      onChange={event => setBarcode(event.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void lookupBarcode() } }}
                      placeholder="输入条码，例如 737628064502"
                      value={barcode}
                    />
                    <button onClick={() => void lookupBarcode()} type="button">查询</button>
                  </div>
                  {status && <p className="panel-status">{status}</p>}
                </div>
              )}

              {/* ── Expanded: USDA search ── */}
              {activeMethod === 'search' && (
                <div className="method-expanded">
                  <div className="food-search-wrap">
                    <div className="food-search-row">
                      {isSearching
                        ? <Loader2 size={16} className="spin" aria-hidden="true" />
                        : <Search size={16} aria-hidden="true" />
                      }
                      <input
                        type="text"
                        className="food-search-input"
                        placeholder="搜索鸡胸肉、米饭、牛奶、香蕉..."
                        value={foodQuery}
                        onChange={e => handleFoodQueryChange(e.target.value)}
                        onFocus={() => foodResults.length > 0 && setShowResults(true)}
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                    {isSearching && (
                      <p className="panel-status" style={{ padding: '8px 12px' }}>正在搜索食物数据库...</p>
                    )}
                    {!isSearching && foodQuery.trim() && foodResults.length === 0 && showResults && (
                      <p className="panel-status" style={{ padding: '8px 12px' }}>
                        没有找到相关食物。试试更简单的关键词，或者手动输入。
                      </p>
                    )}
                    {showResults && foodResults.length > 0 && (
                      <ul className="food-results" role="listbox">
                        {foodResults.map(food => (
                          <li
                            key={food.fdcId}
                            role="option"
                            aria-selected="false"
                            className="food-result-item"
                            onMouseDown={() => selectFood(food)}
                          >
                            <div className="food-result-name">
                              {food.description}
                              {food.brandOwner && <span className="food-result-brand"> · {food.brandOwner}</span>}
                            </div>
                            <div className="food-result-macros">
                              {food.calories} kcal · P {food.protein}g · C {food.carbs}g · F {food.fat}g
                              {food.servingSize && <span> · {food.servingSize}</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* ── Expanded: manual input ── */}
              {activeMethod === 'manual' && (
                <div className="method-expanded">
                  <form className="manual-fields" onSubmit={handleManualSubmit} ref={formRef}>
                    <label>
                      食物名称 *
                      <input name="name" required placeholder="例如：鸡胸肉、牛肉饭、蛋白粉" />
                    </label>
                    <label>
                      品牌（可选）
                      <input name="brand" placeholder="可选，例如 MyProtein、星巴克" />
                    </label>
                    <div className="fc-row fc-row--serving">
                      <label>
                        每份量
                        <input name="servingSize" type="number" min="0.1" step="0.1" defaultValue={100} />
                      </label>
                      <label>
                        单位
                        <select name="servingUnit" defaultValue="g">
                          {MANUAL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="form-grid">
                      <label>热量 kcal <input name="calories" type="number" min="0" placeholder="0" inputMode="numeric" /></label>
                      <label>蛋白质 g <input name="protein" type="number" min="0" step="0.1" placeholder="0" inputMode="numeric" /></label>
                      <label>碳水 g <input name="carbs" type="number" min="0" step="0.1" placeholder="0" inputMode="numeric" /></label>
                      <label>脂肪 g <input name="fat" type="number" min="0" step="0.1" placeholder="0" inputMode="numeric" /></label>
                    </div>
                    <button className="primary-submit" type="submit">
                      <CheckCircle2 size={17} aria-hidden="true" />
                      下一步：确认食物
                    </button>
                  </form>
                </div>
              )}

            </section>
          </div>{/* end toggle-hidden wrapper */}
        </div>

        {/* ── Right column: feedback ── */}
        <aside className="right-column">
          <section className="insight-strip">
            <div>
              <Flame size={16} aria-hidden="true" />
              <span>剩余 {Math.max(0, calorieGoal - totals.calories)} kcal</span>
            </div>
            <div>
              <BarChart3 size={16} aria-hidden="true" />
              <span>{streakInfo.hitDays}/7 天达标</span>
            </div>
          </section>

          <section className="trends-panel" aria-label="近7天热量趋势">
            <div className="section-title">
              <div className="section-icon"><BarChart3 size={18} aria-hidden="true" /></div>
              <div>
                <h2>近7天趋势</h2>
                <p>连续达标 {streakInfo.streak} 天 · 本周 {streakInfo.hitDays}/7 天</p>
              </div>
            </div>
            {hasTrendData ? (
              <div className="trends-chart" aria-hidden="true">
                {last7Days.map(date => {
                  const dayCals = (entriesByDate.get(date) ?? []).reduce((s, e) => s + e.calories, 0)
                  const pct     = Math.min(100, Math.round((dayCals / calorieGoal) * 100))
                  const isToday = date === todayKey
                  const hit     = dayCals > 0 && dayCals >= calorieGoal * 0.85 && dayCals <= calorieGoal * 1.2
                  const over    = dayCals > calorieGoal * 1.2
                  return (
                    <div className="trend-col" key={date}>
                      <div className="trend-bar-wrap" title={dayCals > 0 ? `${dayCals} kcal` : '无记录'}>
                        <div
                          className={`trend-bar${hit ? ' trend-bar--hit' : over ? ' trend-bar--over' : ''}`}
                          style={{ height: `${Math.max(pct, dayCals > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className={`trend-label${isToday ? ' trend-label--today' : ''}`}>
                        {isToday ? '今' : shortWeekday(date)}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="empty-list">记录几天后，这里会显示你的摄入趋势。</p>
            )}
          </section>

          <section className="history-panel">
            <div className="section-title">
              <div className="section-icon"><Apple size={18} aria-hidden="true" /></div>
              <div>
                <h2>今天的食物</h2>
                <p>{todayEntries.length > 0 ? `${todayEntries.length} 条记录` : '还没有记录'}</p>
              </div>
            </div>

            <div className="entry-list">
              {todayByMeal.length === 0 && (
                <p className="empty-list">今天还没有记录。先添加一餐，热量和营养会在这里更新。</p>
              )}
              {todayByMeal.map(({ meal, entries: mealEntries, subtotal }) => (
                <div className="meal-group" key={meal}>
                  <div className="meal-group-header">
                    <span className={`meal-group-label meal-badge--${meal}`}>{mealLabels[meal]}</span>
                    <span className="meal-group-subtotal">
                      <strong>{subtotal.calories}</strong> kcal
                      <span className="meal-group-macros"> · P {subtotal.protein}g · C {subtotal.carbs}g · F {subtotal.fat}g</span>
                    </span>
                  </div>
                  {mealEntries.map(entry => (
                    <article
                      className={`entry-card${editingEntry?.id === entry.id ? ' entry-card--editing' : ''}`}
                      key={entry.id}
                    >
                      {entry.image
                        ? <img src={entry.image} alt="" />
                        : <div className="food-icon"><Utensils size={20} /></div>
                      }
                      <div className="entry-copy">
                        <h3>{entry.name}</h3>
                        <div className="entry-meta">
                          <span className="entry-amount">
                            {entry.servingSize && entry.servingUnit
                              ? `${entry.quantity && entry.quantity !== 1 ? `${entry.quantity} × ` : ''}${entry.servingSize}${entry.servingUnit}`
                              : entry.amount}
                          </span>
                        </div>
                        <p className="entry-nutrition">
                          <strong>{entry.calories}</strong> kcal &nbsp;·&nbsp; P {entry.protein}g &nbsp;·&nbsp; C {entry.carbs}g &nbsp;·&nbsp; F {entry.fat}g
                        </p>
                      </div>
                      <div className="entry-actions">
                        <button
                          aria-label={`编辑 ${entry.name}`}
                          className="icon-button icon-button--edit"
                          onClick={() => startEdit(entry)}
                          type="button"
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        {confirmDeleteId === entry.id ? (
                          <div className="delete-confirm">
                            <button className="confirm-yes" onClick={() => removeEntry(entry.id)} type="button">删除</button>
                            <button className="confirm-no" onClick={() => setConfirmDeleteId(null)} type="button">取消</button>
                          </div>
                        ) : (
                          <button
                            aria-label={`删除 ${entry.name}`}
                            className="icon-button"
                            onClick={() => setConfirmDeleteId(entry.id)}
                            type="button"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </aside>

      </section>
    </main>
  )
}

export default App
