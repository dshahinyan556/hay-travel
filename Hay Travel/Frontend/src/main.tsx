import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ensureAuthReady } from '@/shared/auth'
import App from './app/App.tsx'

/**
 * Kick the session off before the first render, not from an effect.
 *
 * The public shell (`Header`, `MobileTabBar`) reads the auth state too, so without this a
 * returning visitor would sit on `status: 'idle'` — i.e. permanently "signed out" — on any page
 * whose loader never touches the store. Starting it here also overlaps the refresh request with
 * React's first paint instead of queueing behind it.
 *
 * Fire-and-forget is safe: `ensureAuthReady` is single-flight and never rejects (a failed refresh
 * resolves to the anonymous state), and every consumer awaits the same promise anyway.
 */
void ensureAuthReady()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
