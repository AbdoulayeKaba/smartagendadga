/** Pays du monde pour les missions DG (ISO 3166-1 alpha-2, noms en français, drapeaux emoji). */

import { getCountryDialCode } from '@/lib/workspace/mission-country-dial-codes';

export type MissionCountry = {
  code: string;
  name: string;
  flag: string;
  dialCode: string | null;
};

/** Codes ISO 3166-1 alpha-2 (États, territoires et régions géographiques courantes). */
const ISO_ALPHA2 = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
] as const;

/** Priorité affichage (Afrique de l’Ouest + partenaires fréquents du cabinet). */
const PRIORITY_CODES = [
  'GN', 'SN', 'CI', 'ML', 'BF', 'NE', 'LR', 'SL', 'GM', 'GW', 'CV', 'MR', 'TG', 'BJ', 'GH', 'NG',
  'CM', 'GA', 'CG', 'CD', 'MA', 'TN', 'DZ', 'FR', 'BE', 'CH', 'DE', 'GB', 'US', 'CA', 'CN', 'IN',
  'AE', 'SA', 'BR', 'JP', 'ZA', 'KE', 'ET',
];

export function flagFromCode(code: string): string {
  const c = code.toUpperCase();
  if (c.length !== 2) return '🏳️';
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 - 65 + ch.charCodeAt(0)));
}

function frenchCountryName(code: string): string | null {
  try {
    const dn = new Intl.DisplayNames(['fr'], { type: 'region' });
    const name = dn.of(code);
    if (!name || name === code) return null;
    return name;
  } catch {
    return null;
  }
}

function buildMissionCountries(): MissionCountry[] {
  const list: MissionCountry[] = [];
  for (const code of ISO_ALPHA2) {
    const name = frenchCountryName(code);
    if (!name) continue;
    list.push({
      code,
      name,
      flag: flagFromCode(code),
      dialCode: getCountryDialCode(code),
    });
  }
  const priority = new Set(PRIORITY_CODES);
  return list.sort((a, b) => {
    const pa = priority.has(a.code) ? 0 : 1;
    const pb = priority.has(b.code) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name, 'fr');
  });
}

export const MISSION_COUNTRIES: MissionCountry[] = buildMissionCountries();

const BY_CODE = new Map(MISSION_COUNTRIES.map((c) => [c.code, c]));

export function getMissionCountry(code: string): MissionCountry | undefined {
  return BY_CODE.get(code.toUpperCase());
}

export function isMissionCountryCode(code: string): boolean {
  return BY_CODE.has(code.trim().toUpperCase());
}

/** Retrouve un code ISO à partir d’un libellé stocké (code, nom ou « +224 Guinée »). */
export function resolveCountryCodeFromLabel(stored: string): string | null {
  const trimmed = stored.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && BY_CODE.has(upper)) return upper;
  for (const country of MISSION_COUNTRIES) {
    if (trimmed === formatCountryLabel(country)) return country.code;
    if (trimmed.toLowerCase() === country.name.toLowerCase()) return country.code;
  }
  const legacy = parseLegacyDestination(trimmed);
  return legacy[0] ?? null;
}

export function countryLabelFromCode(code: string): string {
  const country = getMissionCountry(code);
  return country ? formatCountryLabel(country) : code;
}

export function matchesCountrySearch(country: MissionCountry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const needleDigits = needle.replace(/\D/g, '');
  const dial = country.dialCode?.toLowerCase() ?? '';
  const dialDigits = dial.replace(/\D/g, '');

  if (country.name.toLowerCase().includes(needle)) return true;
  if (country.code.toLowerCase().includes(needle)) return true;
  if (dial.includes(needle)) return true;
  if (needleDigits.length > 0 && dialDigits.includes(needleDigits)) return true;

  return false;
}

/** Premier code pays d’une mission (destinations ou libellé legacy). */
export function defaultCountryCodeFromMission(mission: {
  destinations?: string[] | null;
  destination: string;
}): string {
  if (Array.isArray(mission.destinations) && mission.destinations.length > 0) {
    return mission.destinations[0]!;
  }
  return parseLegacyDestination(mission.destination)[0] ?? '';
}

const FLAG_ICONS_CDN_VERSION = '7.2.3';

/** Sources drapeau (local → CDN SVG → CDN PNG) — évite les emoji « ZA » sous Windows. */
export function countryFlagSources(code: string): string[] {
  const c = code.toLowerCase();
  return [
    `/flags/${c}.svg`,
    `https://cdn.jsdelivr.net/gh/lipis/flag-icons@${FLAG_ICONS_CDN_VERSION}/flags/4x3/${c}.svg`,
    `https://flagcdn.com/h20/${c}.png`,
  ];
}

/** @deprecated Préférer countryFlagSources + CountryFlagImage */
export function countryFlagImageUrl(code: string, width = 24): string {
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
}

/** Libellé avec indicatif : « +224 Guinée » */
export function formatCountryLabel(country: MissionCountry): string {
  return country.dialCode ? `${country.dialCode} ${country.name}` : country.name;
}

/** Libellé affiché : « +224 Guinée, +221 Sénégal » */
export function formatMissionDestinations(codes: string[]): string {
  return codes
    .map((code) => {
      const c = getMissionCountry(code);
      return c ? formatCountryLabel(c) : code;
    })
    .join(', ');
}

/** Tente de retrouver des codes à partir d’un libellé legacy (texte libre). */
export function parseLegacyDestination(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const c of MISSION_COUNTRIES) {
    if (lower.includes(c.name.toLowerCase())) {
      found.push(c.code);
    }
  }
  return found;
}

export function normalizeDestinationCodes(codes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of codes) {
    const code = raw.trim().toUpperCase();
    if (code.length !== 2 || !BY_CODE.has(code) || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}
