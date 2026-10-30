import { ExportLineItem } from '../types';

export interface PackageKindOption {
  label: string;
  value: string;
  singular: string;
  plural: string;
}

export const PACKAGE_KIND_OPTIONS: PackageKindOption[] = [
  { label: 'ROLLS / ROLL', value: 'ROLLS', singular: 'ROLL', plural: 'ROLLS' },
  { label: 'CARTONS / CARTON', value: 'CARTONS', singular: 'CARTON', plural: 'CARTONS' },
  { label: 'BOXES / BOX', value: 'BOXES', singular: 'BOX', plural: 'BOXES' }
];

export function findPackageKindOption(val?: string): PackageKindOption | undefined {
  if (!val) return undefined;
  const upper = val.trim().toUpperCase();
  
  // Exact match on value, label, singular, plural
  const exact = PACKAGE_KIND_OPTIONS.find(
    opt => opt.value === upper || opt.label.toUpperCase() === upper || opt.singular === upper || opt.plural === upper
  );
  if (exact) return exact;

  // Keyword match
  if (upper.includes('ROLL')) return PACKAGE_KIND_OPTIONS.find(o => o.value === 'ROLLS');
  if (upper.includes('CARTON')) return PACKAGE_KIND_OPTIONS.find(o => o.value === 'CARTONS');
  if (upper.includes('BOX')) return PACKAGE_KIND_OPTIONS.find(o => o.value === 'BOXES');

  return undefined;
}

export function inferPackageKind(text?: string): string {
  const opt = findPackageKindOption(text);
  return opt ? opt.value : 'CARTONS';
}

export function formatNoAndKindOfPkg(
  count: number | string | undefined | null,
  packageKind?: string,
  fallbackText?: string
): string {
  const opt = findPackageKindOption(packageKind) || findPackageKindOption(fallbackText) || PACKAGE_KIND_OPTIONS[0];

  if (opt.value === 'LOOSE / BULK') {
    if (count != null && count !== '' && Number(count) > 0) {
      return `${count} LOOSE / BULK`;
    }
    return 'LOOSE / BULK';
  }

  const num = count != null && count !== '' ? Number(count) : NaN;
  if (isNaN(num)) {
    if (fallbackText && fallbackText.trim()) return fallbackText;
    return opt.plural;
  }

  const formattedCount = num.toLocaleString();
  if (num === 1) {
    return `${formattedCount} ${opt.singular}`;
  }
  return `${formattedCount} ${opt.plural}`;
}

export function buildItemMarksAndNos(item: Partial<ExportLineItem>): string {
  const parts: string[] = [];
  const specPrefix = item.itemDescription1 || item.itemCount || item.description;
  if (specPrefix && specPrefix.trim()) {
    parts.push(specPrefix.trim());
  }

  const noOfCartons = item.noOfCartons != null ? Number(item.noOfCartons) : (item.quantity && item.quantity <= 1000 ? Math.round(item.quantity / 20) : 0);
  const opt = findPackageKindOption(item.packageKind || item.cartonOption) || { singular: 'CARTON', plural: 'CARTONS', value: 'CARTONS' };

  if (noOfCartons > 0) {
    if (opt.value === 'LOOSE / BULK') {
      parts.push('LOOSE / BULK');
    } else {
      parts.push(`${opt.singular} NOS :\n1 - ${noOfCartons}`);
    }
  }

  const netVal = item.netWt != null ? Number(item.netWt) : (item.quantity ? Number(item.quantity) : 0);
  const grossVal = item.grossWt != null ? Number(item.grossWt) : (netVal > 0 ? Math.round(netVal * 1.05 * 1000) / 1000 : 0);

  if (grossVal > 0) {
    parts.push(`TOTAL GROSS WT :\n${grossVal.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KGS`);
  }
  if (netVal > 0) {
    parts.push(`TOTAL NET WT :\n${netVal.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KGS`);
  }

  if ((item as any).containerSealNo && String((item as any).containerSealNo).trim()) {
    parts.push(`CONTAINER NO/SEAL NO :\n${String((item as any).containerSealNo).trim()}`);
  }

  return parts.join('\n').trim();
}

