import { useLoaderData } from 'react-router'
import { getFeaturedTours, getTours } from '@/shared/api/tours'
import type { Tour } from '@/shared/types/tour'
import { RegionExplorer } from '@/features/regions'
import { HeroSection } from './components/HeroSection'
import { FeaturedTours } from './components/FeaturedTours'
import { Testimonials } from './components/Testimonials'

export async function homeLoader() {
  // Parallel: the showcase and the map counters are independent reads.
  const [featured, all] = await Promise.all([getFeaturedTours(3), getTours()])
  return { featured, all }
}

export function HomePage() {
  const { featured, all } = useLoaderData() as {
    featured: readonly Tour[]
    all: readonly Tour[]
  }

  return (
    <>
      <HeroSection />
      {/*
        Seam hairlines instead of `border-t` between sections (2.3) — decorative only, hence
        `aria-hidden`. Safe to place right at these boundaries even where a section fades into
        `--surface-page` internally (the region ribbon): both sides sit at the flat page colour
        at the exact seam, before its own gradient has started.
      */}
      <div className="seam" aria-hidden="true" />
      <FeaturedTours tours={featured} />
      <div className="seam" aria-hidden="true" />
      {/* Collapsed by default here — the map is a teaser on the home page. */}
      <RegionExplorer tours={all} />
      <div className="seam" aria-hidden="true" />
      <Testimonials />
    </>
  )
}
