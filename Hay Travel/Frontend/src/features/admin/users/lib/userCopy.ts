/**
 * Copy and error mapping for the «Пользователи» screens (ADR 021).
 *
 * `ru` is the source of truth, `en` is type-checked against it — see `shared/i18n/defineCopy.ts`.
 * Everything that is NOT translatable (the numeric `GlobalErrorCode`s this screen understands, the
 * option builder) stays a plain export of this file, outside `defineCopy`.
 *
 * Role captions live HERE and not in `shared/auth`: that module is the auth protocol (types, store,
 * permissions) and has no business carrying locale-dependent UI text. The public site has its own
 * role labels in `features/auth/lib/roleLabels.ts`, routed through the public dictionary; the two
 * sets are worded for different audiences and deliberately not shared.
 *
 * `roleLabels` covers the four BUILT-IN tiers only, and is used where a `RoleType` is genuinely the
 * subject (the promotion dialog). Everywhere a specific account's role is displayed the caption is
 * `user.roleName` from the server — a user-created role has no `RoleType` to look up.
 */

import { defineCopy } from '@/shared/i18n/defineCopy'
import { ApiError } from '@/shared/lib/http'
import { RoleType } from '@/shared/auth'
import type { RoleInfoModel } from '@/features/admin/types/roles'
import type { SelectOption } from '@/shared/ui'

/** `GlobalErrorCode` values this screen's mutations can report — the admin panel keeps its own
 * local copy of the numeric codes it cares about rather than a shared dictionary (mirrors
 * `catalogErrors.ts`/`ProductsPage.tsx`'s own `errorCodeOf`, the established pattern here; the
 * i18n `AuthErrorCode` in `shared/auth` is for the public site's login/register forms only). */
const ADMIN_ROLE_IMMUTABLE = 2214 // ChangeRole (B6) — target's current role is Admin.
const CANNOT_DELETE_SELF = 2212 // Delete (B4).
const ACCOUNT_DELETED = 2213 // Delete (B4) — target was already soft-deleted (stale page).
const ADMIN_ACCOUNT_IMMUTABLE = 2215 // Delete — target's role is Admin (mirrors ADMIN_ROLE_IMMUTABLE).
/* One code, two situations since 2026-08-27 — the message below has to answer for both:
 * D3's original one (the ACTOR is not the SuperAdmin, on a role/account of admin tier) and
 * `SuperAdminGuard`'s new one (the TARGET is the SuperAdmin, whoever the actor is). The response
 * carries nothing that tells them apart, so no call site can pick a wording per case. */
const SUPER_ADMIN_REQUIRED = 2216
/* Impersonation (spec 014 §5). The UI hides the button on your own profile and on an elevated
 * target, so both of these in practice mean the page was stale (the target's role changed under
 * it) — they are surfaced as sentences anyway, never as a raw code. */
const CANNOT_IMPERSONATE_SELF = 2217
const IMPERSONATION_TARGET_NOT_ALLOWED = 2218

