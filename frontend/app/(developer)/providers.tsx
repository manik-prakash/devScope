// Thin alias — the real provider lives in app/providers.tsx (shared with the
// (manager) group). Kept so app/(developer)/layout.tsx's import path is unchanged.
export { AppProviders as DevProviders } from '../providers'
