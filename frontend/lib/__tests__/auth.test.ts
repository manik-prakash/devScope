import { describe, it, expect } from 'vitest'
import { persistAuthTokens, refreshCookieExpiry } from '@/lib/auth'

describe('refreshCookieExpiry', () => {
  it('uses the backend-supplied expiry date when valid', () => {
    const iso = '2030-01-02T03:04:05.000Z'
    expect(refreshCookieExpiry(iso)).toEqual(new Date(iso))
  })

  it('falls back to 7 days when absent or unparseable', () => {
    expect(refreshCookieExpiry(undefined)).toBe(7)
    expect(refreshCookieExpiry('not-a-date')).toBe(7)
  })
})

function fakeJwt(payload: Record<string, unknown>): string {
  const seg = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${seg({ alg: 'HS256', typ: 'JWT' })}.${seg(payload)}.sig`
}

describe('persistAuthTokens', () => {
  it('stores ds_user from the passed user', () => {
    persistAuthTokens(fakeJwt({ role: 'DEVELOPER' }), 'refresh-tok', false, {
      name: 'Ada Lovelace',
      email: 'ada@acme.com',
    })

    expect(JSON.parse(sessionStorage.getItem('ds_user') ?? 'null')).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@acme.com',
    })
  })

  it('leaves an existing ds_user untouched when no user is passed (refresh path)', () => {
    sessionStorage.setItem('ds_user', JSON.stringify({ name: 'Existing', email: 'e@x.com' }))

    persistAuthTokens(fakeJwt({ role: 'MANAGER' }), 'refresh-tok', false)

    expect(JSON.parse(sessionStorage.getItem('ds_user') ?? 'null')).toEqual({
      name: 'Existing',
      email: 'e@x.com',
    })
  })
})
