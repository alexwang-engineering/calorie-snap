import express from 'express'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env from project root if present
try {
  const envPath = resolve(__dirname, '..', '.env')
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
} catch {
  // .env is optional
}

const app = express()
app.use(express.json({ limit: '10mb' }))

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

const PORT = 5174
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Calorie Snap proxy running at http://127.0.0.1:${PORT}`)
})
