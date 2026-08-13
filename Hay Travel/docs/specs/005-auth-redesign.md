# Spec 005. Редизайн входа и регистрации: сплит-экран + состояния формы

- **Дата:** 2026-08-11
- **Автор:** Frontend Architect
- **Исполнитель:** frontend-developer
- **Порядок реализации:** **задача №2 из трёх** (004 Шрифт → **005 Логин** → 006 Палитра).
  Делать после 004: экран использует новую шкалу (`font-display` ≥ 24px, `.card-title`
  в Manrope) и не должен переделываться дважды.
- **Источник решения:** предложение дизайнера `hay-auth.html`, утверждено Давидом.
- **ADR:** [017 — сплит-экран как второй шелл](../adr/017-auth-split-layout-as-second-shell.md)
  (почему не переделываем `AuthShell`).

---

## Что делаем (итог)

`/auth` (и только он) переезжает с узкой центрированной колонки на экран пополам: слева фото
Армении с тем же затемнением, что в шапке главной, справа — карточка формы. Плюс четыре
честных состояния формы вместо одного (по умолчанию / ошибка / загрузка / успех) и плавная
смена высоты при переключении «Вход ↔ Регистрация».

**Что НЕ меняется:** набор полей, правила валидации, телефон с выбором страны, письма,
«забыли пароль», любые запросы к бэкенду, `shared/auth/*`. Это только внешний вид и поведение.

Остальные шесть экранов `/auth/*` и `/account` остаются на `AuthShell` — см. ADR 017.

---

## Требуется дополнение к Spec 002 (backend) — одна строка

Источник фотографии — новый ключ `SiteSetting`, по образцу `hero.imageUrl` / `branding.logoUrl`,
а не хардкод. Отдельного захода backend-architect **не нужно**: это одна строка каталога в уже
готовой спеке.

**Кому:** backend-developer, вместе с задачей Spec 002.
**Куда:** `ATTours.Common/Infrastructure/SiteSettings/SiteSettingCatalog.cs`, в блок `Branding`.

```csharp
new("branding.authImageUrl", SiteSettingGroup.Branding, SettingValueType.ImageUrl,
    isTranslatable: false, isPublic: true, sortOrder: 26,
    defaultValue: ""),
```

`sortOrder: 26` — следующий свободный после `theme.defaultMode` (25) из Spec 002. Группа
`Branding` (4), а не новая: это брендовый ассет ровно того же класса, что логотип, и группа
уже публичная. Миграция не нужна (ADR 002). Пустое значение — нормальное состояние, фронт
подставляет заглушку.

**До того как бэкенд это выкатит** фронт работает без изменений: `GetPublic` просто не вернёт
ключ, `getAuthImageUrl()` отдаст `''`, экран покажет заглушку. Ждать бэкенд не нужно.

---

## Файлы

### СОЗДАТЬ

#### 1. `Frontend/src/features/auth/components/AuthSplitLayout.tsx`

Оболочка сплит-экрана. Используется **только** `AuthPage`.

```tsx
interface AuthSplitLayoutProps {
  /** Заголовок над карточкой («С возвращением» / «Создать аккаунт»). */
  title: string
  /** Подзаголовок под ним. */
  subtitle?: string
  /** Содержимое карточки: переключатель режима + форма. */
  children: ReactNode
  /** Мелкий текст под карточкой (условия сервиса на регистрации). */
  note?: string
  /**
   * Запрос в полёте. Превращает золотой «шов» под заголовком в бегущую полосу
   * (`.seam-loading`). Ничего кроме шва не трогает — блокировка полей живёт в формах.
   */
  isBusy?: boolean
}

export function AuthSplitLayout(props: AuthSplitLayoutProps): JSX.Element
```

Структура разметки (сверху вниз, ровно эта):

