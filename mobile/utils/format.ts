const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  // The backend emits naive ISO timestamps (no zone). Treat them as local time.
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "September 14, 2026" */
export function formatDate(iso: string | null | undefined): string {
  const d = parse(iso);
  if (!d) return "Unknown date";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "Sep 14" */
export function formatShortDate(iso: string | null | undefined): string {
  const d = parse(iso);
  if (!d) return "—";
  return `${(MONTHS[d.getMonth()] ?? "").slice(0, 3)} ${d.getDate()}`;
}

/** "September 2026" */
export function formatMonthYear(iso: string | null | undefined): string {
  const d = parse(iso);
  if (!d) return "Unknown";
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Sep 14, 2026, 15:03" */
export function formatDateTime(iso: string | null | undefined): string {
  const d = parse(iso);
  if (!d) return "Unknown";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${(MONTHS[d.getMonth()] ?? "").slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}, ${hh}:${mm}`;
}

/** "Today", "Yesterday", or "Sep 6" for older dates (canvas: "Last survey · Today"). */
export function relativeDay(iso: string | null | undefined, now = new Date()): string {
  const d = parse(iso);
  if (!d) return "—";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return formatShortDate(iso);
}

/** Season (crop year) a survey belongs to — the calendar year of its date. */
export function seasonOf(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? `${d.getFullYear()} Season` : "Undated";
}

/** "1,378" */
export function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "66%" / "1.7%" — one decimal when it matters, none when it's a whole number. */
export function formatPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

/** "320 m²" below one hectare, "1.23 ha" above. */
export function formatArea(m2: number | null | undefined): string {
  if (m2 == null || !Number.isFinite(m2)) return "—";
  if (m2 >= 10_000) return `${(m2 / 10_000).toFixed(2)} ha`;
  return `${formatNumber(m2)} m²`;
}

export function formatHectares(ha: number | null | undefined): string {
  if (ha == null || !Number.isFinite(ha)) return "—";
  return `${ha.toFixed(2)} ha`;
}

export function formatCoordinate(lat: number | null | undefined, lon: number | null | undefined): string {
  if (lat == null || lon == null) return "No GPS";
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

export function formatMeters(m: number | null | undefined, digits = 1): string {
  if (m == null || !Number.isFinite(m)) return "—";
  return `${m.toFixed(digits)} m`;
}

export function formatConfidence(c: number | null | undefined): string {
  if (c == null) return "—";
  return `${Math.round(c * 100)}%`;
}

/** Sentence-cases a snake_case crop type: "soybean" → "Soybean". */
export function cropLabel(crop: string | null | undefined): string {
  if (!crop) return "Unknown crop";
  return crop.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** "2 files", "1 file" */
export function plural(n: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${formatNumber(n)} ${n === 1 ? noun : pluralNoun}`;
}
