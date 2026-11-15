import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { Title, Meta } from '@angular/platform-browser';
import { ServiceDetailSeoService } from './service-detail-seo.service';

describe('service SEO', () => {
  it('sets one canonical without sale parameters and emits only supplied place facts', () => {
    const doc = new JSDOM('<html><head><title>Original</title><meta name="description" content="Previous"></head><body></body></html>', { url: 'https://example.org/services/stay/a?flashSale=temporary' }).window.document;
    const meta = {
      getTag: (selector: string) => doc.querySelector(`meta[${selector}]`),
      removeTag: (selector: string) => doc.querySelector(`meta[${selector}]`)?.remove(),
      updateTag: (attributes: Record<string, string>) => {
        const key = attributes.name ? 'name' : 'property';
        let element = doc.querySelector(`meta[${key}="${attributes[key]}"]`);
        if (!element) { element = doc.createElement('meta'); doc.head.appendChild(element); }
        Object.entries(attributes).forEach(([name, value]) => element!.setAttribute(name, value));
        return element;
      },
    };
    const seo = new ServiceDetailSeoService(doc, new Title(doc), meta as unknown as Meta);
    const tour = { id: 'a', title: 'Hotel <test>', type: 'Lưu trú', destination: 'Đà Lạt', address: 'Lê Lai, Đà Lạt',
      nearbyGroups: [{ name: 'Điểm đến', items: [{ name: 'Chợ Đà Lạt', distanceKm: 2.3 }] }] } as any;
    seo.update(tour);
    seo.update(tour);
    expect(doc.querySelectorAll('link[rel=canonical]')).toHaveLength(1);
    expect(doc.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe('https://example.org/services/stay/a');
    const graph = JSON.parse(doc.getElementById('greensteps-service-schema')!.textContent!)['@graph'];
    expect(graph[0].name).toBe('Hotel <test>');
    expect(graph[0]).not.toHaveProperty('geo');
    expect(graph[0]).not.toHaveProperty('aggregateRating');
    expect(graph.find((row: any) => row['@type'] === 'ItemList').numberOfItems).toBe(1);
    expect(doc.querySelector('meta[name=description]')?.getAttribute('content')).toContain('2,3 km');
    seo.clear();
    expect(doc.title).toBe('Original');
    expect(doc.querySelector('meta[name=description]')?.getAttribute('content')).toBe('Previous');
    expect(doc.querySelector('link[rel=canonical]')).toBeNull();
    expect(doc.getElementById('greensteps-service-schema')).toBeNull();
  });
});
