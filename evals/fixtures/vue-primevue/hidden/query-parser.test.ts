// N1: parseOrderQuery(query: string) in src/utils/orderQuery.ts returns { status?, minTotal?, maxTotal?,
// terms } where minTotal/maxTotal are { value, inclusive }. Only the contract the prompt states is
// asserted: the example, the four comparison operators, both bounds, free-text terms, an empty query,
// and that a word that is not an order status never becomes `status`.
import { beforeAll, describe, expect, it } from 'vitest'

type Bound = { value: number; inclusive: boolean }
type Parsed = { status?: string; minTotal?: Bound; maxTotal?: Bound; terms: string[] }

// Imported lazily so a missing module fails each case rather than the whole file (stable case count).
let parse: (query: string) => Parsed
beforeAll(async () => {
  try {
    const file = '../utils/orderQuery'
    const module = (await import(/* @vite-ignore */ file)) as Record<string, unknown>
    parse = (module.parseOrderQuery ?? module.default) as typeof parse
  } catch {
    parse = undefined as unknown as typeof parse
  }
})

describe('N1 parseOrderQuery', () => {
  it('is exported from src/utils/orderQuery.ts', () => {
    expect(typeof parse).toBe('function')
  })

  it("parses the prompt's example", () => {
    const result = parse('status:paid total>100 northwind')
    expect(result.status).toBe('paid')
    expect(result.minTotal).toEqual({ value: 100, inclusive: false })
    expect(result.maxTotal).toBeUndefined()
    expect(result.terms).toEqual(['northwind'])
  })

  it('distinguishes > from >= and < from <=', () => {
    expect(parse('total>=100').minTotal).toEqual({ value: 100, inclusive: true })
    expect(parse('total<50').maxTotal).toEqual({ value: 50, inclusive: false })
    expect(parse('total<=50').maxTotal).toEqual({ value: 50, inclusive: true })
    expect(parse('total<50').minTotal).toBeUndefined()
    expect(parse('total>=100').maxTotal).toBeUndefined()
  })

  it('keeps both bounds and decimal amounts', () => {
    const result = parse('total>100 total<=500.5')
    expect(result.minTotal).toEqual({ value: 100, inclusive: false })
    expect(result.maxTotal).toEqual({ value: 500.5, inclusive: true })
    expect(result.terms).toEqual([])
    expect(parse('total>12.5').minTotal).toEqual({ value: 12.5, inclusive: false })
  })

  it('collects every free-text word in order', () => {
    const result = parse('  northwind   globex status:shipped hooli ')
    expect(result.terms).toEqual(['northwind', 'globex', 'hooli'])
    expect(result.status).toBe('shipped')
    expect(result.minTotal).toBeUndefined()
  })

  it('returns an empty filter for an empty or blank query', () => {
    for (const query of ['', '   ']) {
      const result = parse(query)
      expect(result.terms).toEqual([])
      expect(result.status).toBeUndefined()
      expect(result.minTotal).toBeUndefined()
      expect(result.maxTotal).toBeUndefined()
    }
  })

  it('accepts each order status and never sets an unknown one', () => {
    for (const status of ['pending', 'paid', 'shipped', 'refunded']) expect(parse(`status:${status}`).status).toBe(status)
    expect(parse('status:bogus').status).toBeUndefined()
  })
})
