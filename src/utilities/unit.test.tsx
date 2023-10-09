import poly from 'polyapi';
import { vari } from 'polyapi';
import jwt_decode from 'jwt-decode';
import { getOhipToken } from './fxGetToken';
import { getHotelId } from './fxGetHotelId';

jest.mock('jwt-decode');
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

describe('getOhipToken function', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    (vari.ohip.token.get as jest.Mock).mockReturnValue('mockToken');
  });

  it('should fetch a new token if the stored token is invalid', async() => {
    (jwt_decode as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Invalid token');
    });
    const mockAccessToken = 'new-access-token';
    (poly.ohip.auth.getAccessToken as jest.Mock).mockResolvedValueOnce({ data: { access_token: mockAccessToken } });
    const result = await getOhipToken();
    expect(result).toBe(mockAccessToken);
  });

  it('should return stored token if it has more than 5 minutes remaining', async() => {
    const mockExpirationTime = Math.floor(Date.now() / 1000) + 360; // 6 minutes from now
    (jwt_decode as jest.Mock).mockReturnValueOnce({ exp: mockExpirationTime });
    const mockStoredToken = 'mockToken';
    const result = await getOhipToken();
    expect(result).toBe(mockStoredToken);
  });

  it('should fetch a new token if the stored token is about to expire', async() => {
    const mockExpirationTime = Math.floor(Date.now() / 1000) + 240; // 4 minutes from now
    (jwt_decode as jest.Mock).mockReturnValueOnce({ exp: mockExpirationTime });
    const mockAccessToken = 'new-access-token';
    (poly.ohip.auth.getAccessToken as jest.Mock).mockResolvedValueOnce({ data: { access_token: mockAccessToken } });
    const result = await getOhipToken();
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