```
<div class="grid grid-cols-1 lg:grid-cols-[44%_56%]">
  <AuthPhotoPanel />                        {/* левая колонка */}
  <div class="flex items-center justify-center px-4 py-8 lg:px-10 lg:py-12">
    <div class="w-full max-w-[400px]">
      <div class="text-center">             {/* шапка карточки */}
        <MountainIcon size={28} /> в text-gold-ink
        <h1 class="text-gold-sheen mt-2.5 font-display text-[30px]">{title}</h1>
        {subtitle && <p class="mt-2 text-sm text-ink-muted">{subtitle}</p>}
        <div class={`mx-auto mt-4 h-px max-w-[180px] ${isBusy ? 'seam-loading' : 'seam'}`} />
      </div>
      <div class="veil-top relative mt-5 overflow-hidden rounded-2xl bg-panel p-5 shadow-lg ring-1 ring-edge sm:p-[22px]">
        {children}
      </div>
      {note && <p class="mt-3.5 text-center text-xs text-ink-muted">{note}</p>}
      <Link to="/" class="link-underline mt-5 block text-center text-sm text-ink-dim hover:text-gold-ink">
        {t('auth.backHome')}
      </Link>
    </div>
  </div>
</div>
```

Обязательные ограничения:

- **Никаких `h-screen` / `100vh` / `100dvh` / `svh` / `dvh` нигде в этом дереве.** Экран живёт
  внутри `RootLayout` (`Header` сверху, `Footer` снизу, `MobileTabBar` фиксирован), высота
  задаётся содержимым. Единица высоты вьюпорта здесь = гарантированный баг с экранной
  клавиатурой на мобильном (см. edge-кейс 6).
- Вуаль на карточке — существующий класс `.veil-top` (index.css), не новый градиент.
- `shadow-lg` берёт токен `--shadow-lg`, который уже свой у каждой темы.

#### 2. `Frontend/src/features/auth/components/AuthPhotoPanel.tsx`

Левая колонка. Пропов нет — самодостаточна (сама тянет картинку и берёт тексты из словаря).

```tsx
export function AuthPhotoPanel(): JSX.Element
```

- Корень: `relative isolate flex items-end overflow-hidden h-[190px] sm:h-[230px] lg:h-auto lg:min-h-[560px]`.
- Фон-заглушка на корне: `bg-obsidian` — рисуется всегда, поэтому пока картинка не пришла,
  колонка не белая и не «пустая», просто тёмная.
- Картинка — `motion.img` **ровно по образцу `HeroSection.tsx:46-53`**: `.ken-burns`,
  `initial={{ scale: 1.08 }}`, `animate={{ scale: reducedMotion ? 1.08 : 1 }}`,
  `transition={{ duration: reducedMotion ? 0 : 12, ease: 'linear' }}`,
  `className="ken-burns absolute inset-0 -z-10 h-full w-full object-cover"`, `alt=""`.
  Рендерится только когда `imageUrl !== ''`.
- Затемнение — существующие токены `--hero-scrim-*`, **без** слоя `--hero-fade` (он нужен там,
  где тёмный герой упирается в светлую страницу; здесь колонка граничит с формой по вертикали):
  ```tsx
  <div className="absolute inset-0 -z-10" style={{ backgroundImage:
    'linear-gradient(to top, var(--hero-scrim-from) 0%, var(--hero-scrim-via) 50%, var(--hero-scrim-to) 100%)' }} />
  ```
- Контент внутри `<div className="p-6 lg:p-9">`:
  - надзаголовок: `.section-eyebrow`, но цвет фиксированно-тёмный — `text-gold` (не `text-gold-ink`),
    потому что фон тёмный в обеих темах, ровно как в `HeroSection`;
  - `<h2 className="font-display mt-3 max-w-[14ch] text-[26px] leading-tight text-hero-ink lg:text-[38px]">`
    с `t('auth.photo.titleShort')` на мобильном и `t('auth.photo.title')` от `lg`
    (два `<span>`: `lg:hidden` / `hidden lg:inline`);
  - `<p className="mt-2.5 hidden max-w-[34ch] text-sm text-hero-ink-dim lg:block">` —
    `auth.photo.subtitle`;
  - список доверия `<ul className="mt-4 hidden gap-2.5 lg:grid">`, три `<li className="flex items-center gap-2.5 text-[13px] text-hero-ink-dim">`
    с иконками `StarIcon` / `MailIcon` / `ClockIcon` (size 17, `className="shrink-0 text-gold"`)
    и текстами `auth.photo.trust1..3`.
