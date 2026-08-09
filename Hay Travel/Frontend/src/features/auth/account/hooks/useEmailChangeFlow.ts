/**
 * The client half of the four-step email-change flow (see `api/emailChange.ts` for the endpoints
 * and why there are four of them).
 *
 * A hook rather than logic inside `EmailChangeForm` for one concrete reason: the flow is a state
 * MACHINE, and keeping it separate is what makes "which step am I on" a single value that the form
 * only renders, instead of three booleans that can contradict each other. The form stays
 * presentational apart from its own input state.
 *
 * The server holds the real flow state (the pending code, the confirmed step, the pending new
 * address); this is the mirror the UI navigates by. On a reload the mirror resets to `'idle'` and
 * the visitor starts again — deliberate: there is no endpoint to ask "where was I", and inventing
 * one to persist a two-minute flow would be the wrong trade.
 */

import { useCallback, useRef, useState } from 'react'
import type { TranslationKey } from '@/shared/i18n/dictionary'
import { confirmEmailChangeCode, requestEmailChange, requestNewEmail } from '../api/emailChange'
import { accountErrorMessageKey } from '../lib/accountErrors'

/**
 * `idle`      — nothing started; the section shows the "change email" button.
 * `code-sent` — a code is in the CURRENT mailbox, waiting to be entered here.
 * `new-email` — the code checked out; the new address can now be submitted.
 * `link-sent` — terminal for this screen: the confirmation link is in the NEW mailbox, and it is
 *               opened there, not here (`/auth/confirm-email-change`).
 */
export type EmailChangeStep = 'idle' | 'code-sent' | 'new-email' | 'link-sent'

export interface EmailChangeFlow {
  step: EmailChangeStep
  /** A request is in flight — every action is a no-op while true, and the form disables itself. */
  pending: boolean
  /** Already-translated failure message for the LAST action, or `null`. */
  error: string | null
  /** The address the link was sent to, once `step === 'link-sent'`. */
  targetEmail: string | null
  /**
   * Only ever set by `DevEmailSender` (no SendGrid key configured): the backend echoes the token
   * back because no mail is actually sent. Always `null` in production — same contract as
   * `CheckEmailPage`'s dev link.
   */
  devToken: string | null
  start: () => void
  submitCode: (code: string) => void
  submitNewEmail: (email: string) => void
  /** Abandon the flow and go back to `idle` (the section's "cancel"). */
  reset: () => void
}

/** @param translate the caller's `t` — the hook stores presentable messages, not error objects, so
 * the form never has to know about `ApiError` shapes. */
export function useEmailChangeFlow(translate: (key: TranslationKey) => string): EmailChangeFlow {
  const [step, setStep] = useState<EmailChangeStep>('idle')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetEmail, setTargetEmail] = useState<string | null>(null)
  const [devToken, setDevToken] = useState<string | null>(null)

  /**
   * The in-flight guard is a REF, not the `pending` state: state updates are asynchronous, so two
   * submits in the same tick would both read `pending === false` and fire two POSTs — the second of
   * which would consume the one-time code the first is still validating. The state exists purely to
   * re-render the disabled UI.
   */
  const pendingRef = useRef(false)

  /**
   * One place where a step is attempted, so "clear the error, mark pending, advance or report,
   * always release pending" cannot drift between the three actions.
   */
  const run = useCallback(
    (action: () => Promise<{ devToken?: string }>, onDone: () => void) => {
      if (pendingRef.current) return
      pendingRef.current = true
      setPending(true)
      setError(null)
      action()
        .then((result) => {
          setDevToken(result.devToken ?? null)
          onDone()
        })
        .catch((err: unknown) => setError(translate(accountErrorMessageKey(err))))
        .finally(() => {
          pendingRef.current = false
          setPending(false)
        })
    },
    [translate],
  )

  const start = useCallback(() => {
    run(requestEmailChange, () => setStep('code-sent'))
  }, [run])

  const submitCode = useCallback(
    (code: string) => {
      run(
        () => confirmEmailChangeCode(code),
        () => setStep('new-email'),
      )
    },
    [run],
  )

  const submitNewEmail = useCallback(
    (email: string) => {
      run(
        () => requestNewEmail(email),
        () => {
          setTargetEmail(email)
          setStep('link-sent')
        },
      )
    },
    [run],
  )

  const reset = useCallback(() => {
    setStep('idle')
    setError(null)
    setTargetEmail(null)
    setDevToken(null)
  }, [])

  return { step, pending, error, targetEmail, devToken, start, submitCode, submitNewEmail, reset }
}
