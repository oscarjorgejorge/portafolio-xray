import { config as loadEnv } from 'dotenv';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, AssetType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  buildRemapCandidates,
  passesLocalVerification,
  type RepairAsset,
  type RemapCandidate,
} from './repair-morningstar-ids.logic';
import { buildXRayProbeUrl, evaluateXRayProbeHtml } from '../xray/xray-probe';

loadEnv({ path: join(__dirname, '..', '..', '.env') });

const DEFAULT_MORNINGSTAR_BASE_URL = 'https://lt.morningstar.com';
const PROBE_TIMEOUT_MS = 20000;
const PROBE_DELAY_MS = 500;

type PortfolioHolding = {
  morningstarId: string;
  weight: number;
  amount?: number;
};

/**
 * Repair 0P / duplicate Morningstar IDs in the asset cache and saved portfolios.
 *
 * Usage:
 * - Dry run (default): npm run repair:morningstar-ids
 * - Apply verified remaps: DRY_RUN=false npm run repair:morningstar-ids
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run this script.');
  }

  const dbHost = describeDatabaseHost(databaseUrl);
  console.log(`Using database host: ${dbHost}`);

  const isLocal =
    databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  if (isLocal && process.env.ALLOW_LOCAL_DB !== 'true') {
    throw new Error(
      `Refusing to run against local database (${dbHost}). Set DATABASE_URL to the Railway public URL in this terminal, then rerun. Example: $env:DATABASE_URL = "postgresql://USER:PASSWORD@centerbeam.proxy.rlwy.net:54032/railway"`,
    );
  }

  const dryRun = process.env.DRY_RUN !== 'false';
  const morningstarBaseUrl =
    process.env.MORNINGSTAR_BASE_URL ?? DEFAULT_MORNINGSTAR_BASE_URL;

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const assets = (await prisma.asset.findMany({
      select: {
        id: true,
        morningstarId: true,
        isin: true,
        name: true,
        type: true,
        url: true,
      },
    })) as RepairAsset[];

    const { candidates, leftovers } = buildRemapCandidates(assets);
    const byId = new Map(assets.map((asset) => [asset.morningstarId, asset]));

    const locallyVerified: RemapCandidate[] = [];
    const skipped: Array<RemapCandidate & { reason: string }> = [];

    for (const candidate of candidates) {
      const local = passesLocalVerification(
        candidate,
        byId.get(candidate.oldId),
        byId.get(candidate.canonicalId),
      );
      if (local.ok) {
        locallyVerified.push(candidate);
      } else {
        skipped.push({ ...candidate, reason: local.reason });
      }
    }

    const probeCache = new Map<string, { ok: boolean; reason: string }>();
    const verified: RemapCandidate[] = [];

    for (const candidate of locallyVerified) {
      let probe = probeCache.get(candidate.canonicalId);
      if (!probe) {
        probe = await probeCanonicalId(
          morningstarBaseUrl,
          candidate.canonicalId,
          candidate.canonicalName,
        );
        probeCache.set(candidate.canonicalId, probe);
        await sleep(PROBE_DELAY_MS);
      }
      if (probe.ok) {
        verified.push(candidate);
      } else {
        skipped.push({ ...candidate, reason: probe.reason });
      }
    }

    const leftoverRows = [
      ...leftovers,
      ...skipped.map((item) => ({
        morningstarId: item.oldId,
        isin: byId.get(item.oldId)?.isin ?? null,
        name: item.oldName,
        type: byId.get(item.oldId)?.type ?? AssetType.FUND,
        reason: item.reason,
      })),
    ];

    const csvPath = join(process.cwd(), 'repair-morningstar-ids-leftovers.csv');
    writeFileSync(csvPath, toCsv(leftoverRows), 'utf8');

    const summary = {
      dryRun,
      scannedAssets: assets.length,
      candidates: candidates.length,
      locallyVerified: locallyVerified.length,
      verified: verified.length,
      skipped: skipped.length,
      leftovers: leftovers.length,
      csvPath,
      verifiedRemaps: verified,
      skippedRemaps: skipped,
    };

    if (dryRun) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const remap = new Map(
      verified.map((item) => [item.oldId, item.canonicalId]),
    );
    let renamed = 0;
    let portfoliosUpdated = 0;

    await prisma.$transaction(async (tx) => {
      const existingIds = new Set(
        (
          await tx.asset.findMany({
            where: { morningstarId: { in: [...new Set(remap.values())] } },
            select: { morningstarId: true },
          })
        ).map((row) => row.morningstarId),
      );

      for (const candidate of verified) {
        if (existingIds.has(candidate.canonicalId)) continue;
        const oldRow = byId.get(candidate.oldId);
        if (!oldRow) continue;
        await tx.asset.update({
          where: { id: oldRow.id },
          data: { morningstarId: candidate.canonicalId },
        });
        existingIds.add(candidate.canonicalId);
        renamed += 1;
      }

      const portfolios = await tx.portfolio.findMany({
        select: { id: true, assets: true, xrayMorningstarUrl: true },
      });

      for (const portfolio of portfolios) {
        const holdings = parseHoldings(portfolio.assets);
        let changed = false;
        const nextHoldings = holdings.map((holding) => {
          const canonicalId = remap.get(holding.morningstarId);
          if (!canonicalId) return holding;
          changed = true;
          return { ...holding, morningstarId: canonicalId };
        });
        if (!changed) continue;

        await tx.portfolio.update({
          where: { id: portfolio.id },
          data: {
            assets: nextHoldings,
            xrayMorningstarUrl: null,
            xrayShareableUrl: null,
            xrayGeneratedAt: null,
          },
        });
        portfoliosUpdated += 1;
      }
    });

    console.log(
      JSON.stringify(
        {
          ...summary,
          renamed,
          portfoliosUpdated,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function probeCanonicalId(
  baseUrl: string,
  fundId: string,
  expectedName: string,
): Promise<{ ok: boolean; reason: string }> {
  const url = buildXRayProbeUrl(baseUrl, fundId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });
    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}` };
    }
    const html = await response.text();
    return evaluateXRayProbeHtml(html, expectedName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `network:${message}` };
  } finally {
    clearTimeout(timer);
  }
}

function parseHoldings(value: unknown): PortfolioHolding[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is PortfolioHolding =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as PortfolioHolding).morningstarId === 'string',
  );
}

function toCsv(
  rows: Array<{
    morningstarId: string;
    isin: string | null;
    name: string;
    type: string;
    reason: string;
  }>,
): string {
  const header = 'morningstarId,isin,name,type,reason';
  const lines = rows.map((row) =>
    [
      row.morningstarId,
      row.isin ?? '',
      csvEscape(row.name),
      row.type,
      row.reason,
    ].join(','),
  );
  return [header, ...lines].join('\n');
}

function csvEscape(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeDatabaseHost(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl.replace(/^postgresql:/, 'http:'));
    const port = parsed.port ? `:${parsed.port}` : '';
    return `${parsed.hostname}${port}`;
  } catch {
    return 'unparseable DATABASE_URL';
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('REPAIR_FAILED', message);
  process.exit(1);
});
