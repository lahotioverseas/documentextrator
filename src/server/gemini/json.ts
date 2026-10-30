// Parsing and cleaning of the JSON the model returns.

/**
 * Extracts the outermost JSON substring from raw model output.
 */
function extractOutermostJSONString(text: string): string {
  let cleaned = text.trim();
  const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    return match[1].trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }
  if (startIdx > 0) {
    cleaned = cleaned.substring(startIdx);
  }
  return cleaned;
}

/**
 * Robustly repairs truncated JSON strings, unclosed quotes, unescaped control
 * characters, and unclosed arrays/objects from partial/long AI model responses.
 */
function repairTruncatedJSON(jsonStr: string): string {
  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];
  let result = '';

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        result += char;
      } else if (char === '\\') {
        isEscaped = true;
        result += char;
      } else if (char === '"') {
        inString = false;
        result += char;
      } else if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else if (char.charCodeAt(0) < 32) {
        result += ' ';
      } else {
        result += char;
      }
    } else {
      if (char === '"') {
        inString = true;
        result += char;
      } else if (char === '{' || char === '[') {
        stack.push(char);
        result += char;
      } else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === '{') {
          stack.pop();
        }
        result += char;
      } else if (char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === '[') {
          stack.pop();
        }
        result += char;
      } else {
        result += char;
      }
    }
  }

  // If ended while still inside an unclosed string
  if (inString) {
    if (isEscaped) {
      result = result.slice(0, -1);
    }
    result += '"';
  }

  // Remove any trailing commas right before closing brackets
  result = result.trim().replace(/,\s*$/, '');

  // Close all unclosed objects and arrays in LIFO order
  while (stack.length > 0) {
    const last = stack.pop();
    result = result.trim().replace(/,\s*$/, '');
    if (last === '{') {
      result += '}';
    } else if (last === '[') {
      result += ']';
    }
  }

  return result;
}

export function cleanAndParseJSON(rawText: string | undefined): any {
  if (!rawText || !rawText.trim()) {
    throw new Error('Empty response received from AI model');
  }

  const cleaned = extractOutermostJSONString(rawText);

  // Attempt 1: Direct JSON.parse
  try {
    return JSON.parse(cleaned);
  } catch (err1) {
    // Attempt 2: Repair unescaped control chars, unclosed strings, and unclosed brackets
    try {
      const repaired = repairTruncatedJSON(cleaned);
      return JSON.parse(repaired);
    } catch (err2) {
      // Attempt 3: Aggressive sanitization of non-printable ASCII
      try {
        const sanitized = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        const repaired = repairTruncatedJSON(sanitized);
        return JSON.parse(repaired);
      } catch (err3: any) {
        console.error('All JSON parsing attempts failed. Sample of raw output:', cleaned.slice(0, 500));
        throw new Error(`JSON parse error: ${err3?.message || 'Invalid JSON output from AI model'}`);
      }
    }
  }
}

/**
 * Server-side anti-hallucination and placeholder detector
 */
const SERVER_PLACEHOLDER_REGEX = /^(x{2,}|tbd|tba|n\/a|na|null|undefined|none|nil|pending|placeholder|dummy|sample|test|12345|99999|00000|(.)\1{4,})$/i;

function isSuspiciousPlaceholder(val: any): boolean {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  if (!str) return false;
  if (SERVER_PLACEHOLDER_REGEX.test(str)) return true;
  if (/^(0123456789|1234567890|abcdef|qwerty)/i.test(str)) return true;
  return false;
}

export function sanitizeAIOutput(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeAIOutput(item));
  }
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        if (isSuspiciousPlaceholder(value)) {
          res[key] = null;
        } else {
          res[key] = value.trim();
        }
      } else if (typeof value === 'object' && value !== null) {
        res[key] = sanitizeAIOutput(value);
      } else {
        res[key] = value;
      }
    }
    return res;
  }
  return obj;
}
