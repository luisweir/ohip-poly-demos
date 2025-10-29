import poly from 'polyapi';
import { vari } from 'polyapi';
import { getGuest } from '../fxGetGuest';

jest.mock('polyapi', () => ({
  ohip: {
    utilities: {
      getOhipToken: jest.fn()
    },
    property: {
      getProfileById: jest.fn()
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

describe('fxGetGuest', () => {
  const mockProfileData = {
    status: 200,
    data: {
      profileIdList: [{ id: '724797', type: 'Profile' }],
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
          telephoneInfo: [{ telephone: { phoneNumber: '+447572339889' } }]
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
            { preferenceType: 'AC', preference: [{ preferenceValue: 'ON' }] },
            { preferenceType: 'FLOOR', preference: [{ preferenceValue: '01' }] }
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

  it('returns the transformed profile', async () => {
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
      preferences: ['AC-ON', 'FLOOR-01']
    };

    const result = await getGuest({ guestId: '724797' });
    expect(result).toEqual(expectedTransformedProfile);
  });
});
