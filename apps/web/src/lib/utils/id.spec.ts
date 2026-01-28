import { describe, it, expect } from 'vitest';
import { generateSimpleId, generateId } from './id';

describe('generateSimpleId', () => {
  it('should return a non-empty string', () => {
    const id = generateSimpleId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should return unique IDs on consecutive calls', () => {
    const ids = new Set<string>();
    const numIds = 100;

    for (let i = 0; i < numIds; i++) {
      ids.add(generateSimpleId());
    }

    // All IDs should be unique
    expect(ids.size).toBe(numIds);
  });

  it('should return IDs that can be used as object keys', () => {
    const id = generateSimpleId();
    const obj: Record<string, number> = {};
    obj[id] = 1;
    expect(obj[id]).toBe(1);
  });
});

describe('generateId (deprecated)', () => {
  it('should return a non-empty string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should return unique IDs on consecutive calls', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it('should include the "id-" prefix', () => {
    const id = generateId();
    expect(id.startsWith('id-')).toBe(true);
  });
});
