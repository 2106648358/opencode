export interface Variable {
  name: string
  description?: string
}

export function extractVariables(text: string): string[] {
  const vars: string[] = []
  const regex = /\{\{(\w+)\}\}/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (!vars.includes(match[1])) vars.push(match[1])
  }
  return vars
}

export function substitute(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    return name in values ? values[name] : `{{${name}}}`
  })
}

export function validateRequired(
  declared: Variable[],
  values: Record<string, string>,
): string[] {
  const missing: string[] = []
  for (const v of declared) {
    if (!values[v.name]?.trim()) missing.push(v.name)
  }
  return missing
}
