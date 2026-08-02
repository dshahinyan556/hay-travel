import { RouterProvider } from 'react-router'
import { LocaleProvider } from '@/shared/i18n/LocaleProvider'
import { router } from './router'

/**
 * App composition root. `LocaleProvider` is the one global Context so far (see its own doc
 * comment for why it wraps `/admin` too even though only the public site ever changes locale) —
 * everything else still avoids cross-feature client state (see router.tsx for how the tours
 * filter does the same). Add providers here if/when that changes further (e.g. auth).
 */
function App() {
  return (
    <LocaleProvider>
      <RouterProvider router={router} />
    </LocaleProvider>
  )
}

export default App