- Подзаголовок и список доверия **скрыты ниже `lg`** намеренно: на полосе 190px им нет места,
  а сжимать их — значит получить нечитаемую кашу поверх фото.

#### 3. `Frontend/src/features/auth/components/AuthModeToggle.tsx`

Сегментированный переключатель со скользящей заливкой.

```tsx
export type AuthMode = 'login' | 'register'

interface AuthModeToggleProps {
  value: AuthMode
  onChange: (mode: AuthMode) => void
  /** Блокирует переключение, пока летит запрос. */
  disabled?: boolean
}

export function AuthModeToggle(props: AuthModeToggleProps): JSX.Element
```

- ARIA берётся **дословно из нынешнего `AuthPage.tsx:106-128`**: контейнер
  `role="radiogroup" aria-label={t('auth.modeToggleLabel')}`, кнопки `role="radio"` +
  `aria-checked`. Не изобретать `tablist`.
- Контейнер: `relative flex rounded-full p-[3px] ring-1 ring-edge`.
- Заливка — отдельный `<span aria-hidden>` :
  `absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-wine shadow-sm`
  плюс `transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]`
  и `style={{ transform: value === 'register' ? 'translateX(100%)' : 'none' }}`.
  Позиция считается от собственной ширины сегмента (`translateX(100%)`), **не измеряется через
  `getBoundingClientRect`** — сегментов ровно два и они равной ширины (`flex-1`), измерение
  здесь было бы лишней машинерией и источником рассинхрона при ресайзе.
- Кнопки: `relative z-[1] min-h-11 flex-1 rounded-full px-4 text-sm font-semibold` +
  `transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)]`,
  цвет `aria-checked` → `text-gold-light`, иначе `text-ink-dim hover:text-gold-ink`.
  `min-h-11` (44px) — тапабельная зона, не декоративный размер.
- `prefers-reduced-motion` отдельной ветки **не требует**: `--dur-fast` уже схлопывается до
  1ms токеном, `--dur-micro` намеренно не схлопывается (это тинт, а не движение) — см.
  комментарий в `index.css` ~строка 260.

#### 4. `Frontend/src/features/auth/hooks/useAuthImage.ts`

```tsx
/** Заглушка, когда админ не задал фото. Тот же файл, что у hero. */
export const AUTH_IMAGE_FALLBACK = '/placeholders/tatev.svg'

/**
 * URL фотографии левой колонки.
 * Возвращает '' пока настройка не приехала — колонка в этот момент показывает тёмный фон и
 * затемнение, без «дыры» и без сдвига макета (высота колонки фиксирована классами).
 * После ответа: URL из админки либо AUTH_IMAGE_FALLBACK. Никогда не бросает.
 */
export function useAuthImage(): string
```

Реализация — по образцу `shared/hooks/useFavicon.ts`: `useEffect` с флагом `cancelled`,
`getAuthImageUrl().then(...)`, без `.catch` (функция API уже не бросает).

**Почему хук, а не route loader:** `/auth` уже имеет `authPageLoader`, который решает, пускать
ли посетителя на экран. Добавить туда запрос настроек — значит задержать показ формы входа
ради декоративной картинки. Форма важнее фотографии.

### ИЗМЕНИТЬ

#### 5. `Frontend/src/shared/api/siteSettings.ts`

Добавить рядом с `getLogoUrl` (та же группа `SITE_SETTING_GROUP_BRANDING`):

```ts
/** '' = админ не задал фото входа. Вызывающий подставляет заглушку. Никогда не бросает. */
export async function getAuthImageUrl(): Promise<string>
```

