const CARD_WIDTH = 144
const CARD_GAP = 12
const ARROW_WIDTH = 40
const ARROW_GAP = 12
const SIDE_PADDING = 48
const GLOBAL_MAX_SLOTS = 10

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
  // consider 15 views, but we can only see 10, so max visible index is 15-10 = 5 ...? I don't get it
  const maxIndex = Math.max(0, totalViews - maxVisibleCards)

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
