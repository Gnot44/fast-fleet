import { describe, it, expect } from 'vitest';
import { normalizeExpenseCategory, formatExpenseCategoryDisplay } from '../utils/expenseUtils';

describe('Expense Category Normalization & Display Logic', () => {
  describe('normalizeExpenseCategory', () => {
    it('should correctly normalize standard Thai categories', () => {
      expect(normalizeExpenseCategory('ค่าทางด่วน')).toBe('toll');
      expect(normalizeExpenseCategory('ค่าผ่านทาง')).toBe('toll');
      expect(normalizeExpenseCategory('ค่าที่จอดรถ')).toBe('parking');
      expect(normalizeExpenseCategory('ค่าจอด')).toBe('parking');
      expect(normalizeExpenseCategory('ค่าน้ำมัน')).toBe('fuel');
      expect(normalizeExpenseCategory('ค่าอาหาร / เลี้ยงรับรองลูกค้า')).toBe('entertainment');
      expect(normalizeExpenseCategory('ค่าอาหาร / เลี้ยงรับรอง')).toBe('entertainment');
      expect(normalizeExpenseCategory('ค่าเลี้ยงรับรอง')).toBe('entertainment');
      expect(normalizeExpenseCategory('ค่าอาหาร')).toBe('entertainment');
      expect(normalizeExpenseCategory('อื่นๆ')).toBe('other');
    });

    it('should correctly normalize English category aliases and case variants', () => {
      expect(normalizeExpenseCategory('toll')).toBe('toll');
      expect(normalizeExpenseCategory('Toll Fee')).toBe('toll');
      expect(normalizeExpenseCategory('TOLL')).toBe('toll');

      expect(normalizeExpenseCategory('parking')).toBe('parking');
      expect(normalizeExpenseCategory('Parking Fee')).toBe('parking');

      expect(normalizeExpenseCategory('fuel')).toBe('fuel');
      expect(normalizeExpenseCategory('Fuel Expense')).toBe('fuel');
      expect(normalizeExpenseCategory('gas')).toBe('fuel');

      expect(normalizeExpenseCategory('entertainment')).toBe('entertainment');
      expect(normalizeExpenseCategory('Meals & Client Hospitality')).toBe('entertainment');
      expect(normalizeExpenseCategory('client entertainment')).toBe('entertainment');
      expect(normalizeExpenseCategory('meals')).toBe('entertainment');

      expect(normalizeExpenseCategory('other')).toBe('other');
    });

    it('should handle falsy and unrecognized categories by falling back to "other"', () => {
      expect(normalizeExpenseCategory(null)).toBe('other');
      expect(normalizeExpenseCategory(undefined)).toBe('other');
      expect(normalizeExpenseCategory('')).toBe('other');
      expect(normalizeExpenseCategory('   ')).toBe('other');
      expect(normalizeExpenseCategory('hotel expense')).toBe('other');
    });
  });

  describe('formatExpenseCategoryDisplay', () => {
    it('should format display labels in Thai', () => {
      expect(formatExpenseCategoryDisplay('toll', 'th')).toBe('ค่าทางด่วน');
      expect(formatExpenseCategoryDisplay('Toll Fee', 'th')).toBe('ค่าทางด่วน');
      expect(formatExpenseCategoryDisplay('parking', 'th')).toBe('ค่าที่จอดรถ');
      expect(formatExpenseCategoryDisplay('fuel', 'th')).toBe('ค่าน้ำมัน');
      expect(formatExpenseCategoryDisplay('entertainment', 'th')).toBe('ค่าอาหาร / เลี้ยงรับรอง');
      expect(formatExpenseCategoryDisplay('other', 'th')).toBe('อื่นๆ');
    });

    it('should format display labels in English', () => {
      expect(formatExpenseCategoryDisplay('toll', 'en')).toBe('Toll Fee');
      expect(formatExpenseCategoryDisplay('ค่าทางด่วน', 'en')).toBe('Toll Fee');
      expect(formatExpenseCategoryDisplay('parking', 'en')).toBe('Parking Fee');
      expect(formatExpenseCategoryDisplay('fuel', 'en')).toBe('Fuel');
      expect(formatExpenseCategoryDisplay('entertainment', 'en')).toBe('Meals & Client Hospitality');
      expect(formatExpenseCategoryDisplay('other', 'en')).toBe('Other');
    });
  });
});
