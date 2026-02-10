import { cn } from "./utils";

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

  it('should handle empty inputs', () => {
    expect(cn()).toBe('');
  });

  it('should handle mixed inputs', () => {
    expect(cn('text-red-500', 'font-bold', 'text-blue-500')).toBe('font-bold text-blue-500');
  });
});
