const DEFAULT_ANALYSTS = ['market', 'social', 'news', 'fundamentals', 'macro', 'smart_money']
const DEFAULT_PROMPT = ''

const ANALYSTS_KEY = 'analysis-default-analysts'
const PROMPT_KEY = 'analysis-custom-prompt'

function readStringArray(key: string, fallback: string[]): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return fallback
    return parsed.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
  } catch {
    return fallback
  }
}

function writeStringArray(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage failures in private mode
  }
}

function readString(key: string, fallback: string): string {
  try {
    return (localStorage.getItem(key) || fallback).trim()
  } catch {
    return fallback
  }
}

function writeString(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore storage failures in private mode
  }
}

export function getDefaultAnalysisAnalysts(): string[] {
  return readStringArray(ANALYSTS_KEY, DEFAULT_ANALYSTS)
}

export function setDefaultAnalysisAnalysts(value: string[]) {
  writeStringArray(ANALYSTS_KEY, value)
}

export function getCustomAnalysisPrompt(): string {
  return readString(PROMPT_KEY, DEFAULT_PROMPT)
}

export function setCustomAnalysisPrompt(value: string) {
  writeString(PROMPT_KEY, value.trim())
}