Тело — копия `getLogoUrl` с ключом `branding.authImageUrl`. Отдельный запрос к той же группе
(а не объединение с `getLogoUrl` в один `getBranding`) — это уже действующий паттерн файла:
каждая функция ходит за своей группой сама (`getContacts`, `getSocialLinks`, `getFaviconUrl`…).
Один лишний маленький запрос на одном маршруте не повод ломать единообразие модуля.

#### 6. `Frontend/src/features/auth/components/AuthField.tsx`

Два дополнения, оба обратно совместимые:

```ts
interface AuthFieldProps {
  // …существующее без изменений…
  /**
   * Визуальная отметка «поле участвует в ошибке уровня формы» (неверный логин/пароль).
   * В отличие от `error`, своего текста не даёт: сообщение живёт в общей плашке над формой.
   * Красная рамка + `aria-invalid`, без `aria-describedby`.
   */
  invalid?: boolean
}
```

- В классе рамки: `error || invalid ? 'ring-danger' : 'ring-edge-strong hover:ring-gold-line'`;
  иконка — `error || invalid ? 'text-danger' : …`.
- `aria-invalid={error || invalid ? true : undefined}`.
- Кнопка «показать пароль» (строки 96-106) — довести тапабельную зону до 44×44 **тем же
  приёмом, что в `ThemeToggle.tsx:26`** (невидимый расширитель, не увеличение самой кнопки):
  добавить в её className `relative before:absolute before:-inset-2.5 before:content-['']`.

#### 7. `Frontend/src/features/auth/components/AuthShell.tsx`

Файл остаётся оболочкой служебных экранов (ADR 017) — **сам `AuthShell` не трогаем**. Меняются
три экспортируемых примитива из этого файла, которыми пользуются обе оболочки:

**`AuthSubmitButton`** — новые необязательные пропы:

```ts
export function AuthSubmitButton(props: {
  children: ReactNode
  disabled?: boolean
  /** Запрос в полёте: спиннер слева от подписи, `cursor-progress`, `aria-busy`. */
  isLoading?: boolean
  /** Кратковременное подтверждение перед переходом: зелёная заливка + галочка. */
  isSuccess?: boolean
}): JSX.Element
```

- В className добавить `btn-motion` (подъём 1px на hover, сжатие 0.97 на нажатии) и
  `inline-flex items-center justify-center gap-2.5`. `transition-colors` из строки убрать —
  `.btn-motion` объявляет цветовую половину сам, и как неслоёный CSS он всё равно выиграет
  у утилиты (см. предупреждение в `index.css` ~строка 680).
- `isLoading` → `<Spinner size="sm" />` (`shared/ui`) перед `children`, `aria-busy` на кнопке,
  класс `cursor-progress`, `disabled` считается как `disabled || isLoading || isSuccess`.
- `isSuccess` → `bg-success text-gold-on` вместо `bg-gold-fill …`, и `<CheckIcon size={17} />`
  перед `children`.
- Все шесть служебных экранов новые пропы не передают → их поведение не меняется, кроме
  бесплатного `.btn-motion`. Это желаемо.

**`AuthError`** — иконка + въезд снизу вверх:

```tsx
<p role="alert" className="alert-in flex items-start gap-2.5 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger ring-1 ring-danger/40">
  <AlertIcon size={17} className="mt-0.5 shrink-0" />
  <span>{message}</span>
</p>
```

`role="alert"` сохранить обязательно. Никакой тряски/shake — сообщение важнее анимации, и
тряска отключается у людей с чувствительностью к движению.

**Добавить `AuthSuccess`** (новый экспорт из этого же файла, форма-близнец `AuthError`):

```tsx
export function AuthSuccess({ message }: { message: string }): JSX.Element
```

Та же разметка, что у `AuthError`, но `bg-success-soft text-success ring-success/40`,
иконка `CheckIcon`, и `role="status"` (не `alert` — это не ошибка).

