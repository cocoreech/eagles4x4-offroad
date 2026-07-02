/** The single greeting-name rule: preferred → full → contact → 'there'. Pure. */
export function resolveGreetingName(input: {
  preferredName?: string | null
  fullName?: string | null
  contactName?: string | null
}): string {
  for (const candidate of [input.preferredName, input.fullName, input.contactName]) {
    const trimmed = candidate?.trim()
    if (trimmed) return trimmed
  }
  return 'there'
}
