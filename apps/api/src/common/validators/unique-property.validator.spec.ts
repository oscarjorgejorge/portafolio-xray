import { validate } from 'class-validator';
import { HasUniqueProperty } from './unique-property.validator';

// Test DTO class for validation
class TestPortfolioDto {
  @HasUniqueProperty('morningstarId')
  assets!: Array<{ morningstarId: string }>;
}

describe('HasUniqueProperty', () => {
  const createDto = (ids: string[]): TestPortfolioDto => {
    const dto = new TestPortfolioDto();
    dto.assets = ids.map((morningstarId) => ({ morningstarId }));
    return dto;
  };

  describe('valid (unique values)', () => {
    it('should pass when all values are unique', async () => {
      const dto = createDto(['F00000THA5', '0P0000YXJO', 'F000016RL3']);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass when single item', async () => {
      const dto = createDto(['F00000THA5']);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass for empty array', async () => {
      const dto = createDto([]);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should treat different cases as different values', async () => {
      // Note: In practice, values should be normalized before validation
      const dto = createDto(['F00000THA5', 'f00000tha5']);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid (duplicate values)', () => {
    it('should fail when duplicate values exist', async () => {
      const dto = createDto(['F00000THA5', '0P0000YXJO', 'F00000THA5']);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty('hasUniqueProperty');
    });

    it('should fail when all values are the same', async () => {
      const dto = createDto(['F00000THA5', 'F00000THA5', 'F00000THA5']);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
    });

    it('should fail when two values are duplicates among many', async () => {
      const dto = createDto([
        'F00000THA5',
        '0P0000YXJO',
        'F000016RL3',
        '0P0000YXJO', // duplicate
        'F00000ABC1',
      ]);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
    });

    it('should include property name in error message', async () => {
      const dto = createDto(['F00000THA5', 'F00000THA5']);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      const message = errors[0].constraints?.hasUniqueProperty || '';
      expect(message).toContain('morningstarId');
    });
  });

  describe('non-array values', () => {
    it('should pass when value is not an array (let other validators handle)', async () => {
      const dto = new TestPortfolioDto();
      (dto.assets as unknown) = 'not an array';
      const errors = await validate(dto);

      const uniqueError = errors.find(
        (e) => e.constraints && 'hasUniqueProperty' in e.constraints,
      );
      expect(uniqueError).toBeUndefined();
    });

    it('should pass when value is null (let other validators handle)', async () => {
      const dto = new TestPortfolioDto();
      (dto.assets as unknown) = null;
      const errors = await validate(dto);

      const uniqueError = errors.find(
        (e) => e.constraints && 'hasUniqueProperty' in e.constraints,
      );
      expect(uniqueError).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined property values', async () => {
      const dto = new TestPortfolioDto();
      dto.assets = [
        { morningstarId: 'F00000THA5' },
        { morningstarId: undefined as unknown as string },
        { morningstarId: 'F000016RL3' },
      ];
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should handle null property values', async () => {
      const dto = new TestPortfolioDto();
      dto.assets = [
        { morningstarId: 'F00000THA5' },
        { morningstarId: null as unknown as string },
        { morningstarId: 'F000016RL3' },
      ];
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should detect duplicates with empty strings', async () => {
      const dto = createDto(['', '', 'F00000THA5']);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
    });
  });
});
