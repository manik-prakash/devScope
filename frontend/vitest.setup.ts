import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

// jsdom provides sessionStorage/localStorage; clear between tests so state
// from one spec never leaks into the next.
afterEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})
