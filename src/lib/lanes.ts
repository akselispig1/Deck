import type { Lane } from '../types'

export interface LaneMeta {
  key: Lane
  label: string
  // Tailwind colour token name (matches tailwind.config.js + index.css)
  token: string
  // Google Calendar colorId (1–11) mapped from the lane — see §8.
  googleColorId: string
}

// The four lanes share one timeline. Colours identify; they don't shout.
export const LANES: Record<Lane, LaneMeta> = {
  // googleColorId = the nearest Google Calendar event colour to each brand hue.
  school: { key: 'school', label: 'School', token: 'school', googleColorId: '9' }, // Blueberry ≈ blue
  charq: { key: 'charq', label: 'CharQ', token: 'charq', googleColorId: '2' }, // Sage ≈ green
  freelance: {
    key: 'freelance',
    label: 'Freelance',
    token: 'freelance',
    googleColorId: '11', // Tomato ≈ red
  },
  training: {
    key: 'training',
    label: 'Training',
    token: 'training',
    googleColorId: '5', // Banana ≈ yellow
  },
}

export const LANE_ORDER: Lane[] = ['school', 'charq', 'freelance', 'training']

// The CSS variable for a lane, e.g. `rgb(var(--school))`. Used where a raw
// colour string is needed (SVG, inline styles) rather than a Tailwind class.
export function laneVar(lane: Lane): string {
  return `rgb(var(--${lane}))`
}

export function laneVarAlpha(lane: Lane, alpha: number): string {
  return `rgb(var(--${lane}) / ${alpha})`
}
