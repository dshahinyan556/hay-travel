import { useLoaderData } from 'react-router'
import { getTours } from '@/shared/api/tours'
import type { Tour } from '@/shared/types/tour'
import { RegionExplorer } from './components/RegionExplorer'

export async function regionsLoader() {
  return { tours: await getTours() }
}

/**
 * Dedicated `/regions` page — the map opened by default (`defaultOpen`), since the visitor
 * navigated here specifically for it. No extra wrapper spacing: `RegionExplorer`'s own
 * full-bleed section already carries its `py-24 sm:py-32` ribbon padding.
 */
export function RegionsPage() {
  const { tours } = useLoaderData() as { tours: readonly Tour[] }

  return <RegionExplorer tours={tours} defaultOpen />
}
