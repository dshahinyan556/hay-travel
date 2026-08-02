import { useLoaderData } from 'react-router'
import { getFeaturedTours, getTours } from '@/shared/api/tours'
import { getContentText, getHeroContent, type ContentText, type HeroContent } from '@/shared/api/siteSettings'
import type { Tour } from '@/shared/types/tour'
import { RegionExplorer } from '@/features/regions'
import { Reveal } from '@/shared/ui'
import { HeroSection } from './components/HeroSection'
import { FeaturedTours } from './components/FeaturedTours'
import { Testimonials } from './components/Testimonials'

export async function homeLoader() {
  // Parallel: the showcase, the map counters and the hero/content copy are independent reads.
  // `getHeroContent`/`getContentText` never reject (they degrade internally), so a broken
  // settings read can't take the whole home page down with it via `Promise.all`.
  const [featured, all, hero, content] = await Promise.all([
    getFeaturedTours(),
    getTours(),
    getHeroContent(),
    getContentText(),
  ])
  return { featured, all, hero, content }
}

/**
 * Seam hairline between sections (2.3) — decorative only, hence `aria-hidden`. Safe to place right
 * at these boundaries even where a section fades into `--surface-page` internally (the region
 * ribbon): both sides sit at the flat page colour at the exact seam, before its own gradient has
 * started.
 *
 * As of 2.4 it draws out from its centre when scrolled to (`rise="seam"`, see `shared/ui/Reveal`).
 */
function Seam() {
  return <Reveal rise="seam" className="seam" aria-hidden="true" />
}

export function HomePage() {
  const { featured, all, hero, content } = useLoaderData() as {
    featured: readonly Tour[]
    all: readonly Tour[]
    hero: HeroContent
    content: ContentText
  }

  return (
    <>
      <HeroSection hero={hero} />
      <Seam />
      <FeaturedTours tours={featured} heading={content.featuredHeading} />
      <Seam />
      {/* Collapsed by default here — the map is a teaser on the home page. */}
      <RegionExplorer tours={all} />
      <Seam />
      <Testimonials />
    </>
  )
}
