import poly from 'polyapi';
import { vari } from 'polyapi';
import { getHotelId } from '../fxGetHotelId';

jest.mock('polyapi', () => ({
  ohip: {
    utilities: {
      getOhipToken: jest.fn()
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
  }
}));

describe('fxGetHotelId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (vari.ohip.envSecrets.inject as jest.Mock).mockImplementation((k: string) => k);
  });

  it('returns the hotel ID for a case-insensitive name match', async () => {
    const mockToken = 'mockToken';
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

    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(mockToken);
    (poly.ohip.property.getAllHotelsInChain as jest.Mock).mockResolvedValue(mockHotelsInChain);

    const result = await getHotelId('TEST hotel');
    expect(result).toBe('TH');
    expect(poly.ohip.property.getAllHotelsInChain).toHaveBeenCalledWith(
      'ohip.hostName',
      'ohip.hotelId',
      'ohip.appKey',
      mockToken
    );
  });

  it('returns "notfound" when no hotel matches', async () => {
    const mockToken = 'mockToken';
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
    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(mockToken);
    (poly.ohip.property.getAllHotelsInChain as jest.Mock).mockResolvedValue(mockHotelsInChain);

    const result = await getHotelId('Nonexistent Hotel');
    expect(result).toBe('notfound');
  });
});
