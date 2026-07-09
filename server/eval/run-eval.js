import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseMeal, PROMPT_V1_BASELINE, PROMPT_V2_PORTION_GUIDANCE } from '../mealParser.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env from project root if present (same loader as server/proxy.mjs)
try {
  const envPath = path.resolve(__dirname, '..', '..', '.env')
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
} catch {
  // .env is optional
}

const testCases = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-cases.json'), 'utf-8'))

const VARIANTS = [
  { label: 'v1_baseline', prompt: PROMPT_V1_BASELINE },
  { label: 'v2_portion_guidance', prompt: PROMPT_V2_PORTION_GUIDANCE },
]

function sumCalories(items) {
  return items.reduce((total, item) => total + (Number(item.calories) || 0), 0)
}

function midpoint([min, max]) {
  return (min + max) / 2
}

async function runVariant(variant) {
  const rows = []

  for (const testCase of testCases) {
    const { input, expected_calories_range, expected_item_count } = testCase
    const row = { input, expected_calories_range }

    try {
      const result = await parseMeal(input, variant.prompt)
      const items = result.items || []
      const actualCalories = sumCalories(items)
      const [min, max] = expected_calories_range
      const withinRange = actualCalories >= min && actualCalories <= max
      const percentError =
        (Math.abs(actualCalories - midpoint(expected_calories_range)) / midpoint(expected_calories_range)) * 100

      row.actual_calories = Math.round(actualCalories)
      row.item_count = items.length
      row.expected_item_count = expected_item_count
      row.pass = withinRange
      row.percent_error = Math.round(percentError * 10) / 10
    } catch (err) {
      row.error = err.message
      row.pass = false
    }

    rows.push(row)
    // Small delay to be polite to the Open Food Facts API across many calls.
    await new Promise(r => setTimeout(r, 300))
  }

  return rows
}

function printReport(label, rows) {
  console.log(`\n=== ${label} ===`)
  for (const row of rows) {
    if (row.error) {
      console.log(`✗ ERROR  | "${row.input}" → ${row.error}`)
      continue
    }
    const mark = row.pass ? '✓ PASS' : '✗ FAIL'
    console.log(
      `${mark} | "${row.input}"\n` +
        `        expected ${row.expected_calories_range[0]}-${row.expected_calories_range[1]} kcal, ` +
        `got ${row.actual_calories} kcal (${row.percent_error}% off midpoint), ` +
        `${row.item_count}/${row.expected_item_count} items`,
    )
  }

  const scored = rows.filter(r => !r.error)
  const passRate = (scored.filter(r => r.pass).length / rows.length) * 100
  const meanError = scored.reduce((sum, r) => sum + r.percent_error, 0) / (scored.length || 1)

  console.log(`\n${label} summary: ${passRate.toFixed(0)}% pass rate, ${meanError.toFixed(1)}% mean error`)
  return { label, passRate, meanError }
}

async function main() {
  const summaries = []
  for (const variant of VARIANTS) {
    const rows = await runVariant(variant)
    summaries.push(printReport(variant.label, rows))
  }

  console.log('\n=== Comparison ===')
  console.table(summaries)

  const best = [...summaries].sort((a, b) => b.passRate - a.passRate || a.meanError - b.meanError)[0]
  console.log(`\nBest performing prompt: ${best.label}`)
}

main().catch(err => {
  console.error('Eval run failed:', err)
  process.exit(1)
})
