export interface Size {
  width: number
  height: number
}

export interface PinPositionResult {
  left: string
  top: string
  visible: boolean
}

export function calculatePinPosition(
  pinX: number,
  pinY: number,
  containerSize: Size,
  imageNaturalSize: Size
): PinPositionResult {
  if (
    containerSize.width === 0 ||
    containerSize.height === 0 ||
    imageNaturalSize.width === 0 ||
    imageNaturalSize.height === 0
  ) {
    return {
      left: `${pinX}%`,
      top: `${pinY}%`,
      visible: true,
    }
  }

  const containerAspect = containerSize.width / containerSize.height
  const imageAspect = imageNaturalSize.width / imageNaturalSize.height

  let renderedWidth: number
  let renderedHeight: number
  let offsetX: number
  let offsetY: number

  if (containerAspect > imageAspect) {
    renderedWidth = containerSize.width
    renderedHeight = renderedWidth / imageAspect
    offsetX = 0
    offsetY = (containerSize.height - renderedHeight) / 2
  } else {
    renderedHeight = containerSize.height
    renderedWidth = renderedHeight * imageAspect
    offsetX = (containerSize.width - renderedWidth) / 2
    offsetY = 0
  }

  const pixelX = offsetX + (pinX / 100) * renderedWidth
  const pixelY = offsetY + (pinY / 100) * renderedHeight

  const visible =
    pixelX >= 0 &&
    pixelX <= containerSize.width &&
    pixelY >= 0 &&
    pixelY <= containerSize.height

  return {
    left: `${pixelX}px`,
    top: `${pixelY}px`,
    visible,
  }
}
