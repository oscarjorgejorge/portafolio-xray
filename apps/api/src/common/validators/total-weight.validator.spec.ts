import { validate } from 'class-validator';
import { HasTotalWeight100 } from './total-weight.validator';

// Test DTO class for validation
class TestPortfolioDto {
  @HasTotalWeight100()
  assets!: Array<{ weight: number }>;
}

describe('HasTotalWeight100', () => {
  const createDto = (weights: number[]): TestPortfolioDto => {
    const dto = new TestPortfolioDto();
    dto.assets = weights.map((weight) => ({ weight }));
    return dto;
  };

  describe('valid weights', () => {
    it('should pass when weights sum to exactly 100', async () => {
      const dto = createDto([50, 30, 20]);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass when single weight is 100', async () => {
      const dto = createDto([100]);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass when weights sum to 100 with decimals', async () => {
      const dto = createDto([33.33, 33.33, 33.34]);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass within tolerance (99.995)', async () => {
      const dto = createDto([49.9975, 49.9975]); // 99.995 - within 0.01 tolerance
      const errors = await validate(dto);

      // Tolerance is 0.01, so 99.995 (diff of 0.005) should pass
      expect(errors).toHaveLength(0);
    });

    it('should pass within tolerance (100.005)', async () => {
      const dto = createDto([50.0025, 50.0025]); // 100.005 - within 0.01 tolerance
      const errors = await validate(dto);

      // Tolerance is 0.01, so 100.005 (diff of 0.005) should pass
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid weights', () => {
    it('should fail when weights sum to less than 100 (outside tolerance)', async () => {
      const dto = createDto([40, 30, 20]); // 90
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty('hasTotalWeight100');
    });

    it('should fail when weights sum to more than 100 (outside tolerance)', async () => {
      const dto = createDto([50, 40, 20]); // 110
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
    });

    it('should fail when weights sum to 0', async () => {
      const dto = createDto([0, 0, 0]);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
    });

    it('should include actual total in error message', async () => {
      const dto = createDto([40, 30]); // 70
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      const message = errors[0].constraints?.hasTotalWeight100 || '';
      expect(message).toContain('70');
    });
  });

  describe('edge cases', () => {
    it('should pass for empty array (let other validators handle)', async () => {
      const dto = createDto([]);
      const errors = await validate(dto);

      // Empty array sums to 0, which is not 100
      expect(errors).toHaveLength(1);
    });

    it('should handle missing weight property gracefully', async () => {
      const dto = new TestPortfolioDto();
      dto.assets = [{ weight: 50 }, {} as { weight: number }];
      const errors = await validate(dto);

      // Missing weight treated as 0, so sum is 50
      expect(errors).toHaveLength(1);
    });

    it('should handle many small weights', async () => {
      const weights: number[] = Array(100).fill(1) as number[]; // 100 assets at 1% each
      const dto = createDto(weights);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('non-array values', () => {
    it('should pass validation when value is not an array (let other validators handle)', async () => {
      const dto = new TestPortfolioDto();
      (dto.assets as unknown) = 'not an array';
      const errors = await validate(dto);

      // HasTotalWeight100 returns true for non-arrays, but other validators would catch this
      const totalWeightError = errors.find(
        (e) => e.constraints && 'hasTotalWeight100' in e.constraints,
      );
      expect(totalWeightError).toBeUndefined();
    });

    it('should pass validation when value is null (let other validators handle)', async () => {
      const dto = new TestPortfolioDto();
      (dto.assets as unknown) = null;
      const errors = await validate(dto);

      const totalWeightError = errors.find(
        (e) => e.constraints && 'hasTotalWeight100' in e.constraints,
      );
      expect(totalWeightError).toBeUndefined();
    });
  });
});
