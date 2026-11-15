import { describe, expect, it } from 'vitest';
import { profileCarbonSummary } from './profile-carbon.analytics';

describe('profile carbon summary', () => {
  it('reports unavailable when an account has no saved itinerary data', () => {
    expect(profileCarbonSummary([])).toEqual({
      available: false,
      breakdownAvailable: false,
      total: 0,
      transport: 0,
      stay: 0,
      activity: 0,
    });
  });

  it('aggregates recorded activity carbon by real activity type', () => {
    expect(
      profileCarbonSummary([
        {
          daysData: [
            [
              { type: 'transport', carbon: 2.4 },
              { type: 'lodging', carbon: 1.6 },
            ],
            [{ type: 'attraction', carbon: 0.5 }, { type: 'dining', carbon: 0.3 }],
          ],
        },
      ]),
    ).toEqual({ available: true, breakdownAvailable: true, total: 4.8, transport: 2.4, stay: 1.6, activity: 0.8 });
  });

  it('uses the stored itinerary total only when activity details are unavailable', () => {
    expect(profileCarbonSummary([{ totalCarbon: 3.2, daysData: [] }])).toEqual({
      available: true,
      breakdownAvailable: false,
      total: 3.2,
      transport: 0,
      stay: 0,
      activity: 0,
    });
  });

  it('does not treat an empty itinerary with a default zero total as measured carbon', () => {
    expect(profileCarbonSummary([{ totalCarbon: 0, daysData: [] }]).available).toBe(false);
  });
});
