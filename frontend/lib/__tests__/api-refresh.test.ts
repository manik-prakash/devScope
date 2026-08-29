import { describe, it, expect, beforeEach } from 'vitest'
import { applyRefreshedSession } from '@/lib/api'

beforeEach(() => {
  sessionStorage.clear()
  document.cookie = 'ds_must_change=; Max-Age=0; path=/'
})

describe('applyRefreshedSession', () => {
  it('persists the new access token', () => {
    applyRefreshedSession({ accessToken: 'AT', expiresIn: '15m' })
    expect(sessionStorage.getItem('ds_access')).toBe('AT')
  })

  it('restores ds_user from the refresh response so the UI keeps the real name', () => {
    applyRefreshedSession({
      accessToken: 'AT',
      expiresIn: '15m',
      user: { name: 'Ada Lovelace', email: 'ada@acme.com' },
    })
    expect(JSON.parse(sessionStorage.getItem('ds_user') ?? 'null')).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@acme.com',
    })
  })

  it('leaves ds_user alone when the response carries no user', () => {
    sessionStorage.setItem('ds_user', JSON.stringify({ name: 'Keep', email: 'k@x.com' }))
    applyRefreshedSession({ accessToken: 'AT', expiresIn: '15m' })
    expect(JSON.parse(sessionStorage.getItem('ds_user') ?? 'null')).toEqual({
      name: 'Keep',
      email: 'k@x.com',
    })
  })

  it('clears the must-change cookie when mustChangePass is false', () => {
    document.cookie = 'ds_must_change=1; path=/'
    applyRefreshedSession({ accessToken: 'AT', expiresIn: '15m', mustChangePass: false })
    expect(document.cookie).not.toContain('ds_must_change=1')
  })

  it('sets the must-change cookie when mustChangePass is true', () => {
    applyRefreshedSession({ accessToken: 'AT', expiresIn: '15m', mustChangePass: true })
    expect(document.cookie).toContain('ds_must_change=1')
  })
})
