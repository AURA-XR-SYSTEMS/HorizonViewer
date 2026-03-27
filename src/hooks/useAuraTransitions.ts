import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { ProjectConfig } from '@/types'

interface UseAuraTransitionsParams {
  currentViewId: number
  transitions: ProjectConfig['transitions']
  onViewChange: (viewId: number) => void
}

export interface TransitionDebugState {
  key: string
  src: string
  targetViewId: number | null
  loadedMetadata: boolean
  canPlay: boolean
  playRequested: boolean
  playAttempted: boolean
  playRejected: string | null
  playing: boolean
  advancing: boolean
  completionFired: boolean
  completionSignal: string | null
  committedViewId: number | null
  currentTime: number
  duration: number | null
  paused: boolean
  ended: boolean
  error: string | null
  lastEvent: string | null
}

function isTransitionDebugEnabled(): boolean {
  if (import.meta.env.DEV) {
    return true
  }

  if (typeof window === 'undefined') {
    return false
  }

  const params = new URLSearchParams(window.location.search)
  const value = params.get('transitionDebug')?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes'
}

export function useAuraTransitions({
  currentViewId,
  transitions,
  onViewChange,
}: UseAuraTransitionsParams) {
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const playbackMonitorFrames = useRef<Record<string, number | null>>({})
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [activeTransitionKey, setActiveTransitionKey] = useState<string | null>(null)
  const [showStaticImage, setShowStaticImage] = useState(true)
  const [transitionDebug, setTransitionDebug] = useState<Record<string, TransitionDebugState>>({})

  const debugEnabled = isTransitionDebugEnabled()

  const transitionMap = useMemo(
    () => new Map(transitions.map((transition) => [transition.key, transition])),
    [transitions]
  )

  const updateDebugState = (key: string, video: HTMLVideoElement | null, patch: Partial<TransitionDebugState>) => {
    setTransitionDebug((prev) => {
      const current = prev[key] ?? {
        key,
        src: video?.currentSrc || video?.src || '',
        targetViewId: null,
        loadedMetadata: false,
        canPlay: false,
        playRequested: false,
        playAttempted: false,
        playRejected: null,
        playing: false,
        advancing: false,
        completionFired: false,
        completionSignal: null,
        committedViewId: null,
        currentTime: 0,
        duration: Number.isFinite(video?.duration) ? (video?.duration ?? null) : null,
        paused: video?.paused ?? true,
        ended: false,
        error: null,
        lastEvent: null,
      }

      return {
        ...prev,
        [key]: {
          ...current,
          src: video?.currentSrc || video?.src || current.src,
          currentTime: video?.currentTime ?? current.currentTime,
          duration:
            video && Number.isFinite(video.duration) ? video.duration : current.duration,
          paused: video?.paused ?? current.paused,
          ...patch,
        },
      }
    })
  }

  const emitDebugLog = (key: string, event: string, video: HTMLVideoElement | null, extra: Record<string, unknown> = {}) => {
    if (!debugEnabled) {
      return
    }

    console.info('[AuraTransition]', key, event, {
      currentTime: video?.currentTime ?? null,
      paused: video?.paused ?? null,
      readyState: video?.readyState ?? null,
      networkState: video?.networkState ?? null,
      currentSrc: video?.currentSrc ?? video?.src ?? null,
      ...extra,
    })
  }

  const stopPlaybackMonitor = (key: string) => {
    const frame = playbackMonitorFrames.current[key]
    if (frame !== null && frame !== undefined) {
      window.cancelAnimationFrame(frame)
      playbackMonitorFrames.current[key] = null
    }
  }

  const startPlaybackMonitor = (key: string, video: HTMLVideoElement) => {
    stopPlaybackMonitor(key)

    let lastTime = video.currentTime
    const tick = () => {
      const nextTime = video.currentTime
      if (nextTime > lastTime) {
        updateDebugState(key, video, {
          advancing: true,
          currentTime: nextTime,
          lastEvent: 'timeupdate',
        })
      }
      lastTime = nextTime

      if (!video.paused && !video.ended) {
        playbackMonitorFrames.current[key] = window.requestAnimationFrame(tick)
      } else {
        playbackMonitorFrames.current[key] = null
      }
    }

    playbackMonitorFrames.current[key] = window.requestAnimationFrame(tick)
  }

  useEffect(() => {
    transitions.forEach((transition) => {
      const video = videoRefs.current[transition.key]
      if (video) {
        updateDebugState(transition.key, video, {
          key: transition.key,
          src: video.currentSrc || video.src || transition.videoUrl,
        })
      }
    })
  }, [transitions])

  useEffect(() => {
    const cleanups: Array<() => void> = []

    transitions.forEach((transition) => {
      const video = videoRefs.current[transition.key]
      if (!video) {
        return
      }

      const key = transition.key
      const handleLoadedMetadata = () => {
        emitDebugLog(key, 'loadedmetadata', video)
        updateDebugState(key, video, {
          loadedMetadata: true,
          duration: Number.isFinite(video.duration) ? video.duration : null,
          lastEvent: 'loadedmetadata',
        })
      }

      const handleCanPlay = () => {
        emitDebugLog(key, 'canplay', video)
        updateDebugState(key, video, {
          canPlay: true,
          lastEvent: 'canplay',
        })
      }

      const handlePlay = () => {
        emitDebugLog(key, 'play', video)
        updateDebugState(key, video, {
          playAttempted: true,
          lastEvent: 'play',
        })
      }

      const handlePlaying = () => {
        emitDebugLog(key, 'playing', video)
        updateDebugState(key, video, {
          playing: true,
          paused: false,
          playRejected: null,
          lastEvent: 'playing',
        })
        startPlaybackMonitor(key, video)
      }

      const handlePause = () => {
        emitDebugLog(key, 'pause', video)
        updateDebugState(key, video, {
          playing: false,
          paused: true,
          lastEvent: 'pause',
        })
        stopPlaybackMonitor(key)
      }

      const handleTimeUpdate = () => {
        updateDebugState(key, video, {
          currentTime: video.currentTime,
          duration: Number.isFinite(video.duration) ? video.duration : null,
          advancing: video.currentTime > 0,
          lastEvent: 'timeupdate',
        })
      }

      const handleEnded = () => {
        emitDebugLog(key, 'ended', video)
        updateDebugState(key, video, {
          ended: true,
          playing: false,
          paused: true,
          lastEvent: 'ended',
        })
        stopPlaybackMonitor(key)
      }

      const handleError = () => {
        const mediaError = video.error
        const errorMessage = mediaError
          ? `MediaError code=${mediaError.code}`
          : 'Unknown media error'
        emitDebugLog(key, 'error', video, { error: errorMessage })
        updateDebugState(key, video, {
          error: errorMessage,
          playing: false,
          lastEvent: 'error',
        })
        stopPlaybackMonitor(key)
      }

      video.addEventListener('loadedmetadata', handleLoadedMetadata)
      video.addEventListener('canplay', handleCanPlay)
      video.addEventListener('play', handlePlay)
      video.addEventListener('playing', handlePlaying)
      video.addEventListener('pause', handlePause)
      video.addEventListener('timeupdate', handleTimeUpdate)
      video.addEventListener('ended', handleEnded)
      video.addEventListener('error', handleError)
      video.load()

      cleanups.push(() => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
        video.removeEventListener('canplay', handleCanPlay)
        video.removeEventListener('play', handlePlay)
        video.removeEventListener('playing', handlePlaying)
        video.removeEventListener('pause', handlePause)
        video.removeEventListener('timeupdate', handleTimeUpdate)
        video.removeEventListener('ended', handleEnded)
        video.removeEventListener('error', handleError)
        stopPlaybackMonitor(key)
      })
    })

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [transitions])

  useEffect(() => {
    if (!debugEnabled || typeof window === 'undefined') {
      return
    }

    ;(window as Window & { __AURA_TRANSITION_DEBUG__?: Record<string, TransitionDebugState> }).__AURA_TRANSITION_DEBUG__ =
      transitionDebug
  }, [debugEnabled, transitionDebug])

  useEffect(() => {
    setTransitionDebug((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([key, value]) => [
          key,
          {
            ...value,
            committedViewId: currentViewId,
          },
        ])
      )
    )
  }, [currentViewId])

  const resetTransitionState = () => {
    setShowStaticImage(true)
    setIsTransitioning(false)
    setActiveTransitionKey(null)
  }

  const transitionToView = (targetViewId: number) => {
    if (isTransitioning || targetViewId === currentViewId) return

    const transitionKey = `${currentViewId}-${targetViewId}`
    const transition = transitionMap.get(transitionKey)

    if (!transition) {
      emitDebugLog(transitionKey, 'missing-transition-definition', null, {
        currentViewId,
        targetViewId,
      })
      onViewChange(targetViewId)
      return
    }

    const video = videoRefs.current[transitionKey]
    if (!video) {
      emitDebugLog(transitionKey, 'missing-transition-video-ref', null, {
        currentViewId,
        targetViewId,
      })
      onViewChange(targetViewId)
      return
    }

    setActiveTransitionKey(transitionKey)
    setIsTransitioning(true)

    let completionFinalized = false

    const removeCompletionListeners = () => {
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('timeupdate', handleCompletionTimeUpdate)
    }

    const removeStartupListeners = () => {
      video.removeEventListener('seeked', handleSeeked)
    }

    const finalizeTransition = (signal: string) => {
      if (completionFinalized) {
        return
      }
      completionFinalized = true
      removeStartupListeners()
      removeCompletionListeners()
      emitDebugLog(transitionKey, 'transition-complete', video, {
        signal,
        targetViewId,
      })
      updateDebugState(transitionKey, video, {
        completionFired: true,
        completionSignal: signal,
        committedViewId: targetViewId,
        ended: signal === 'ended' || video.ended,
        lastEvent: 'transition-complete',
      })
      onViewChange(targetViewId)
      resetTransitionState()
    }

    const handleEnded = () => {
      finalizeTransition('ended')
    }

    const handleCompletionTimeUpdate = () => {
      const duration = video.duration
      if (!Number.isFinite(duration) || duration <= 0) {
        return
      }

      if (video.currentTime >= duration - 0.05) {
        finalizeTransition('timeupdate-near-end')
      }
    }

    const startPlayback = () => {
      setShowStaticImage(false)
      updateDebugState(transitionKey, video, {
        targetViewId,
        playRequested: true,
        playRejected: null,
        ended: false,
        advancing: false,
        completionFired: false,
        completionSignal: null,
        lastEvent: 'play-requested',
      })
      emitDebugLog(transitionKey, 'play-requested', video)

      video.play().catch((error) => {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Video play failed:', error)
        emitDebugLog(transitionKey, 'play-rejected', video, { error: message })
        updateDebugState(transitionKey, video, {
          playAttempted: true,
          playRejected: message,
          playing: false,
          lastEvent: 'play-rejected',
        })
        onViewChange(targetViewId)
        resetTransitionState()
      })
    }

    const handleSeeked = () => {
      emitDebugLog(transitionKey, 'seeked', video)
      removeStartupListeners()
      startPlayback()
    }

    video.pause()
    video.addEventListener('ended', handleEnded)
    video.addEventListener('timeupdate', handleCompletionTimeUpdate)
    video.addEventListener('seeked', handleSeeked)
    video.defaultMuted = true
    video.muted = true
    video.playsInline = true
    video.currentTime = 0

    // If the video is already at the beginning, some browsers will not emit `seeked`.
    if (Math.abs(video.currentTime) < 0.001) {
      removeStartupListeners()
      startPlayback()
    }
  }

  return {
    debugEnabled,
    transitionDebug,
    videoRefs,
    isTransitioning,
    activeTransitionKey,
    showStaticImage,
    transitionToView,
  }
}