#### 8. `Frontend/src/features/auth/AuthPage.tsx`

Переписывается на новую оболочку и на конечный автомат отправки.

```ts
type SubmitStatus = 'idle' | 'submitting' | 'success'
```

Состояние компонента: `mode: AuthMode`, `status: SubmitStatus`, `error: string | null`.
Проп `isSubmitting` в формах заменяется на `status === 'submitting'` (см. п. 9/10).

**Вход:**
1. `setError(null)`, `setStatus('submitting')`.
2. `await login(request)`.
3. Успех → `setStatus('success')`, затем через **400 мс** — тот же `navigate(...)` с той же
   логикой `forceChangePassword`/`returnTo`, что сейчас (строки 64-67). Таймер хранить в
   `useRef<number|null>` и гасить в `useEffect(() => () => clearTimeout(...), [])` — иначе
   размонтирование во время паузы даёт `navigate` на снятом компоненте.
4. Ошибка → `setError(t(authErrorMessageKey(err)))`, `setStatus('idle')`.

Пауза 400 мс **не гейтится** на `prefers-reduced-motion`: это пауза, а не движение. Сейчас
переход мгновенный, и человек не успевает понять, что вход удался — особенно если до этого
он пару раз ошибся.

**Регистрация:** без состояния `success` — как и сейчас, при успехе сразу
`navigate('/auth/check-email', …)`. Там уже есть собственный экран подтверждения, второе
подряд подтверждение было бы шумом.

**Переключение режима:** `setMode(v)`, `setError(null)` (как сейчас). Дополнительно — не
переключать, пока `status !== 'idle'` (проп `disabled` у `AuthModeToggle`).

**Рендер:**

```tsx
<AuthSplitLayout
  title={isRegister ? t('auth.createAccount') : t('auth.welcomeBack')}
  subtitle={isRegister ? t('auth.subtitleRegister') : t('auth.subtitleLogin')}
  note={isRegister ? t('auth.terms') : undefined}
  isBusy={status === 'submitting'}
>
  <AuthModeToggle value={mode} onChange={handleModeChange} disabled={status !== 'idle'} />
  <motion.div layout transition={reducedMotion ? { duration: 0 } : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }}>
    {isRegister ? <RegisterForm … /> : <LoginForm … />}
  </motion.div>
</AuthSplitLayout>
```

`motion.div layout` — плавная смена высоты карточки при «Вход ↔ Регистрация» (2 поля ↔ 7).
Сейчас карточка мгновенно вырастает вдвое и страница дёргается. `0.34` и кривая `[0.22,1,.36,1]`
— это литералы токенов `--dur-base` и `--ease-out-soft`; framer не умеет читать CSS-переменные,
поэтому значения продублированы, и это обязательно отметить комментарием в коде.
`reducedMotion` — существующий `useReducedMotion()` из `shared/hooks`.

#### 9. `Frontend/src/features/auth/components/LoginForm.tsx`

Проп `isSubmitting: boolean` заменяется на:

```ts
interface LoginFormProps {
  onSubmit: (request: LoginRequest) => void
  error: string | null
  /** Общий статус отправки, приходит из AuthPage. */
  status: 'idle' | 'submitting' | 'success'
  forgotPasswordHref: string
}
```

Новая структура формы (порядок обязателен):

```tsx
<Reveal group className="mt-5">
  <form className="space-y-3.5" onSubmit={…}>
    {status === 'success' && <AuthSuccess message={t('auth.successLogin')} />}
    {error && <AuthError message={error} />}

    <fieldset disabled={status !== 'idle'} className="m-0 space-y-3.5 border-0 p-0 transition-opacity duration-[var(--dur-fast)] disabled:opacity-55">
      <div className="reveal-item"><AuthField name="usernameOrEmail" … invalid={Boolean(error)} /></div>
      <div className="reveal-item"><AuthField name="password" … invalid={Boolean(error)} /></div>
      <p className="reveal-item text-right">…забыли пароль…</p>
    </fieldset>

    <AuthSubmitButton isLoading={status === 'submitting'} isSuccess={status === 'success'}>
      {status === 'submitting' ? t('auth.checking')
        : status === 'success' ? t('auth.signedIn')
        : t('auth.submitLogin')}
    </AuthSubmitButton>
  </form>
</Reveal>
```

