import { afterEach, describe, expect, it, vi } from 'vitest';

import { WeatherService } from './weather.service';

describe('WeatherService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the saved destination to geocode and load a real forecast', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ name: 'Đà Lạt', latitude: 11.94, longitude: 108.44 }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          current: { temperature_2m: 21, weather_code: 2, is_day: 1 },
          daily: {
            time: ['2026-11-13'],
            weather_code: [61],
            temperature_2m_max: [23],
            temperature_2m_min: [16],
            precipitation_probability_max: [40],
          },
        })
      });
    vi.stubGlobal('fetch', fetchMock);
    const service = new WeatherService();

    const result = await service.getDestinationForecast(' Đà Lạt ');
    const forecastUrl = new URL(fetchMock.mock.calls[1][0]);

    expect(result).toEqual({
      destination: 'Đà Lạt',
      current: { temperature: 21, weatherCode: 2, isDay: true },
      days: [{
        date: '2026-11-13',
        weatherCode: 61,
        temperatureMax: 23,
        temperatureMin: 16,
        precipitationProbability: 40,
      }],
    });
    expect(forecastUrl.searchParams.get('latitude')).toBe('11.94');
    expect(forecastUrl.searchParams.get('longitude')).toBe('108.44');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not request weather when there is no recorded destination', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = new WeatherService();

    await expect(service.getDestinationForecast(' ')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces provider errors so the dashboard can offer a retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);
    const service = new WeatherService();

    await expect(service.getDestinationForecast('Đà Lạt')).rejects.toThrow('Weather geocoding request failed: 503');
  });
});
