import { AssetType } from '@prisma/client';
import {
  extractPreferredFundId,
  isFundShareClassId,
  isPerformanceId,
  isValidIsin,
} from '../assets/resolver/utils/id-extractor';
import {
  isFundLikeType,
  namesLookSimilar,
} from '../assets/resolver/utils/canonical-fund-id';

export type RepairAsset = {
  id: string;
  morningstarId: string;
  isin: string | null;
  name: string;
  type: AssetType;
  url: string;
};

export type RemapCandidate = {
  oldId: string;
  canonicalId: string;
  oldName: string;
  canonicalName: string;
  source: 'isin_group' | 'url' | 'isin_as_id';
};

export type LeftoverAsset = {
  morningstarId: string;
  isin: string | null;
  name: string;
  type: AssetType;
  reason: string;
};

/**
 * Build 0P/garbage → F remap candidates from cache rows (no network)
 */
export function buildRemapCandidates(assets: RepairAsset[]): {
  candidates: RemapCandidate[];
  leftovers: LeftoverAsset[];
} {
  const byId = new Map(assets.map((asset) => [asset.morningstarId, asset]));
  const candidateMap = new Map<string, RemapCandidate>();

  const byIsin = new Map<string, RepairAsset[]>();
  for (const asset of assets) {
    if (!asset.isin) continue;
    const key = asset.isin.toUpperCase();
    const group = byIsin.get(key) ?? [];
    group.push(asset);
    byIsin.set(key, group);
  }

  for (const group of byIsin.values()) {
    const canonical = group.find((asset) =>
      isFundShareClassId(asset.morningstarId),
    );
    if (!canonical) continue;
    for (const asset of group) {
      if (asset.morningstarId === canonical.morningstarId) continue;
      if (asset.type === AssetType.STOCK) continue;
      addCandidate(candidateMap, {
        oldId: asset.morningstarId,
        canonicalId: canonical.morningstarId,
        oldName: asset.name,
        canonicalName: canonical.name,
        source: 'isin_group',
      });
    }
  }

  for (const asset of assets) {
    if (asset.type === AssetType.STOCK) continue;
    if (!isFundLikeType(asset.type)) continue;
    if (!isPerformanceId(asset.morningstarId)) continue;
    if (candidateMap.has(asset.morningstarId)) continue;

    const fromUrl = extractPreferredFundId(asset.url);
    if (!fromUrl || fromUrl === asset.morningstarId) continue;

    const canonicalRow = byId.get(fromUrl);
    addCandidate(candidateMap, {
      oldId: asset.morningstarId,
      canonicalId: fromUrl,
      oldName: asset.name,
      canonicalName: canonicalRow?.name ?? asset.name,
      source: 'url',
    });
  }

  for (const asset of assets) {
    if (asset.type === AssetType.STOCK) continue;
    if (!isValidIsin(asset.morningstarId)) continue;
    if (candidateMap.has(asset.morningstarId)) continue;

    const group = byIsin.get(asset.morningstarId.toUpperCase()) ?? [];
    const canonical =
      group.find((row) => isFundShareClassId(row.morningstarId)) ??
      group.find((row) => isPerformanceId(row.morningstarId));
    if (!canonical || canonical.morningstarId === asset.morningstarId) continue;

    addCandidate(candidateMap, {
      oldId: asset.morningstarId,
      canonicalId: canonical.morningstarId,
      oldName: asset.name,
      canonicalName: canonical.name,
      source: 'isin_as_id',
    });
  }

  const leftovers: LeftoverAsset[] = [];
  for (const asset of assets) {
    if (asset.type === AssetType.STOCK) continue;
    if (isFundShareClassId(asset.morningstarId)) continue;
    if (candidateMap.has(asset.morningstarId)) continue;

    if (isFundLikeType(asset.type) && isPerformanceId(asset.morningstarId)) {
      leftovers.push({
        morningstarId: asset.morningstarId,
        isin: asset.isin,
        name: asset.name,
        type: asset.type,
        reason: 'no_f_candidate',
      });
      continue;
    }

    if (
      isFundLikeType(asset.type) &&
      !isPerformanceId(asset.morningstarId) &&
      !isFundShareClassId(asset.morningstarId)
    ) {
      leftovers.push({
        morningstarId: asset.morningstarId,
        isin: asset.isin,
        name: asset.name,
        type: asset.type,
        reason: 'invalid_morningstar_id',
      });
    }
  }

  return { candidates: [...candidateMap.values()], leftovers };
}

/**
 * Local gate before the live X-Ray probe
 */
export function passesLocalVerification(
  candidate: RemapCandidate,
  oldAsset: RepairAsset | undefined,
  canonicalAsset: RepairAsset | undefined,
): { ok: boolean; reason: string } {
  const oldIsin = oldAsset?.isin?.toUpperCase() ?? null;
  const canonicalIsin = canonicalAsset?.isin?.toUpperCase() ?? null;
  if (oldIsin && canonicalIsin && oldIsin !== canonicalIsin) {
    return { ok: false, reason: 'isin_mismatch' };
  }

  if (!namesLookSimilar(candidate.oldName, candidate.canonicalName)) {
    return { ok: false, reason: 'name_mismatch' };
  }

  return { ok: true, reason: 'ok' };
}

function addCandidate(
  map: Map<string, RemapCandidate>,
  candidate: RemapCandidate,
): void {
  if (candidate.oldId === candidate.canonicalId) return;
  if (!isFundShareClassId(candidate.canonicalId)) return;
  if (!map.has(candidate.oldId)) {
    map.set(candidate.oldId, candidate);
  }
}
