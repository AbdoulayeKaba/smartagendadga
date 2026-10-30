'use client'

import * as React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from 'lucide-react'

import { useToast } from '@/hooks/use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'
import './app-toast.css'

type ToastVariant = 'default' | 'success' | 'warning' | 'info' | 'destructive'

const DEFAULT_TOAST_DURATION = 4200

const VARIANT_META: Record<
  ToastVariant,
  { Icon: React.ComponentType<{ className?: string }> }
> = {
  default: { Icon: CheckCircle2 },
  success: { Icon: CheckCircle2 },
  warning: { Icon: AlertTriangle },
  info: { Icon: Info },
  destructive: { Icon: XCircle },
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider duration={DEFAULT_TOAST_DURATION}>
      {toasts.map(function ({ id, title, description, action, variant, duration, ...props }) {
        const resolvedVariant = (variant as ToastVariant) ?? 'default'
        const meta = VARIANT_META[resolvedVariant] ?? VARIANT_META.default
        const { Icon } = meta
        const effectiveDuration = duration ?? DEFAULT_TOAST_DURATION

        return (
          <Toast key={id} variant={resolvedVariant} duration={duration} {...props}>
            <span aria-hidden className="app-toast-accent" />
            <span className="app-toast-icon" aria-hidden>
              <Icon />
            </span>
            <div className="app-toast-body">
              {title ? <ToastTitle>{title}</ToastTitle> : null}
              {description ? <ToastDescription>{description}</ToastDescription> : null}
              {action ? <div className="mt-1">{action}</div> : null}
            </div>
            <ToastClose />
            {effectiveDuration !== Infinity ? (
              <span
                aria-hidden
                className="app-toast-progress"
                style={{ ['--app-toast-duration' as string]: `${effectiveDuration}ms` }}
              />
            ) : null}
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
