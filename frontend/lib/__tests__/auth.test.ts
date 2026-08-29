import { describe, it, expect } from 'vitest'
import { persistAuthTokens } from '@/lib/auth'

function fakeJwt(payload: Record<string, unknown>): string {
  const seg = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${seg({ alg: 'HS256', typ: 'JWT' })}.${seg(payload)}.sig`
}

describe('persistAuthTokens', () => {
  it('stores ds_user from the passed user (refresh token is a cookie, not an arg)', () => {
    persistAuthTokens(fakeJwt({ role: 'DEVELOPER' }), false, {
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

    persistAuthTokens(fakeJwt({ role: 'MANAGER' }), false)

    expect(JSON.parse(sessionStorage.getItem('ds_user') ?? 'null')).toEqual({
      name: 'Existing',
      email: 'e@x.com',
    })
  })

  it('stores the access token', () => {
    persistAuthTokens(fakeJwt({ role: 'DEVELOPER' }), false)
    expect(sessionStorage.getItem('ds_access')).toBeTruthy()
  })
})
