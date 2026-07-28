import { StarIcon } from '@/shared/ui/icons'

interface Review {
  id: string
  author: string
  from: string
  rating: number
  text: string
  tour: string
}

/** Mock reviews — the reviews feature (submission + moderation) comes with the user role. */
const REVIEWS: readonly Review[] = [
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
]

export function Testimonials() {
  return (
    // Ordinary section rhythm (2.3): `py-20 sm:py-28`.
    <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-16 sm:py-28">
      <p className="section-eyebrow">Отзывы</p>
      <h2 className="text-gold-sheen h2-section mt-1.5">Что говорят гости</h2>

      {/* Same alignment discipline as the tour grid: cards stretch, footer pinned with mt-auto. */}
      <ul className="mt-10 grid gap-5 sm:mt-14 sm:gap-6 md:grid-cols-3">
        {REVIEWS.map((review) => (
          <li
            key={review.id}
            className="flex h-full flex-col rounded-2xl bg-panel p-5 ring-1 ring-edge"
          >
            <div className="flex gap-0.5 text-gold-ink" aria-label={`Оценка ${review.rating} из 5`}>
              {Array.from({ length: review.rating }, (_, i) => (
                <StarIcon key={i} size={15} />
              ))}
            </div>
            <p className="mt-3 font-display text-lg leading-relaxed text-ink-dim">
              «{review.text}»
            </p>
            <div className="mt-auto pt-4">
              <p className="text-sm text-ink">
                {review.author}, <span className="text-ink-muted">{review.from}</span>
              </p>
              <p className="mt-0.5 text-xs text-gold-ink">{review.tour}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
