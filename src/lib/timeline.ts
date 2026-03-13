export const CARD_WIDTH = 144
export const CARD_HEIGHT = 96
export const CARD_GAP = 12

export const ARROW_EXPANDED_SIZE = 40
export const ARROW_COLLAPSED_SIZE = 6
export const ARROW_WIDTH = 40
export const ARROW_GAP = 12
export const SIDE_PADDING = 48

export const GLOBAL_MAX_SLOTS = 10

const getTimelineWidth = () => {
  return 2 * SIDE_PADDING + 2 * ARROW_WIDTH + 2 * ARROW_GAP
}

const getMaxDisplayableCards = (width: number) => {
  return Math.floor((width + CARD_GAP) / (CARD_WIDTH + CARD_GAP))
}

const getNumVisibleCards = (maxSlots: number, totalViews: number) => {
  return Math.max(2, Math.min(GLOBAL_MAX_SLOTS, maxSlots, totalViews))
}

export interface TimelineLayout {
  maxVisibleCards: number
  maxIndex: number
}

export function getTimelineLayout(
  windowWidth: number,
  totalViews: number
): TimelineLayout {
  const availableWidth = windowWidth - getTimelineWidth()
  const maxSlots = getMaxDisplayableCards(availableWidth)
  const maxVisibleCards = getNumVisibleCards(maxSlots, totalViews)
  const maxIndex = Math.max(0, totalViews - maxVisibleCards) // maximium visible card index, account for slide

  return {
    maxVisibleCards,
    maxIndex,
  }
}

export function clampCarouselIndex(
  index: number,
  windowWidth: number,
  totalViews: number
) {
  const { maxIndex } = getTimelineLayout(windowWidth, totalViews)
  return Math.min(index, maxIndex)
}

export function getCarouselIndexForView(
  viewIndex: number,
  currentCarouselIndex: number,
  windowWidth: number,
  totalViews: number
) {
  const { maxVisibleCards, maxIndex } = getTimelineLayout(windowWidth, totalViews)

  const windowStart = currentCarouselIndex
  const windowEnd = currentCarouselIndex + maxVisibleCards - 1

  if (viewIndex < windowStart) {
    return viewIndex
  }

  if (viewIndex > windowEnd) {
    return Math.min(viewIndex - maxVisibleCards + 1, maxIndex)
  }

  return currentCarouselIndex
}
