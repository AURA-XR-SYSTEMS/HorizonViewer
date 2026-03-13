import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { ProjectConfig } from '@/types'

interface UseAuraTransitionsParams {
  currentViewId: number
  transitions: ProjectConfig['transitions']
  onViewChange: (viewId: number) => void
}

export function useAuraTransitions({
  currentViewId,
  transitions,
  onViewChange,
}: UseAuraTransitionsParams) {
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [activeTransitionKey, setActiveTransitionKey] = useState<string | null>(null)
  const [showStaticImage, setShowStaticImage] = useState(true)

  const transitionMap = useMemo(
    () => new Map(transitions.map((transition) => [transition.key, transition])),
    [transitions]
  )

  // consider smarter video loading approach
  useEffect(() => {
    transitions.forEach((transition) => {
      const video = videoRefs.current[transition.key]
      if (video) {
        video.load
      }
    })
  }, [transitions])

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
      onViewChange(targetViewId)
      return
    }

    const video = videoRefs.current[transitionKey]
    if (!video) {
      onViewChange(targetViewId)
      return
    }

    setActiveTransitionKey(transitionKey)
    setIsTransitioning(true)

    const handleEnded = () => {
      video.onended = null
      onViewChange(targetViewId)
      resetTransitionState()
    }

    const handleSeeked = () => {
      video.removeEventListener('seeked', handleSeeked)
      setShowStaticImage(false)

      video.play().catch((error) => {
        console.error('Video play failed:', error)
        onViewChange(targetViewId)
        resetTransitionState()
      })
    }

    video.onended = handleEnded
    video.addEventListener('seeked', handleSeeked)
    video.currentTime = 0
  }

  return {
    videoRefs,
    isTransitioning,
    activeTransitionKey,
    showStaticImage,
    transitionToView,
  }
}
