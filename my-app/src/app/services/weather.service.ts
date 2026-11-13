import { Injectable } from '@angular/core';

interface GeocodingResponse {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
  }>;
}

interface ForecastResponse {
  current?: {
    temperature_2m: number;
    weather_code: number;
    is_day: number;
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
}

export interface DestinationWeather {
  destination: string;
  current: {
    temperature: number;
    weatherCode: number;
    isDay: boolean;
  };
  days: Array<{
    date: string;
    weatherCode: number;
    temperatureMax: number;
    temperatureMin: number;
    precipitationProbability: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  public async getDestinationForecast(destination: string): Promise<DestinationWeather | null> {
    const query = destination.trim();
    if (!query) return null;

    const geocodingUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
    geocodingUrl.search = new URLSearchParams({
      name: query,
      count: '1',
      language: 'vi',
      format: 'json'
    }).toString();
    const geocodingResponse = await fetch(geocodingUrl);
    if (!geocodingResponse.ok) throw new Error(`Weather geocoding request failed: ${geocodingResponse.status}`);
    const geocoding = await geocodingResponse.json() as GeocodingResponse;
    const location = geocoding.results?.[0];
    if (!location) return null;

    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
    forecastUrl.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: 'temperature_2m,weather_code,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      forecast_days: '3',
      timezone: 'auto'
    }).toString();
    const forecastResponse = await fetch(forecastUrl);
    if (!forecastResponse.ok) throw new Error(`Weather forecast request failed: ${forecastResponse.status}`);
    const forecast = await forecastResponse.json() as ForecastResponse;

    if (!forecast.current || !forecast.daily) return null;
    const { daily } = forecast;

    return {
      destination: location.name,
      current: {
        temperature: forecast.current.temperature_2m,
        weatherCode: forecast.current.weather_code,
        isDay: forecast.current.is_day === 1
      },
      days: daily.time.map((date, index) => ({
        date,
        weatherCode: daily.weather_code[index],
        temperatureMax: daily.temperature_2m_max[index],
        temperatureMin: daily.temperature_2m_min[index],
        precipitationProbability: daily.precipitation_probability_max[index]
      }))
    };
  }
}