export const userCopy = defineCopy(
  {
    roleLabels: {
      [RoleType.Regular]: 'Пользователь',
      [RoleType.TourManager]: 'Тур-менеджер',
      [RoleType.Admin]: 'Администратор',
      [RoleType.Employee]: 'Исполнитель',
    } as Record<RoleType, string>,

    page: {
      title: 'Пользователи',
      subtitle: 'Все учётные записи и их роли. Смена роли применяется сразу.',
      emptyFiltered: 'Ничего не найдено по заданным фильтрам.',
      /** Replaced the old hard-coded «Что даёт роль» legend: with user-created roles those four
       * descriptions became a guess. What a role allows is now editable data, so the page links to
       * where it can be read and changed instead of restating it. */
      roleLegend: 'Что именно даёт каждая роль — на странице',
      roleLegendLink: 'Роли и права',
      singleAdminNote: 'Сейчас администратор один — снять эту роль с него нельзя, пока не назначен другой.',
      superAdminOnlyNote: 'Назначать и снимать роль администратора может только главный администратор.',
    },

    toolbar: {
      searchPlaceholder: 'Поиск по имени, логину, email или телефону…',
      searchAria: 'Поиск пользователей',
      allRoles: 'Все роли',
      allStatuses: 'Все статусы',
      roleFilterAria: 'Фильтр по роли',
      statusFilterAria: 'Фильтр по статусу',
    },

    /** Two independent account states, reused by the table row and the detail header. */
    status: {
      verified: 'Подтверждён',
      unverified: 'Не подтверждён',
      locked: 'Заблокирован',
      lockedTitle: 'Временная блокировка после неудачных попыток входа',
    },

    table: {
      colName: 'Имя',
      colUsername: 'Логин',
      colEmail: 'Email',
      colPhone: 'Телефон',
      colStatus: 'Статус',
      colRole: 'Роль',
      itsYou: 'это вы',
      ownRoleLocked: 'Свою роль изменить нельзя',
      /** Accessible name of one row's `RoleSelect` — the visible label is a column header. */
      roleAria: (userLabel: string) => `Роль: ${userLabel}`,
    },

    /** Explanatory text under a disabled `RoleSelect` (F5). As of D3 this is shown only when the
     * actor is NOT the SuperAdmin — for the SuperAdmin the control is live, so the hint would be
     * wrong. */
    adminRoleImmutableHint: 'Снять роль администратора может только главный администратор',

    /** Under a `RoleSelect` disabled because the TARGET is the главный администратор
     * (`SuperAdminGuard`, 2026-08-27). Отдельно от `adminRoleImmutableHint`: там речь о ТИРЕ роли и
     * запрет снимается, если действует главный администратор, — здесь он безусловный, и никакие
     * права действующего пользователя его не открывают. */
    superAdminImmutableHint: 'Учётную запись главного администратора может изменять только он сам',

    /** Confirm dialog for promoting somebody to Admin (D5). Promotion had no confirmation at all
     * before — it was a plain select — which is too quiet for the one change that hands over full
     * control of the panel. */
    promote: {
      title: (userLabel: string) => `Назначить «${userLabel}» администратором?`,
      body:
        'Администратор получает полный доступ к панели: справочники, настройки, удаление туров и ' +
        'управление ролями других пользователей. Снять эту роль сможет только главный администратор.',
      confirm: 'Назначить',
      pending: 'Назначаем…',
    },

    header: {
      breadcrumbAria: 'Хлебные крошки',
    },

    /** «Войти как пользователь» (spec 014 §3) — действие в управляющей зоне карточки и его
     * подтверждение. Кнопки «вернуться в свой аккаунт» нет и не будет: выход из чужого сеанса —
     * это обычный логаут и повторный вход. */
    impersonate: {
      button: 'Войти как пользователь',
      pending: 'Входим…',
      title: (userLabel: string) => `Войти как «${userLabel}»?`,
      body:
        'Вы продолжите работу от имени этого пользователя. Ваш собственный сеанс администратора ' +
        'завершится немедленно — на всех устройствах и вкладках. Чтобы вернуться в свою учётную ' +
        'запись, нужно будет войти заново; кнопки «вернуться» нет.',
      confirm: 'Войти как пользователь',
      /** Кнопка видна, но заблокирована: сервер откажет (2218), потому что у цели повышенные
       * права, а действующий администратор — не главный. */
      elevatedHint: 'Войти в аккаунт с повышенными правами может только главный администратор',
    },

    /** Письмо со ссылкой на смену пароля (2026-08-27) — действие в управляющей зоне, рядом с
     * «Войти как пользователь». Намеренно НЕ в «опасной зоне»: письмо ничего не ломает и не
     * блокирует вход, в отличие от принудительного сброса, который стоит там. */
    passwordResetEmail: {
      button: 'Отправить ссылку на смену пароля',
      pending: 'Отправляем…',
      /** Адрес в тексте — чтобы было видно, КУДА ушло письмо: у клиента в карточке может быть не
       * тот email, который админ держал в голове. */
      sent: (email: string) => `Ссылка на смену пароля отправлена на ${email}.`,
      /** `title` заблокированной кнопки для цели-главного администратора: письмо со ссылкой —
       * такой же путь к захвату учётки, как и сброс пароля, поэтому закрыто тем же guard'ом. */
      superAdminHint: 'Отправить эту ссылку главному администратору может только он сам',
    },

    /** Read-only data grid of the user-detail screen (F4). */
    info: {
      contacts: 'Контакты',
      email: 'Email',
      phone: 'Телефон',
      username: 'Логин',
      account: 'Аккаунт',
      registeredAt: 'Дата регистрации',
      role: 'Роль',
      defaultJobRole: 'Роль исполнителя (по умолчанию)',
      defaultJobRoleAria: 'Роль исполнителя по умолчанию',
      preferredLanguage: 'Язык писем',
      preferredLanguageAria: 'Язык писем пользователя',
      session: 'Сессия и геолокация',
      registeredIp: 'IP регистрации',
      lastLoginIp: 'IP последней активности',
      country: 'Страна',
    },

    /** «В сети» approximation — see `lib/onlineStatus.ts`. The English variant drops the Russian
     * gendered form: `Был(а) X` → `Last seen X`. */
    online: {
      online: 'В сети',
      lastSeen: (relative: string) => `Был(а) ${relative}`,
      noActivity: 'Нет данных об активности',
    },

    history: {
      title: 'История входов',
      subtitle: 'Только успешные входы. Обновление токена входом не считается.',
      loadFailed: 'Не удалось загрузить историю входов. Остальные данные пользователя показаны выше.',
      empty:
        'Входов пока нет — либо пользователь ни разу не входил, либо все его входы были до ' +
        'появления этой истории.',
      limitNote: (limit: number) => `Показаны последние ${limit} входов.`,
    },

    danger: {
      sectionTitle: 'Опасная зона',
      resetHeading: 'Принудительный сброс пароля',
      resetHint: 'Пользователь будет обязан задать новый пароль при следующем входе',
      resetButton: 'Сбросить пароль',
      resetting: 'Сброс…',
      confirmReset: 'Сбросить',
      deleteHeading: 'Удалить пользователя',
      deleteHint: 'Необратимо в панели. Аккаунт будет деактивирован',
      deleteButton: 'Удалить пользователя',
      deleting: 'Удаление…',
      confirmDelete: 'Удалить',
    },

    /** Copy for the user-detail screen (F4/F14). */
    detail: {
      helpTitle: 'Карточка пользователя',
      helpBody:
        '«В сети» — приблизительный статус: считается по времени последнего авторизованного запроса ' +
        'этого пользователя, обновляется не чаще раза в 5 минут, без отдельного опроса сервера. IP и ' +
        'страна показываются только здесь, не в общем списке пользователей. Удаление — мягкое: аккаунт ' +
        'скрывается из панели и перестаёт работать, но его данные не стираются физически; после удаления ' +
        'тот же email/логин можно зарегистрировать заново.',
      deleteTitle: (userLabel: string) => `Удалить пользователя «${userLabel}»?`,
      deleteBody:
        'Аккаунт будет деактивирован и скрыт из списка пользователей. Восстановить его из панели ' +
        'администратора нельзя.',
      /** Harsher variant for deleting ANOTHER ADMIN's account (D3) — only the SuperAdmin ever sees
       * the button enabled in that case, and the consequences are wider than for a regular
       * account. */
      deleteAdminBody:
        'Это учётная запись АДМИНИСТРАТОРА. Вместе с доступом к панели она потеряет и права на ' +
        'справочники, настройки и управление ролями. Аккаунт будет деактивирован и скрыт из списка; ' +
        'восстановить его из панели нельзя.',
      deleteSelfHint: 'Свою же учётную запись удалить нельзя',
      deleteAdminHint: 'Удалить аккаунт администратора может только главный администратор',
      /** Не вариант `deleteAdminHint`, а другой запрет (`SuperAdminGuard`, 2026-08-27): тот
       * снимается для главного администратора, этот — ни для кого. */
      deleteSuperAdminHint: 'Учётную запись главного администратора не может удалить никто другой',
      deleteNoPermissionHint: 'У вашей роли нет права удалять пользователей',
      resetNoPermissionHint: 'У вашей роли нет права изменять пользователей',
      resetSuperAdminHint: 'Сбросить пароль главного администратора может только он сам',
      resetTitle: (userLabel: string) => `Сбросить пароль «${userLabel}»?`,
      resetBody: 'Пользователь будет обязан задать новый пароль при следующем входе.',
    },

    /** What was being attempted — substituted into `errors.forbidden`/`server`/`network` so no
     * call site has to spell a sentence fragment out itself. */
    errorActions: {
      changeRole: (userLabel: string) => `изменить роль пользователя «${userLabel}»`,
      changeJobRole: 'изменить роль исполнителя по умолчанию',
      changePreferredLanguage: 'изменить язык писем пользователя',
      deleteUser: 'удалить пользователя',
      resetPassword: 'сбросить пароль',
      sendPasswordResetEmail: 'отправить ссылку на смену пароля',
      impersonate: 'войти как пользователь',
    },

    errors: {
      cannotImpersonateSelf: 'Нельзя войти в свою же учётную запись — вы уже в ней.',
      impersonationTargetNotAllowed:
        'В эту учётную запись входить нельзя: у неё повышенные права. Такое действие доступно ' +
        'только главному администратору.',
      adminRoleImmutable: 'Роль администратора можно снять только напрямую в базе данных.',
      cannotDeleteSelf: 'Нельзя удалить свою же учётную запись.',
      adminAccountImmutable: 'Аккаунт администратора можно удалить только напрямую в базе данных.',
      superAdminRequired:
        'Это действие доступно только главному администратору — а его собственную учётную запись ' +
        'не может изменить никто, кроме него самого.',
      accountDeleted: 'Этот пользователь уже удалён — обновите страницу.',
      forbidden: (action: string) => `Не удалось ${action}: недостаточно прав.`,
      server: (action: string, status: number) => `Не удалось ${action}: сервер вернул ошибку (${status}).`,
      network: (action: string) => `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`,
      /** Never rendered — `AdminErrorBoundary` shows its own message for a thrown `Response` — but
       * the route still throws a human-readable body, so it belongs here like any other string. */
      invalidId: 'Некорректный идентификатор пользователя',
    },
  },
  {
    roleLabels: {
      [RoleType.Regular]: 'User',
      [RoleType.TourManager]: 'Tour manager',
      [RoleType.Admin]: 'Administrator',
      [RoleType.Employee]: 'Employee',
    } as Record<RoleType, string>,

    page: {
      title: 'Users',
      subtitle: 'Every account and its role. A role change takes effect immediately.',
      emptyFiltered: 'Nothing matches the current filters.',
      roleLegend: 'What each role actually allows is described on',
      roleLegendLink: 'Roles & permissions',
      singleAdminNote:
        'There is only one administrator right now — that role cannot be removed until another one is appointed.',
      superAdminOnlyNote: 'Only the super administrator can grant and revoke the Administrator role.',
    },

    toolbar: {
      searchPlaceholder: 'Search by name, username, email or phone…',
      searchAria: 'Search users',
      allRoles: 'All roles',
      allStatuses: 'All statuses',
      roleFilterAria: 'Filter by role',
      statusFilterAria: 'Filter by status',
    },

    status: {
      verified: 'Verified',
      unverified: 'Not verified',
      locked: 'Locked',
      lockedTitle: 'Temporarily locked after failed sign-in attempts',
    },

    table: {
      colName: 'Name',
      colUsername: 'Username',
      colEmail: 'Email',
      colPhone: 'Phone',
      colStatus: 'Status',
      colRole: 'Role',
      itsYou: "it's you",
      ownRoleLocked: 'You cannot change your own role',
      roleAria: (userLabel: string) => `Role: ${userLabel}`,
    },

    adminRoleImmutableHint: 'Only the super administrator can revoke the Administrator role',

    superAdminImmutableHint: 'Only the super administrator can change their own account',

    promote: {
      title: (userLabel: string) => `Make “${userLabel}” an administrator?`,
      body:
        'An administrator gets full access to the panel: catalogues, settings, tour deletion and ' +
        'the roles of other users. Only the super administrator will be able to revoke this role.',
      confirm: 'Appoint',
      pending: 'Appointing…',
    },

    header: {
      breadcrumbAria: 'Breadcrumbs',
    },

    impersonate: {
      button: 'Sign in as user',
      pending: 'Signing in…',
      title: (userLabel: string) => `Sign in as “${userLabel}”?`,
      body:
        'You will continue as this user. Your own administrator session ends immediately — on ' +
        'every device and tab. To get back to your own account you will have to sign in again; ' +
        'there is no “return” button.',
      confirm: 'Sign in as user',
      elevatedHint: 'Only the super administrator can sign in as an account with elevated rights',
    },

    passwordResetEmail: {
      button: 'Send a password reset link',
      pending: 'Sending…',
      sent: (email: string) => `A password reset link has been sent to ${email}.`,
      superAdminHint: 'Only the super administrator can have this link sent to themselves',
    },

    info: {
      contacts: 'Contacts',
      email: 'Email',
      phone: 'Phone',
      username: 'Username',
      account: 'Account',
      registeredAt: 'Registered on',
      role: 'Role',
      defaultJobRole: 'Employee role (default)',
      defaultJobRoleAria: 'Default employee role',
      preferredLanguage: 'Email language',
      preferredLanguageAria: 'User’s email language',
      session: 'Session and location',
      registeredIp: 'Registration IP',
      lastLoginIp: 'Last activity IP',
      country: 'Country',
    },

    online: {
      online: 'Online',
      lastSeen: (relative: string) => `Last seen ${relative}`,
      noActivity: 'No activity data',
    },

    history: {
      title: 'Sign-in history',
      subtitle: 'Successful sign-ins only. A token refresh does not count as one.',
      loadFailed: "Could not load the sign-in history. The user's other data is shown above.",
      empty:
        'No sign-ins yet — either the user has never signed in, or all of their sign-ins predate ' +
        'this history.',
      limitNote: (limit: number) => `Showing the latest ${limit} sign-ins.`,
    },

    danger: {
      sectionTitle: 'Danger zone',
      resetHeading: 'Force a password reset',
      resetHint: 'The user will have to set a new password at their next sign-in',
      resetButton: 'Reset password',
      resetting: 'Resetting…',
      confirmReset: 'Reset',
      deleteHeading: 'Delete user',
      deleteHint: 'Irreversible from the panel. The account will be deactivated',
      deleteButton: 'Delete user',
      deleting: 'Deleting…',
      confirmDelete: 'Delete',
    },

    detail: {
      helpTitle: 'User profile',
      helpBody:
        '“Online” is an approximation: it is derived from the time of this user’s last ' +
        'authenticated request, refreshed at most once every 5 minutes, with no separate polling of ' +
        'the server. The IP and the country are shown here only, not in the users list. Deletion is ' +
        'soft: the account is hidden from the panel and stops working, but its data is not physically ' +
        'erased; after deletion the same email/username can be registered again.',
      deleteTitle: (userLabel: string) => `Delete the user “${userLabel}”?`,
      deleteBody:
        'The account will be deactivated and hidden from the users list. It cannot be restored from ' +
        'the admin panel.',
      deleteAdminBody:
        'This is an ADMINISTRATOR account. Along with access to the panel it will lose the rights to ' +
        'catalogues, settings and role management. The account will be deactivated and hidden from ' +
        'the list; it cannot be restored from the panel.',
      deleteSelfHint: 'You cannot delete your own account',
      deleteAdminHint: 'Only the super administrator can delete an administrator account',
      deleteSuperAdminHint: 'Nobody else can delete the super administrator account',
      deleteNoPermissionHint: 'Your role cannot delete users',
      resetNoPermissionHint: 'Your role cannot modify users',
      resetSuperAdminHint: 'Only the super administrator can reset their own password',
      resetTitle: (userLabel: string) => `Reset the password of “${userLabel}”?`,
      resetBody: 'The user will have to set a new password at their next sign-in.',
    },

    errorActions: {
      changeRole: (userLabel: string) => `change the role of “${userLabel}”`,
      changeJobRole: 'change the default employee role',
      changePreferredLanguage: 'change the user’s email language',
      deleteUser: 'delete the user',
      resetPassword: 'reset the password',
      sendPasswordResetEmail: 'send a password reset link',
      impersonate: 'sign in as this user',
    },

    errors: {
      cannotImpersonateSelf: 'You cannot sign in as yourself — you already are.',
      impersonationTargetNotAllowed:
        'You may not sign in as this account: it holds elevated rights. Only the super ' +
        'administrator can do that.',
      adminRoleImmutable: 'The Administrator role can only be revoked directly in the database.',
      cannotDeleteSelf: 'You cannot delete your own account.',
      adminAccountImmutable: 'An administrator account can only be deleted directly in the database.',
      superAdminRequired:
        'Only the super administrator can do this — and their own account cannot be modified by ' +
        'anyone else.',
      accountDeleted: 'This user has already been deleted — refresh the page.',
      forbidden: (action: string) => `Could not ${action}: you do not have permission.`,
      server: (action: string, status: number) =>
        `Could not ${action}: the server returned an error (${status}).`,
      network: (action: string) => `Could not ${action}: check your connection and try again.`,
      invalidId: 'Invalid user identifier',
    },
  },
)

