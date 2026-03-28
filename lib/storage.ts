export function parseStoredArray<T = string>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (typeof value !== 'string' || value.trim() === '') return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

export function parseStoredObject<T extends Record<string, unknown>>(
  value: unknown,
  fallback: T
): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as T
  if (typeof value !== 'string' || value.trim() === '') return fallback

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as T)
      : fallback
  } catch {
    return fallback
  }
}

export function stringifyStoredArray(value: unknown): string {
  return JSON.stringify(Array.isArray(value) ? value : [])
}

export function stringifyStoredObject(value: unknown): string {
  return JSON.stringify(value && typeof value === 'object' && !Array.isArray(value) ? value : {})
}
