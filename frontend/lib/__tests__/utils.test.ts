import { describe, it, expect } from 'vitest'
import { safeInternalPath, roleLabel } from '../utils'

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
