import { RouterProvider } from 'react-router'
import { router } from './router'

/**
 * App composition root. No global Context/Zustand providers yet — there is no
 * cross-feature client state to justify one (see router.tsx for how the tours filter
 * avoids needing one too). Add providers here if/when that changes (e.g. auth, theme).
 */
function App() {
  return <RouterProvider router={router} />
}

export default App
