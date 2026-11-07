import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { ServicesComponent } from './services';
import { Service } from '../../models/models';

function catalog() {
  const component = new ServicesComponent({} as any, {} as any, {} as any, {} as any, { detectChanges: vi.fn() } as any);
  component.servicesData = [
    { id: 'new', name: 'New stay', type: 'stay', destination: 'Đà Lạt', cost: 550000, rating: null },
    { id: 'legacy', name: 'Stay without rating field', type: 'stay', destination: 'Hội An', cost: 680000 },
    { id: 'rated', name: 'Rated stay', type: 'stay', destination: 'Đà Lạt', cost: 750000, rating: 4.8 },
    { id: 'lower', name: 'Lower rated stay', type: 'stay', destination: 'Phú Yên', cost: 400000, rating: 4.2 },
    { id: 'food', name: 'New restaurant', type: 'food', destination: 'Đà Lạt', cost: 220000, rating: null }
  ] as Service[];
  return component;
}

describe('service catalog rating filter', () => {
  it('shows new services without ratings when all ratings are selected', () => {
    const component = catalog();
    component.filterServices();
    expect(component.filteredServices.map(service => service.id)).toEqual(['new', 'legacy', 'rated', 'lower']);
    expect(component.paginatedServices).toHaveLength(4);
  });

  it('excludes unrated services only when a minimum rating is selected', () => {
    const component = catalog();
    component.filterRating = '4.5';
    component.filterServices();
    expect(component.filteredServices.map(service => service.id)).toEqual(['rated']);
    component.filterRating = '5.0';
    component.filterServices();
    expect(component.filteredServices).toHaveLength(0);
  });

  it('keeps category and search filters working for unrated services', () => {
    const component = catalog();
    component.serviceType = 'food';
    component.searchQuery = 'new';
    component.filterServices();
    expect(component.filteredServices.map(service => service.id)).toEqual(['food']);
  });
});
