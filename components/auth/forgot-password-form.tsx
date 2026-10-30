'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PlatformBranding } from '@/lib/dg/platform-branding'
import {
  onFrenchInputChange,
  onFrenchInputInvalid,
  validateFrenchForm,
} from '@/lib/auth/french-input-validation'

export function ForgotPasswordForm({ branding }: { branding: PlatformBranding }) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validateFrenchForm(e.currentTarget)) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      if (!res.ok) {
        setError('Impossible d’envoyer la demande. Réessayez plus tard.')
        setIsLoading(false)
        return
      }

      setIsSubmitted(true)
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion et réessayez.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthPageShell
      branding={branding}
      title={isSubmitted ? 'Email envoyé' : 'Mot de passe oublié'}
      subtitle={
        isSubmitted
          ? 'Vérifiez votre boîte de réception'
          : 'Recevez un lien de réinitialisation par e-mail'
      }
    >
      <div className="auth-login-card">
        <div className="auth-login-card-intro">
          <h3 className="auth-login-card-title">
            {isSubmitted ? 'Email envoyé' : 'Mot de passe oublié'}
          </h3>
          <p className="auth-login-card-desc">
            {isSubmitted
              ? 'Vérifiez votre boîte de réception'
              : 'Recevez un lien de réinitialisation par e-mail'}
          </p>
        </div>

        {isSubmitted ? (
          <div className="auth-login-form">
            <div className="auth-forgot-success">
              <div className="auth-forgot-success-icon" aria-hidden>
                <CheckCircle className="h-5 w-5" />
              </div>
              <p className="auth-forgot-success-text">
                Si un compte existe avec l&apos;adresse{' '}
                <span className="font-medium text-foreground">{email}</span>, vous recevrez un
                e-mail avec les instructions pour réinitialiser votre mot de passe.
              </p>
            </div>
            <Button asChild className="auth-login-submit">
              <Link href="/login">
                <ArrowLeft className="h-3.5 w-3.5" />
                Retour à la connexion
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-login-form">
            {error ? (
              <p className="auth-login-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="auth-login-field">
              <Label htmlFor="forgot-email" className="auth-login-label">
                Adresse email
              </Label>
              <Input
                id="forgot-email"
                type="email"
                className="auth-login-input"
                placeholder="votre.email@arpt.gov.gn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onInvalid={onFrenchInputInvalid}
                onInput={onFrenchInputChange}
                required
                autoComplete="email"
              />
            </div>

            <Button type="submit" className="auth-login-submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Envoyer le lien
            </Button>

            <Link href="/login" className="auth-login-back-link">
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Retour à la connexion
            </Link>
          </form>
        )}
      </div>
    </AuthPageShell>
  )
}
