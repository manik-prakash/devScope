import { describe, it, expect } from 'vitest'
import { safeInternalPath, roleLabel, paginate } from '../utils'

describe('paginate', () => {
  const items = Array.from({ length: 45 }, (_, i) => i) // 0..44

  it('slices the requested page (pageSize 20)', () => {
    const { totalPages, safePage, visible } = paginate(items, 2, 20)
    expect(totalPages).toBe(3)
    expect(safePage).toBe(2)
    expect(visible).toEqual(items.slice(20, 40))
  })

  it('clamps a page past the end to the last page and returns its slice', () => {
    const { safePage, visible } = paginate(items, 99, 20)
    expect(safePage).toBe(3)
    expect(visible).toEqual(items.slice(40, 45)) // 5 items
  })

  it('clamps page < 1 to 1', () => {
    expect(paginate(items, 0, 20).safePage).toBe(1)
    expect(paginate(items, -5, 20).safePage).toBe(1)
  })

  it('empty list → 1 page, empty slice', () => {
    expect(paginate([], 1, 20)).toEqual({ totalPages: 1, safePage: 1, visible: [] })
  })
})

describe('roleLabel', () => {
  it('labels every role, not just MANAGER', () => {
    expect(roleLabel('ADMIN')).toBe('Admin')
    expect(roleLabel('MANAGER')).toBe('Manager')
    expect(roleLabel('DEVELOPER')).toBe('Developer')
  })

  it('falls back to Developer for an unknown role', () => {
    expect(roleLabel('SOMETHING')).toBe('Developer')
    expect(roleLabel(undefined)).toBe('Developer')
  })
})

describe('safeInternalPath', () => {
  it('passes through a same-origin path', () => {
    expect(safeInternalPath('/dashboard/team/123?tab=x')).toBe('/dashboard/team/123?tab=x')
  })

  it('rejects a protocol-relative URL', () => {
    expect(safeInternalPath('//evil.com')).toBeNull()
  })

  it('rejects a backslash-prefixed path (parsed as //evil.com by browsers)', () => {
    expect(safeInternalPath('/\\evil.com')).toBeNull()
  })

  it('rejects an absolute URL', () => {
    expect(safeInternalPath('https://evil.com')).toBeNull()
  })

  it('rejects a non-slash path and null/empty', () => {
    expect(safeInternalPath('dashboard')).toBeNull()
    expect(safeInternalPath(null)).toBeNull()
    expect(safeInternalPath('')).toBeNull()
  })
})
