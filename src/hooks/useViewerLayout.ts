import { useEffect, useRef, useState } from 'preact/hooks'
interface Size {
  width: number
  height: number
}

interface ViewerLayout {
  containerRef: ReturnType<typeof useRef<HTMLDivElement | null>>
  containerSize: Size
  windowWidth: number
}
export function useViewerLayout(): ViewerLayout {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState<Size>({ width: 0, height: 0 })
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)

  useEffect(() => {
    const updateWindowWidth = () => {
      setWindowWidth(window.innerWidth)
    }

    const updateContainerSize = () => {
      const container = containerRef.current
      if (!container) return
      setContainerSize({
        width: container.offsetWidth,
        height: container.offsetHeight,
      })
    }

    updateWindowWidth()
    updateContainerSize()

    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      updateContainerSize()
    })

    resizeObserver.observe(container)
    window.addEventListener('resize', updateWindowWidth)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateWindowWidth)
    }
  }, [])

  return { containerRef, containerSize, windowWidth }
}
