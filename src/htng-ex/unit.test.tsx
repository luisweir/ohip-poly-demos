import { readFile } from 'fs/promises';
import poly from 'polyapi';
import { vari } from 'polyapi';
import { getGuest } from './fxGetGuest';
import { getReservation } from './fxGetReservation';
import { searchReservations, RangeType, OrderBy, SortOrder } from './fxSearchReservations';

jest.mock('polyapi', () => ({
  ohip: {
    utilities: {
      getOhipToken: jest.fn()
    },
    property: {
      getProfileById: jest.fn(),
      getReservationByConfirmationNumber: jest.fn(),
      getReservationByExternalId: jest.fn(),
      getReservationDetails: jest.fn(), 
      searchReservationsByDateRangeAndGuestNames: jest.fn()
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

describe('getGuest function', () => {
  const mockProfileData = {
    status: 200,
    data: {
      profileIdList: [
        {
          id: '724797',
          type: 'Profile'
        }
      ],
      profileDetails: {
        customer: {
          personName: [
            {
              givenName: 'Harry',
              middleName: 'Augusto',
              surname: 'Potter',
              nameSuffix: '',
              nameTitle: 'MR',
              salutation: 'Mr',
              nameType: 'Primary',
              language: 'E'
            },
            {
              nameTitle: 'Prof',
              envelopeGreeting: 'Herr Prof. <XFIRSTNAME><XLASTNAME>',
              salutation: 'Professor <XLASTNAME>',
              nameType: 'Alternate'
            }
          ],
          legalCompany: 'Oracle',
          vipStatus: 'GOLD',
          language: 'E'
        },
        profileMemberships: {
          profileMembership: [
            {
              programDescription: 'Dreams Loyalty Program',
              membershipLevel: 'GOLD',
              membershipId: '123456789'
            }
          ]
        },
        telephones: {
          telephoneInfo: [
            {
              telephone: {
                phoneNumber: '+447572339889'
              }
            }
          ]
        },
        emails: {
          emailInfo: [
            {
              email: {
                typeDescription: 'Email Address',
                primaryInd: true,
                emailAddress: 'harry.potter@oracle.com'
              }
            }
          ]
        },
        preferenceCollection: {
          preferenceType: [
            {
              preferenceType: 'AC',
              preference: [
                {
                  preferenceValue: 'ON'
                }
              ]
            },
            {
              preferenceType: 'FLOOR',
              preference: [
                {
                  preferenceValue: '01'
                }
              ]
            }
            // ... (add other preferences here following the same structure)
          ]
        }
      }
    }
  };

  beforeAll(() => {
    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue('mockToken');
    (poly.ohip.property.getProfileById as jest.Mock).mockResolvedValue(mockProfileData);
    (vari.ohip.envSecrets.inject as jest.Mock).mockReturnValue('mockValue');
  });

  it('should return the transformed profile', async() => {
    const expectedTransformedProfile = {
      name_suffix: 'MR',
      name_prefix: 'Prof',
      name_first: 'Harry',
      name_middle: 'Augusto',
      name_last: 'Potter',
      vip_code: 'GOLD',
      company_name: 'Oracle',
      prefered_language: 'E',
      profile_id: '724797',
      loyalty: {
        loyalty_program_type: 'Dreams Loyalty Program',
        loyalty_level: 'GOLD',
        loyalty_membership_id: '123456789'
      },
      phone_mobile: '+447572339889',
      email: {
        email_type: 'Email Address',
        email_is_primary: true,
        email_address: 'harry.potter@oracle.com'
      },
      preferences: [
        'AC-ON',
        'FLOOR-01'
        // ... (add other preferences here)
      ]
    };

    const result = await getGuest({ guestId: '724797' });
    expect(result).toEqual(expectedTransformedProfile);
  });
});

describe('getReservation function',() => {
  beforeAll(async() => {
    const operaReservations = JSON.parse(await readFile('./src/htng-ex/data/operaReservations.json', 'utf-8'));
    const htngProfiles: any = JSON.parse(await readFile('./src/htng-ex/data/htngProfiles.json', 'utf-8'));
    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue('mockToken');
    (poly.ohip.property.getReservationByConfirmationNumber as jest.Mock).mockResolvedValue({
      status: 200,
      data: {
        reservations: {
          reservationInfo: [
            {
              reservationIdList: [
                {
                  id: '000001'
                }
              ]
            }
          ]
        }
      }
    });
    (poly.ohip.property.getReservationByExternalId as jest.Mock).mockResolvedValue({
      status: 200,
      data: {
        reservations: {
          reservationInfo: [
            {
              reservationIdList: [
                {
                  id: '000001'
                }
              ]
            }
          ]
        }
      }
    });
    (poly.ohip.property.getReservationDetails as jest.Mock).mockResolvedValue({
      status: 200,
      data: operaReservations.read
    });
    (poly.ohip.htngexpress.getGuest as jest.Mock).mockImplementation((inputs) => {
      console.log(inputs);
      if (inputs.guestId === '123456') {
        return Promise.resolve(htngProfiles.profile1);
      } else {
        return Promise.resolve(htngProfiles.profile2);
      }});
    (vari.ohip.envSecrets.inject as jest.Mock).mockReturnValue('mockValue');
  });

  it('should return the transformed full reservation using a reservationId', async() => {

    const htngReservations: any = JSON.parse(await readFile('./src/htng-ex/data/htngReservations.json','utf-8'));
    const inputParams: any = {
      reservationId: '000001',
      propertyCode: 'HOGSANDBOX',
      reservationIdType: 'internal',
      guestFetchInstructions: 'full'
    };

    const result = await getReservation(inputParams);
    expect(result).toEqual(htngReservations.full);
    expect(poly.ohip.property.getReservationDetails).toHaveBeenCalledTimes(1);
    expect(poly.ohip.htngexpress.getGuest).toHaveBeenCalledTimes(2);
  });

  it('should return the transformed self reservation using a confirmation number', async() => {

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
    expect(poly.ohip.htngexpress.getGuest).toHaveBeenCalledTimes(2); // 2 + 0 this time
  });

  it('should return the transformed self reservation using a external confirmation number', async() => {

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
    expect(poly.ohip.htngexpress.getGuest).toHaveBeenCalledTimes(4); // 2 + 2 this time
  });

});

describe('searchReservations function', () => {
  beforeAll(async() => {
    const operaReservations = JSON.parse(await readFile('./src/htng-ex/data/operaReservations.json', 'utf-8'));
    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue('mockToken');
    (poly.ohip.property.searchReservationsByDateRangeAndGuestNames as jest.Mock).mockResolvedValue({
      status: 200,
      data: operaReservations.search
    });
  });

  it('should find reservations by date and guest names', async() => {
    const htngReservations: any = JSON.parse(await readFile('./src/htng-ex/data/htngReservations.json','utf-8'));

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

    // Assertions based on what you expect from operaReservationSearch mock data
    const result = await searchReservations(inputParams);
    expect(result).toEqual(htngReservations.search);
    expect(result).toHaveLength(3);
    expect(poly.ohip.property.searchReservationsByDateRangeAndGuestNames).toHaveBeenCalledTimes(1);
  });

});
