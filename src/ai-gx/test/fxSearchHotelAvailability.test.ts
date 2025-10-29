import poly from 'polyapi';
import { vari } from 'polyapi';
import { searchHotelAvailability } from '../fxSearchHotelAvailability';

jest.mock('polyapi', () => ({
  ohip: {
    utilities: {
      getOhipToken: jest.fn(),
      getHotelId: jest.fn()
    },
    property: {
      searchHotelAvailability: jest.fn(),
      getPropertyRoomTypes: jest.fn()
    }
  },
  vari: {
    ohip: {
      envSecrets: {
        inject: jest.fn()
      },
      descriptionsForModel: {
        get: jest.fn()
      }
    }
  }
}));

describe('fxSearchHotelAvailability', () => {
  it('should search for hotel availability based on given parameters', async () => {
    const mockToken = 'mockToken';
    const mockHotelId = 'H1';
    const mockAvailability = {
      status: 200,
      data: {
        hotelAvailability: [
          {
            roomStays: [
              {
                roomRates: [
                  {
                    roomType: 'RT1',
                    ratePlanCode: 'RPC1',
                    total: {
                      currencyCode: 'USD',
                      amountBeforeTax: 100
                    },
                    numberOfUnits: 2
                  }
                ]
              }
            ]
          }
        ]
      }
    };
    const mockRoomTypes = {
      data: {
        listOfValues: {
          items: [{ code: 'RT1', name: 'RoomType1' }]
        }
      }
    };
    const mockDescriptions = ['mockDescription'];

    const expectedResult = {
      descriptionForModel: mockDescriptions,
      availability: [
        {
          roomName: 'RoomType1',
          ratePlanCode: 'RPC1',
          roomTypeCode: 'RT1',
          currencyCode: 'USD',
          amountBeforeTax: 100,
          roomsAvailable: 2,
          roomRateIncludes: []
        }
      ]
    };

    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(mockToken);
    (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue(mockHotelId);
    (poly.ohip.property.searchHotelAvailability as jest.Mock).mockResolvedValue(mockAvailability);
    (poly.ohip.property.getPropertyRoomTypes as jest.Mock).mockResolvedValue(mockRoomTypes);
    (vari.ohip.envSecrets.inject as jest.Mock).mockReturnValue('mockValue');
    (vari.ohip.descriptionsForModel.get as jest.Mock).mockResolvedValue({
      searchHotelAvailability: mockDescriptions
    });

    const result = await searchHotelAvailability('Test Hotel', 2, 1, 1, '2023-01-01', '2023-01-02');
    expect(result).toEqual(expectedResult);
    expect(poly.ohip.utilities.getOhipToken).toHaveBeenCalled();
    expect(poly.ohip.utilities.getHotelId).toHaveBeenCalledWith('Test Hotel');
    expect(poly.ohip.property.searchHotelAvailability).toHaveBeenCalled();
    expect(poly.ohip.property.getPropertyRoomTypes).toHaveBeenCalled();
  });
});
