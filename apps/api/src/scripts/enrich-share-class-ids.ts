import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';
import { PrismaClient, AssetType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  extractPreferredFundId,
  extractShareClassIdFromHtml,
  needsShareClassEnrichment,
} from '../assets/resolver/utils/canonical-fund-id';
import { shareClassIdLookupUrls } from '../assets/resolver/utils/url-builder';
import { MS_ASSET_TYPES } from '../assets/resolver/utils/constants';

loadEnv({ path: join(__dirname, '..', '..', '.env') });

const LOOKUP_TIMEOUT_MS = 15000;
const LOOKUP_GAP_MS = 2000;

/**
 * Backfill Instant X-Ray F IDs for fund-like assets that only have a 0P ID.
 *
 * Usage:
 * - Dry run (default): npm run enrich:share-class-ids
 * - Apply: DRY_RUN=false npm run enrich:share-class-ids
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run this script.');
  }

  const dryRun = process.env.DRY_RUN !== 'false';
  console.log(`Share-class backfill (${dryRun ? 'dry run' : 'APPLY'})`);

  const isLocal =
    databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const assets = await prisma.asset.findMany({
      where: {
        type: { in: [AssetType.FUND, AssetType.ETF, AssetType.ETC] },
        shareClassId: null,
      },
      select: {
        id: true,
        morningstarId: true,
        shareClassId: true,
        type: true,
        url: true,
        name: true,
      },
    });

    const pending = assets.filter((asset) => needsShareClassEnrichment(asset));
    console.log(
      `Found ${pending.length} fund-like assets missing a share-class F ID`,
    );

    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < pending.length; i++) {
      const asset = pending[i];
      const fromUrl = extractPreferredFundId(asset.url ?? '');
      let shareClassId = fromUrl;

      if (!shareClassId) {
        shareClassId = await lookupShareClassId(asset);
        if (i < pending.length - 1) {
          await sleep(LOOKUP_GAP_MS);
        }
      }

      if (!shareClassId) {
        skipped += 1;
        console.log(`SKIP ${asset.morningstarId} (${asset.name})`);
        continue;
      }

      if (dryRun) {
        console.log(
          `DRY ${asset.morningstarId} -> ${shareClassId} (${asset.name})`,
        );
      } else {
        await prisma.asset.update({
          where: { id: asset.id },
          data: { shareClassId },
        });
        console.log(
          `SAVE ${asset.morningstarId} -> ${shareClassId} (${asset.name})`,
        );
      }
      updated += 1;
    }

    console.log(
      `Done. ${dryRun ? 'Would update' : 'Updated'} ${updated}, skipped ${skipped}.`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function lookupShareClassId(asset: {
  morningstarId: string;
  url: string | null;
  type: AssetType;
}): Promise<string | null> {
  const msType =
    asset.type === AssetType.ETF
      ? MS_ASSET_TYPES.ETF
      : asset.type === AssetType.STOCK
        ? MS_ASSET_TYPES.STOCK
        : MS_ASSET_TYPES.FUND;
  const urls = shareClassIdLookupUrls(asset.morningstarId, asset.url, msType);

  for (const url of urls) {
    const html = await fetchHtml(url);
    if (!html) continue;
    const shareClassId = extractShareClassIdFromHtml(html);
    if (shareClassId) return shareClassId;
  }
  return null;
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; XRayPortfolioShareClassBackfill/1.0)',
        Accept: 'text/html',
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('SHARE_CLASS_BACKFILL_FAILED', message);
  process.exit(1);
});
