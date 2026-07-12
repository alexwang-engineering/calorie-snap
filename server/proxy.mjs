import express from 'express'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parseMeal, PROMPT_V1_BASELINE } from './mealParser.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env — packaged app passes CALORIE_SNAP_ENV_DIR (Application Support);
// dev falls back to the project root.
const envCandidates = [
  process.env.CALORIE_SNAP_ENV_DIR && resolve(process.env.CALORIE_SNAP_ENV_DIR, '.env'),
  resolve(__dirname, '..', '.env'),
].filter(Boolean)
for (const envPath of envCandidates) {
  try {
    const envContent = readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.*)$/)
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
    break
  } catch {
    // try the next candidate
  }
}

const app = express()
app.use(express.json({ limit: '10mb' }))

// LAN mode (npm run proxy:lan): serve the built app + APIs to phones on the
// same network. Default stays loopback-only.
const LAN_MODE = process.env.CALORIE_SNAP_LAN === '1'
if (LAN_MODE) {
  app.use(express.static(resolve(__dirname, '..', 'dist')))
}

// The packaged Electron app calls from a file:// origin; the server is bound
// to 127.0.0.1, so this only exposes it to local processes.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
if (!ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set. Add it to .env or set as environment variable.')
  process.exit(1)
}

app.post('/api/analyze-food', async (req, res) => {
  const { imageBase64, mediaType } = req.body
  if (!imageBase64 || !mediaType) {
    res.status(400).json({ error: 'imageBase64 and mediaType are required' })
    return
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: imageBase64 },
              },
              {
                type: 'text',
                text: 'Look at this food image. Estimate the nutrition for a typical serving. Reply ONLY with a JSON object (no markdown, no explanation): {"name":"...","calories":number,"protein":number,"carbs":number,"fat":number,"amount":"..."}. Use realistic values. If you cannot identify food, use {"name":"Unknown food","calories":0,"protein":0,"carbs":0,"fat":0,"amount":"1 serving"}.',
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      res.status(502).json({ error: `Anthropic API error: ${err}` })
      return
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''
    const nutrition = JSON.parse(text)
    res.json(nutrition)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/parse-meal', async (req, res) => {
  const { text } = req.body
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: "Body must include a 'text' string." })
    return
  }

  try {
    // Eval winner (2026-07-09): v1 100% pass vs v2 75% — see server/eval/run-eval.js
    const parsed = await parseMeal(text, PROMPT_V1_BASELINE)
    res.json(parsed)
  } catch (err) {
    console.error('parseMeal failed:', err)
    res.status(500).json({ error: 'Meal parsing failed. Please try again.' })
  }
})

const PORT = 5174
app.listen(PORT, LAN_MODE ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`Calorie Snap proxy running at http://127.0.0.1:${PORT}`)
})
