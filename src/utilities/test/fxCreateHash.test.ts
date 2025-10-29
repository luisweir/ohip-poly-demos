import { createHash } from '../fxCreateHash';
import * as crypto from 'crypto';

describe('fxCreateHash', () => {
  it('produces deterministic SHA-256 hex for given inputs', async () => {
    const hotelName = 'HOGSANDBOX';
    const enterpriseId = 'OCR4ENT';
    const chainCode = 'OHIPLAB';

    // deriveSecret function mirrored for expectation (kept small and explicit)
    const codeAt = (s: string) => (s?.length >= 2 ? s.charCodeAt(1) : 0);
    const derivedSecret = [hotelName, enterpriseId, chainCode]
      .map(codeAt)
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');

    const message = `${enterpriseId}:${chainCode}:${hotelName}`;
    const expected = crypto.createHmac('sha256', derivedSecret).update(message).digest('hex');

    const result = await createHash(hotelName, enterpriseId, chainCode);
    expect(result).toEqual(expected);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('handles empty strings (uses 0 derivation) and returns valid hex', async () => {
    const hotelName = '';
    const enterpriseId = '';
    const chainCode = '';

    const codeAt = (s: string) => (s?.length >= 2 ? s.charCodeAt(1) : 0);
    const derivedSecret = [hotelName, enterpriseId, chainCode]
      .map(codeAt)
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');

    const message = `${enterpriseId}:${chainCode}:${hotelName}`;
    const expected = crypto.createHmac('sha256', derivedSecret).update(message).digest('hex');

    const result = await createHash(hotelName, enterpriseId, chainCode);
    expect(result).toEqual(expected);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns "notfound" if HMAC throws', async () => {
    // Re-require the module with a mocked crypto to simulate an exception
    jest.resetModules();
    jest.doMock('crypto', () => ({
      createHmac: () => { throw new Error('boom'); }
    }));
    const { createHash: createHashIsolated } = require('../fxCreateHash');
    const result = await createHashIsolated('H', 'E', 'C');
    expect(result).toBe('notfound');
    jest.dontMock('crypto');
  });
});
