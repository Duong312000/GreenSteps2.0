export interface ProfileCarbonSummary {
  available: boolean;
  breakdownAvailable: boolean;
  total: number;
  transport: number;
  stay: number;
  activity: number;
}

interface CarbonItinerary {
  totalCarbon?: unknown;
  daysData?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function carbonValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.abs(parsed) : null;
}

export function profileCarbonSummary(itineraries: CarbonItinerary[]): ProfileCarbonSummary {
  const summary: ProfileCarbonSummary = {
    available: false,
    breakdownAvailable: false,
    total: 0,
    transport: 0,
    stay: 0,
    activity: 0,
  };
  let hasUncategorizedCarbon = false;

  for (const itinerary of itineraries) {
    const days = Array.isArray(itinerary.daysData) ? itinerary.daysData : [];
    let itineraryHasActivityCarbon = false;
    let itineraryActivityTotal = 0;

    for (const day of days) {
      if (!Array.isArray(day)) continue;
      for (const activity of day) {
        if (!isRecord(activity)) continue;
        const carbon = carbonValue(activity['carbon']);
        if (carbon === null) continue;
        itineraryHasActivityCarbon = true;
        itineraryActivityTotal += carbon;
        const type = String(activity['type'] || '').toLowerCase();
        if (type === 'transport') summary.transport += carbon;
        else if (type === 'lodging' || type === 'stay') summary.stay += carbon;
        else summary.activity += carbon;
      }
    }

    if (itineraryHasActivityCarbon) summary.total += itineraryActivityTotal;

    if (!itineraryHasActivityCarbon) {
      const totalCarbon = carbonValue(itinerary.totalCarbon);
      if (totalCarbon !== null && totalCarbon > 0) {
        summary.total += totalCarbon;
        itineraryHasActivityCarbon = true;
        hasUncategorizedCarbon = true;
      }
    }

    summary.available ||= itineraryHasActivityCarbon;
  }

  summary.breakdownAvailable = summary.available && !hasUncategorizedCarbon;
  return summary;
}
