import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { Tour } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ServiceDetailSeoService {
  private restore?: () => void;
  constructor(@Inject(DOCUMENT) private doc: Document, private title: Title, private meta: Meta) {}
  update(tour: Tour) {
    if (!this.restore) {
      const previousTitle = this.title.getTitle();
      const keys = ['name="description"', 'property="og:title"', 'property="og:description"', 'property="og:url"', 'property="og:type"'];
      const previous = keys.map(key => ({ key, element: this.meta.getTag(key)?.cloneNode(true) as HTMLMetaElement | undefined }));
      const canonical = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      const oldHref = canonical?.getAttribute('href');
      this.restore = () => {
        this.title.setTitle(previousTitle);
        previous.forEach(({ key, element }) => { this.meta.removeTag(key); if (element) this.doc.head.appendChild(element); });
        const link = this.doc.querySelector('link[rel="canonical"]');
        if (canonical && oldHref != null) link?.setAttribute('href', oldHref); else link?.remove();
        this.doc.getElementById('greensteps-service-schema')?.remove();
      };
    }
    const type = /lưu trú|stay|lodging/i.test(tour.type || '') ? 'stay' : /phương tiện|transport/i.test(tour.type || '') ? 'transport' : 'attraction';
    const url = new URL(`/services/${type}/${encodeURIComponent(tour.id)}`, this.doc.baseURI).href;
    const title = `${tour.title} tại ${tour.destination} | GreenSteps`;
    const places = (tour.nearbyGroups || []).flatMap(group => group.items);
    const distances = places.filter(place => Number.isFinite(place.distanceKm) && Number(place.distanceKm) > 0);
    const near = distances.slice(0, 2).map(place => `${place.name} khoảng ${new Intl.NumberFormat('vi-VN').format(place.distanceKm!)} km`).join(', ');
    const description = (near ? `${tour.title}, ${tour.destination}: ${near}. Xem vị trí, chỉ đường và các điểm đến lân cận.`
      : `${tour.title} tại ${tour.destination}. Xem địa chỉ, vị trí trên bản đồ, tiện nghi và thông tin đặt dịch vụ.`).slice(0, 220);
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    for (const [property, content] of Object.entries({ 'og:title': title, 'og:description': description, 'og:url': url, 'og:type': 'website' })) this.meta.updateTag({ property, content });
    let canonical = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = this.doc.createElement('link'); canonical.rel = 'canonical'; this.doc.head.appendChild(canonical); }
    canonical.href = url;
    const place = { '@type': type === 'stay' ? 'Hotel' : 'Place', '@id': url + '#place', name: tour.title, url,
      ...(tour.address ? { address: { '@type': 'PostalAddress', streetAddress: tour.address, addressLocality: tour.destination, addressCountry: 'VN' } } : {}),
      ...(Number.isFinite(tour.latitude) && Number.isFinite(tour.longitude) ? { geo: { '@type': 'GeoCoordinates', latitude: tour.latitude, longitude: tour.longitude } } : {}) };
    const graph: unknown[] = [place, { '@type': 'WebPage', '@id': url, url, name: title, description, inLanguage: 'vi-VN', mainEntity: { '@id': url + '#place' } }];
    if (places.length) graph.push({ '@type': 'ItemList', '@id': url + '#nearby', name: `Địa điểm gần ${tour.title}`,
      numberOfItems: places.length, itemListElement: places.map((item, index) => ({ '@type': 'ListItem', position: index + 1,
        item: { '@type': 'Place', name: item.name, ...(item.distanceKm ? { description: `Cách ${tour.title} khoảng ${new Intl.NumberFormat('vi-VN').format(item.distanceKm)} km theo nguồn tham khảo; quãng đường thực tế có thể khác.` } : {}) } })) });
    let script = this.doc.getElementById('greensteps-service-schema') as HTMLScriptElement | null;
    if (!script) { script = this.doc.createElement('script'); script.id = 'greensteps-service-schema'; script.type = 'application/ld+json'; this.doc.head.appendChild(script); }
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  }
  clear() { this.restore?.(); this.restore = undefined; }
}