Почему именно так:

- `<fieldset disabled>` — нативный способ разом перестать принимать ввод: он отключает и поля,
  и кнопку-глаз внутри. Ручной перебор `disabled` по каждому полю не нужен. `m-0 border-0 p-0`
  снимает браузерные умолчания fieldset.
- **Кнопка отправки — вне fieldset**, иначе `disabled` затрёт `aria-busy`/спиннер и кнопка
  перестанет быть объявляемой.
- `<Reveal group>` оборачивает `<form>`, а не является им: `RevealTag` не содержит `'form'`,
  и расширять union ради одного случая не нужно — `.reveal-group .reveal-item` селектор
  потомка, глубина роли не играет.
- `.reveal-item` ставится на **обёртки-`div`**, а не на сам `AuthField`: у `AuthField` внутри
  живёт `transition-colors`, а `index.css` (~строка 538) прямо запрещает вешать `.reveal-item`
  на элемент с собственным `transition`/`transform` — неслоёные правила выиграют.
- `AuthSuccess`/`AuthError` — прямые дети формы, поэтому при их появлении индекс волны
  (`:nth-child`) у полей смещается на один шаг. Это допустимо и специально не компенсируется:
  волна проигрывается один раз при входе на экран, когда плашек ещё нет.
- Ссылка «Забыли пароль?» технически остаётся кликабельной внутри `disabled`-fieldset (он
  отключает form controls, но не `<a>`). Принято как есть: уход со страницы во время запроса
  не ломает ничего.

#### 10. `Frontend/src/features/auth/components/RegisterForm.tsx`

Те же три правки, что в `LoginForm`:

- проп `isSubmitting` → `status` (той же формы);
- `<Reveal group>` вокруг `<form>`, `<fieldset disabled={status !== 'idle'} …>` вокруг всех
  семи полей, каждое поле — в `<div className="reveal-item">` (включая `PhoneField`);
- кнопка вне fieldset, подпись: `submitting` → `t('auth.submitting')` (существующий ключ
  «Отправляем…», для регистрации он точнее, чем «Проверяем…»), иначе `t('auth.submitRegister')`.

Состояния `success` у регистрации нет — `isSuccess` не передавать. Локальная валидация
(`fieldErrors`, `passwordRules`) и вся логика `handleSubmit` **остаются без единого изменения**.

#### 11. `Frontend/src/index.css`

Добавить два класса. Место — сразу после блока `.skeleton-shimmer` (~строка 815), чтобы
переиспользование `@keyframes skeleton-shimmer` читалось рядом.

```css
/**
 * Auth (Spec 005). The seam under the heading turns into a running highlight while a sign-in
 * request is in flight — reusing `skeleton-shimmer`'s keyframe rather than adding a second
 * one. Overrides `.seam`'s own `--seam-op` on purpose: at rest the hairline is a decoration,
 * here it is a progress indicator and must read at full strength.
 */
.seam-loading {
  height: 1px;
  background-image: linear-gradient(100deg, transparent 30%, var(--gold-fill) 50%, transparent 70%);
  background-size: 200% 100%;
  opacity: 1;
  animation: skeleton-shimmer 1.8s ease-in-out infinite;
}

/**
 * Form-level alert entrance: 8px up + fade, no shake. Duration is `--dur-fast`, which already
 * collapses to 1ms under reduced motion, so the message still appears — instantly.
 */
@keyframes alert-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}
.alert-in {
  animation: alert-in var(--dur-fast) var(--ease-out-soft) both;
}
```

