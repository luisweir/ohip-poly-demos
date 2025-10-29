import poly from 'polyapi';
import { vari } from 'polyapi';
import { searchHotelsByLocation } from '../fxSearchHotelsByLocation';

jest.mock('polyapi', () => ({
  ohip: {
    utilities: {
      getOhipToken: jest.fn(),
      getHotelId: jest.fn()
    },
    property: {
      getAllHotelsInChain: jest.fn(),
      getHotelDetails: jest.fn()
    }
  },
  google: {
    maps: {
      distanceToHotels: jest.fn()
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

describe('fxSearchHotelsByLocation', () => {
  it('searches for hotels based on location and distance and maps fields', async () => {
    const mockToken = 'mockToken';
    const mockHotelsInChain = {
      data: {
        listOfValues: {
          items: [{ name: 'Hotel1', code: 'H1', description: 'Desc1' }]
        }
      }
    };
    const mockHotelDetails = {
      data: {
        hotelConfigInfo: {
          address: {
            addressLine: ['Street 1'],
            cityName: 'City 1',
            state: 'State 1',
            country: { code: 'Country 1' }
          },
          communication: {
            webPage: { value: 'website1' },
            phoneNumber: { phoneNumber: 'phone1' }
          }
        }
      }
    };
    const mockHotelDistances = {
      data: { rows: [{ elements: [{ status: 'OK', distance: { value: 1609 } }] }] }
    };

    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(mockToken);
    (poly.ohip.property.getAllHotelsInChain as jest.Mock).mockResolvedValue(mockHotelsInChain);
    (poly.ohip.property.getHotelDetails as jest.Mock).mockResolvedValue(mockHotelDetails);
    (poly.google.maps.distanceToHotels as jest.Mock).mockResolvedValue(mockHotelDistances);
    (vari.ohip.envSecrets.inject as jest.Mock).mockReturnValue('mockToken');

    const result = await searchHotelsByLocation('Test Location', 2, 'imperial', 'walking', 'en');

    expect(result).toEqual({
      hotels: [
        {
          name: 'hotel1',
          hotelId: 'H1',
          description: 'Desc1',
          street: 'Street 1',
          city: 'City 1',
          state: 'State 1',
          country: 'Country 1',
          website: 'website1',
          phone: 'phone1',
          distance: 1
        }
      ]
    });

    expect(poly.ohip.utilities.getOhipToken).toHaveBeenCalled();
    expect(poly.ohip.property.getAllHotelsInChain).toHaveBeenCalled();
    expect(poly.ohip.property.getHotelDetails).toHaveBeenCalled();
    expect(poly.google.maps.distanceToHotels).toHaveBeenCalled();
  });
});