export type UserCopy = ReturnType<typeof userCopy>

/**
 * Options for one row's `RoleSelect`, built from `GET api/Roles`.
 *
 * The list comes from the server, not from a hard-coded tier order: since roles are user-creatable
 * there is no fixed set to enumerate, and the old `roleIdFor(tier, users)` trick — inferring a role
 * ROW id from whichever account happened to be on that tier — cannot name a role nobody holds yet.
 * Captions are `role.name`, never `roleLabels[...]`: a custom role has no `RoleType` to look up.
 *
 * A `CanManageAdmins` role is offered ONLY to the SuperAdmin (D3) — an ordinary admin cannot
 * promote anyone into it, and showing an option the backend answers 403 to would be a lie. This is
 * a check of the FLAG, not of `role.type`: any role, built-in or custom, can carry it now (решение
 * Давида 2026-08-22).
 *
 * The CURRENT role is always included even when `allowAdminOption` is false. That is not a courtesy
 * but a correctness requirement: `Select` falls back to its placeholder when `value` matches no
 * option, so dropping a locked role's own entry would render the account as "nothing selected".
 * The row stays readable — the role name, disabled, with `adminRoleImmutableHint` under it.
 */
export function buildRoleOptions(
  roles: RoleInfoModel[],
  currentRoleId: number,
  allowAdminOption: boolean,
): SelectOption[] {
  return roles
    .filter((role) => !role.canManageAdmins || allowAdminOption || role.id === currentRoleId)
    .map((role) => ({ value: String(role.id), label: role.name }))
}

/** Maps a failed mutation to a sentence. `copy` comes from the caller (`useCopy(userCopy)` in a
 * component) — this stays a pure function of its arguments, per Spec 009 §3. */
export function usersErrorMessage(copy: UserCopy, err: unknown, action: string): string {
  if (err instanceof ApiError) {
    const code = errorCodeOf(err.body)
    if (code === CANNOT_IMPERSONATE_SELF) return copy.errors.cannotImpersonateSelf
    if (code === IMPERSONATION_TARGET_NOT_ALLOWED) return copy.errors.impersonationTargetNotAllowed
    if (code === ADMIN_ROLE_IMMUTABLE) return copy.errors.adminRoleImmutable
    if (code === CANNOT_DELETE_SELF) return copy.errors.cannotDeleteSelf
    if (code === ADMIN_ACCOUNT_IMMUTABLE) return copy.errors.adminAccountImmutable
    if (code === SUPER_ADMIN_REQUIRED) return copy.errors.superAdminRequired
    if (code === ACCOUNT_DELETED) return copy.errors.accountDeleted
    if (err.status === 403) return copy.errors.forbidden(action)
    return copy.errors.server(action, err.status)
  }
  return copy.errors.network(action)
}

function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}
