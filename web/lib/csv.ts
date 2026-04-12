import Papa from 'papaparse'
import type { ParsedCsv } from './types'

export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    let rowCount = 0
    let headers: string[] = []

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      step(results) {
        if (rowCount === 0) {
          headers = results.meta.fields ?? []
          if (headers.length === 0) {
            reject(new Error('CSV has no headers'))
          }
        }
        rowCount++
      },
      complete() {
        if (rowCount === 0) {
          reject(new Error('CSV is empty'))
          return
        }
        resolve({ headers, rowCount, file })
      },
      error(err) {
        reject(new Error(err.message))
      },
    })
  })
}

export function getUniqueColumnValues(file: File, column: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const values = new Set<string>()

    Papa.parse(file, {
      header: true,
      preview: 2000,
      skipEmptyLines: true,
      step(results) {
        const row = results.data as Record<string, string>
        if (row[column] != null) values.add(String(row[column]))
      },
      complete() {
        resolve([...values].sort())
      },
      error(err) {
        reject(new Error(err.message))
      },
    })
  })
}
