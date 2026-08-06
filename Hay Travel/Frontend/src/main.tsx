import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ensureAuthReady } from '@/shared/auth'
import { ensureRatesReady } from '@/shared/currency'
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

/**
 * Exchange rates, same fire-and-forget contract (`ensureRatesReady` is single-flight and never
 * rejects).
 *
 * NOT a root-route loader: a loader would `await`, and the endpoint is allowed to spend up to ~10s
 * on its stale path (a slow call out to the CBA), which would blank the entire public site for a
 * display-only price. NOT an effect either — effects run after first paint, which is exactly the
 * flicker the store's localStorage seed exists to prevent.
 *
 * It also fires on `/admin`, which does not need rates. Deliberate: the cost is one anonymous
 * ~300-byte GET on a route only the owner visits, and the alternative — a path check here — is a
 * second copy of the route table that would silently rot.
 */
void ensureRatesReady()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
