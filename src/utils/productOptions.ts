export interface ProductOption {
  id: string;
  name: string;
  nameEn?: string;
  badge?: string;
  isCustom?: boolean;
}

export const DEFAULT_PRODUCT_OPTIONS: ProductOption[] = [
  { id: 'term_insurance', name: 'Term Life Insurance', nameEn: 'Term Life Insurance', badge: 'Life Insurance' },
  { id: 'pension', name: 'Retirement & Pension Plan', nameEn: 'Retirement & Pension Plan', badge: 'Retirement & Pension' },
  { id: 'health_general', name: 'Health Insurance (Mediclaim)', nameEn: 'Health Insurance (Mediclaim)', badge: 'Health Insurance' },
  { id: 'child_future', name: 'Child Education & Future Fund', nameEn: 'Child Education & Future Fund', badge: 'Child Education' },
  { id: 'investment', name: 'Guaranteed Savings & Investment Plan', nameEn: 'Guaranteed Savings & Investment Plan', badge: 'Savings & Investment' },
  { id: 'motor', name: 'Motor & Vehicle Insurance', nameEn: 'Motor & Vehicle Insurance', badge: 'Motor Insurance' },
];

export const DEFAULT_CATEGORIES: string[] = [
  'Life Insurance',
  'Health Insurance',
  'Motor Insurance',
  'Savings & Investment',
  'Retirement & Pension',
  'Child Education',
  'General / Business Insurance',
];

export const PRODUCT_STORAGE_KEY = 'familyfirst_custom_products';
export const CATEGORY_STORAGE_KEY = 'familyfirst_custom_categories';

export function getCustomProducts(): ProductOption[] {
  try {
    const raw = localStorage.getItem(PRODUCT_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveCustomProduct(product: ProductOption) {
  try {
    const existing = getCustomProducts();
    const updated = [...existing.filter(p => p.id !== product.id), product];
    localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function getAllProductOptions(): ProductOption[] {
  const custom = getCustomProducts();
  const seenIds = new Set(DEFAULT_PRODUCT_OPTIONS.map(p => p.id));
  const uniqueCustom = custom.filter(c => !seenIds.has(c.id));
  return [...DEFAULT_PRODUCT_OPTIONS, ...uniqueCustom];
}

export function getCustomCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveCustomCategory(category: string): string[] {
  const clean = category.trim();
  if (!clean) return getCustomCategories();
  try {
    const existing = getCustomCategories();
    const updated = Array.from(new Set([...existing, clean]));
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function getAllCategories(): string[] {
  const custom = getCustomCategories();
  const all = Array.from(new Set([...DEFAULT_CATEGORIES, ...custom]));
  return all;
}

export const PRODUCT_OPTIONS: ProductOption[] = DEFAULT_PRODUCT_OPTIONS;
