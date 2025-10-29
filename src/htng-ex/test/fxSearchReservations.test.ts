import { readFile } from 'fs/promises';
import poly from 'polyapi';
import { vari } from 'polyapi';
import { searchReservations, RangeType, OrderBy, SortOrder } from '../fxSearchReservations';

jest.mock('polyapi', () => ({
  ohip: {
    utilities: {
      getOhipToken: jest.fn()
    },
    property: {
      searchReservationsByDateRangeAndGuestNames: jest.fn()
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

describe('fxSearchReservations', () => {
  beforeAll(async () => {
    const operaReservations = JSON.parse(await readFile('./src/htng-ex/data/operaReservations.json', 'utf-8'));
    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue('mockToken');
    (poly.ohip.property.searchReservationsByDateRangeAndGuestNames as jest.Mock).mockResolvedValue({
      status: 200,
      data: operaReservations.search
    });
    (vari.ohip.envSecrets.inject as jest.Mock).mockReturnValue('mockValue');
  });

  it('finds reservations by date and guest names', async () => {
    const htngReservations: any = JSON.parse(await readFile('./src/htng-ex/data/htngReservations.json', 'utf-8'));

    const inputParams = {
      fromDate: '2023-08-30',
      toDate: '2023-09-12',
      rangeType: RangeType.arrivals,
      propertyCode: 'HOGSANDBOX',
      guestLastName: 'Potter',
      guestFirstName: 'Harry',
      orderBy: OrderBy.guestLastName,
      sortOrder: SortOrder.desc
    };

    const result = await searchReservations(inputParams);
    expect(result).toEqual(htngReservations.search);
    expect(result).toHaveLength(3);
    expect(poly.ohip.property.searchReservationsByDateRangeAndGuestNames).toHaveBeenCalledTimes(1);
  });
});
