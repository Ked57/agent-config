import { describe, expect, it } from 'vitest'
import { formatCurrency, initials } from './format'

describe('formatCurrency', () => {
  it('formats USD by default', () => {
    expect(formatCurrency(1250.5)).toBe('$1,250.50')
  })
})

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Ada  Lovelace King')).toBe('AL')
  })

  it('handles empty input', () => {
    expect(initials('')).toBe('')
  })
})
