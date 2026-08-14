import { CARDS, type Card } from '../data/cards'
import { STYLES } from '../data/styles'
import { createEyePair } from '../eyes/Eye'
import './layout.css'

/** Cards likely above the fold on any breakpoint; the rest load lazily. */
const EAGER_CARDS = 4

export function createCard(card: Card, index: number): HTMLElement {
  const style = STYLES[card.bg]
  if (!style) throw new Error(`createCard: unknown bg style "${card.bg}"`)

  const el = document.createElement('article')
  el.className = 'card'

  const bg = document.createElement('img')
  bg.className = 'card__bg'
  bg.src = `/styles/${card.bg}/bg.png`
  // intrinsic size reserves the aspect ratio, so lazy cards cause no shift
  bg.width = style.bgSize[0]
  bg.height = style.bgSize[1]
  bg.alt = ''
  bg.decoding = 'async'
  bg.loading = index < EAGER_CARDS ? 'eager' : 'lazy'

  el.append(bg, createEyePair(card.eyes, card))
  return el
}

export function buildFeed(cards: readonly Card[] = CARDS): HTMLElement {
  const feed = document.createElement('div')
  feed.className = 'feed'
  cards.forEach((card, i) => feed.append(createCard(card, i)))
  return feed
}
