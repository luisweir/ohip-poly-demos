import { readFile } from 'fs/promises';
import poly from 'polyapi';
import { vari } from 'polyapi';
import { getReservation } from '../fxGetReservation';

jest.mock('polyapi', () => ({
  ohip: {
    utilities: {
      getOhipToken: jest.fn()
    },
    property: {
      getReservationByConfirmationNumber: jest.fn(),
      getReservationByExternalId: jest.fn(),
      getReservationDetails: jest.fn(),
      getReservationById: jest.fn()
    },
    htngexpress: {
      getGuest: jest.fn()
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

describe('fxGetReservation', () => {
  beforeAll(async () => {
    const operaReservations = JSON.parse(await readFile('./src/htng-ex/data/operaReservations.json', 'utf-8'));
    const htngProfiles: any = JSON.parse(await readFile('./src/htng-ex/data/htngProfiles.json', 'utf-8'));

    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue('mockToken');

    (poly.ohip.property.getReservationByConfirmationNumber as jest.Mock).mockResolvedValue({
      status: 200,
      data: {
        reservations: {
          reservationInfo: [
            { reservationIdList: [{ id: '000001' }] }
          ]
        }
      }
    });

    (poly.ohip.property.getReservationByExternalId as jest.Mock).mockResolvedValue({
      status: 200,
      data: {
        reservations: {
          reservationInfo: [
            { reservationIdList: [{ id: '000001' }] }
          ]
        }
      }
    });

    (poly.ohip.property.getReservationById as jest.Mock).mockResolvedValue({
      status: 200,
      data: operaReservations.read
    });

    (poly.ohip.htngexpress.getGuest as jest.Mock).mockImplementation((inputs: any) => {
      if (inputs.guestId === '123456') {
        return Promise.resolve(htngProfiles.profile1);
      } else {
        return Promise.resolve(htngProfiles.profile2);
      }
    });

    (vari.ohip.envSecrets.inject as jest.Mock).mockReturnValue('mockValue');
  });

  it('returns the transformed full reservation using a reservationId', async () => {
    const htngReservations: any = JSON.parse(await readFile('./src/htng-ex/data/htngReservations.json','utf-8'));
    const inputParams: any = {
      reservationId: '000001',
      propertyCode: 'HOGSANDBOX',
      reservationIdType: 'internal',
      guestFetchInstructions: 'full'
    };

    const result = await getReservation(inputParams);
    expect(result).toEqual(htngReservations.full);
    expect(poly.ohip.property.getReservationById).toHaveBeenCalledTimes(1);
    expect(poly.ohip.htngexpress.getGuest).toHaveBeenCalledTimes(2);
  });

  it('returns the transformed self reservation using a confirmation number', async () => {
    const htngReservations: any = JSON.parse(await readFile('./src/htng-ex/data/htngReservations.json','utf-8'));
    const inputParams: any = {
      reservationId: '000007',
      propertyCode: 'HOGSANDBOX',
      reservationIdType: 'confirmation',
      guestFetchInstructions: 'self'
    };

    const result = await getReservation(inputParams);
    expect(result).toEqual(htngReservations.self);
    expect(poly.ohip.property.getReservationByConfirmationNumber).toHaveBeenCalledTimes(1);
    // first test called htngexpress twice, this test adds 0 additional guest fetches
  });

  it('returns the transformed full reservation using an external confirmation number', async () => {
    const htngReservations: any = JSON.parse(await readFile('./src/htng-ex/data/htngReservations.json','utf-8'));
    const inputParams: any = {
      reservationId: '12345678',
      propertyCode: 'HOGSANDBOX',
      reservationIdType: 'external',
      guestFetchInstructions: 'full'
    };

    const result = await getReservation(inputParams);
    expect(result).toEqual(htngReservations.full);
    expect(poly.ohip.property.getReservationByExternalId).toHaveBeenCalledTimes(1);
  });
});
