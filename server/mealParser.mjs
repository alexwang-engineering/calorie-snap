import Anthropic from '@anthropic-ai/sdk'

// Constructed lazily: proxy.mjs loads .env *after* its imports are evaluated,
// so a module-level `new Anthropic()` here would miss ANTHROPIC_API_KEY.
let anthropic = null
function getClient() {
  anthropic ??= new Anthropic()
  return anthropic
}

// ── Tool definition Claude will be told about ────────────────
const tools = [
  {
    name: 'lookup_food',
    description:
      "Look up a packaged or common food item's nutrition facts (per 100g) using the Open Food Facts database. Use this once per distinct food item mentioned by the user.",
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: "The food name to search for, e.g. 'chicken sandwich' or 'white toast'.",
        },
      },
      required: ['query'],
    },
  },
]

// ── The actual tool implementation (real API call) ───────────
async function lookupFood(query) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
    query,
  )}&search_simple=1&action=process&json=1&page_size=1`

  const res = await fetch(url, { headers: { 'User-Agent': 'CalorieSnap-MealParser/1.0' } })
  if (!res.ok) {
    return { found: false, query, error: `Open Food Facts request failed (${res.status})` }
  }
  const data = await res.json()
  const product = data.products?.[0]

  if (!product) {
    return { found: false, query, note: 'No match found; estimate from general knowledge instead.' }
  }

  const n = product.nutriments || {}
  return {
    found: true,
    query,
    product_name: product.product_name || query,
    per_100g: {
      calories_kcal: n['energy-kcal_100g'] ?? null,
      protein_g: n['proteins_100g'] ?? null,
      carbs_g: n['carbohydrates_100g'] ?? null,
      fat_g: n['fat_100g'] ?? null,
    },
  }
}

export const PROMPT_V1_BASELINE = `You are a nutrition-logging assistant for the Calorie Snap app.
The user will describe what they ate in plain language. Your job:

1. Identify each distinct food item and its approximate quantity/portion.
2. For each item, call the lookup_food tool to get real nutrition data.
3. Once you have data for every item, respond with ONLY a JSON object (no prose,
   no markdown fences) matching exactly this shape:

{
  "items": [
    {
      "name": string,
      "quantity_description": string,   // e.g. "2 slices", "1 medium"
      "estimated_grams": number,
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "source": "open_food_facts" | "estimated"
    }
  ]
}

If lookup_food returns found: false, or returns a product that clearly doesn't
match the query, estimate reasonable values yourself and set source to
"estimated". Scale per-100g values to the estimated portion size.
Do not include any text outside the JSON object in your final reply. Never
explain your reasoning or comment on lookup quality — even when lookups fail,
reply with the JSON object only.`

export const PROMPT_V2_PORTION_GUIDANCE = `You are a nutrition-logging assistant for the Calorie Snap app.
The user will describe what they ate in plain language. Your job:

1. Identify each distinct food item mentioned, including implicit ones (e.g. "a
   sandwich" implies bread + filling — call lookup_food separately for each
   component rather than guessing one combined value).
2. Use standard portion-size references when the user doesn't give exact
   weights: 1 slice of bread ≈ 30g, 1 medium egg ≈ 50g, 1 medium banana ≈ 120g,
   1 cup cooked rice ≈ 160g, 1 chicken breast ≈ 170g. Prefer these references
   over rough guessing.
3. For each item, call the lookup_food tool to get real nutrition data, then
   scale the per-100g values to your estimated portion in grams.
4. Respond with ONLY a JSON object (no prose, no markdown fences) matching
   exactly this shape:

{
  "items": [
    {
      "name": string,
      "quantity_description": string,
      "estimated_grams": number,
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "source": "open_food_facts" | "estimated"
    }
  ]
}

If lookup_food returns found: false, estimate values yourself using general
nutrition knowledge and set source to "estimated". Do not include any text
outside the JSON object in your final reply.`

/**
 * Runs the full tool-calling loop for one user meal description.
 * `systemPrompt` defaults to the baseline prompt but can be swapped for
 * eval/comparison purposes (see server/eval/run-eval.js).
 * Returns the parsed { items: [...] } object.
 */
export async function parseMeal(userText, systemPrompt = PROMPT_V1_BASELINE) {
  const messages = [{ role: 'user', content: userText }]

  // Cap iterations so a misbehaving loop can't run forever.
  for (let turn = 0; turn < 6; turn++) {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages,
    })

    if (response.stop_reason === 'tool_use') {
      // Assistant's turn (including tool_use blocks) goes back into history.
      messages.push({ role: 'assistant', content: response.content })

      const toolResults = []
      for (const block of response.content) {
        if (block.type === 'tool_use' && block.name === 'lookup_food') {
          const result = await lookupFood(block.input.query)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }
      }
      messages.push({ role: 'user', content: toolResults })
      continue // loop again so Claude can use the tool results
    }

    // Final answer — extract the text block and parse as JSON.
    const textBlock = response.content.find(b => b.type === 'text')
    const raw = textBlock ? textBlock.text.trim() : '{}'
    const cleaned = raw.replace(/^```json\s*|```$/g, '')

    try {
      return JSON.parse(cleaned)
    } catch {
      // The model occasionally narrates before the JSON when lookups return
      // mismatched products — salvage the object literal instead of failing.
      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1))
        } catch {
          // fall through to the error below
        }
      }
      throw new Error(`Model did not return valid JSON: ${cleaned.slice(0, 200)}`)
    }
  }

  throw new Error('Tool-use loop did not terminate after 6 turns.')
}
