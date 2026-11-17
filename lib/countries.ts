/**
 * Country normalisation shared by the server (Eulerpool look-through) and the client (world map):
 * long English names and map short names → ISO 3166 alpha-2, ISO2 → German label and region.
 */

// ── Countries (shared by the server analysis and the client world map) ───────────────────────────────────────────────────────────────────────────────

const COUNTRY_ALIASES: Record<string, string> = {
  'united kingdom of great britain and northern ireland': 'GB',
  'united kingdom': 'GB',
  uk: 'GB',
  'united states of america': 'US',
  usa: 'US',
  'korea (the republic of)': 'KR',
  'republic of korea': 'KR',
  'south korea': 'KR',
  'taiwan (province of china)': 'TW',
  'russian federation': 'RU',
  'netherlands (kingdom of the)': 'NL',
  'viet nam': 'VN',
  'iran (islamic republic of)': 'IR',
  türkiye: 'TR',
  turkey: 'TR',
  'hong kong': 'HK',
  czechia: 'CZ',
  'czech republic': 'CZ',
  // Short names used by the world-atlas map shapes.
  'dem. rep. congo': 'CD',
  'bosnia and herz.': 'BA',
  'central african rep.': 'CF',
  's. sudan': 'SS',
  'dominican rep.': 'DO',
  'eq. guinea': 'GQ',
  'solomon is.': 'SB',
  'falkland is.': 'FK',
  'w. sahara': 'EH',
  "côte d'ivoire": 'CI',
  'n. cyprus': 'CY',
  macedonia: 'MK',
  'fr. s. antarctic lands': 'TF'
}

let reverseNames: Map<string, string> | null = null

/** English region name → ISO2, built once from the runtime's own region names. */
function countryNameIndex() {
  if (reverseNames) return reverseNames
  reverseNames = new Map()
  const en = new Intl.DisplayNames(['en'], { type: 'region' })
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b)
      try {
        const name = en.of(code)
        if (name && name !== code) reverseNames.set(name.toLowerCase(), code)
      } catch {
        // not a region code
      }
    }
  }
  return reverseNames
}

export function normalizeCountry(raw: string | null | undefined): string | null {
  const s = (raw || '').trim()
  if (!s) return null
  if (/^[A-Z]{2}$/.test(s)) return s
  const lower = s.toLowerCase()
  if (COUNTRY_ALIASES[lower]) return COUNTRY_ALIASES[lower]
  const index = countryNameIndex()
  if (index.has(lower)) return index.get(lower)!
  // "Netherlands (Kingdom of the)" → "netherlands"
  const stripped = lower.replace(/\s*\(.*\)\s*/g, '').replace(/^the /, '').trim()
  return COUNTRY_ALIASES[stripped] || index.get(stripped) || null
}

/** Country of an ISIN's issuer — the first two letters. Funds report their domicile (IE, LU) instead. */
export function countryFromIsin(isin: string | null | undefined): string | null {
  const m = /^([A-Z]{2})[A-Z0-9]{9}\d$/.exec((isin || '').trim().toUpperCase())
  if (!m || m[1] === 'XS' || m[1] === 'EU') return null
  return m[1]
}

const REGIONS: Record<string, string[]> = {
  Nordamerika: ['US', 'CA'],
  Europa: ['DE', 'FR', 'GB', 'CH', 'NL', 'SE', 'DK', 'NO', 'FI', 'IT', 'ES', 'IE', 'BE', 'AT', 'PT', 'PL', 'LU', 'CZ', 'HU', 'GR', 'IS'],
  Asien: ['JP', 'CN', 'TW', 'KR', 'IN', 'HK', 'SG', 'ID', 'TH', 'MY', 'PH', 'VN', 'PK'],
  Ozeanien: ['AU', 'NZ'],
  Lateinamerika: ['BR', 'MX', 'CL', 'CO', 'PE', 'AR'],
  'Nahost & Afrika': ['SA', 'AE', 'IL', 'QA', 'KW', 'ZA', 'EG', 'TR']
}

export function regionOf(iso2: string | null): string {
  if (!iso2) return 'Sonstige'
  for (const [region, codes] of Object.entries(REGIONS)) if (codes.includes(iso2)) return region
  return 'Sonstige'
}

let deNames: Intl.DisplayNames | null = null

/** German country name for an ISO2 code ("US" → "Vereinigte Staaten"). */
export function countryLabelDe(iso2: string) {
  try {
    deNames ??= new Intl.DisplayNames(['de'], { type: 'region' })
    return deNames.of(iso2) || iso2
  } catch {
    return iso2
  }
}
