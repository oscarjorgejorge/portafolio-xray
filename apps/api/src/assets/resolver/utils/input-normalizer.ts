/**
 * Re-export from centralized IdentifierClassifier
 * This file is kept for backward compatibility with existing imports
 *
 * @deprecated Import directly from '@common/utils/identifier-classifier' instead
 */
import {
  IdentifierClassifier,
  IdentifierType,
} from '../../../common/utils/identifier-classifier';

// Note: InputType is exported from resolver.types.ts to avoid duplicate exports

/**
 * Normalize input string for consistent processing
 * @deprecated Use IdentifierClassifier.normalizeInput() instead
 */
export function normalizeInput(input: string): string {
  return IdentifierClassifier.normalizeInput(input);
}

/**
 * Classify the input type based on its format
 * @deprecated Use IdentifierClassifier.classify() instead
 */
export function classifyInput(input: string): IdentifierType {
  return IdentifierClassifier.classify(input);
}
