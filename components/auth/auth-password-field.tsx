'use client';

import { useMemo, useState } from 'react';
import { Check, Eye, EyeOff, Lock, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { evaluatePasswordStrength } from '@/lib/auth/password-strength';
import type { PasswordPolicyConfig } from '@/lib/auth/password-policy';
import {
  onFrenchInputChange,
  onFrenchInputInvalid,
} from '@/lib/auth/french-input-validation';
import { cn } from '@/lib/utils';

type Props = {
  id: string
  value: string
  onChange: (value: string) => void
  policy: PasswordPolicyConfig
  placeholder?: string
  autoComplete?: string
  showStrength?: boolean
  leadingIcon?: boolean
  compactStrength?: boolean
  /** Bloque la saisie HTML via minLength (création / changement MDP). Laisser false à la connexion. */
  enforceMinLength?: boolean
}

export function AuthPasswordField({
  id,
  value,
  onChange,
  policy,
  placeholder = '••••••••',
  autoComplete = 'current-password',
  showStrength = true,
  leadingIcon = false,
  compactStrength = false,
  enforceMinLength = false,
}: Props) {
  const [visible, setVisible] = useState(false)
  const strength = useMemo(() => evaluatePasswordStrength(value, policy), [value, policy])

  return (
    <div className="auth-login-password-field">
      <div className="auth-login-password-input-wrap">
        {leadingIcon ? <Lock className="auth-login-input-icon" aria-hidden /> : null}
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          className={cn(
            'auth-login-input auth-login-input--password',
            leadingIcon && 'auth-login-input--with-icon'
          )}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onInvalid={onFrenchInputInvalid}
          onInput={onFrenchInputChange}
          required
          minLength={enforceMinLength ? policy.passwordMinLength : undefined}
          autoComplete={autoComplete}
          aria-describedby={showStrength && value.length > 0 ? `${id}-strength` : undefined}
        />
        <button
          type="button"
          className="auth-login-password-toggle"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>

      {showStrength && value.length > 0 ? (
        <div
          id={`${id}-strength`}
          className={cn(
            'auth-password-strength',
            compactStrength && 'auth-password-strength--compact'
          )}
          aria-live="polite"
        >
          <div className="auth-password-strength-head">
            <span className="auth-password-strength-label">Force du mot de passe</span>
            <span
              className={cn(
                'auth-password-strength-level',
                `auth-password-strength-level--${strength.level}`
              )}
            >
              {strength.levelLabel}
            </span>
          </div>
          <div className="auth-password-strength-track" aria-hidden>
            <div
              className={cn(
                'auth-password-strength-fill',
                `auth-password-strength-fill--${strength.level}`
              )}
              style={{ width: `${strength.score}%` }}
            />
          </div>
          <ul className="auth-password-strength-checks">
            {strength.checks.map((check) => (
              <li
                key={check.id}
                className={cn(
                  'auth-password-strength-check',
                  check.met && 'auth-password-strength-check--met'
                )}
              >
                {check.met ? (
                  <Check className="auth-password-strength-check-icon" aria-hidden />
                ) : (
                  <X className="auth-password-strength-check-icon" aria-hidden />
                )}
                <span>{check.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
