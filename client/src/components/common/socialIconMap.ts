// Mapping centralisé: clé normalisée → icône Iconify + couleur officielle
// Utilisé par SocialIcon.vue et entityElementsBuilder.ts

export const SOCIAL_ICON_MAP: Record<string, string> = {
  // Réseaux sociaux
  facebook:   'logos:facebook',
  instagram:  'skill-icons:instagram',
  twitter:    'logos:twitter',
  'twitter/x': 'logos:x',
  x:          'logos:x',
  tiktok:     'logos:tiktok-icon',
  snapchat:   'logos:snapchat-icon',
  linkedin:   'logos:linkedin-icon',
  discord:    'logos:discord-icon',
  telegram:   'logos:telegram',
  whatsapp:   'logos:whatsapp-icon',
  youtube:    'logos:youtube-icon',
  reddit:     'logos:reddit-icon',
  twitch:     'logos:twitch',
  pinterest:  'logos:pinterest',
  // Types non-sociaux (fallback MDI)
  identity:   'mdi:account',
  phone:      'mdi:phone',
  email:      'mdi:email',
  pseudo:     'mdi:drama-masks',
  ip:         'mdi:web',
  address:    'mdi:map-marker',
  vehicle:    'mdi:car',
  iban:       'mdi:bank',
  other:      'mdi:pin',
}

export const SOCIAL_COLOR_MAP: Record<string, string> = {
  facebook:   '#1877F2',
  instagram:  '#E4405F',
  twitter:    '#1DA1F2',
  'twitter/x': '#000000',
  x:          '#000000',
  tiktok:     '#010101',
  snapchat:   '#FFFC00',
  linkedin:   '#0A66C2',
  discord:    '#5865F2',
  telegram:   '#26A5E4',
  whatsapp:   '#25D366',
  youtube:    '#FF0000',
  reddit:     '#FF4500',
  twitch:     '#9146FF',
  pinterest:  '#E60023',
  // Types non-sociaux
  identity:   '#3b82f6',
  phone:      '#22c55e',
  email:      '#22c55e',
  pseudo:     '#a855f7',
  ip:         '#f97316',
  address:    '#f97316',
  vehicle:    '#f97316',
  iban:       '#f97316',
  other:      '#6b7280',
}
