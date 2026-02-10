import { cn, formatCurrency, calculateMargin, isValidCNPJ } from "./utils";

describe('cn', () => {
  it('should combine class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('should handle conditional class names', () => {
    expect(cn('class1', true && 'class2', false && 'class3')).toBe('class1 class2');
  });

  it('should merge tailwind classes correctly', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8');
  });
});

describe('formatCurrency', () => {
  it('should format number to BRL currency string', () => {
    // Note: The actual string might have non-breaking spaces depending on environment
    const result = formatCurrency(1234.56);
    expect(result).toContain('1.234,56');
    expect(result).toContain('R$');
  });
});

describe('calculateMargin', () => {
  it('should calculate price with percentage margin', () => {
    expect(calculateMargin(100, 20, 'percentage')).toBe(120);
  });

  it('should calculate price with fixed margin', () => {
    expect(calculateMargin(100, 20, 'fixed')).toBe(120);
  });
});

describe('isValidCNPJ', () => {
  it('should return true for a valid length numeric string', () => {
    expect(isValidCNPJ('12345678901234')).toBe(true);
  });

  it('should return false for invalid length', () => {
    expect(isValidCNPJ('123')).toBe(false);
  });
});
