import { useEffect, useState } from 'react'

/**
 * Порог, после которого «Стеклянная лента» переходит в поднятое состояние (макет
 * `design/header-2026-08/direction-a-frosted-rail.html`, блок «Что нужно добавить в код»).
 * 24px — это «страница уже тронулась», но ещё не «прокручена»: инерционный отскок в мобильных
 * браузерах его не перешагивает, так что стекло не мигает от одного касания.
 */
export const SCROLL_ELEVATION_THRESHOLD = 24

/**
 * `true`, когда страница прокручена дальше `threshold`.
 *
 * ЛОКАЛЬНЫЙ хук варианта `rail` — лежит рядом с его компонентами, а не в `shared/hooks`: ни одна
 * другая часть сайта такого состояния не знает, а вариант `pill` не должен даже подписываться на
 * `scroll`. Если состояние понадобится третьему потребителю — тогда и переезжает в `shared`.
 *
 * Слушатель `passive` + троттлинг через `requestAnimationFrame`: обработчик скролла, который
 * пишет в состояние React на каждом событии, роняет фреймрейт именно там, где эффект и должен
 * быть плавным. `setState` с тем же значением React отбрасывает сам, так что перерисовка
 * происходит ровно на пересечении порога, а не на каждом кадре прокрутки.
 */
export function useScrollElevation(threshold: number = SCROLL_ELEVATION_THRESHOLD): boolean {
  const [elevated, setElevated] = useState(false)

  useEffect(() => {
    let ticking = false

    function read() {
      ticking = false
      setElevated(window.scrollY > threshold)
    }

    function handleScroll() {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(read)
    }

    // Первое чтение синхронно: переход по якорю/восстановление позиции (`ScrollRestoration`)
    // приземляет посетителя в середину страницы без единого события `scroll`.
    read()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [threshold])

  return elevated
}