И **обязательно** добавить `.seam-loading` в список классов, который глушится в
`@media (prefers-reduced-motion: reduce)` рядом с `.skeleton-shimmer` (сейчас строки 279-291):
бесконечная бегущая полоса — это именно движение, и она должна выключаться, а не ускоряться.

#### 12. `Frontend/src/shared/i18n/dictionary.ts`

Новые ключи. RU — источник правды, EN обязателен (TypeScript иначе не соберётся).

| Ключ | RU | EN |
| --- | --- | --- |
| `auth.photo.eyebrow` | Личный кабинет | Your account |
| `auth.photo.title` | Ваши поездки по Армении | Your trips across Armenia |
| `auth.photo.titleShort` | Ваши поездки | Your trips |
| `auth.photo.subtitle` | Бронирования, история и данные для связи — в одном месте. | Bookings, history and contact details in one place. |
| `auth.photo.trust1` | 11 регионов, только Армения | 11 regions, Armenia only |
| `auth.photo.trust2` | Подтверждение брони на почту | Booking confirmation by email |
| `auth.photo.trust3` | Предоплата 20 %, остальное на месте | 20% deposit, the rest on arrival |
| `auth.checking` | Проверяем… | Checking… |
| `auth.successLogin` | Готово. Открываем ваш личный кабинет… | Done. Opening your account… |
| `auth.signedIn` | Вход выполнен | Signed in |

Существующие ключи `auth.*` не переименовывать и не удалять — ими пользуются шесть служебных
экранов.

#### 13. `Frontend/src/features/admin/settings/lib/settingsCopy.ts`

Добавить в `fieldCopy`, в блок `/* ---- Branding ---- */`:

```ts
'branding.authImageUrl': {
  label: 'Фото на экране входа — URL',
  hint: 'Вертикальный или квадратный кадр Армении. Показывается слева на странице входа. Пусто — покажем стандартную картинку.',
},
```

Тип `ImageUrl` уже умеет рисоваться превью (`ImageUrlField`) — ничего кроме подписи не нужно.

---

## Состояния и edge-кейсы

1. **Загрузка (`status === 'submitting'`).** Поля гаснут до 55 % и не принимают ввод
   (`fieldset disabled`), переключатель режима заблокирован, кнопка показывает спиннер и
   подпись «Проверяем…», шов над карточкой превращается в бегущую полосу. Сейчас меняется
   только текст кнопки — на медленном интернете это читается как «сайт завис».
2. **Ошибка.** Плашка `AuthError` с иконкой, `role="alert"`, въезд снизу вверх 220 мс. Оба
   поля входа получают красную рамку через `invalid` — чтобы было видно, куда смотреть. При
   переключении режима и при новой отправке `error` сбрасывается.
3. **Ошибка поля (регистрация).** Живёт под самим полем (`AuthField error`), как сейчас, — при
   семи полях общая плашка сверху не подсказывает, какое именно поле не так. Логика
   `passwordRules` не меняется.
4. **Успех (только вход).** `AuthSuccess` + зелёная кнопка с галочкой, пауза 400 мс, переход.
   Таймер обязательно чистится на размонтировании.
5. **Пустое состояние фото.** `branding.authImageUrl` не задан или ключа ещё нет на бэкенде →
   `AUTH_IMAGE_FALLBACK` (`/placeholders/tatev.svg`, файл уже лежит в `public/placeholders/`).
   Пока настройка летит — колонка это `bg-obsidian` + затемнение, без спиннера и без скелета:
   высота колонки задана классами, сдвига макета не будет.
6. **Экранная клавиатура на мобильном.** Экран — обычный поток документа, поэтому фокус в поле
   браузер доскроллит сам. **Не подключать `useVisualViewportHeight`** — этот хук существует
   для `position: fixed`-шторок (`Sheet`), здесь он не нужен и только создаст проблему. Условие
   работоспособности — запрет на единицы высоты вьюпорта из п. 1 требований к `AuthSplitLayout`.
7. **Уже вошедший посетитель.** `authPageLoader` отрабатывает до рендера и уводит на
   `/account`/`returnTo` — **не менять**. Новый экран этого не касается.
