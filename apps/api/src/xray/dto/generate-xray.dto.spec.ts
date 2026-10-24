import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GenerateXRayDto } from './generate-xray.dto';

async function currencyErrors(currency: unknown) {
  const dto = plainToInstance(GenerateXRayDto, {
    assets: [{ morningstarId: 'F000011IM4', weight: 100 }],
    currency,
  });
  const errors = await validate(dto);
  return {
    dto,
    errors: errors.filter((error) => error.property === 'currency'),
  };
}

describe('GenerateXRayDto currency', () => {
  it('accepts a missing currency (EUR default)', async () => {
    const { errors } = await currencyErrors(undefined);
    expect(errors).toHaveLength(0);
  });

  it.each(['EUR', 'NOK', 'USD', 'SEK', 'DKK', 'GBP', 'CHF'])(
    'accepts %s',
    async (currency) => {
      const { errors } = await currencyErrors(currency);
      expect(errors).toHaveLength(0);
    },
  );

  it('normalizes lowercase input', async () => {
    const { dto, errors } = await currencyErrors(' nok ');
    expect(errors).toHaveLength(0);
    expect(dto.currency).toBe('NOK');
  });

  it.each(['JPY', 'XYZ', 'EUR&LanguageId=xx', 42])(
    'rejects %p',
    async (currency) => {
      const { errors } = await currencyErrors(currency);
      expect(errors).toHaveLength(1);
    },
  );
});
