import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';
import { Prisma, PrismaClient, AssetType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { extractShareClassIdFromHtml } from '../assets/resolver/utils/canonical-fund-id';
import { shareClassIdLookupUrls } from '../assets/resolver/utils/url-builder';
import {
  isMorningstarBotChallenge,
  MS_ASSET_TYPES,
} from '../assets/resolver/utils/constants';
import {
  formatSkipSummary,
  planShareClassBackfill,
  type BackfillAsset,
  type BackfillPlan,
  type BackfillSkipReason,
} from './enrich-share-class-ids.logic';
import {
  buildInstantXrayScreenerUrl,
  parseInstantXrayScreenerResponse,
  pickShareClassIdFromScreenerResults,
  screenerUniversesForQuery,
} from '../assets/resolver/utils/instant-xray-screener';

loadEnv({ path: join(__dirname, '..', '..', '.env') });

const LOOKUP_TIMEOUT_MS = Number(process.env.LOOKUP_TIMEOUT_MS ?? 15000);
const LOOKUP_GAP_MS = Number(process.env.LOOKUP_GAP_MS ?? 4000);
const CONSECUTIVE_BOT_STOP = Number(process.env.CONSECUTIVE_BOT_STOP ?? 5);

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

type LookupResult =
  | { status: 'found'; shareClassId: string }
  | { status: 'blocked'; httpStatus?: number }
  | { status: 'error'; httpStatus?: number }
  | { status: 'timeout' }
  | { status: 'empty' };

/**
 * Backfill Instant X-Ray F IDs and fix asset types from quote URLs.
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
    const assets = await loadCandidates(prisma);
    console.log(`Found ${assets.length} cached rows to classify`);

    let saved = 0;
    let typed = 0;
    let lookups = 0;
    const skipped: Partial<Record<BackfillSkipReason, number>> = {};
    let consecutiveBot = 0;
    let botStopped = false;

    for (const asset of assets) {
      let current: BackfillAsset = asset;
      let plan = planShareClassBackfill(current);

      if (plan.action === 'correct_type') {
        typed += 1;
        logLine(dryRun ? 'DRY TYPE' : 'TYPE', current, plan.type);
        if (!dryRun) {
          await prisma.asset.update({
            where: { id: current.id },
            data: { type: plan.type },
          });
        }
        current = { ...current, type: plan.type };
        plan = planShareClassBackfill(current);
      }

      const handled = await applyShareClassPlan({
        prisma,
        dryRun,
        asset: current,
        plan,
        botStopped,
        skipped,
      });
      if (handled.saved) saved += 1;
      if (handled.lookedUp) lookups += 1;
      if (handled.botHit) {
        consecutiveBot += 1;
        if (consecutiveBot >= CONSECUTIVE_BOT_STOP && !botStopped) {
          botStopped = true;
          console.log(
            `STOP lookups after ${consecutiveBot} consecutive Morningstar bot challenges`,
          );
        }
      } else if (handled.lookedUp && handled.saved) {
        consecutiveBot = 0;
      }
    }

    const skipSummary = formatSkipSummary(skipped);
    console.log(
      `Done. ${dryRun ? 'Would save' : 'Saved'} ${saved} F IDs, ` +
        `${dryRun ? 'would retag' : 'retagged'} ${typed} types, ` +
        `lookups ${lookups}` +
        (skipSummary ? `, skipped ${skipSummary}` : '') +
        '.',
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function loadCandidates(prisma: PrismaClient): Promise<BackfillAsset[]> {
  const select = {
    id: true,
    morningstarId: true,
    shareClassId: true,
    type: true,
    url: true,
    name: true,
    isin: true,
  } as const;

  const [fundLike, mistypedStocks] = await Promise.all([
    prisma.asset.findMany({
      where: {
        type: { in: [AssetType.FUND, AssetType.ETF, AssetType.ETC] },
        shareClassId: null,
      },
      select,
    }),
    prisma.asset.findMany({
      where: {
        type: AssetType.STOCK,
        OR: [
          { url: { contains: '/etfs/' } },
          { url: { contains: '/funds/' } },
          { url: { contains: '/fondos/' } },
        ],
      },
      select,
    }),
  ]);

  const byId = new Map<string, BackfillAsset>();
  for (const asset of [...fundLike, ...mistypedStocks]) {
    byId.set(asset.id, asset);
  }
  return [...byId.values()];
}

async function applyShareClassPlan(args: {
  prisma: PrismaClient;
  dryRun: boolean;
  asset: BackfillAsset;
  plan: BackfillPlan;
  botStopped: boolean;
  skipped: Partial<Record<BackfillSkipReason, number>>;
}): Promise<{ saved: boolean; lookedUp: boolean; botHit: boolean }> {
  const { prisma, dryRun, asset, plan, skipped } = args;

  if (plan.action === 'correct_type') {
    return { saved: false, lookedUp: false, botHit: false };
  }

  if (plan.action === 'skip') {
    bumpSkip(skipped, plan.reason);
    logLine(`SKIP ${plan.reason}`, asset);
    return { saved: false, lookedUp: false, botHit: false };
  }

  if (plan.action === 'save_share_class') {
    return persistShareClassPlan(
      prisma,
      dryRun,
      asset,
      plan.shareClassId,
      skipped,
    );
  }

  if (args.botStopped) {
    bumpSkip(skipped, 'BOT_STOP');
    logLine('SKIP BOT_STOP', asset);
    return { saved: false, lookedUp: false, botHit: false };
  }

  const fromScreener = await lookupShareClassFromScreener(
    plan.morningstarId,
    asset.isin,
  );
  if (fromScreener) {
    const persisted = await persistShareClassPlan(
      prisma,
      dryRun,
      asset,
      fromScreener,
      skipped,
    );
    await sleep(Math.min(LOOKUP_GAP_MS, 1000));
    return { ...persisted, lookedUp: true, botHit: false };
  }

  const result = await lookupShareClassId(plan.morningstarId, asset);
  await sleep(LOOKUP_GAP_MS);

  if (result.status === 'found') {
    const persisted = await persistShareClassPlan(
      prisma,
      dryRun,
      asset,
      result.shareClassId,
      skipped,
    );
    return { ...persisted, lookedUp: true, botHit: false };
  }

  const reason = skipReasonFromLookup(result);
  bumpSkip(skipped, reason);
  const statusLabel =
    result.status === 'blocked' || result.status === 'error'
      ? result.httpStatus
        ? `HTTP_${result.httpStatus}`
        : reason
      : reason;
  const lookupHint =
    plan.morningstarId !== asset.morningstarId
      ? `lookup ${plan.morningstarId}`
      : undefined;
  logLine(`SKIP ${statusLabel}`, asset, lookupHint);
  return {
    saved: false,
    lookedUp: true,
    botHit: result.status === 'blocked' || result.status === 'timeout',
  };
}

function skipReasonFromLookup(result: LookupResult): BackfillSkipReason {
  if (result.status === 'blocked') return 'HTTP_BLOCKED';
  if (result.status === 'error') return 'HTTP_ERROR';
  if (result.status === 'timeout') return 'TIMEOUT';
  return 'NO_F_ID';
}

async function persistShareClassPlan(
  prisma: PrismaClient,
  dryRun: boolean,
  asset: BackfillAsset,
  shareClassId: string,
  skipped: Partial<Record<BackfillSkipReason, number>>,
): Promise<{ saved: boolean; lookedUp: boolean; botHit: boolean }> {
  const owner = await prisma.asset.findFirst({
    where: { shareClassId, NOT: { id: asset.id } },
    select: { id: true, morningstarId: true },
  });
  if (owner) {
    bumpSkip(skipped, 'DUPLICATE');
    logLine(
      'SKIP DUPLICATE',
      asset,
      `${shareClassId} already on ${owner.morningstarId}`,
    );
    return { saved: false, lookedUp: false, botHit: false };
  }

  logLine(dryRun ? 'DRY' : 'SAVE', asset, shareClassId);
  if (!dryRun) {
    try {
      await prisma.asset.update({
        where: { id: asset.id },
        data: { shareClassId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        bumpSkip(skipped, 'DUPLICATE');
        logLine('SKIP DUPLICATE', asset, shareClassId);
        return { saved: false, lookedUp: false, botHit: false };
      }
      throw error;
    }
  }
  return { saved: true, lookedUp: false, botHit: false };
}

async function lookupShareClassFromScreener(
  morningstarId: string,
  isin?: string | null,
): Promise<string | null> {
  const terms = [isin?.trim().toUpperCase(), morningstarId].filter(
    (term): term is string => Boolean(term),
  );
  const seen = new Set<string>();
  for (const term of terms) {
    if (seen.has(term)) continue;
    seen.add(term);
    const universes = screenerUniversesForQuery(term);
    const merged: ReturnType<typeof parseInstantXrayScreenerResponse> = [];
    for (const universeId of universes) {
      const payload = await fetchJson(
        buildInstantXrayScreenerUrl(term, universeId),
      );
      if (!payload) continue;
      merged.push(
        ...parseInstantXrayScreenerResponse(payload, term, universeId),
      );
    }
    const shareClassId = pickShareClassIdFromScreenerResults(merged);
    if (shareClassId) {
      return shareClassId;
    }
  }
  return null;
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        ...BROWSER_HEADERS,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookupShareClassId(
  morningstarId: string,
  asset: BackfillAsset,
): Promise<LookupResult> {
  const msType =
    asset.type === AssetType.ETF
      ? MS_ASSET_TYPES.ETF
      : asset.type === AssetType.STOCK
        ? MS_ASSET_TYPES.STOCK
        : MS_ASSET_TYPES.FUND;
  const urls = shareClassIdLookupUrls(morningstarId, asset.url, msType);

  let lastError: LookupResult = { status: 'empty' };
  for (const url of urls) {
    const fetched = await fetchHtml(url);
    if (fetched.status === 'blocked' || fetched.status === 'timeout') {
      return fetched;
    }
    if (fetched.status === 'error') {
      lastError = fetched;
      continue;
    }
    if (fetched.status === 'found') {
      const shareClassId = extractShareClassIdFromHtml(fetched.html);
      if (shareClassId) {
        return { status: 'found', shareClassId };
      }
      lastError = { status: 'empty' };
    }
  }
  return lastError;
}

async function fetchHtml(
  url: string,
): Promise<
  | { status: 'found'; html: string }
  | { status: 'blocked'; httpStatus?: number }
  | { status: 'error'; httpStatus?: number }
  | { status: 'timeout' }
> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: BROWSER_HEADERS,
    });
    if (isMorningstarBotChallenge(response.status)) {
      return { status: 'blocked', httpStatus: response.status };
    }
    if (!response.ok) {
      return { status: 'error', httpStatus: response.status };
    }
    return { status: 'found', html: await response.text() };
  } catch (error) {
    const aborted =
      (error instanceof Error && error.name === 'AbortError') ||
      controller.signal.aborted;
    return aborted ? { status: 'timeout' } : { status: 'error' };
  } finally {
    clearTimeout(timer);
  }
}

function bumpSkip(
  skipped: Partial<Record<BackfillSkipReason, number>>,
  reason: BackfillSkipReason,
): void {
  skipped[reason] = (skipped[reason] ?? 0) + 1;
}

function logLine(prefix: string, asset: BackfillAsset, extra?: string): void {
  const detail = extra ? ` -> ${extra}` : '';
  console.log(`${prefix} ${asset.morningstarId}${detail} (${asset.name})`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('SHARE_CLASS_BACKFILL_FAILED', message);
  process.exit(1);
});
