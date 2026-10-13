/**
 * FastFleet Standardized Expense Category Normalization & Formatting
 */

export type StandardExpenseCategory = 'toll' | 'parking' | 'fuel' | 'entertainment' | 'other';

export function normalizeExpenseCategory(cat?: string | null): StandardExpenseCategory {
  if (!cat) return 'other';
  const c = cat.trim();
  const lower = c.toLowerCase();

  if (c === 'ค่าทางด่วน' || lower === 'toll fee' || lower === 'toll' || lower === 'ค่าผ่านทาง') {
    return 'toll';
  }
  if (c === 'ค่าที่จอดรถ' || lower === 'parking fee' || lower === 'parking' || lower === 'ค่าจอด') {
    return 'parking';
  }
  if (c === 'ค่าน้ำมัน' || lower === 'fuel' || lower === 'fuel expense' || lower === 'gas') {
    return 'fuel';
  }
  if (
    c === 'ค่าอาหาร / เลี้ยงรับรองลูกค้า' ||
    c === 'ค่าอาหาร / เลี้ยงรับรอง' ||
    c === 'ค่าเลี้ยงรับรอง' ||
    c === 'ค่าอาหาร' ||
    lower === 'meals & client hospitality' ||
    lower === 'entertainment' ||
    lower === 'client entertainment' ||
    lower === 'meals'
  ) {
    return 'entertainment';
  }
  return 'other';
}

export function formatExpenseCategoryDisplay(cat?: string | null, lang: 'th' | 'en' = 'th'): string {
  const norm = normalizeExpenseCategory(cat);
  if (lang === 'en') {
    switch (norm) {
      case 'toll': return 'Toll Fee';
      case 'parking': return 'Parking Fee';
      case 'fuel': return 'Fuel';
      case 'entertainment': return 'Meals & Client Hospitality';
      default: return 'Other';
    }
  }
  switch (norm) {
    case 'toll': return 'ค่าทางด่วน';
    case 'parking': return 'ค่าที่จอดรถ';
    case 'fuel': return 'ค่าน้ำมัน';
    case 'entertainment': return 'ค่าอาหาร / เลี้ยงรับรอง';
    default: return 'อื่นๆ';
  }
}
