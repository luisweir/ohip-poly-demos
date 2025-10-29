import poly from 'polyapi';
import { vari } from 'polyapi';
import * as conciergeModule from '../fxConciergeServices';
import { getConciergeServices, requestConciergeService } from '../fxConciergeServices';

jest.mock('polyapi', () => ({
  ohip: {
    utilities: {
      getOhipToken: jest.fn(),
      getHotelId: jest.fn()
    },
    property: {
      getPackages: jest.fn(),
      getReservationByConfirmationNumber: jest.fn(),
      addCharges: jest.fn()
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

describe('fxConciergeServices edge cases', () => {
  const token = 't';
  const hotelId = 'H1';
  const dateFrom = '2025-01-01';
  const dateTo = '2025-01-02';
  const adults = 2;
  const children = 1;

  beforeEach(() => {
    jest.clearAllMocks();
    (vari.ohip.envSecrets.inject as jest.Mock).mockImplementation((k: string) => k);
    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(token);
  });

  describe('getConciergeServices', () => {
    it('errors when hotel not found', async () => {
      (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue('notfound');
      const res = await getConciergeServices('NoHotel', dateFrom, dateTo, adults, children);
      expect((res as any).error).toContain("Error: Could not find a hotel named 'NoHotel'");
    });

    it('returns empty when packages are filtered out (group, sellSeparate=false, out of date, missing txn code)', async () => {
      (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue(hotelId);
      (poly.ohip.property.getPackages as jest.Mock).mockResolvedValue({
        data: {
          packageCodesList: {
            packageCodes: [
              {
                packageCodeInfo: [
                  { code: 'G1', group: true, header: { postingAttributes: { sellSeparate: true } } }, // group => skip
                  { code: 'NS1', group: false, header: { postingAttributes: { sellSeparate: false } } }, // sellSeparate false => skip
                  { code: 'FUT', group: false, header: { postingAttributes: { sellSeparate: true }, primaryDetails: { beginSellDate: '2025-12-31' } } }, // begin in future => skip
                  { code: 'PAST', group: false, header: { postingAttributes: { sellSeparate: true }, primaryDetails: { endSellDate: '2024-12-31' } } }, // end in past => skip
                  { code: 'NOTXN', group: false, header: { postingAttributes: { sellSeparate: true, calculatedPrice: 10 }, transactionDetails: { /* no txn code*/ } } } // txn NaN => skip
                ]
              }
            ]
          }
        }
      });

      const res = await getConciergeServices('Hotel', dateFrom, dateTo, adults, children);
      expect('ConciergeServiceNames' in res).toBeTruthy();
      expect(Object.keys((res as any).ConciergeServiceNames)).toHaveLength(0);
    });

    it('returns mapped service when valid', async () => {
      (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue(hotelId);
      (poly.ohip.property.getPackages as jest.Mock).mockResolvedValue({
        data: {
          packageCodesList: {
            packageCodes: [
              {
                packageCodeInfo: [
                  {
                    code: 'SPA',
                    group: false,
                    header: {
                      primaryDetails: { shortDescription: 'Spa Access' },
                      postingAttributes: { sellSeparate: true, calculatedPrice: 25 },
                      transactionDetails: { currency: 'EUR', packagePostingRules: { transactionCode: { code: '5010' } } }
                    }
                  }
                ]
              }
            ]
          }
        }
      });

      const res = await getConciergeServices('Hotel', dateFrom, dateTo, adults, children) as any;
      expect(res).toEqual({
        ConciergeServiceNames: {
          SPA: { Description: 'Spa Access', PackageAmount: 25, CurrencyCode: 'EUR', TransactionCode: 5010 }
        }
      });
    });
  });

  describe('requestConciergeService', () => {
    it('returns successful when totalQuantity <= 0 (nights=0)', async () => {
      const spy = jest.spyOn(conciergeModule, 'getConciergeServices').mockResolvedValue({
        ConciergeServiceNames: {
          SPA: { Description: 'Spa', PackageAmount: 10, CurrencyCode: 'USD', TransactionCode: 1001 }
        }
      });

      (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue(hotelId);
      // dateFrom == dateTo => nights = 0 -> totalQuantity 0
      const res = await requestConciergeService('12345', 'Hotel', 'SPA', '2025-01-01', '2025-01-01', 2, 2);
      expect(res).toEqual({ successful: true });
      expect(poly.ohip.property.addCharges).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('errors when concierge code is not found', async () => {
      const spy = jest.spyOn(conciergeModule, 'getConciergeServices').mockResolvedValue({
        ConciergeServiceNames: { } // no codes
      });
      (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue(hotelId);

      const res = await requestConciergeService('12345', 'Hotel', 'UNKNOWN', dateFrom, dateTo, 1, 0);
      expect((res as any).error).toContain('Concierge service UNKNOWN not found');
      spy.mockRestore();
    });

    it('errors when reservation not found', async () => {
      const spy = jest.spyOn(conciergeModule, 'getConciergeServices').mockResolvedValue({
        ConciergeServiceNames: {
          SPA: { Description: 'Spa', PackageAmount: 10, CurrencyCode: 'USD', TransactionCode: 1001 }
        }
      });

      (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue(hotelId);
      (poly.ohip.property.getReservationByConfirmationNumber as jest.Mock).mockResolvedValue({
        data: { reservations: { totalPages: 0 } }
      });

      const res = await requestConciergeService('12345', 'Hotel', 'SPA', dateFrom, dateTo, 1, 0);
      expect((res as any).error).toContain('Reservation with confirmation number 12345 not found');
      spy.mockRestore();
    });

    it('errors when addCharges fails mid-way', async () => {
      const spy = jest.spyOn(conciergeModule, 'getConciergeServices').mockResolvedValue({
        ConciergeServiceNames: {
          SPA: { Description: 'Spa', PackageAmount: 10, CurrencyCode: 'USD', TransactionCode: 1001 }
        }
      });

      (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue(hotelId);
      (poly.ohip.property.getReservationByConfirmationNumber as jest.Mock).mockResolvedValue({
        data: {
          reservations: {
            totalPages: 1,
            reservationInfo: [{ reservationIdList: [{ id: '1' }] }]
          }
        }
      });

      // 1 night * 2 persons = 2 iterations; first succeeds, second fails
      (poly.ohip.property.addCharges as jest.Mock)
        .mockResolvedValueOnce({ status: 201 })
        .mockResolvedValueOnce({ status: 500, data: { title: 'failed' } });

      const res = await requestConciergeService('12345', 'Hotel', 'SPA', dateFrom, dateTo, 2, 0);
      expect((res as any).error).toContain('Error: failed');
      spy.mockRestore();
    });
  });
});
