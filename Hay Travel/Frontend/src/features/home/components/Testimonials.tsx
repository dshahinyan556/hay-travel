import { useLocale } from '@/shared/i18n/LocaleProvider'
import { Reveal } from '@/shared/ui'
import { StarIcon } from '@/shared/ui/icons'

interface Review {
  id: string
  author: string
  from: string
  rating: number
  text: string
  tour: string
}

/** Mock reviews — the reviews feature (submission + moderation) comes with the user role.
 * Keyed by locale rather than carrying both languages per field: this is presentational mock
 * content, not backend data, so it does not need the `Localized`-object shape the rest of the
 * app uses for real tour text. */
const REVIEWS: Record<'ru' | 'en', readonly Review[]> = {
  ru: [
    {
      id: '1',
      author: 'Марина',
      from: 'Москва',
      rating: 5,
      text: 'Татев в тумане — отдельное впечатление. Гид знал, где остановиться ради вида, а не ради сувениров.',
      tour: 'Юг Армении: Татев и Крылья',
    },
    {
      id: '2',
      author: 'Давид',
      from: 'Тбилиси',
      rating: 5,
      text: 'Взяли Гарни и Гегард на один день. Успели всё без спешки, вернулись к ужину в Ереване.',
      tour: 'Гарни и Гегард',
    },
    {
      id: '3',
      author: 'Анна',
      from: 'Санкт-Петербург',
      rating: 4,
      text: 'Дилижан оказался лучше, чем на фото. Отель простой, но вид из окна всё оправдал.',
      tour: 'Севан и Дилижан',
    },
  ],
  en: [
    {
      id: '1',
      author: 'Marina',
      from: 'Moscow',
      rating: 5,
      text: 'Tatev in the fog was something else. Our guide knew exactly where to stop for the view, not the souvenir stands.',
      tour: 'South Armenia: Tatev and the Wings',
    },
    {
      id: '2',
      author: 'David',
      from: 'Tbilisi',
      rating: 5,
      text: 'We did Garni and Geghard in a single day — no rushing, back in Yerevan in time for dinner.',
      tour: 'Garni and Geghard',
    },
    {
      id: '3',
      author: 'Anna',
      from: 'Saint Petersburg',
      rating: 4,
      text: 'Dilijan looked even better in person. The hotel was simple, but the view from the window made up for it.',
      tour: 'Sevan and Dilijan',
    },
  ],
}

export function Testimonials() {
  const { locale, t } = useLocale()
  const reviews = REVIEWS[locale]

  return (
    // Ordinary section rhythm (2.3): `py-20 sm:py-28`.
    <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-16 sm:py-28">
      <Reveal as="div">
        <p className="section-eyebrow">{t('home.testimonials.eyebrow')}</p>
        <h2 className="text-gold-sheen h2-section mt-1.5">{t('home.testimonials.title')}</h2>
      </Reveal>

      {/*
        Same alignment discipline as the tour grid: cards stretch, footer pinned with mt-auto.
        The list is also the 2.4 reveal group — the three cards come in `--stagger` apart, index
        from `:nth-child`. `.reveal-item` sits on the `<li>` itself, which is safe here: the card
        carries no `transition-*`/`transform` utility of its own that the unlayered reveal rules
        could outrank.
      */}
      <Reveal group as="ul" className="mt-10 grid gap-5 sm:mt-14 sm:gap-6 md:grid-cols-3">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="reveal-item flex h-full flex-col rounded-2xl bg-panel p-5 ring-1 ring-edge"
          >
            <div
              className="flex gap-0.5 text-gold-ink"
              aria-label={t('home.testimonials.rating', { rating: review.rating })}
            >
              {Array.from({ length: review.rating }, (_, i) => (
                <StarIcon key={i} size={15} />
              ))}
            </div>
            <p className="mt-3 text-[19px] leading-relaxed text-ink-dim">
              {locale === 'en' ? `“${review.text}”` : `«${review.text}»`}
            </p>
            <div className="mt-auto pt-4">
              <p className="text-sm text-ink">
                {review.author}, <span className="text-ink-muted">{review.from}</span>
              </p>
              <p className="mt-0.5 text-xs text-gold-ink">{review.tour}</p>
            </div>
          </li>
        ))}
      </Reveal>
    </section>
  )
}
