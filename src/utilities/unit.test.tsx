import poly from 'polyapi';
import { vari } from 'polyapi';
import { decodeJWT } from './fxGetToken';
import * as tokenModule from './fxGetToken';
import { getHotelId } from './fxGetHotelId';

jest.mock('polyapi', () => ({
  ohip: {
    utilities: {
      getOhipToken: jest.fn()
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
      token: {
        get: jest.fn(),
        update: jest.fn()
      },
      envSecrets: {
        inject: jest.fn()
      }
    }
  }
}));

describe('decodeJWT function', () => {
  it('should correctly decode a valid JWT', () => {
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkhhcnJ5IFBvdHRlciIsImlhdCI6MTUxNjIzOTAyMn0.Jkr1iBrO9-cr7uZRYhvE8BuSXIfuPnQWuZBNBE60t14'; // Example JWT
    const expectedPayload = { sub: '1234567890', name: 'Harry Potter', iat: 1516239022 };

    const result = decodeJWT(validToken);
    expect(result).toEqual(expectedPayload);
  });

  it('should handle invalid JWT format', () => {
    const invalidToken = 'invalid.jwt.token';
    const result = decodeJWT(invalidToken);
    expect(result).toBeNull();
  });

  it('should handle invalid Base64 encoding', () => {
    const invalidBase64Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidbase64.abc123';
    const result = decodeJWT(invalidBase64Token);
    expect(result).toBeNull();
  });

  it('should handle malformed JSON payload', () => {
    const malformedJsonToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.bWFsdm9ybWVkLWpzb24.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const result = decodeJWT(malformedJsonToken);
    expect(result).toBeNull();
  });

  it('should handle exceptions', () => {
    const tokenCausingException = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const result = decodeJWT(tokenCausingException);
    expect(result).toBeNull();
  });
});

describe('getOhipToken function', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    (vari.ohip.token.get as jest.Mock).mockResolvedValue('mockToken');
  });

  it('should fetch a new token if the stored token is invalid', async() => {
    jest.spyOn(tokenModule, 'decodeJWT').mockImplementationOnce(() => {
        throw new Error('Invalid token');
    });

    const mockAccessToken = 'new-access-token';
    (poly.ohip.auth.getAccessToken as jest.Mock).mockResolvedValueOnce({ data: { access_token: mockAccessToken } });
    const result = await tokenModule.getOhipToken();
    expect(result).toBe(mockAccessToken);
  });

  it('should return stored token if it has more than 5 minutes remaining', async() => {
    const mockExpirationTime = Math.floor(Date.now() / 1000) + 360; // 6 minutes from now
    jest.spyOn(tokenModule, 'decodeJWT').mockImplementationOnce(jest.fn().mockReturnValueOnce({ exp: mockExpirationTime }));
    const result = await tokenModule.getOhipToken();
    expect(result).toBe('mockToken');
  });

  it('should fetch a new token if the stored token is about to expire', async() => {
    const mockExpirationTime = Math.floor(Date.now() / 1000) + 240; // 4 minutes from now
    jest.spyOn(tokenModule, 'decodeJWT').mockImplementationOnce(jest.fn().mockReturnValueOnce({ exp: mockExpirationTime }));
    const mockAccessToken = 'new-access-token';
    (poly.ohip.auth.getAccessToken as jest.Mock).mockResolvedValueOnce({ data: { access_token: mockAccessToken } });
    const result = await tokenModule.getOhipToken();
    expect(result).toBe(mockAccessToken);
  });
});

describe('getHotelId', () => {
  it('should fetch the hotel ID based on the provided hotel name (non-case sensitive)', async() => {
    // Mock data
    const mockToken = 'mockToken';
    const mockHotelName = 'TEST hotel';
    const mockHotelsInChain = {
      data: {
        listOfValues: {
          items: [
            { name: 'Another Hotel', code: 'AH' },
            { name: 'Test Hotel', code: 'TH' },
            { name: 'Some Hotel', code: 'SH' }
          ]
        }
      }
    };
    const expectedHotelId = 'TH';

    // Mock function implementations
    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(mockToken);
    (poly.ohip.property.getAllHotelsInChain as jest.Mock).mockResolvedValue(mockHotelsInChain);
    (vari.ohip.envSecrets.inject as jest.Mock).mockReturnValue('mockValue');

    // Perform the test
    const result = await getHotelId(mockHotelName);

    // Assertions
    expect(result).toEqual(expectedHotelId);

    // Verify that the mock functions were called
    expect(poly.ohip.utilities.getOhipToken).toHaveBeenCalled();
    expect(poly.ohip.property.getAllHotelsInChain).toHaveBeenCalledWith(
      'mockValue', // hostName
      'mockValue', // hotelId
      'mockValue', // appKey
      mockToken    // token
    );
  });

  it('should return "notfound" when the hotel name does not match any hotel in the chain', async() => {
    // Mock data
    const mockToken = 'mockToken';
    const mockHotelName = 'Nonexistent Hotel';
    const mockHotelsInChain = {
      data: {
        listOfValues: {
          items: [
            { name: 'Another Hotel', code: 'AH' },
            { name: 'Test Hotel', code: 'TH' },
            { name: 'Some Hotel', code: 'SH' }
          ]
        }
      }
    };

    // Mock function implementations
    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(mockToken);
    (poly.ohip.property.getAllHotelsInChain as jest.Mock).mockResolvedValue(mockHotelsInChain);
    (vari.ohip.envSecrets.inject as jest.Mock).mockReturnValue('mockValue');

    // Perform the test
    const result = await getHotelId(mockHotelName);

    // Assertions
    expect(result).toEqual('notfound');

    // Verify that the mock functions were called
    expect(poly.ohip.utilities.getOhipToken).toHaveBeenCalled();
    expect(poly.ohip.property.getAllHotelsInChain).toHaveBeenCalledWith(
      'mockValue', // hostName
      'mockValue', // hotelId
      'mockValue', // appKey
      mockToken    // token
    );
  });
});
