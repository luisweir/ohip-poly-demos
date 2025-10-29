import poly from 'polyapi';
import { vari } from 'polyapi';
import { checkBillCharges } from '../fxCheckBillCharges';

jest.mock('polyapi', () => ({
  ohip: {
    utilities: {
      getOhipToken: jest.fn(),
      getHotelId: jest.fn()
    },
    property: {
      getReservationByConfirmationNumber: jest.fn(),
      getFolioDetails: jest.fn()
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

describe('fxCheckBillCharges', () => {
  it('returns account details and charges', async () => {
    const mockToken = 'mockToken';
    const mockHotelId = 'mockHotelId';
    const mockResId = 1;
    const mockFolioDetails = {
      status: 200,
      data: {
        reservationFolioInformation: {
          reservationInfo: {
            roomStay: {
              balance: {
                amount: 0,
                currencyCode: 'USD'
              }
            }
          },
          folioWindows: [
            {
              revenue: { amount: 181, currencyCode: 'USD' },
              emptyFolio: false,
              folios: [
                {
                  postings: [
                    {
                      transactionCode: '9000',
                      transactionNo: 278484,
                      postedAmount: { amount: 181, currencyCode: 'USD' },
                      postingTime: { time: '2023-07-25 05:48:09.0' }
                    },
                    {
                      transactionCode: '9980',
                      transactionNo: 277520,
                      postedAmount: { amount: 75, currencyCode: 'USD' },
                      postingTime: { time: '2023-07-23 06:08:11.0' }
                    },
                    {
                      transactionCode: '5010',
                      transactionNo: 278248,
                      postedAmount: { amount: 22, currencyCode: 'USD' },
                      postingTime: { time: '2023-07-23 05:34:51.0' }
                    }
                  ]
                }
              ]
            }
          ]
        },
        trxCodesInfo: [
          { transactionCode: '9000', description: 'Cash' },
          { transactionCode: '9980', description: 'Accommodation Wrapper' },
          { transactionCode: '5010', description: 'Tickets' }
        ]
      }
    };

    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(mockToken);
    (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue(mockHotelId);
    (poly.ohip.property.getReservationByConfirmationNumber as jest.Mock).mockResolvedValue({
      data: {
        reservations: {
          totalPages: 1,
          reservationInfo: [{ reservationIdList: [{ id: String(mockResId) }] }]
        }
      }
    });
    (poly.ohip.property.getFolioDetails as jest.Mock).mockResolvedValue(mockFolioDetails);
    (vari.ohip.envSecrets.inject as jest.Mock).mockReturnValue('mockInjectedValue');

    const result = await checkBillCharges('12345', 'Test Hotel');

    expect(result).toEqual({
      balance: 0,
      currency: 'USD',
      charges: [
        {
          transaction: 'Cash',
          transactionNumber: 278484,
          transactionAmount: 181,
          transactionCurrency: 'USD',
          transactionTime: '2023-07-25 05:48:09.0'
        },
        {
          transaction: 'Accommodation Wrapper',
          transactionNumber: 277520,
          transactionAmount: 75,
          transactionCurrency: 'USD',
          transactionTime: '2023-07-23 06:08:11.0'
        },
        {
          transaction: 'Tickets',
          transactionNumber: 278248,
          transactionAmount: 22,
          transactionCurrency: 'USD',
          transactionTime: '2023-07-23 05:34:51.0'
        }
      ]
    });

    expect(poly.ohip.utilities.getOhipToken).toHaveBeenCalled();
    expect(poly.ohip.utilities.getHotelId).toHaveBeenCalledWith('Test Hotel');
    expect(poly.ohip.property.getReservationByConfirmationNumber).toHaveBeenCalled();
    expect(poly.ohip.property.getFolioDetails).toHaveBeenCalled();
  });
});