8. **`?returnTo=`** и принудительная смена пароля (`forceChangePassword`) — логика сохраняется
   дословно, включая `withReturnTo('/auth/change-password', returnTo)`.
9. **`prefers-reduced-motion`.** Ken Burns и волна выключаются токенами/гейтом `useReducedMotion`;
   смена цвета остаётся (`--dur-micro` намеренно не схлопывается). Собственных
   `if (reduced)`-веток в компонентах быть не должно нигде, кроме двух framer-мест
   (ken-burns и `layout`) — там иначе никак.
10. **Клавиатурная навигация.** Tab проходит: переключатель (2 радио) → поля сверху вниз →
    глаз → «Забыли пароль?» → кнопка. Фокус виден всегда (`focus-visible:ring-focus` уже есть
    в примитивах). Проверить, что `<fieldset disabled>` корректно выбрасывает поля из
    таб-порядка на время запроса.

## Мобильная адаптивность — обязательная проверка

Жёсткое требование проекта. Проверять **реально на узком экране**, не только по классам.

- **375px и 320px:** одна колонка. Фото — полоса 190px сверху, форма под ней во всю ширину
  минус `px-4`. Двух колонок ниже `lg` быть не должно ни при каком содержимом.
- **Полоса фото:** видны только надзаголовок и короткий заголовок (`auth.photo.titleShort`).
  Подзаголовок и три пункта доверия скрыты — убедиться, что они действительно не рендерятся
  видимо и не создают скролл.
- **Нижняя панель `MobileTabBar`** не должна перекрывать ни кнопку «Войти», ни ссылку
  «Вернуться на сайт». Отступ уже даёт `RootLayout` (`pb-24 lg:pb-0`) — **свой `pb-*` не
  добавлять**, иначе внизу будет двойная дыра.
- **Регистрация на 375px:** семь полей + кнопка + мелкий текст. Прокрутка страницы, не
  внутренняя прокрутка карточки.
- **Клавиатура открыта:** нажать в «Пароль» на регистрации (последние поля) — поле должно
  остаться видимым, страница доскроллиться, ничего не должно «залипнуть» под клавиатурой.
  Проверить на реальном мобильном (или в режиме устройства с эмуляцией клавиатуры).
- **Тапабельные зоны ≥ 44×44:** глаз показа пароля, оба сегмента переключателя. Мерить
  инспектором (визуальный размер меньше — расширитель невидимый, это нормально).
- **Переключение «Вход ↔ Регистрация» на мобильном:** высота карточки меняется плавно,
  страница не дёргается, скролл не прыгает.
- **Обе темы** (`dark` и `light`) на мобильном: затемнение фото должно оставаться тёмным и в
  светлой теме — токены `--hero-scrim-*` это уже обеспечивают, но проверить глазами.
- **Ландшафтная ориентация телефона (~640×360):** полоса фото 190px + форма — убедиться, что
  экран остаётся пригодным (прокруткой), а не превращается в щель.

---

## Вне скоупа

- Любые изменения `AuthShell` кроме трёх примитивов из п. 7. Шесть служебных экранов и
  `/account` визуально не трогаем (ADR 017).
- Бэкенд авторизации, поля, валидация, письма, `shared/auth/*` — не трогаем вообще.
- Состояние «успех» на регистрации, соцсети-логины, «запомнить меня», капча — не делаем.
- Админ-редактируемые тексты левой колонки (заголовок/подзаголовок/пункты доверия). Пока это
  словарь. Если Давид попросит — отдельная задача с новыми ключами `SiteSetting`.
- Реализация ключа `branding.authImageUrl` на бэкенде — это backend-developer по дополнению к
  Spec 002 (см. раздел выше). Фронт готов работать и без него.
- Палитра «Базальт и медь» — Spec 006. Экран собран на ролевых токенах и подхватит любой
  пресет сам; никаких `[data-preset]`-веток здесь писать не нужно.
