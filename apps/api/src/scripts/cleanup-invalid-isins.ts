import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { IdentifierClassifier } from '../common/utils/identifier-classifier';

/**
 * Cleanup script: null-out invalid ISIN values in the Asset cache table.
 *
 * Usage:
 * - Dry run (default): npm run cleanup:invalid-isins
 * - Apply changes:     DRY_RUN=false npm run cleanup:invalid-isins
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run this script.');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const dryRun = process.env.DRY_RUN !== 'false';
  const pageSize = 500;

  let scanned = 0;
  let invalidCount = 0;
  let lastId: string | undefined = undefined;

  try {
    // Paginate by id to avoid large memory usage.
    while (true) {
      const assets: Array<{ id: string; isin: string | null }> =
        await prisma.asset.findMany({
          where: {
            isin: { not: null },
            ...(lastId ? { id: { gt: lastId } } : {}),
          },
          orderBy: { id: 'asc' },
          take: pageSize,
          select: { id: true, isin: true },
        });

      if (assets.length === 0) break;

      scanned += assets.length;
      lastId = assets[assets.length - 1]?.id;

      const invalidIds: string[] = [];
      for (const a of assets) {
        const isin = (a.isin ?? '').toString().toUpperCase();
        if (!IdentifierClassifier.validateISINChecksum(isin)) {
          invalidIds.push(a.id);
        }
      }

      if (invalidIds.length > 0) {
        invalidCount += invalidIds.length;
        if (!dryRun) {
          await prisma.asset.updateMany({
            where: { id: { in: invalidIds } },
            data: {
              isin: null,
              isinPending: false,
              isinManual: false,
            },
          });
        }
      }
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        scanned,
        invalidIsins: invalidCount,
        action: dryRun ? 'none (dry run)' : 'set isin=null',
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
