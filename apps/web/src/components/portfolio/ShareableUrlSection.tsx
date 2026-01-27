'use client';

import React, { memo } from 'react';
import { Button } from '@/components/ui/Button';

interface ShareableUrlSectionProps {
  fullShareableUrl: string;
  morningstarUrl: string | null;
  copied: boolean;
  onCopyUrl: () => void;
  onOpenPDF: () => void;
}

/**
 * Displays shareable URL and X-Ray report link after successful generation.
 */
export const ShareableUrlSection = memo<ShareableUrlSectionProps>(function ShareableUrlSection({
  fullShareableUrl,
  morningstarUrl,
  copied,
  onCopyUrl,
  onOpenPDF,
}) {
  return (
    <div className="pt-4 border-t border-slate-200">
      <div className="space-y-3">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Shareable Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={fullShareableUrl}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm"
              aria-label="Shareable portfolio URL"
            />
            <Button
              onClick={onCopyUrl}
              variant="secondary"
              size="sm"
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Share this link to recreate the portfolio
          </p>
        </div>
        <Button
          onClick={onOpenPDF}
          className="w-full"
          disabled={!morningstarUrl}
        >
          View X-Ray Report
        </Button>
      </div>
    </div>
  );
});
