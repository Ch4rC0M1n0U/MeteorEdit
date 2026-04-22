import type { IEntity } from '../../types'

type ExcalidrawElement = Record<string, unknown>

const CATEGORY_COLORS: Record<string, string> = {
  identity: '#3b82f6',
  phone: '#22c55e',
  email: '#22c55e',
  snapchat: '#a855f7',
  facebook: '#a855f7',
  instagram: '#a855f7',
  twitter: '#a855f7',
  tiktok: '#a855f7',
  discord: '#a855f7',
  telegram: '#a855f7',
  linkedin: '#a855f7',
  ip: '#f97316',
  address: '#f97316',
  vehicle: '#f97316',
  iban: '#f97316',
  pseudo: '#a855f7',
  other: '#6b7280',
}

const TYPE_ICONS: Record<string, string> = {
  identity: '👤',
  phone: '📞',
  email: '✉️',
  snapchat: '👻',
  facebook: '📘',
  instagram: '📷',
  twitter: '🐦',
  tiktok: '🎵',
  discord: '💬',
  telegram: '✈️',
  linkedin: '💼',
  ip: '🌐',
  address: '📍',
  vehicle: '🚗',
  iban: '🏦',
  pseudo: '🎭',
  other: '📌',
}

// Normalize legacy French type labels to canonical keys
const LEGACY_TYPE_MAP: Record<string, string> = {
  'Identité': 'identity',
  'Téléphone': 'phone',
  'Email': 'email',
  'Pseudo': 'pseudo',
  'Snapchat': 'snapchat',
  'Facebook': 'facebook',
  'Instagram': 'instagram',
  'Twitter / X': 'twitter',
  'TikTok': 'tiktok',
  'Discord': 'discord',
  'Telegram': 'telegram',
  'LinkedIn': 'linkedin',
  'Adresse IP': 'ip',
  'Adresse postale': 'address',
  'Véhicule': 'vehicle',
  'IBAN': 'iban',
  'Autre': 'other',
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function normalizeType(rawType: string): string {
  if (LEGACY_TYPE_MAP[rawType]) return LEGACY_TYPE_MAP[rawType]
  const lower = rawType.toLowerCase()
  if (CATEGORY_COLORS[lower]) return lower
  return 'other'
}

export function buildEntityElements(
  entity: IEntity,
  cx: number,
  cy: number
): ExcalidrawElement[] {
  const type = normalizeType(entity.type || 'other')
  const color = CATEGORY_COLORS[type] ?? '#6b7280'
  const icon = TYPE_ICONS[type] ?? '📌'
  const label = entity.name || entity.value || '—'
  const typeLabel = `${icon} ${entity.type || type}`

  const groupId = uid()
  const rectId = uid()
  const textTypeId = uid()
  const textNameId = uid()

  const W = 280
  const H = 76
  const x = cx - W / 2
  const y = cy - H / 2

  const rect: ExcalidrawElement = {
    id: rectId,
    type: 'rectangle',
    x,
    y,
    width: W,
    height: H,
    angle: 0,
    strokeColor: color,
    backgroundColor: color + '18',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    roundness: { type: 3, value: 8 },
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    groupIds: [groupId],
    frameId: null,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
  }

  const textType: ExcalidrawElement = {
    id: textTypeId,
    type: 'text',
    x: x + 12,
    y: y + 10,
    width: W - 24,
    height: 20,
    angle: 0,
    strokeColor: color,
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    roundness: null,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    groupIds: [groupId],
    frameId: null,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    text: typeLabel,
    fontSize: 14,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    originalText: typeLabel,
    lineHeight: 1.25,
  }

  const truncatedLabel = label.length > 36 ? label.slice(0, 34) + '…' : label
  const textName: ExcalidrawElement = {
    id: textNameId,
    type: 'text',
    x: x + 12,
    y: y + 36,
    width: W - 24,
    height: 26,
    angle: 0,
    strokeColor: '#e2e8f0',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    roundness: null,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    groupIds: [groupId],
    frameId: null,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    text: truncatedLabel,
    fontSize: 18,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    originalText: truncatedLabel,
    lineHeight: 1.25,
  }

  return [rect, textType, textName]
}

export function buildNoteElements(
  title: string,
  cx: number,
  cy: number
): ExcalidrawElement[] {
  const color = '#64748b'
  const groupId = uid()
  const rectId = uid()
  const textTypeId = uid()
  const textNameId = uid()

  const W = 280
  const H = 76
  const x = cx - W / 2
  const y = cy - H / 2

  const rect: ExcalidrawElement = {
    id: rectId,
    type: 'rectangle',
    x,
    y,
    width: W,
    height: H,
    angle: 0,
    strokeColor: color,
    backgroundColor: color + '18',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    roundness: { type: 3, value: 8 },
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    groupIds: [groupId],
    frameId: null,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
  }

  const typeLabel = '📝 Note'
  const textType: ExcalidrawElement = {
    id: textTypeId,
    type: 'text',
    x: x + 12,
    y: y + 10,
    width: W - 24,
    height: 20,
    angle: 0,
    strokeColor: color,
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    roundness: null,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    groupIds: [groupId],
    frameId: null,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    text: typeLabel,
    fontSize: 14,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    originalText: typeLabel,
    lineHeight: 1.25,
  }

  const truncatedTitle = title.length > 36 ? title.slice(0, 34) + '…' : title
  const textName: ExcalidrawElement = {
    id: textNameId,
    type: 'text',
    x: x + 12,
    y: y + 36,
    width: W - 24,
    height: 26,
    angle: 0,
    strokeColor: '#e2e8f0',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    roundness: null,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    groupIds: [groupId],
    frameId: null,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    text: truncatedTitle,
    fontSize: 18,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    originalText: truncatedTitle,
    lineHeight: 1.25,
  }

  return [rect, textType, textName]
}
