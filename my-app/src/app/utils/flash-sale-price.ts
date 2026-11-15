import { CatalogMetadata } from '../models/models';

export function flashSaleTotal(unitPrice: number, units: number, sale: CatalogMetadata['flashSale'], stockUnits = units): number {
  const original = unitPrice * units;
  if (!sale || Date.parse(sale.start_at) > Date.now() || Date.parse(sale.end_at) <= Date.now()
      || original < sale.min_order || stockUnits > sale.remaining) return original;
  const saleUnit = sale.discount_type === 'fixed' ? Math.max(0, unitPrice - sale.discount_value)
    : Math.max(0, Math.round(unitPrice * (100 - sale.discount_value) / 100));
  return saleUnit * units;
}
