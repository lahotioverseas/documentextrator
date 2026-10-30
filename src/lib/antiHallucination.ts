/**
 * Anti-Hallucination & Placeholder Detection Safeguards
 * Ensures that AI extractions never hallucinate or inject placeholder values,
 * and flags low-confidence or missing fields for manual entry.
 */

export interface FieldValidationResult {
  isValid: boolean;
  isPlaceholder: boolean;
  needsManualEntry: boolean;
  reason?: string;
  cleanedValue: any;
}

/**
 * Patterns that indicate obvious placeholder / dummy values
 */
const PLACEHOLDER_PATTERNS = [
  /^x+$/i,
  /^x{2,}/i,
  /^(tbd|tba|n\/a|na|null|undefined|none|nil|pending|placeholder|dummy|sample|test)$/i,
  /^0{4,}$/,
  /^(123456789?0?|1234567890)$/,
  /^99999/,
  /^(.)\1{4,}$/ // 5 or more repeated identical characters (e.g. 11111, aaaaa, 99999)
];

/**
 * Checks if a string value is an obvious placeholder or dummy text
 */
export function isPlaceholderValue(val: any): boolean {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  if (!str) return false;

  // Check against common placeholder terms
  if (PLACEHOLDER_PATTERNS.some(pat => pat.test(str))) {
    return true;
  }

  // Check for repeated sequences like "12345678", "000000", "XXXXXX"
  if (/^(0123456789|1234567890|abcdef|qwerty)/i.test(str)) {
    return true;
  }

  return false;
}

/**
 * Sanitizes a single extracted value:
 * If it's a placeholder, dummy value, or empty, returns null or empty string.
 */
export function sanitizeExtractedValue<T>(val: T, fallback: any = null): T | typeof fallback {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || isPlaceholderValue(trimmed)) {
      return fallback;
    }
    return trimmed as unknown as T;
  }
  if (typeof val === 'number') {
    if (isNaN(val) || val === 0 && isPlaceholderValue(val)) {
      return fallback;
    }
    return val;
  }
  return val;
}

/**
 * Recursively sanitizes an extracted object or array, stripping placeholder values.
 */
export function sanitizeExtractedData(data: any): any {
  if (data === null || data === undefined) return null;

  if (Array.isArray(data)) {
    return data.map(item => sanitizeExtractedData(item));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        if (isPlaceholderValue(value)) {
          sanitized[key] = null;
        } else {
          sanitized[key] = value.trim();
        }
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeExtractedData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Inspects a document object and generates a list of fields that need manual entry.
 */
export function detectFieldsNeedingManualEntry(data: Record<string, any>, requiredFields: string[]): Array<{ field: string; label: string; reason: string }> {
  const missing: Array<{ field: string; label: string; reason: string }> = [];

  for (const field of requiredFields) {
    const parts = field.split('.');
    let val: any = data;
    for (const p of parts) {
      val = val ? val[p] : undefined;
    }

    if (val === null || val === undefined || val === '') {
      missing.push({
        field,
        label: field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        reason: 'Not explicitly present in uploaded document — manual entry required'
      });
    } else if (typeof val === 'string' && isPlaceholderValue(val)) {
      missing.push({
        field,
        label: field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        reason: `Detected suspicious placeholder value "${val}" — flagged for manual confirmation`
      });
    }
  }

  return missing;
}
