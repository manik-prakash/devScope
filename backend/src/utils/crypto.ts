import crypto from 'crypto';

/**
 * Reconstructs a canonical JSON string by recursively sorting object keys.
 * This matches Go's json.Marshal behavior for structs (ordered by declaration)
 * provided the JS object keys match the Go struct field names.
 */
export function canonicalJson(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }

  const sortedKeys = Object.keys(obj).sort();
  const result = sortedKeys.map(key => {
    return JSON.stringify(key) + ':' + canonicalJson(obj[key]);
  });

  return '{' + result.join(',') + '}';
}

export function hmacSha256(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function verifySignature(payload: any, signingSecret: string): boolean {
  const { signature, ...rest } = payload;
  
  if (!signature) return false;

  const sigHex = signature.startsWith('hmac-sha256:')
    ? signature.slice(12)
    : signature;

  const canonical = canonicalJson(rest);
  const expected = hmacSha256(signingSecret, canonical);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(sigHex, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch (error) {
    return false;
  }
}
