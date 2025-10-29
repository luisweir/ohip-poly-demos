import poly from 'polyapi';
import { vari } from 'polyapi';
import { createResWithPayLink } from '../fxCreateResWithPayLink';

jest.mock('polyapi', () => ({
  ohip: {
    utilities: {
      getOhipToken: jest.fn(),
      getHotelId: jest.fn()
    },
    aiGuest: {
      paymentEventsCache: jest.fn()
    },
    payments: {
      adyen: {
        getPayByLinkDetails: jest.fn(),
        createPayByLink: jest.fn()
      }
    },
    property: {
      createReservationWithToken: jest.fn(),
      createReservation: jest.fn(),
      getReservationById: jest.fn()
    }
  },
  vari: {
    ohip: {
      envSecrets: {
        inject: jest.fn()
      },
      envSettings: {
        get: jest.fn()
      },
      descriptionsForModel: {
        get: jest.fn()
      }
    }
  }
}));

describe('fxCreateResWithPayLink edge cases', () => {
  const linkMessageMock = {
    createResWithPayLink: {
      linkMessage: {
        messageToUser: 'msg',
        instructionsForModel: 'instr'
      }
    }
  };

  const defaultEventRecord: any = {
    additionalData: {
      cardSummary: '1234',
      shopperCountry: 'Mock Country',
      shopperIP: '1.1.1.1',
      hmacSignature: 'sig',
      expiryDate: '12/2025',
      'billingAddress.street': 'Mock Street',
      shopperName: '[first name=John, infix=null, last name=Doe, gender=null]',
      cardBin: '444433',
      'billingAddress.city': 'Mock City',
      recurringProcessingModel: 'CardOnFile',
      paymentMethodVariant: 'visacorporatecredit',
      'billingAddress.country': 'Mock Country',
      authCode: '000661',
      paymentLinkId: 'mockLinkId',
      cardHolderName: 'John Doe',
      'billingAddress.houseNumberOrName': '123',
      shopperEmail: 'john.doe@email.com',
      'checkout.cardAddedBrand': 'visacorporatecredit',
      'billingAddress.stateOrProvince': 'Mock State',
      'billingAddress.postalCode': '12345',
      issuerCountry: 'GB',
      shopperTelephone: '+447575666777',
      'threeds2.cardEnrolled': 'false',
      paymentMethod: 'visa',
      shopperLocale: 'en-UK',
      shopperReference: 'UNIQUE00010'
    },
    amount: { currency: 'USD', value: 10 },
    eventCode: 'AUTHORISATION',
    eventDate: '2023-09-05T20:01:13+02:00',
    merchantAccountCode: 'Oracle097ECOM',
    merchantReference: 'ref',
    operations: ['CANCEL', 'CAPTURE', 'REFUND'],
    paymentMethod: 'visa',
    pspReference: 'psp',
    reason: 'reason',
    success: 'true'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (vari.ohip.envSecrets.inject as jest.Mock).mockImplementation((k: string) => k);
    (vari.ohip.descriptionsForModel.get as jest.Mock).mockResolvedValue(linkMessageMock);
    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue('token');
    (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue('H1');
    (vari.ohip.envSettings.get as jest.Mock).mockResolvedValue({ opi: true });
    (poly.ohip.payments.adyen.getPayByLinkDetails as jest.Mock).mockResolvedValue({ status: 200, data: { id: 'x', url: 'u', status: 'completed' } });
    (poly.ohip.aiGuest.paymentEventsCache as jest.Mock).mockResolvedValue(defaultEventRecord);
    (poly.ohip.property.createReservationWithToken as jest.Mock).mockResolvedValue({ status: 201, data: { links: [{ rel: 'self', href: '/reservations/456' }] } });
    (poly.ohip.property.getReservationById as jest.Mock).mockResolvedValue({
      data: {
        reservations: {
          reservation: [
            {
              reservationIdList: [{ id: '123', type: 'internal' }, { id: 'CONFIRM', type: 'external' }]
            }
          ]
        }
      }
    });
  });

  it('rejects invalid date format', async () => {
    // Use a clearly invalid format that fails the YYYY-MM-DD regex
    const res = await createResWithPayLink(
      'hotel', 1, 0, '', '2025/01/01', '2025-01-02', 1, 'rate', 'room', 100, 'US', 'en-US', 'USD'
    );
    expect(res).toHaveProperty('error');
    expect((res as any).error).toContain('dateFrom and dateTo must be strings in format YYYY-MM-DD');
  });

  it('rejects when children ages mismatch', async () => {
    const res = await createResWithPayLink(
      'hotel', 1, 2, '4', '2025-01-01', '2025-01-02', 1, 'rate', 'room', 100, 'US', 'en-US', 'USD'
    );
    expect(res).toHaveProperty('error');
    expect((res as any).error).toContain('Make sure ages are entered for all children');
  });

  it('returns link message when pay link must be created', async () => {
    (poly.ohip.payments.adyen.getPayByLinkDetails as jest.Mock).mockResolvedValue({ status: 404, data: {} });
    (poly.ohip.payments.adyen.createPayByLink as jest.Mock).mockResolvedValue({ status: 201, data: { id: 'NEWID', url: 'NEWURL' } });

    const res = await createResWithPayLink(
      'hotel', 1, 0, '', '2025-01-01', '2025-01-02', 1, 'rate', 'room', 100, 'US', 'en-US', 'USD'
    ) as any;

    expect(res).toEqual({
      messageToUser: 'msg',
      instructionsForModel: 'instr',
      linkId: 'NEWID',
      url: 'NEWURL'
    });
  });

  it('propagates link creation error when createPayByLink fails', async () => {
    (poly.ohip.payments.adyen.getPayByLinkDetails as jest.Mock).mockResolvedValue({ status: 404, data: {} });
    (poly.ohip.payments.adyen.createPayByLink as jest.Mock).mockResolvedValue({ status: 500, data: { message: 'fail' } });

    const res = await createResWithPayLink(
      'hotel', 1, 0, '', '2025-01-01', '2025-01-02', 1, 'rate', 'room', 100, 'US', 'en-US', 'USD'
    );
    expect((res as any).error).toContain('Error when generating pay by link');
  });

  it('returns link message when link exists but not completed', async () => {
    (poly.ohip.payments.adyen.getPayByLinkDetails as jest.Mock).mockResolvedValue({
      status: 200,
      data: { id: 'EXIST', url: 'EXISTURL', status: 'pending' }
    });

    const res = await createResWithPayLink(
      'hotel', 1, 0, '', '2025-01-01', '2025-01-02', 1, 'rate', 'room', 100, 'US', 'en-US', 'USD', 'EXIST'
    ) as any;

    expect(res).toEqual({
      messageToUser: 'msg',
      instructionsForModel: 'instr',
      linkId: 'EXIST',
      url: 'EXISTURL'
    });
  });

  it('errors when cached event cannot be found', async () => {
    (poly.ohip.aiGuest.paymentEventsCache as jest.Mock).mockResolvedValue({ error: 'not found' });

    const res = await createResWithPayLink(
      'hotel', 1, 0, '', '2025-01-01', '2025-01-02', 1, 'rate', 'room', 100, 'US', 'en-US', 'USD', 'L1'
    );
    expect((res as any).error).toContain("Could not find details for linkId 'L1'");
  });

  it('OPI=true: propagates createReservationWithToken error', async () => {
    (vari.ohip.envSettings.get as jest.Mock).mockResolvedValue({ opi: true });
    (poly.ohip.property.createReservationWithToken as jest.Mock).mockResolvedValue({
      status: 500,
      data: { detail: 'boom' }
    });

    const res = await createResWithPayLink(
      'hotel', 1, 0, '', '2025-01-01', '2025-01-02', 1, 'rate', 'room', 100, 'US', 'en-US', 'USD', 'L1'
    );
    expect((res as any).error).toContain('boom');
  });

  it('OPI=false: returns empty confirmation number if reservation not found', async () => {
    (vari.ohip.envSettings.get as jest.Mock).mockResolvedValue({ opi: false });
    (poly.ohip.property.createReservation as jest.Mock).mockResolvedValue({
      status: 201,
      data: { links: [{ rel: 'self', href: '/reservations/789' }] }
    });
    (poly.ohip.property.getReservationById as jest.Mock).mockResolvedValue({
      data: { reservations: { reservation: [] } }
    });

    const res = await createResWithPayLink(
      'hotel', 1, 0, '', '2025-01-01', '2025-01-02', 1, 'rate', 'room', 100, 'US', 'en-US', 'USD', 'L1'
    ) as any;
    expect(res).toEqual({ operaConfirmationNumber: '' });
  });

  it('OPI=true: returns final confirmation number on success', async () => {
    (vari.ohip.envSettings.get as jest.Mock).mockResolvedValue({ opi: true });
    (poly.ohip.property.createReservationWithToken as jest.Mock).mockResolvedValue({
      status: 201,
      data: { links: [{ rel: 'self', href: '/reservations/456' }] }
    });
    (poly.ohip.property.getReservationById as jest.Mock).mockResolvedValue({
      data: {
        reservations: {
          reservation: [
            {
              reservationIdList: [
                { id: '123', type: 'internal' },
                { id: 'CONFIRM-OK', type: 'external' }
              ]
            }
          ]
        }
      }
    });

    const res = await createResWithPayLink(
      'hotel', 1, 0, '', '2025-01-01', '2025-01-02', 1, 'rate', 'room', 100, 'US', 'en-US', 'USD', 'EXIST'
    ) as any;

    expect(res).toEqual({ operaConfirmationNumber: 'CONFIRM-OK' });
  });

  it('OPI=false: returns final confirmation number on success', async () => {
    (vari.ohip.envSettings.get as jest.Mock).mockResolvedValue({ opi: false });
    (poly.ohip.property.createReservation as jest.Mock).mockResolvedValue({
      status: 201,
      data: { links: [{ rel: 'self', href: '/reservations/789' }] }
    });
    (poly.ohip.property.getReservationById as jest.Mock).mockResolvedValue({
      data: {
        reservations: {
          reservation: [
            {
              reservationIdList: [
                { id: '123', type: 'internal' },
                { id: 'CONFIRM-OK', type: 'external' }
              ]
            }
          ]
        }
      }
    });

    const res = await createResWithPayLink(
      'hotel', 1, 0, '', '2025-01-01', '2025-01-02', 1, 'rate', 'room', 100, 'US', 'en-US', 'USD', 'EXIST'
    ) as any;

    expect(res).toEqual({ operaConfirmationNumber: 'CONFIRM-OK' });
  });
});
