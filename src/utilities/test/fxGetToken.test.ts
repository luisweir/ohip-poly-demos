import poly from 'polyapi';
import { vari } from 'polyapi';
import { decodeJWT } from '../fxGetToken';
import * as tokenModule from '../fxGetToken';

jest.mock('polyapi', () => ({
  ohip: {
    utilities: {
      getOhipToken: jest.fn(),
      createHash: jest.fn().mockResolvedValue('mock-hash')
    },
    auth: {
      getAccessToken: jest.fn()
    },
    property: {
      getAllHotelsInChain: jest.fn()
    }
  },
  vari: {
    ohip: {
      envSecrets: {
        inject: jest.fn()
      }
    }
  },
  tabi: {
    ohip: {
      tokens: {
        selectOne: jest.fn(),
        insertOne: jest.fn(),
        upsertOne: jest.fn()
      }
    }
  }
}));

describe('decodeJWT', () => {
  it('decodes a valid JWT', () => {
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkhhcnJ5IFBvdHRlciIsImlhdCI6MTUxNjIzOTAyMn0.Jkr1iBrO9-cr7uZRYhvE8BuSXIfuPnQWuZBNBE60t14';
    const expectedPayload = { sub: '1234567890', name: 'Harry Potter', iat: 1516239022 };
    expect(decodeJWT(validToken)).toEqual(expectedPayload);
  });

  it('handles invalid JWT format', () => {
    expect(decodeJWT('invalid.jwt.token')).toBeNull();
  });

  it('handles invalid Base64', () => {
    expect(decodeJWT('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidbase64.abc123')).toBeNull();
  });

  it('handles malformed JSON payload', () => {
    expect(decodeJWT('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.bWFsdm9ybWVkLWpzb24.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')).toBeNull();
  });

  it('handles exceptions', () => {
    expect(decodeJWT('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')).toBeNull();
  });
});

describe('getOhipToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (poly.ohip.utilities.createHash as jest.Mock).mockResolvedValue('mock-hash');
    (vari.ohip.envSecrets.inject as jest.Mock).mockImplementation((k: string) => k);
    ((poly as any).tabi.ohip.tokens.selectOne as jest.Mock).mockResolvedValue({ token: 'mockToken' });
    ((poly as any).tabi.ohip.tokens.insertOne as jest.Mock).mockResolvedValue({});
    ((poly as any).tabi.ohip.tokens.upsertOne as jest.Mock).mockResolvedValue({});
  });

  it('fetches a new token if the stored token is invalid', async () => {
    jest.spyOn(tokenModule, 'decodeJWT').mockImplementationOnce(() => {
      throw new Error('Invalid token');
    });
    (poly.ohip.auth.getAccessToken as jest.Mock).mockResolvedValueOnce({ data: { access_token: 'new-access-token' } });
    const result = await tokenModule.getOhipToken();
    expect(result).toBe('new-access-token');
  });

  it('returns stored token if it has more than 5 minutes remaining', async () => {
    const mockExpirationTime = Math.floor(Date.now() / 1000) + 360;
    jest.spyOn(tokenModule, 'decodeJWT').mockImplementationOnce(jest.fn().mockReturnValueOnce({ exp: mockExpirationTime }));
    const result = await tokenModule.getOhipToken();
    expect(result).toBe('mockToken');
  });

  it('fetches a new token if the stored token is about to expire', async () => {
    const mockExpirationTime = Math.floor(Date.now() / 1000) + 240;
    jest.spyOn(tokenModule, 'decodeJWT').mockImplementationOnce(jest.fn().mockReturnValueOnce({ exp: mockExpirationTime }));
    (poly.ohip.auth.getAccessToken as jest.Mock).mockResolvedValueOnce({ data: { access_token: 'new-access-token' } });
    const result = await tokenModule.getOhipToken();
    expect(result).toBe('new-access-token');
  });
});
