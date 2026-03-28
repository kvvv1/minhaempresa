export function parseEnumValue<T extends Record<string, string>>(
  enumObject: T,
  value: string | null | undefined
): T[keyof T] | undefined {
  if (!value) return undefined

  return Object.values(enumObject).includes(value as T[keyof T])
    ? (value as T[keyof T])
    : undefined
}
