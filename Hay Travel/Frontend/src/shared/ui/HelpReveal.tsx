import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ElementType, ReactNode } from 'react'
import { useIsTouchDevice } from '@/shared/hooks'

/** Наведение должно быть намеренным: случайный проезд мышью над полем ничего не показывает. */
export const HELP_REVEAL_SHOW_DELAY_MS = 500
/**
 * Пауза перед скрытием. Она же закрывает требование «hoverable» из WCAG 1.4.13 — за это время
 * курсор успевает дойти от лейбла до самой кнопки, не потеряв её по дороге.
 */
export const HELP_REVEAL_HIDE_DELAY_MS = 2000

interface HelpRevealContextValue {
  /** Виден ли сейчас триггер «?». Вне зоны (и на тач-устройствах) — всегда `true`. */
  revealed: boolean
  /**
   * `HelpButton` сообщает, что им прямо сейчас пользуются: панель открыта ИЛИ кнопка в фокусе с
   * клавиатуры. Пока это `true`, зона не прячет триггер ни по какому таймеру.
   *
   * Фокус приходит именно отсюда, а не с `onFocus` самой зоны, намеренно: зона накрывает всё поле,
   * и слушай она фокус целиком — «?» вспыхивала бы при каждом клике в инпут, то есть ровно та
   * визуальная шумность, ради устранения которой всё это и делается. При этом клавиатурный
   * пользователь не остаётся с невидимой, но фокусируемой кнопкой: таб доходит до неё — она сама
   * себя показывает.
   */
  setTriggerEngaged: (engaged: boolean) => void
}

const HelpRevealContext = createContext<HelpRevealContextValue | null>(null)

/** `null`, если вокруг нет `HelpRevealZone` — тогда триггер ведёт себя как раньше, всегда видимый. */
export function useHelpReveal(): HelpRevealContextValue | null {
  return useContext(HelpRevealContext)
}

export interface HelpRevealZoneProps {
  children: ReactNode
  /**
   * Тег зоны. Зона ЗАМЕНЯЕТ собой уже существующий контейнер на месте вызова (строку лейбла,
   * `fieldset`, `h1`, ...), а не оборачивает его в лишний `div` — иначе поменялась бы вёрстка.
   * @default 'div'
   */
  as?: ElementType
  /** Классы контейнера, который зона собой заменила — переезжают сюда один в один. */
  className?: string
  /**
   * `false` → зона рендерит тот же тег с тем же `className`, но без слушателей и без таймеров, а
   * триггер внутри остаётся всегда видимым. Для полей без подсказки: DOM байт в байт тот же, так
   * что обернуть «на всякий случай» ничего не стоит.
   * @default true
   */
  enabled?: boolean
}

/**
 * Зона наведения, внутри которой `HelpButton` показывается не постоянно, а по требованию
 * (спека Давида, 2026-08-29).
 *
 * ПК (точный указатель): «?» скрыта. Курсор входит в зону → через 0.5 с кнопка проявляется;
 * курсор ушёл → через 2 с гаснет сама. Место под кнопку зарезервировано ВСЕГДА (гасим
 * `opacity`, а не снимаем из потока), поэтому наведение не двигает ни лейбл, ни поле — ноль
 * layout shift.
 *
 * Тач-устройства: поведение не меняется, кнопка видна всегда. Раскрытие по ховеру — это
 * desktop-only progressive enhancement поверх постоянно видимого триггера, ровно как это устроено
 * в Material/Lightning/Radix: на тач у ховера нет эквивалентного обнаруживаемого жеста, а тап по
 * лейблу занят браузером под перевод фокуса в поле.
 *
 * Скрытая кнопка получает `pointer-events: none`, так что её невидимую площадку «проходит
 * насквозь» — событие ловит сама зона. Благодаря этому наведение на пустое зарезервированное
 * место тоже показывает кнопку, и она остаётся достижимой даже в зоне, где кроме неё ничего нет.
 *
 * Только админка. Публичный `PhoneField` в зону не заворачивается и работает как раньше.
 */
export function HelpRevealZone({ children, as: Component = 'div', className = '', enabled = true }: HelpRevealZoneProps) {
  const isTouch = useIsTouchDevice()
  const active = enabled && !isTouch

  const [revealed, setRevealed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [triggerEngaged, setTriggerEngaged] = useState(false)

  useEffect(() => {
    if (!active) return

    if (hovered || triggerEngaged) {
      if (revealed) return
      // Фокус/открытая панель — уже состоявшееся намерение, ждать полсекунды нечего.
      if (triggerEngaged) {
        setRevealed(true)
        return
      }
      const showId = window.setTimeout(() => setRevealed(true), HELP_REVEAL_SHOW_DELAY_MS)
      return () => window.clearTimeout(showId)
    }

    if (!revealed) return
    const hideId = window.setTimeout(() => setRevealed(false), HELP_REVEAL_HIDE_DELAY_MS)
    return () => window.clearTimeout(hideId)
  }, [active, hovered, triggerEngaged, revealed])

  // Зона выключена или это тач — контекст отдаёт «видно всегда», и `HelpButton` не различает этот
  // случай и полное отсутствие зоны.
  const value = useMemo<HelpRevealContextValue>(
    () => ({ revealed: active ? revealed : true, setTriggerEngaged }),
    [active, revealed],
  )

  return (
    <Component
      className={className}
      onMouseEnter={active ? () => setHovered(true) : undefined}
      onMouseLeave={active ? () => setHovered(false) : undefined}
    >
      <HelpRevealContext.Provider value={value}>{children}</HelpRevealContext.Provider>
    </Component>
  )
}
