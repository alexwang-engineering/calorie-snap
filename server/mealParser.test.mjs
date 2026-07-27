import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

const { parseMeal } = await import('./mealParser.mjs')

function textResponse(obj) {
  return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(obj) }] }
}

function toolUseResponse(query) {
  return {
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', id: 'tool_1', name: 'lookup_food', input: { query } }],
  }
}

describe('parseMeal', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          products: [
            {
              product_name: 'White Toast',
              nutriments: {
                'energy-kcal_100g': 265,
                proteins_100g: 9,
                'carbohydrates_100g': 49,
                fat_100g: 3.2,
              },
            },
          ],
        }),
      })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the parsed JSON object when the model answers directly', async () => {
    mockCreate.mockResolvedValueOnce(textResponse({ items: [{ name: 'Toast', calories: 100 }] }))
    const result = await parseMeal('2 slices of toast')
    expect(result).toEqual({ items: [{ name: 'Toast', calories: 100 }] })
  })

  it('runs the tool-use loop and feeds lookup results back to the model', async () => {
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('white toast'))
      .mockResolvedValueOnce(textResponse({ items: [{ name: 'Toast', calories: 130 }] }))

    const result = await parseMeal('2 slices of toast')

    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ items: [{ name: 'Toast', calories: 130 }] })

    // Second call's message history should include the tool_result fed back in.
    const secondCallArgs = mockCreate.mock.calls[1][0]
    const toolResultMessage = secondCallArgs.messages.find(m =>
      Array.isArray(m.content) && m.content.some(c => c.type === 'tool_result'),
    )
    expect(toolResultMessage).toBeDefined()
    const parsedToolResult = JSON.parse(toolResultMessage.content[0].content)
    expect(parsedToolResult.found).toBe(true)
    expect(parsedToolResult.product_name).toBe('White Toast')
  })

  it('strips markdown code fences from the final JSON reply', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '```json\n{"items":[]}\n```' }],
    })
    const result = await parseMeal('nothing much')
    expect(result).toEqual({ items: [] })
  })

  it('salvages a JSON object even when the model narrates before it', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Here you go: {"items":[{"name":"Egg","calories":70}]} thanks!' }],
    })
    const result = await parseMeal('one egg')
    expect(result).toEqual({ items: [{ name: 'Egg', calories: 70 }] })
  })

  it('throws when the final reply is not valid JSON and cannot be salvaged', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Sorry, I cannot help with that.' }],
    })
    await expect(parseMeal('???')).rejects.toThrow('did not return valid JSON')
  })

  it('throws if the tool-use loop never terminates within 6 turns', async () => {
    mockCreate.mockResolvedValue(toolUseResponse('mystery food'))
    await expect(parseMeal('a strange dish')).rejects.toThrow('did not terminate after 6 turns')
    expect(mockCreate).toHaveBeenCalledTimes(6)
  })

  it('reports found:false to the model when Open Food Facts has no match', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ products: [] }) }))
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('unobtainium bar'))
      .mockResolvedValueOnce(textResponse({ items: [{ name: 'Unobtainium Bar', source: 'estimated' }] }))

    await parseMeal('an unobtainium bar')

    const secondCallArgs = mockCreate.mock.calls[1][0]
    const toolResultMessage = secondCallArgs.messages.find(m =>
      Array.isArray(m.content) && m.content.some(c => c.type === 'tool_result'),
    )
    const parsedToolResult = JSON.parse(toolResultMessage.content[0].content)
    expect(parsedToolResult.found).toBe(false)
  })

  it('reports a lookup error to the model when the Open Food Facts request fails', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 503 }))
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('failing lookup'))
      .mockResolvedValueOnce(textResponse({ items: [] }))

    await parseMeal('something')

    const secondCallArgs = mockCreate.mock.calls[1][0]
    const toolResultMessage = secondCallArgs.messages.find(m =>
      Array.isArray(m.content) && m.content.some(c => c.type === 'tool_result'),
    )
    const parsedToolResult = JSON.parse(toolResultMessage.content[0].content)
    expect(parsedToolResult.found).toBe(false)
    expect(parsedToolResult.error).toContain('503')
  })
})
