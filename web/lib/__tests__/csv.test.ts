import { describe, it, expect } from 'vitest'
import { parseCsvFile, getUniqueColumnValues } from '../csv'

function makeFile(content: string): File {
  return new File([content], 'test.csv', { type: 'text/csv' })
}

describe('parseCsvFile', () => {
  it('returns headers and row count', async () => {
    const file = makeFile('variant,converted\n0,1\n0,0\n1,1\n')
    const result = await parseCsvFile(file)
    expect(result.headers).toEqual(['variant', 'converted'])
    expect(result.rowCount).toBe(3)
    expect(result.file).toBe(file)
  })

  it('rejects on empty file', async () => {
    const file = makeFile('')
    await expect(parseCsvFile(file)).rejects.toThrow()
  })
})

describe('getUniqueColumnValues', () => {
  it('returns sorted unique values for a column', async () => {
    const file = makeFile('variant,converted\n0,1\n1,0\n0,1\n2,0\n')
    const values = await getUniqueColumnValues(file, 'variant')
    expect(values).toEqual(['0', '1', '2'])
  })
})
