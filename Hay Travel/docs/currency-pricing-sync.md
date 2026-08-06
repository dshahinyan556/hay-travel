# Currency + tiered-pricing + booking-calendar-limit — sync doc

Working contract file for this feature. **Read this first before starting. Append your
decisions before finishing** — this is how backend-architect and architect (frontend) stay
in sync without seeing each other's session.

Full requirements/decisions already locked with Давид: see
`Hay Travel/currency-pricing-checklist.txt` (read that too, it has the full picture incl.
rounding rules, scope, and the verified real CBA SOAP contract).

## Status
- [x] backend-architect decisions (below, 2026-08-06)
- [x] architect (frontend) decisions (below, 2026-08-06)

## David confirmed after reading backend-architect's proposal (2026-08-06)
- Tier boundary is non-overlapping: **1-4 base / 5-6 +20% / 7+ hidden** (not 6+, avoids the
  5-6 vs 6+ overlap at exactly 6).
- The 7+ invitation copy ("we'll review your request and get back to you with a price")
  lives in **SiteSettingCatalog** (admin-editable, RU/EN, no redeploy needed) — NOT a
  hardcoded frontend string. Backend-developer: add one new SiteSetting key following the
  existing SiteSettingCatalog pattern (see ADR 002). Frontend reads it like any other
  site setting already surfaced to the public site (check how existing SiteSetting values
  are currently fetched/rendered client-side — reuse that path, don't build a new one).
- Frontend-side conversion+tier+rounding computation (§6 below) — confirmed, no server-trusted
  price endpoint needed at this time.

## Backend-architect decisions

**TL;DR for the frontend architect:** backend ships **only rates + per-currency rounding
step** via one new anonymous endpoint `GET /api/ExchangeRate/GetCurrent`. Tier multiplier
and currency conversion/rounding are **computed on the frontend**. Nothing in the existing
tour contract changes — `TotalPrice` / `TourDay.Price` stay AMD, no new query params on
`GetToursClient` / `GetTourInfo`. Reasoning in §6.

---

### 1. Entity + migration

`ATTours.Common/Entities/ExchangeRate.cs`

```
[EntityTypeConfiguration(typeof(ExchangeRateConfiguration))]
public class ExchangeRate : EntityBase        // Id from EntityBase
{
    string   Code              // ISO-4217 uppercase, 3 chars ("USD"/"EUR"/"RUB")
    decimal  RatePerUnitAmd    // AMD per exactly 1 unit of Code
    DateTime RateDateUtc       // CBA <CurrentDate> the value came from
    DateTime LastUpdatedUtc    // when we last WROTE a rate value
    DateTime LastAttemptUtc    // when we last CALLED CBA (success or failure)
}
```

`ATTours.Common/Infrastructure/EntityConfiguration/ExchangeRateConfiguration.cs`
- `ToTable(nameof(ExchangeRate))`
- `Code` — `IsRequired().HasMaxLength(3)`, `HasIndex(x => x.Code).IsUnique()` (identity of a
  row is the code, not Id — upsert goes by it, same rule as `SiteSetting.Key`).
- `RatePerUnitAmd` — `HasPrecision(18, 6)`. 6 decimals, not the project's usual `(18,2)`:
  CBA publishes 4–5 decimals for cheap currencies (`RUB 4.4889`, and per-100/per-1000 quotes
  go down to `0.026655`). `(18,2)` would truncate RUB to 4.49 — a ~0.2% error on every price.

`ATTours.DataLayer/ATToursContext.cs` — add `public DbSet<ExchangeRate> ExchangeRates { get; set; }`.

Migration: `AddExchangeRate`. **No seed data.** Rows are created by the first successful CBA
fetch. Seeding invented rates into a table that looks authoritative is worse than an honest
error — cold-start failure handling is in §4.

**Table shape: one row per currency** (agreed with the launcher's lean). Three columns on one
row would need a migration + entity change + DTO change for every new currency; a row means an
`INSERT`. It also lets `LastUpdatedUtc` be a real per-value fact instead of a table-wide one.

**AMD is NOT stored.** It is the base and is always exactly `1` — storing a constant invites
someone to edit it in the DB and silently break every price. AMD is emitted into the response
by the code catalog (§2).

**No translations, no `ITranslatableModel`.** Nothing here is translatable content: `Code` is
an ISO identifier and the symbol is a glyph (`֏ $ € ₽`), identical in ru/en/hy. If a currency
*name* ("Российский рубль") is ever needed in the UI, it belongs in frontend i18n strings, not
in a DB translation table.

### 2. Currency catalog — metadata in code (follows ADR 002)

`ATTours.Common/Infrastructure/Currencies/CurrencyDefinition.cs`
`ATTours.Common/Infrastructure/Currencies/CurrencyCatalog.cs`

```
CurrencyDefinition: Code, Symbol, RoundingStep (int), IsBase (bool), SortOrder (int)

CurrencyCatalog.All        -> AMD ֏ step 100 IsBase sort 0
                              USD $ step 1           sort 1
                              EUR € step 1           sort 2
                              RUB ₽ step 100         sort 3
CurrencyCatalog.ByCode(string code) -> CurrencyDefinition?
CurrencyCatalog.FetchCodes          -> ["USD","EUR","RUB"]   (non-base; whitelist when parsing CBA)
```

Exactly the `SiteSettingCatalog` split (ADR 002): **metadata in code, values in DB.** Rounding
step lives here and travels to the frontend in the response — so David's rounding rule
(RUB→100, USD/EUR→1, AMD→100) is written down in **exactly one place in the whole system**
and the frontend hardcodes no currency rule at all. Adding GBP later = one catalog entry, one
DB row, zero frontend changes.

### 3. CBA integration

`ATTours.Service/ExchangeRates/ICbaExchangeRateClient.cs`
`ATTours.Service/ExchangeRates/CbaExchangeRateClient.cs`
`ATTours.Service/ExchangeRates/CbaRatesSnapshot.cs`

Folder `ATTours.Service/ExchangeRates/` mirrors `ATTours.Service/Email/` — an outbound
third-party protocol adapter, no DB, no business rules. It does **not** go in
`Services/InfoServices|UpdateServices` (those are DB-facing verticals) and **not** in
`ATTours.Helper` (that's ASP.NET cross-cutting infra, not domain integrations).

```
interface ICbaExchangeRateClient
{
    Task<CbaRatesSnapshot> GetLatestAsync(CancellationToken cancellationToken = default);
}

record CbaRate(string Iso, decimal RatePerUnitAmd);
record CbaRatesSnapshot(DateTime CurrentDate, IReadOnlyList<CbaRate> Rates);
```

The client returns **already normalised per-1-unit** rates — the `Rate / Amount` trap never
escapes this file.

**Approach: raw `HttpClient` + hand-built SOAP 1.1 envelope + `System.Xml.Linq`.** Agreed with
the launcher's lean; no WCF / `dotnet-svcutil` / connected-service package. One operation with
a frozen contract does not justify a code-gen toolchain and a new dependency in `.Service`;
the whole call is a const string and ~15 lines of `XDocument`.

Wire details — **verified live 2026-08-06** (`?op=` help page + a real POST, not guessed):

```
POST https://api.cba.am/exchangerates.asmx
Content-Type: text/xml; charset=utf-8
SOAPAction: "http://www.cba.am/ExchangeRatesLatest"

<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body><ExchangeRatesLatest xmlns="http://www.cba.am/" /></soap:Body>
</soap:Envelope>
```

Response path (XML namespace `http://www.cba.am/`):
`Envelope/Body/ExchangeRatesLatestResponse/ExchangeRatesLatestResult/` →
`CurrentDate` + `Rates/ExchangeRate/{ISO, Amount, Rate, Difference}`.

Parsing rules — **all four are mandatory, each one is a real bug if skipped**:
1. `RatePerUnitAmd = Rate / Amount`. In today's live payload USD/EUR/RUB all have `Amount=1`,
   **but the same payload contains `JPY Amount=10`, `IRR Amount=100`, `KZT Amount=10`,
   `UZS Amount=10`** — the divisor is real and CBA may re-quote any currency. Do not shortcut
   to `decimal.Parse(Rate)` "because it's 1 today".
2. `decimal.Parse(..., CultureInfo.InvariantCulture)`. `Rate` is `"366.25"` with a dot; a
   server running under a ru/hy culture would parse it as 36625 and every price would be 100x off.
3. Skip a currency if `Amount <= 0` or `Rate <= 0` — never divide by zero, never persist a 0
   rate (a stored 0 would make the frontend divide by zero forever).
4. Keep only `CurrencyCatalog.FetchCodes`. The payload carries ~30 entries including `XAU`/`XAG`
   (gold/silver) — we store 3 rows, not 30.

`HttpClient` lifetime: a `private static readonly HttpClient` with `Timeout = TimeSpan.FromSeconds(10)`,
created once in `CbaExchangeRateClient`. Rationale: this vertical is `new`-constructed like the
rest of the project (DI is scoped to auth only, ADR 005), so no `IHttpClientFactory` is in
scope; a static instance is the correct way to avoid socket exhaustion against a single fixed
host. The 10s cap is not cosmetic — a request that hits the stale path blocks on it (§4).
If this vertical ever moves to DI, swap to `AddHttpClient(nameof(CbaExchangeRateClient))`;
`ICbaExchangeRateClient` does not change.

### 4. Refresh service + the "stale > 3h" flow

**Write side** — `ATTours.Service/Services/UpdateServices/ExchangeRateRefreshService.cs`

```
public class ExchangeRateRefreshService : RepositoryCoreBase<ExchangeRate, ATToursContextFactory>
{
    ExchangeRateRefreshService(CancellationToken ct = default, ICbaExchangeRateClient client = null)
    ExchangeRateRefreshService(IApplicationDbContext context, CancellationToken ct = default,
                               ICbaExchangeRateClient client = null)

    Task<bool> RefreshAsync();   // true = rates written; false = CBA failed, only LastAttemptUtc bumped
}
```

Base class choice — **`RepositoryCoreBase<T, ATToursContextFactory>`, not `EntityActionServiceBase`**
(same shape as `TourActivationService`). `EntityActionServiceBase` is "caller hands me entities
to persist"; here the source of truth is an HTTP response, and passing `[]` as `Entities` would
be lying about that contract. `client = null` defaults to `new CbaExchangeRateClient()` so the
service stays `new`-able from the info service while remaining substitutable in tests.

`RefreshAsync()` behaviour:
- Load all rows **tracked** (no `AsNoTracking`), match incoming ISO → existing `Code`.
- Success: upsert each of USD/EUR/RUB; set `RatePerUnitAmd`, `RateDateUtc = CurrentDate`
  (`DateTime.SpecifyKind(..., Utc)` — CBA sends `Unspecified`), `LastUpdatedUtc = UtcNow`,
  `LastAttemptUtc = UtcNow`. `SaveChangesAsync(ct)`. Return `true`.
- Failure (network / timeout / XML / parse): set `LastAttemptUtc = UtcNow` on existing rows
  only, `SaveChangesAsync(ct)`, return `false`. **Never** touch `RatePerUnitAmd` /
  `LastUpdatedUtc` on failure.

**Read side + staleness decision** — `ATTours.Service/Services/InfoServices/ExchangeRateInfo.cs`

```
public class ExchangeRateInfo : EntityInfoBase<ExchangeRate>
{
    ExchangeRateInfo()                                   // CommonSettings connection string
    ExchangeRateInfo(IApplicationDbContext context, CancellationToken ct = default)

    Task<ExchangeRatesModel> GetCurrentAsync();          // the only entry point the controller uses
}
```

The staleness check lives **here**, in `.Service` — it is a business rule ("a rate older than
3h is not good enough"), so it must not sink into the repository/`DataLayer`, and it must not
surface in the controller.

Exact flow of `GetCurrentAsync()`:
1. `rows = await GetAllAsync()` (`AsNoTracking`, inherited).
2. `isStale = CurrencyCatalog.FetchCodes.Any(code => row missing) || rows.Min(LastUpdatedUtc) < UtcNow - 3h`
3. `canAttempt = rows.Count == 0 || rows.Max(LastAttemptUtc) < UtcNow - 10min`
4. `if (isStale && canAttempt)`: construct `new ExchangeRateRefreshService(Context, CancellationToken)`
   **on the shared context and without `using`** — the context owner is this info instance, and
   disposing the borrowed service would close the connection early (same rule as
   `SiteSettingsUpdateService` → `SiteSettingsInfo`, inverted direction). If it returns `true`,
   re-read `rows`.
5. Wrap the refresh call in `catch (Exception)` + log, then continue with whatever is in the DB.
   The broad catch is deliberate: for this endpoint any failure mode (network, TLS, CBA schema
   change, parse bug) has the same correct answer — degrade, don't fail.
6. `if (rows.Count == 0)` — no rate has *ever* been stored and CBA is unreachable — this is the
   only hard error:
   `throw new ErrorModelException(GlobalErrorCode.ExchangeRatesUnavailable, HttpStatusCode.ServiceUnavailable, "...")`.
   New enum member in `ATTours.Helper/Enums/GlobalErrorCode.cs`, `ExchangeRatesUnavailable = 2012`
   (next free in the `EntityErrors` block). No new exception type and no `try/catch` in the
   controller — `ErrorModelExceptionHandlerChain` already renders it.
7. Compose and return `ExchangeRatesModel` (§5), with `IsStale` = "we are past 3h and the
   refresh did not succeed".

**Decision: on a failed refresh, serve the last known (stale) rate — do not error out.**
Reasoning: this is presentation-only pricing. No money moves (there is no Booking/Reservation
entity, nothing is charged or persisted from a price), and FX moves well under 1%/day, so a
3–24h-old rate shows a materially correct price. Erroring would take the *entire catalog and
tour detail pricing* offline because a third-party SOAP endpoint blipped — trading a ~0.5%
display inaccuracy for a broken site. The staleness is not hidden: `isStale` + `lastUpdatedUtc`
go out in the response, so the frontend can badge it if David ever wants that. The moment a
booking/payment flow exists, that flow must re-derive and re-validate the price server-side
anyway, with its own freshness policy — this decision does not constrain it.

**`LastAttemptUtc` and the 10-minute retry throttle** exist because of a concrete failure mode,
not future-proofing: without them, while CBA is down every single page view would fire its own
SOAP call and block for the full 10s timeout, so a third-party outage turns into a
site-wide 10s latency. One column and one comparison remove that.

**Still no `IMemoryCache`, confirmed.** The `ExchangeRate` table + the 3h check *is* the cache;
at current scale (single instance, LocalDB) an in-memory layer adds invalidation and
multi-instance skew for nothing. The one thing DB-only does not solve is a *concurrent*
thundering herd — N simultaneous requests arriving on a stale table all fire a CBA call before
any of them writes. At current traffic that is a non-issue. **The trigger to revisit** is real
concurrency (multi-instance hosting, or CBA rate-limiting us); the fix then is an in-process
lock or `IMemoryCache` in front of `ExchangeRateInfo` — not a redesign. Flagging, not adding.

### 5. Endpoint + DTO contract

`ATTours.ClientAPI/Controllers/ExchangeRateController.cs`

```
[ApiController]
[Route("api/[controller]")]
public class ExchangeRateController : Controller   // no IMapper — see below

[HttpGet] [Route("GetCurrent")]                    // anonymous, public site
public async Task<ExchangeRatesModel> GetCurrentAsync()
    => await new ExchangeRateInfo().GetCurrentAsync();   // `using var`, project style
```

`GET /api/ExchangeRate/GetCurrent` — **no query params.** No `languageCode` (nothing
translatable), no currency filter (the set is fixed by the catalog). Anonymous: the currency
switcher is available to everyone, logged in or not. No admin/manual-refresh endpoint — not
requested, and the 3h rule already covers it.

`ATTours.Common/DTO/Info/ExchangeRatesModel.cs`
```
string   BaseCurrency                  // always "AMD"
DateTime LastUpdatedUtc                // MIN across stored rows = age of the oldest rate
DateTime RateDateUtc                   // CBA publication date these rates come from
bool     IsStale                       // true = older than 3h and the refresh did not succeed
List<ExchangeRateInfoModel> Rates      // ordered by CurrencyCatalog.SortOrder, AMD first
```

`ATTours.Common/DTO/Info/ExchangeRateInfoModel.cs`
```
string  Code              // "AMD" | "USD" | "EUR" | "RUB"
string  Symbol            // "֏" | "$" | "€" | "₽"
decimal RatePerUnitAmd    // AMD per 1 unit; AMD itself is always exactly 1
int     RoundingStep      // 100 | 1 | 1 | 100
```

Sample response (rates are the real CBA values of 2026-08-06):
```json
{
  "baseCurrency": "AMD",
  "lastUpdatedUtc": "2026-08-06T09:14:22Z",
  "rateDateUtc": "2026-08-06T00:00:00Z",
  "isStale": false,
  "rates": [
    { "code": "AMD", "symbol": "֏", "ratePerUnitAmd": 1,        "roundingStep": 100 },
    { "code": "USD", "symbol": "$", "ratePerUnitAmd": 366.25,   "roundingStep": 1   },
    { "code": "EUR", "symbol": "€", "ratePerUnitAmd": 422.73,   "roundingStep": 1   },
    { "code": "RUB", "symbol": "₽", "ratePerUnitAmd": 4.4889,   "roundingStep": 100 }
  ]
}
```

**No AutoMapper profile entry for this vertical.** The response is a join of DB rows with
code-catalog metadata (`Symbol`/`RoundingStep` do not exist on the entity), so a profile could
map at most 2 of 4 fields. `ExchangeRateInfo` composes the model directly — precedent:
`SiteSettingsInfo.GetPublicAsync` returns a ready `Dictionary` rather than going through a profile.

**Note for the frontend architect — cold-start failure:** if this endpoint returns 503
(`ExchangeRatesUnavailable`), it means no rate has ever been stored. The frontend must degrade
to **AMD-only** (show AMD prices, disable/hide the non-AMD options in the switcher) rather than
show a broken page or NaN prices. This is the only error state this endpoint has.

### 6. KEY DECISION: tier multiplier + conversion + rounding live on the **FRONTEND**

Backend ships the *inputs* (rate, rounding step); the frontend owns the *formula*. No
`tourId + guestCount + currency → final price` endpoint.

Reasoning:

1. **It is per-viewer presentation, not domain state.** Currency is a localStorage preference
   with no backend user state (David's decision #6), and guest count is a live UI counter
   (1–16) inside `BookingCard`. A server round-trip on every `+`/`−` click adds latency and a
   loading state to an interaction that must feel instant, and buys nothing.
2. **Nothing needs a server-trusted price.** There is no Booking/Reservation/Order entity — no
   price is ever persisted, compared, or charged. A server-computed price would be advisory
   only, i.e. the exact same number the browser can compute.
3. **Computing it on the backend would not remove the frontend copy — it would create a second
   one.** Live counter feedback and the catalog's "от X" across N cards would still need
   client-side math (or N+1 requests). So "backend owns it" in practice means the rule exists
   twice, which is precisely the duplicate-logic risk to avoid.
4. **Duplicate-rule risk is instead killed by shipping the parameters.** `roundingStep` per
   currency comes from `CurrencyCatalog` (§2), so the rounding rule is defined once, on the
   backend, and the frontend never hardcodes "RUB rounds to 100". Only the tier rule (×1.2 at
   5–6, hidden at 7+) is frontend-side, and it must live in exactly one module there.
5. **Reversing this later is cheap and non-breaking.** When a booking flow appears, the server
   *must* recompute the price from `tourId + guestCount` and never trust a client-sent number —
   at that point the rule is added inside the booking service, on the server's own terms, and
   the display path stays as is. Building it now would be guessing that flow's shape.

**The formula, stated once, for the frontend architect to implement:**

```
base    = TotalPrice (AMD, from TourCardModel / TourInfoModel — unchanged)
tiered  = guests <= 4 ? base
        : guests <= 6 ? base * 1.2
        : /* 7+ */      HIDDEN — show the "leave a request" invitation instead of a price
converted = tiered / ratePerUnitAmd          // AMD row has ratePerUnitAmd = 1
final     = Math.round(converted / roundingStep) * roundingStep   // LAST step, always
```

Guard rail: if `final === 0` while `base > 0` (possible in RUB with `roundingStep = 100` on a
very cheap item), clamp to `roundingStep` instead of rendering "0 ₽".

Note on the tier boundary: David's wording is "1–4 base / 5–6 +20% / 6+ hidden". Read as
**1–4 / 5–6 / 7+** (6 gets the +20% price, hiding starts at 7). If David meant hiding from 6,
that is a one-constant change in the frontend module — worth a one-line confirmation, not a
backend change either way.

### 7. What the backend explicitly does NOT change

Important for the frontend architect — none of this moves:
- `Tour.TotalPrice`, `TourDay.Price` stay **AMD**, `decimal(18,2)`. No `Currency` column
  anywhere. Adding one would mean tour authors could enter prices in a foreign currency, which
  nobody asked for and which would make historical prices drift with FX.
- `TourInfoModel` / `TourCardModel` — unchanged, no new fields.
- `GetToursClient` / `GetFeaturedToursClient` / `GetTourInfo` — unchanged, **no** `currency` or
  `guestCount` query params.
- No changes to the admin side, `SiteSettings`, auth, or the exception chain beyond one new
  `GlobalErrorCode` member.
- The 3-month `DatePicker` limit is purely frontend — no backend availability/date entity
  exists or is being added.

### 8. File map for backend-developer

New:
- `ATTours.Common/Entities/ExchangeRate.cs`
- `ATTours.Common/Infrastructure/EntityConfiguration/ExchangeRateConfiguration.cs`
- `ATTours.Common/Infrastructure/Currencies/CurrencyDefinition.cs`
- `ATTours.Common/Infrastructure/Currencies/CurrencyCatalog.cs`
- `ATTours.Common/DTO/Info/ExchangeRatesModel.cs`
- `ATTours.Common/DTO/Info/ExchangeRateInfoModel.cs`
- `ATTours.Service/ExchangeRates/ICbaExchangeRateClient.cs`
- `ATTours.Service/ExchangeRates/CbaExchangeRateClient.cs`
- `ATTours.Service/ExchangeRates/CbaRatesSnapshot.cs`
- `ATTours.Service/Services/UpdateServices/ExchangeRateRefreshService.cs`
- `ATTours.Service/Services/InfoServices/ExchangeRateInfo.cs`
- `ATTours.ClientAPI/Controllers/ExchangeRateController.cs`
- `ATTours.DataLayer/Migrations/*_AddExchangeRate.cs`

Modified:
- `ATTours.DataLayer/ATToursContext.cs` — `DbSet<ExchangeRate> ExchangeRates`
- `ATTours.Helper/Enums/GlobalErrorCode.cs` — `ExchangeRatesUnavailable = 2012`

Untouched: `MappingProfile.cs`, `DependencyInjectionConfiguration.cs`, `Startup.cs`, every
existing entity/DTO/controller.

### 9. Open items for Давид (backend side, do not decide unilaterally)

- The 7+ "leave a request" invitation text is still open (checklist §Открытые вопросы). It is
  translatable copy that David will want to tune — a good fit for a `SiteSettingCatalog` key
  (`IsTranslatable`, `IsPublic`), which already has a public read endpoint and an admin editor.
  Backend cost is one catalog entry, zero migrations. **Recommendation, not a decision** —
  if David prefers, a frontend i18n constant is fine and cheaper. Frontend architect: assume a
  frontend constant for now, keep the string in one place so swapping the source is trivial.
- Tier boundary at 6 vs 7 (see §6) — one-line confirmation.

ADR for the §6 decision: `docs/adr/008-currency-conversion-and-tier-pricing-on-frontend.md`.

## Architect (frontend) decisions

**TL;DR for frontend-developer:** one new shared vertical `src/shared/currency/` (module-level
store + pure pricing math, flat like `shared/auth`), `formatPrice()` in `shared/lib/format.ts` is
**deleted** and replaced by a `useMoney()` binding, one new header control
`app/layout/CurrencySwitch.tsx` visible on **all** viewports, one new feature hook
`features/tours/hooks/useTierPrice.ts` used only by `BookingCard`, and the 3-month calendar limit
is the **already-existing** `DatePicker` `max` prop (no new prop). Admin is untouched.

Two corrections to assumptions that were floating around before this section — check them before
implementing:

1. **AMD *is* in the `rates` array.** §5's sample response includes
   `{"code":"AMD","symbol":"֏","ratePerUnitAmd":1,"roundingStep":100}`, and §1 only says AMD is not
   *stored in the DB*. So the frontend does **not** synthesize an AMD entry in the normal path and
   AMD is **not** a special case in the switcher — it is just the first row of a uniform 4-row list.
   A hardcoded AMD descriptor exists in the frontend for exactly one reason: the 503 cold-start
   degrade path (§F1.4).
2. **`DatePicker` already has `min?: string` / `max?: string`** (ISO `YYYY-MM-DD`, inclusive) and
   already enforces them in `isDisabledDate`. Nothing about its props changes. See §F7.

---

### F1. New shared vertical: `src/shared/currency/`

**Flat folder, no `lib/` subfolder** — mirrors `shared/auth/` exactly (8 flat files there, no
subfolders). A two-file `lib/` inside an eight-file folder buys a level of nesting and nothing else.

```
src/shared/currency/
  types.ts          — wire + state types
  currencyApi.ts    — the ONLY module that knows `api/ExchangeRate/GetCurrent`
  currencyStore.ts  — module-level observable (the store)
  pricing.ts        — PURE math: tier, convert, round. No store, no React, no i18n.
  moneyFormat.ts    — PURE presentation: number + symbol → string. No store, no React.
  useCurrency.ts    — `useSyncExternalStore` binding over the store
  useMoney.ts       — the formatting binding components actually call
  index.ts          — barrel; everything outside imports from `@/shared/currency` only
```

Same import discipline as `shared/auth/index.ts`: features and `shared/ui` import
`@/shared/currency`, never a file inside it.

#### F1.1 Why a module-level store and not React Context

Honest reasoning — do **not** repeat ADR 007's loader argument here, because today no loader reads
the currency (the backend serves AMD with no `currency` query param, so no loader needs it):

- The rate table is a **process-wide singleton with a single-flight fetch and a localStorage
  mirror**. That is module state by nature; a Context provider would be a thin wrapper around the
  same module and would have to be mounted in *two* separate route trees (`RootLayout` and the
  admin tree) or hoisted above both.
- **One store idiom per codebase.** `shared/auth` is already a module store + `useSyncExternalStore`;
  `shared/lib/locale.ts` already exposes a module-level `getStoredLocale()` next to its provider.
  A third pattern (a fresh Context) for the third global preference would be the odd one out.
- It stays readable from non-React code for free (the SEO edge function, a future loader that wants
  to prefetch, tests) at zero extra cost.

Non-React consumers today: none. That is fine and expected — it is a consistency + lifecycle
decision, not a loader decision.

**No Zustand.** Two globals in this app already use the hand-rolled pattern; adding a dependency
for the third would leave the codebase with both.

#### F1.2 `types.ts`

```ts
/**
 * NOT a union of 'AMD'|'USD'|'EUR'|'RUB'.
 * Backend §2 promises "adding GBP later = one catalog entry, one DB row, zero frontend changes".
 * A literal union would break that promise on the first new currency.
 */
export type CurrencyCode = string

/** One row of `GET /api/ExchangeRate/GetCurrent` → `rates[]`. Wire shape and UI shape are the
 *  same object here on purpose: there is nothing to map, and a second identical interface would
 *  only be one more thing to keep in sync. */
export interface CurrencyRate {
  code: CurrencyCode
  symbol: string
  /** AMD per 1 unit. AMD's own row is exactly 1. */
  ratePerUnitAmd: number
  /** 100 | 1 | 1 | 100 — comes from the backend catalog, NEVER hardcoded per currency here. */
  roundingStep: number
}

export interface ExchangeRatesModel {
  baseCurrency: CurrencyCode
  lastUpdatedUtc: string
  rateDateUtc: string
  isStale: boolean
  rates: CurrencyRate[]
}

export type RatesStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface CurrencyState {
  /** What the visitor picked (localStorage). May not be resolvable yet, or ever (503). */
  selectedCode: CurrencyCode
  /** The currency actually renderable RIGHT NOW: `selectedCode`'s rate if present in `rates`,
   *  otherwise the AMD row. Never null — this is what removes every `if (!rates)` branch from
   *  every call site. */
  active: CurrencyRate
  /** Everything the switcher offers, in backend order (AMD first). Never empty. */
  rates: readonly CurrencyRate[]
  status: RatesStatus
  /** Backend's own freshness flag, passed straight through. See F1.6 — deliberately not rendered. */
  isStale: boolean
  /** Epoch ms of the last SUCCESSFUL fetch; 0 if never. */
  lastFetchedAt: number
}
```

#### F1.3 `currencyApi.ts`

```ts
/** Throws `ApiError` (incl. the 503 `ExchangeRatesUnavailable` cold start). The store is the only
 *  caller and owns the degrade decision — this module does NOT swallow errors, unlike
 *  `shared/api/siteSettings.ts`, because "no rates" and "empty rates" are different outcomes here. */
export function fetchExchangeRates(): Promise<ExchangeRatesModel>
// => apiFetch<ExchangeRatesModel>('api/ExchangeRate/GetCurrent')
```

Anonymous endpoint → `apiFetch` from `shared/lib/http`, **not** `authFetch`.
No `languageCode` param (§5: there is none).

#### F1.4 `currencyStore.ts` — the one hardcoded currency fact, and why

```ts
const STORAGE_KEY_CURRENCY = 'hay-travel-currency'
const STORAGE_KEY_RATES    = 'hay-travel-rates'

/** The ONLY currency constant hardcoded on the frontend. Used exclusively when the endpoint is
 *  unreachable / 503 (backend §5 "Note for the frontend architect — cold-start failure": degrade
 *  to AMD-only). Without it, `state.active` could not be non-null and every price in the app
 *  would need a null branch for a case that should never reach production. */
const AMD_FALLBACK: CurrencyRate = { code: 'AMD', symbol: '֏', ratePerUnitAmd: 1, roundingStep: 100 }
```

Public API (mirrors `authStore`'s shape):

```ts
export function getCurrencyState(): CurrencyState
export function subscribeCurrency(listener: () => void): () => void

/** Single-flight, NEVER rejects. Resolves to the state after the attempt. */
export function ensureRatesReady(): Promise<CurrencyState>

/** No-op unless the last successful fetch is older than RATES_MAX_AGE_MS. Fire-and-forget. */
export function refreshRatesIfStale(): void

/** Ignores a code that is not in `state.rates` (a hand-edited localStorage value, or a currency
 *  the backend has since dropped) rather than moving the app into an unrenderable state. */
export function setCurrency(code: CurrencyCode): void
```

**Snapshot rules** (these are what make every call site branch-free):

- `state` is replaced wholesale, never mutated — `useSyncExternalStore` requires a referentially
  stable snapshot between real changes, same as `authStore.setState`.
- `active` is **derived at write time**, not by consumers. Resolution order:
  `rates.find(r => r.code === selectedCode && r.ratePerUnitAmd > 0)` → `rates.find(code === 'AMD')`
  → `AMD_FALLBACK`. The `ratePerUnitAmd > 0` guard is not paranoia about the backend: it is what
  stops a bad row from producing `Infinity`/`NaN` in every price on the page.
- `selectedCode` keeps the visitor's choice even while it is unresolvable — the switcher shows what
  they picked, `active` is what renders. The two are only different during the first ~200ms of a
  cold load, or permanently in the 503 case.

**localStorage: two keys, two different jobs.**

1. `hay-travel-currency` — the preference. Plain string. Read synchronously at module init, written
   in `setCurrency`. Both wrapped in `try/catch` (Safari private mode), same as
   `shared/lib/theme.ts` — a storage failure degrades to "AMD this session", never throws.
2. `hay-travel-rates` — a **seed cache** of the last successful response,
   `{ fetchedAt: number, payload: ExchangeRatesModel }`. Read at module init and used as the
   initial `rates` when `Date.now() - fetchedAt < 24h`; written after every successful fetch.

   Why this exists: without it, a returning visitor whose preference is USD renders **AMD prices on
   first paint and watches every price on the page change ~200ms later**. That is the worst
   possible first impression on a pricing page, and neither alternative is better — a skeleton turns
   every price into a dash, and blocking the root loader on this endpoint would let a slow CBA call
   (backend allows a 10s timeout on the stale path, §3) hold the whole site blank.

   Why a browser-side cache is legitimate here specifically: the backend's own policy is already
   "serve rates up to 3h old, and older than that on failure" (§4). A ≤24h browser seed that is
   *immediately* overwritten by the live response is strictly fresher than what the backend itself
   is willing to serve, so it introduces no new class of staleness. The 24h ceiling is the point at
   which a seed stops being a reasonable guess; past it, seed from `AMD_FALLBACK` instead.

**When rates are fetched: `void ensureRatesReady()` in `src/main.tsx`, one line under the existing
`void ensureAuthReady()`.**

- Fire-and-forget, so a slow/stale CBA path can never delay first paint. This is why it is *not* a
  root-route loader: a loader would `await`, and awaiting a call that is allowed to take 10s to
  blank the entire public site is not an acceptable failure mode for a display-only price.
- Not an effect in `RootLayout`: effects run *after* first paint, which guarantees the flicker the
  seed cache exists to prevent for the (rare) visitor with no seed.
- It also fires on `/admin`, which does not need rates. Accepted deliberately: the cost is one
  anonymous ~300-byte GET on a route only the owner visits, and the alternative — a path check in
  `main.tsx` — is a second copy of the route table that will silently rot. `ensureAuthReady()` is
  already unconditional there for the same reason.

**Cross-tab and long-lived-tab sync** (registered once at module init, mirroring `useTheme`'s
precedent — in the store, not in a component, so it works regardless of what is mounted):

- `window.addEventListener('storage', …)` on `STORAGE_KEY_CURRENCY` → re-resolve `active` and
  notify. Switching currency in one tab updates the others.
- `document.addEventListener('visibilitychange', …)` → on `visible`, call `refreshRatesIfStale()`
  with `RATES_MAX_AGE_MS = 3h`, matching the backend's own refresh window. A tab left open
  overnight must not keep showing yesterday's rate forever.

**No revalidation on currency change.** `useRevalidateOnLocaleChange` has no currency counterpart
and must not grow one: prices arrive as AMD and are converted client-side, so nothing a loader
fetched becomes stale when the currency changes. State this in the store's doc comment — it is the
first thing someone will try to add "for symmetry" with the language switch.

#### F1.5 `pricing.ts` — pure, no store, no React (this is the unit-testable module)

The tier rule exists **here and nowhere else** (§6.4). `useTierPrice`, and anything added later,
compose these; they never re-express the rule.

```ts
export const TIER_BASE_MAX_GUESTS = 4        // 1–4 → base
export const TIER_SURCHARGE_MAX_GUESTS = 6   // 5–6 → ×1.2
export const TIER_SURCHARGE_MULTIPLIER = 1.2 // 7+  → hidden
export type PriceTier = 'base' | 'surcharge' | 'hidden'

export function resolveTier(guestCount: number): PriceTier

export interface TieredPrice {
  tier: PriceTier
  /** AMD after the multiplier. `null` — and only null — when `tier === 'hidden'`, so the
   *  "no price exists to show" case is unrepresentable as a number. */
  amountAmd: number | null
}
export function applyGroupTier(amountAmd: number, guestCount: number): TieredPrice

/** AMD → target currency, UNROUNDED. `amountAmd / rate.ratePerUnitAmd` (§6). Returns 0 if
 *  `ratePerUnitAmd <= 0` rather than Infinity. */
export function convertFromAmd(amountAmd: number, rate: CurrencyRate): number

/** `Math.round(value / step) * step`. `step <= 1` → `Math.round(value)`. */
export function roundToStep(value: number, step: number): number

/** The full display pipeline: convert → round to `rate.roundingStep` → clamp.
 *  Clamp = §6's guard rail: if the result is 0 while `amountAmd > 0`, return `roundingStep`
 *  instead of rendering "0 ₽". */
export function priceInCurrency(amountAmd: number, rate: CurrencyRate): number

/** Inverse, for inputs the user types in the display currency (the catalog price filter, F6).
 *  `Math.round(amount * rate.ratePerUnitAmd)` — NO rounding step applied, on purpose: stepping a
 *  filter bound to 100 would make the field snap while the user types. */
export function amdFromCurrency(amount: number, rate: CurrencyRate): number
```

**Order of operations is non-negotiable and belongs in this file's doc comment:** tier in AMD →
multiply by guests in AMD → apply the prepayment share in AMD → convert **once** → round **once**.
Never convert per person and multiply the rounded result, and never round twice: for RUB
(`roundingStep = 100`) a per-person round on a 16-guest booking drifts by up to 800 ₽.

#### F1.6 `moneyFormat.ts` — pure presentation

```ts
export function formatMoney(amount: number, rate: CurrencyRate, locale: Locale): string
/** convert + round + format, i.e. `formatMoney(priceInCurrency(amountAmd, rate), rate, locale)`. */
export function formatAmountAmd(amountAmd: number, rate: CurrencyRate, locale: Locale): string
```

- Number: `Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 0 })`.
  Not `Intl` `style: 'currency'` — that would force decimals, its own symbol choice and its own
  placement, none of which match this design.
- Symbol placement: **prefix** by default (`$290`, `€270`, and a future `£240`), **suffix with a
  non-breaking space** for a small set — `const SUFFIX_SYMBOL_CODES = new Set(['AMD', 'RUB'])` →
  `112 000 ֏`, `24 500 ₽`. This is the one currency-specific thing the frontend legitimately owns:
  it is a *typographic* convention, not a pricing rule, and the backend has no business shipping it.
  An unknown new code lands on the prefix default and renders correctly without a frontend change.

**`isStale` renders nothing.** It is carried in state (so a badge is a one-component change if David
ever asks) but no UI reads it: the error it signals is well under 1% on a display-only price, and a
"rates may be out of date" badge on a travel site costs more trust than the inaccuracy does.
Do not invent one.

#### F1.7 `useCurrency.ts` / `useMoney.ts`

```ts
/** Whole snapshot. Only the switcher needs this. */
export function useCurrency(): CurrencyState   // useSyncExternalStore(subscribeCurrency, getCurrencyState, getCurrencyState)

export interface Money {
  /** The currency actually being rendered (`state.active`), not necessarily what was selected. */
  currency: CurrencyRate
  /** AMD in → ready-to-render string. The only thing 95% of call sites need. */
  format(amountAmd: number): string
  /** AMD in → rounded numeric amount, for `<input value>` / `aria-valuenow` / sorting. */
  amount(amountAmd: number): number
  /** Display-currency number → AMD, for fields the user types into (F6). */
  toAmd(displayAmount: number): number
}
export function useMoney(): Money
```

`useMoney` closes over `useLocale().locale` and `useCurrency().active`; the returned object is
`useMemo`'d on those two so it is referentially stable between currency/locale changes.

---

### F2. `shared/lib/format.ts` — `formatPrice()` is DELETED

Not re-signatured, not kept as a wrapper. **Delete it**; `formatDuration` and `formatTourCount`
stay.

Reasoning:

- Its current behaviour is a **bug**, not a spec (it prints `$` over an AMD number). A same-named
  replacement invites someone to assume the old call sites were fine.
- The new behaviour needs live store state. Keeping a *pure-looking* `formatPrice(price, locale)`
  that secretly reads a module global would hide the dependency at every call site and make the
  function untestable without store setup — the exact thing §F1.5's pure/binding split exists to
  avoid.
- Deleting makes the TypeScript compiler enumerate all 7 call sites, which is the cheapest possible
  guarantee that none is missed.

Migration, one per call site: `formatPrice(x, locale)` → `money.format(x)` where
`const money = useMoney()`.

| File | Line (today) | Note |
| --- | --- | --- |
| `shared/ui/TourCard.tsx` | 100 | catalog card "от X" — base 1–4 price |
| `features/tours/TourDetailPage.tsx` | 187 | additional-expense amounts (AMD line items) |
| `features/tours/TourDetailPage.tsx` | 217 | "more in region, from X" |
| `features/tours/components/BookingCard.tsx` | 73, 140, 144 | replaced by `useTierPrice`, see F5 |
| `features/regions/components/RegionPanel.tsx` | 189 | region panel card price |
| `features/tours/components/PriceSortControl.tsx` | 85, 100 | filter placeholders, see F6 |

**`shared/ui/TourCard.tsx` importing `@/shared/currency` is allowed.** `shared/ui` → `shared/*` is
not a cycle and TourCard already depends on `shared/i18n` and `shared/lib/format`; threading a
pre-formatted price down as a prop from all four render sites would be worse. TourCard is not
rendered anywhere under `/admin` (verified: `FeaturedTours`, `RegionPanel`, `ToursPage`,
`TourDetailPage` only).

**Admin stays exactly as it is — confirmed, do not touch.** `features/admin/tour-form/lib/price.ts`,
`TourDayCard.tsx`, `TourDayFields.tsx`, `TourFormHeader.tsx`, `AdditionalExpensesEditor.tsx` keep
their hardcoded `֏` and their raw un-rounded AMD values, and must **not** import
`@/shared/currency`. The admin edits the stored value; showing it converted (or rounded to the
public display's 100-step) would mean the number the owner types is not the number he sees back.
They never imported `shared/lib/format`'s `formatPrice` either — `TourDayCard.tsx:30` defines its
own unrelated local `formatPrice(raw: string)`, which stays.

---

### F3. `app/layout/CurrencySwitch.tsx` — the header control

**New file, sibling of `LanguageSwitch.tsx` / `ThemeToggle.tsx`.** Presentation lives in
`app/layout/`, state lives in `shared/currency/` — same split as `ThemeToggle` ↔ `shared/lib/theme`.

**Shape: a dropdown trigger, not a segmented pill.** `LanguageSwitch`'s segment control works for 2
options; 4 currency pills would not fit the capsule at 375px, and the control would grow every time
a currency is added — which the backend contract explicitly allows. The trigger is fixed-width
(`֏ ▾`, symbol only, ~40px) regardless of how many currencies exist.

- Desktop: `Popover` anchored to the trigger. Compact: `Sheet` with `SHEET_SINGLE_DETENT`.
  Exactly the pair `PriceSortControl` and `DatePicker` already use — **not** `shared/ui/Select`,
  whose trigger shape and labelling contract are a form control's, not a header pill's.
- Options render from `state.rates` (backend order, AMD first) as
  `<symbol> <code>` → `֏ AMD`, `$ USD`. `role="listbox"` / `role="option"` with `aria-selected`,
  keyboard: Up/Down/Home/End/Enter/Esc, 44px minimum row height (project rule).
- Trigger shows `state.rates.find(r => r.code === state.selectedCode)?.symbol ?? state.active.symbol`
  — i.e. the visitor's choice, even during the load window when `active` is still AMD.
- Accessible name: `aria-label={t('currency.switchAriaLabel')}`, `aria-haspopup="listbox"`,
  `aria-expanded`.
- 503 degrade: when `status === 'error'` and `rates.length === 1` (AMD fallback only), render the
  trigger **disabled** with the `֏` symbol. Not hidden — a control that vanishes reads as a broken
  page; a disabled one reads as "unavailable right now".

**Placement, and the mobile decision.**

In `Header.tsx`'s right-hand cluster, **first**, i.e. `CurrencySwitch → LanguageSwitch →
ThemeToggle → UserMenu`. Visible on **every** viewport — no `lg:` gate.

Justification for a mobile presence: on a travel catalog, "what does this cost in my money" is a
higher-intent question than theme or even language, mobile is the majority of the traffic, and
`Header` is `sticky top-0` on mobile too, so the control is one thumb-tap away from anywhere on the
page. **It does not go in `MobileTabBar`**: that bar's contract is four *navigation destinations*
(`NavLink`s); a stateful non-navigating control there would break the pattern and there is no room
for a fifth item at 375px.

**Required companion change in `Header.tsx` — space budget.** At 375px the cluster currently spends
~136px (RU/EN + theme + user + gaps) and the wordmark takes ~140px; a fourth control overflows. Hide
the built-in wordmark below `sm` (keep the `MountainIcon`): add `hidden sm:inline` to the
`Hay Travel` span in the no-custom-logo branch. The custom-logo `<img>` branch is already
`h-7 sm:h-8` and needs no change. **Flag for ui-ux-engineer/tester: verify the capsule at 360px and
375px before sign-off** — this is the tightest the header has ever been.

New i18n keys in `shared/i18n/dictionary.ts` (ru + en): `currency.switchAriaLabel`,
`currency.optionAriaLabel` (`'{code}'`), `currency.unavailable` (disabled-trigger `title`).
Currency *names* are deliberately not translated — the option row is symbol + ISO code, which is
identical in every locale (backend §1 makes the same call).

---

### F4. Catalog card + tour detail (base price, no tier)

Both show the **1–4 base price** (the tier only exists where a guest count exists), so both are a
pure formatting swap — no tier hook, no new component.

- `shared/ui/TourCard.tsx` — `const money = useMoney()`; line 100 becomes `money.format(tour.priceFrom)`.
  The `tourCard.priceFrom` ("цена от"/"from") caption is unchanged and still correct: it is now "from"
  in two senses (smallest group tier, and per person), which is if anything more accurate than before.
- `features/tours/TourDetailPage.tsx` — same swap at lines 187 and 217. The expense amounts (187) are
  AMD line items from the backend and convert through the identical path; they are **not** tiered
  (an entrance fee does not scale with group size).
- `features/regions/components/RegionPanel.tsx` — same swap at line 189.
- `features/home/components/FeaturedTours.tsx` — no change; it renders `TourCard`.

No new components. No presentational/container split anywhere in F4: a one-line formatting call does
not justify one.

---

### F5. `BookingCard.tsx` + `useTierPrice`

**New hook: `src/features/tours/hooks/useTierPrice.ts`.** Feature-local, not shared — the tier only
applies where a live guest counter exists, which is this one component. The *rule* still lives in
`shared/currency/pricing.ts` (F1.5); this hook only composes rule + money + booking policy.

```ts
/** Booking policy, moved here from BookingCard: the hook is what computes the figure. */
export const PREPAYMENT_SHARE = 0.2

export interface TierPriceView {
  tier: PriceTier
  /** Convenience for the render branch; `tier === 'hidden'`. */
  hidden: boolean
  /** All three are `null` — and only null — when `hidden`. Already formatted. */
  perPerson: string | null
  total: string | null
  prepayment: string | null
}

export function useTierPrice(basePerPersonAmd: number, guestCount: number): TierPriceView
```

Internals, in this exact order (F1.5's rule):

```
tiered      = applyGroupTier(basePerPersonAmd, guestCount)   // AMD
if hidden   -> { tier:'hidden', hidden:true, perPerson:null, total:null, prepayment:null }
totalAmd    = tiered.amountAmd * guestCount                  // AMD
prepayAmd   = totalAmd * PREPAYMENT_SHARE                    // AMD, NOT pre-rounded
perPerson   = money.format(tiered.amountAmd)                 // convert+round happens once, inside
total       = money.format(totalAmd)
prepayment  = money.format(prepayAmd)
```

Note `prepayAmd` is deliberately not `Math.round`ed in AMD first (today's line 36 does) — rounding
is the last step and happens once, in `money.format`.

**Changes to `BookingCard.tsx`:**

- New prop: `largeGroupInvitation: string` (see F5.1). Signature becomes
  `BookingCard({ tour, largeGroupInvitation }: { tour: TourDetail; largeGroupInvitation: string })`.
- Drop the `formatPrice` import and the local `total`/`prepayment`/`PREPAYMENT_SHARE`; call
  `useTierPrice(tour.priceFrom, guests)`.
- Lift the counter's magic numbers to named consts in this file: `const MIN_GUESTS = 1`,
  `const MAX_GUESTS = 16` (the `Math.max(1, …)` / `Math.min(16, …)` clamps at lines 119/128). With a
  tier boundary at 7 sitting three lines away, two bare numeric literals become genuinely confusing.
  The counter itself stays plain `useState` — it is one number owned by one form. No store, no
  context, no shared type.
- `<DatePicker max={…}>` — see F7.

**Render branches:**

*Not hidden (1–6)* — visually unchanged from today, only the numbers differ. The 5–6 surcharge gets
**no badge, no "+20%" label, no strikethrough**: David's requirement is a price, not a disclosed
markup, and surfacing the multiplier invites "why am I being charged more" on a page with no place
to answer it. The price simply is what it is for that group size.

*Hidden (7+)* — the price becomes a request:

- Headline block: the `֏…`/`$…` figure and the `booking.perPerson` caption are replaced by
  `largeGroupInvitation` rendered as body copy (`text-sm text-ink-dim`, not the `font-display
  text-3xl` price treatment — it is a sentence, not a number). `booking.priceFrom` ("цена от")
  caption is dropped in this branch; there is no price for it to label.
- The `<dl>` with Итого/Предоплата is **removed entirely** in this branch — not blanked, not
  shown as "—". There is no total to show, and an empty definition list is noise for a screen reader.
- Date field and guest counter: **unchanged and still active.** The date is exactly what the request
  is about, and the counter must keep working — the visitor has to be able to come back down to 6.
- Submit button: **kept and enabled**, with a different label
  (`t('booking.submitLargeGroup')` → "Оставить заявку" / "Request a quote", plus
  `booking.submitHintLargeGroup`). Disabling it would delete the only path to the action the
  invitation text just asked for. The submit handler, the date-required guard and the `submitted`
  confirmation screen are all unchanged — the underlying flow is already "a request with no
  payment", so 7+ is the same action with honest copy.
- `aria-live="polite"` on the wrapper of the price/invitation area, so crossing 6→7 with the counter
  is announced instead of silently swapping the block.

#### F5.1 Where the 7+ invitation text comes from — reuse, do not invent

**Backend-developer:** one new row in `SiteSettingCatalog.cs`, following the existing Content block:

```
new("content.largeGroupInvitation", SiteSettingGroup.Content, SettingValueType.MultilineText,
    isTranslatable: true, isPublic: true, sortOrder: 23, defaultValue: <ru>, defaultTranslations: { ru, en })
```

`sortOrder: 23` — next free number at the end of the global sequence, same rule the `seo.faviconUrl`
comment (sortOrder 22) already documents. `SiteSettingGroup.Content` = the group the frontend
already fetches. Zero migrations, admin editor for free (ADR 002). David fills in the real copy in
`Настройки → Тексты сайта` after deploy; the catalog default keeps the block from being empty in the
meantime.

**Frontend — this is the existing path, not a new one:**

1. `shared/api/siteSettings.ts` → extend the existing `ContentText` interface and `getContentText()`
   (already `group=6`, already never throws) with one field:
   `largeGroupInvitation: res.values['content.largeGroupInvitation'] ?? ''`. **No new fetch, no new
   function, no new endpoint call** — the request that already loads the catalog headings carries it.
2. `features/tours/TourDetailPage.tsx` → `tourDetailLoader` currently awaits `getTourInfo` then
   `getToursByRegion`. Add `getContentText()` to a `Promise.all` alongside the related-tours fetch
   (it never rejects, so it cannot take the page down — same contract `ToursPage`/`HomePage` already
   rely on). Return `{ tour, related, content }`.
3. `TourDetailPage` passes `largeGroupInvitation={content.largeGroupInvitation || t('booking.largeGroupFallback')}`
   down to `BookingCard`.

**One local fallback string is justified here**, unlike `content.footerTagline` (which is used bare):
a blank value would leave the 7+ branch with an empty price area and no explanation of why the price
disappeared. Same reasoning as `fallbackHero()` — never let an unfilled setting blank out something
load-bearing. So: `booking.largeGroupFallback` in `dictionary.ts` (ru + en), used only when the
setting is empty.

`BookingCard` takes the resolved string as a **prop**, and does not fetch or translate it itself:
the component stays presentational w.r.t. site settings, and the loader keeps owning the data.

---

### F6. Catalog price filter — forced into scope by the `formatPrice` deletion

`PriceSortControl.tsx` uses `formatPrice` for its two placeholders, and its two `<input type=number>`
bounds are raw AMD. Once cards show `$290`, a filter that expects `112000` typed into it is simply
broken. It is not in David's stated three places, but it cannot be left as-is.

**Decision: the URL stays AMD; the component converts at its edge.**

- `useTourFilters` / `applyTourFilters` / `?minPrice=&maxPrice=` — **unchanged, still AMD.** A shared
  catalog link then means the same set of tours regardless of what currency either person has
  selected, which a display-currency URL would not.
- `usePriceRange` — unchanged, still returns AMD `floor`/`ceiling`.
- `PriceSortControl` gains `const money = useMoney()` and converts on both edges:
  - display value shown in the input: `money.amount(amdBound)`
  - value written back: `onMinPriceChange(money.toAmd(typedValue))`
  - placeholders: `money.format(priceFloor)` / `money.format(priceCeiling)`
- The round trip is **stable**, which is why this is safe: `amdFromCurrency` and the input-side
  conversion both use plain `Math.round` with no rounding step, so
  `amount(toAmd(x)) === x` for integer `x`. Applying `roundingStep` on this path instead would make
  a RUB/AMD field snap to hundreds while the user types — that is exactly why `amdFromCurrency`
  exists separately from `priceInCurrency`.
- `<input step>` becomes `money.currency.roundingStep` (1 for USD/EUR, 100 for AMD/RUB) instead of
  the imported `PRICE_STEP`.

**Related bug this exposes — fix it in the same pass:** `PRICE_STEP = 10` and
`Math.ceil(max / 50) * 50` in `useTourFilters.ts` are USD-era constants (the doc comment still talks
about "$35 and $45"). Against AMD values in the tens of thousands they are meaningless. Change to
`PRICE_STEP = 1000` and a `/ 5000 * 5000` ceiling, and update that comment. This is AMD-domain
tidy-up, independent of the display currency.

---

### F7. `DatePicker` 3-month limit — no new prop

**Verified by reading the file: `DatePicker` already has `min?: string` and `max?: string`** (ISO
`YYYY-MM-DD`, inclusive, documented as such at lines 120–123) and already enforces both in
`isDisabledDate` (line 215) with correct `useMemo`-on-the-string handling. `DatePickerProps` does
not change at all.

What is missing is only the value, and a place to compute it that does not duplicate month
arithmetic.

**Required small refactor — extract the date helpers out of `DatePicker.tsx` into a new
`src/shared/lib/date.ts`:** `parseISODate`, `formatISODate`, `stripTime`, `addMonths`. `DatePicker`
imports them back and its behaviour must not change by one line (`isBeforeDay`, `isAfterDay`,
`isSameDay`, `addDays`, `startOfMonth`, `mondayFirstWeekday`, `getMonthGrid` stay private to
`DatePicker` — nothing else needs them).

Why extract rather than let `BookingCard` do its own: `addMonths` already carries the day-of-month
clamp (31 Jan + 1 month → 28 Feb, not 3 Mar) and `formatISODate` already avoids the `toISOString`
UTC off-by-one that this file's own doc comment warns about. A second, hand-written "today + 3
months" in `BookingCard` would be a coin flip on reproducing both.

**In `BookingCard.tsx`:**

```ts
/** David's rule: bookable window is today .. today + 3 calendar months, same day-of-month
 *  (clamped by `addMonths` when the target month is shorter). Purely a frontend limit —
 *  no backend availability entity exists (backend §7). */
const BOOKING_WINDOW_MONTHS = 3

const maxDate = useMemo(
  () => formatISODate(addMonths(stripTime(new Date()), BOOKING_WINDOW_MONTHS)),
  [],
)
...
<DatePicker ... max={maxDate} />
```

`useMemo` with `[]`: `new Date()` is a fresh object every render and would otherwise re-run
`DatePicker`'s `maxDate` memo on every keystroke elsewhere in the form. The empty dep array is
correct here for the same reason `DatePicker`'s own `today` snapshot is — a tab does not usefully
cross midnight mid-session, and `disablePast` already defaults to `true` for the lower bound.

No `min` is passed: `disablePast` already covers it and is `true` by default.

---

### F8. File map for frontend-developer

**New:**
- `src/shared/currency/types.ts`
- `src/shared/currency/currencyApi.ts`
- `src/shared/currency/currencyStore.ts`
- `src/shared/currency/pricing.ts`
- `src/shared/currency/moneyFormat.ts`
- `src/shared/currency/useCurrency.ts`
- `src/shared/currency/useMoney.ts`
- `src/shared/currency/index.ts`
- `src/shared/lib/date.ts` (extracted from `DatePicker`)
- `src/app/layout/CurrencySwitch.tsx`
- `src/features/tours/hooks/useTierPrice.ts`

**Modified:**
- `src/main.tsx` — `void ensureRatesReady()`
- `src/shared/lib/format.ts` — **delete** `formatPrice`
- `src/shared/ui/DatePicker.tsx` — import the four helpers from `shared/lib/date`; no behaviour change
- `src/shared/ui/TourCard.tsx` — `useMoney`
- `src/app/layout/Header.tsx` — mount `CurrencySwitch`; hide wordmark below `sm`
- `src/shared/api/siteSettings.ts` — one field on `ContentText` / `getContentText`
- `src/shared/i18n/dictionary.ts` — `currency.*`, `booking.submitLargeGroup`,
  `booking.submitHintLargeGroup`, `booking.largeGroupFallback` (ru + en)
- `src/features/tours/TourDetailPage.tsx` — loader returns `content`; two `useMoney` swaps; pass
  `largeGroupInvitation`
- `src/features/tours/components/BookingCard.tsx` — `useTierPrice`, 7+ branch, `max` on `DatePicker`,
  named guest consts
- `src/features/tours/components/PriceSortControl.tsx` — display-currency bounds
- `src/features/tours/hooks/useTourFilters.ts` — `PRICE_STEP` / ceiling constants to AMD scale
- `src/features/regions/components/RegionPanel.tsx` — `useMoney`

**Explicitly untouched:** everything under `src/features/admin/**` (incl. all five files with the
hardcoded `֏`), `src/app/router.tsx`, `src/app/layout/MobileTabBar.tsx`,
`src/shared/i18n/useRevalidateOnLocaleChange.ts`, `src/shared/auth/**`, `src/shared/types/tour.ts`,
`src/shared/api/tours.ts`, `vite.config.ts` / `tsconfig.json` (no new alias needed —
`@/shared/currency` resolves under the existing `@/*`).

**Nothing here is lazy-loaded.** `shared/currency` is a few KB and every public page renders a price;
a `React.lazy` boundary around it would add a suspense state to the first paint to defer bytes
smaller than one tour thumbnail. The existing route-level splitting in `router.tsx` is the right
granularity and does not change.

### F9. What tester must cover (beyond the obvious)

- 375px **and** 360px: the header capsule with four utility controls (F3), and the currency sheet.
- Guest counter 4→5→6→7→6: price steps up at 5, disappears at 7, comes back at 6. Live, no reload.
- Currency switch while sitting on `/trips` with an active price filter: cards, filter placeholders
  and the typed bounds must all move together, and the URL's `minPrice`/`maxPrice` must stay AMD.
- Second tab: switch currency in tab A, tab B follows.
- Cold start with `localStorage.hay-travel-currency = 'USD'` and a warm `hay-travel-rates` seed —
  first paint must already be in USD, with no visible re-render of the prices.
- Backend down / 503: every price renders in AMD, the switcher is disabled, nothing shows `NaN`,
  `Infinity`, `0 ₽` or `undefined`.
- Calendar: today + 3 months is selectable, +1 day past it is not; check it on the 31st of a month
  (target month shorter) and across a year boundary.

ADR по решениям F1.1 / F1.4 / F2: `docs/adr/009-frontend-currency-store-and-price-formatting.md`.
