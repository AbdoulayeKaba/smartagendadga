'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, CalendarPlus, CheckCircle2, CirclePlay } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const WORKFLOW_STEPS = [
  {
    icon: CalendarPlus,
    title: 'Demande de RDV',
    description: 'Soumission avec priorité, type et participants.',
  },
  {
    icon: CheckCircle2,
    title: 'Validation assistante',
    description: 'Approbation, refus ou reprogrammation avant publication.',
  },
  {
    icon: CalendarClock,
    title: 'Synchronisation',
    description: 'Buffer anti-conflit et publication sur l’agenda.',
  },
] as const

const DEFAULT_VIDEO_SRC = '/videos/workflow-dga.mp4'

function resolveVideoSource(raw?: string) {
  const value = raw?.trim()
  return value || DEFAULT_VIDEO_SRC
}

function toEmbedUrl(url: string) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1)
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v')
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : null
    }

    if (host === 'vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean).pop()
      return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null
    }
  } catch {
    return null
  }

  return null
}

function LandingWorkflowDemo() {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % WORKFLOW_STEPS.length)
    }, 3200)

    return () => window.clearInterval(timer)
  }, [])

  const step = WORKFLOW_STEPS[activeStep]
  const Icon = step.icon

  return (
    <div className="landing-page-workflow-demo" aria-live="polite">
      <div className="landing-page-workflow-demo-stage">
        <span className="landing-page-workflow-demo-badge">
          Étape {String(activeStep + 1).padStart(2, '0')}
        </span>
        <span className="landing-page-workflow-demo-icon" aria-hidden>
          <Icon className="h-8 w-8" />
        </span>
        <h3 className="landing-page-workflow-demo-title">{step.title}</h3>
        <p className="landing-page-workflow-demo-desc">{step.description}</p>
      </div>
      <div className="landing-page-workflow-demo-dots" aria-hidden>
        {WORKFLOW_STEPS.map((item, index) => (
          <span
            key={item.title}
            className={index === activeStep ? 'is-active' : undefined}
          />
        ))}
      </div>
    </div>
  )
}

export function LandingWorkflowVideoTrigger() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [useDemo, setUseDemo] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const configuredSource = process.env.NEXT_PUBLIC_LANDING_WORKFLOW_VIDEO_URL
  const videoSource = useMemo(() => resolveVideoSource(configuredSource), [configuredSource])
  const embedUrl = useMemo(() => toEmbedUrl(videoSource), [videoSource])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      videoRef.current?.pause()
      if (videoRef.current) videoRef.current.currentTime = 0
      return
    }

    if (embedUrl || useDemo) return

    const video = videoRef.current
    if (!video) return

    const play = () => {
      void video.play().catch(() => setUseDemo(true))
    }

    if (video.readyState >= 2) {
      play()
      return
    }

    video.addEventListener('loadeddata', play, { once: true })
    return () => video.removeEventListener('loadeddata', play)
  }, [open, embedUrl, useDemo])

  if (!mounted) {
    return (
      <span className="landing-page-cta-secondary" aria-hidden>
        <CirclePlay className="h-3.5 w-3.5" />
        Voir le workflow
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        className="landing-page-cta-secondary"
        onClick={() => {
          setUseDemo(false)
          setOpen(true)
        }}
      >
        <CirclePlay className="h-3.5 w-3.5" aria-hidden />
        Voir le workflow
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        {open ? (
          <DialogContent
            className="landing-page-workflow-video-dialog"
            showCloseButton
          >
            <DialogHeader className="landing-page-workflow-video-head">
              <DialogTitle>Parcours de bout en bout</DialogTitle>
              <DialogDescription>
                De la demande à la publication sur l&apos;agenda DGA.
              </DialogDescription>
            </DialogHeader>

            <div className="landing-page-workflow-video-frame">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title="Vidéo du workflow DGA"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : useDemo ? (
                <LandingWorkflowDemo />
              ) : (
                <video
                  ref={videoRef}
                  className="landing-page-workflow-video-player"
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => setUseDemo(true)}
                >
                  <source src={videoSource} type="video/mp4" />
                </video>
              )}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  )
}
