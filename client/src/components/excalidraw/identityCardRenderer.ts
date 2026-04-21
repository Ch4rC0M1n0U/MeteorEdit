export interface IdentityCardInput {
  name: string
  description?: string
  photoUrl?: string
}

export interface IdentityCardResult {
  dataURL: string
  width: number
  height: number
  fileId: string
}

const CARD_WIDTH = 280
const CARD_HEIGHT = 110

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  // Skip encrypted files — they cannot be rendered as images
  if (url.endsWith('.enc')) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export async function renderIdentityCard(
  input: IdentityCardInput
): Promise<IdentityCardResult> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')!

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT)
  grad.addColorStop(0, '#1e3a5f')
  grad.addColorStop(1, '#0f172a')
  ctx.fillStyle = grad

  // Rounded rect background
  ctx.beginPath()
  ctx.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 10)
  ctx.fill()

  // Blue accent left bar
  ctx.fillStyle = '#3b82f6'
  ctx.beginPath()
  ctx.roundRect(0, 0, 5, CARD_HEIGHT, [10, 0, 0, 10])
  ctx.fill()

  // Avatar area
  const avatarX = 28
  const avatarY = CARD_HEIGHT / 2
  const avatarR = 32

  let photoLoaded = false

  if (input.photoUrl) {
    const img = await loadImage(input.photoUrl)
    if (img) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2)
      ctx.restore()
      photoLoaded = true
    }
  }

  if (!photoLoaded) {
    // Colored circle with initials
    ctx.fillStyle = '#3b82f6'
    ctx.beginPath()
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(getInitials(input.name), avatarX, avatarY)
  }

  // Avatar border
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2)
  ctx.stroke()

  // Text area
  const textX = avatarX + avatarR + 14

  // IDENTITÉ badge
  ctx.fillStyle = '#3b82f6'
  ctx.beginPath()
  ctx.roundRect(textX, 14, 62, 16, 4)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 10px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('IDENTITÉ', textX + 6, 22)

  // Name
  const nameMaxWidth = CARD_WIDTH - textX - 14
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 17px sans-serif'
  ctx.textBaseline = 'top'
  const name = input.name.length > 24 ? input.name.slice(0, 22) + '…' : input.name
  ctx.fillText(name, textX, 38, nameMaxWidth)

  // Description (date of birth or other info)
  if (input.description) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '13px sans-serif'
    const desc =
      input.description.length > 30
        ? input.description.slice(0, 28) + '…'
        : input.description
    ctx.fillText(desc, textX, 62, nameMaxWidth)
  }

  const dataURL = canvas.toDataURL('image/png')
  return {
    dataURL,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fileId: uid(),
  }
}
