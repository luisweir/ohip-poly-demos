import poly, { vari } from 'polyapi';
import { paths, components, operations } from './api-spec/htng-ex';

// Used https://github.com/drwpow/openapi-typescript/tree/main/packages/openapi-typescript to generate types directly from oas spec
// npx openapi-typescript ./src/htng-ex/api-spec/htng-api.json -o ./src/htng-ex/htng-ex.ts
type InputParams = paths['/guest/{guestId}']['parameters']['path'];
export type Guest = components['schemas']['Guest'];
/* TODO: 
  - No input for hotel id. This is a problem as unless you’re calling a CRS hotelId is required
  - error responses for get profiles missing. There should be a standard error response
  - how to extend input parameters and responses? OC has a lot more info about a profile, HTNG only offers a small subset
  - Why database notation for json and camel case for GET properties? makes it a bit confusing
*/
export type Error = operations['get-reservations']['responses'][529]['content']['application/json'];

export interface ExtendedInput extends InputParams {
  propertyCode?: string
}

// TODO: once is clear how to extend inputParams modify hotelId input
export async function getGuest(params: ExtendedInput): Promise<Guest| Error> {

  try {
    // get environment variables
    const env = vari.ohip.envSecrets;
    // get access token
    console.log('Fetching ohip token');
    const token = await poly.ohip.utilities.getOhipToken();

    // TODO: HTNG express doesn't support concept of Hotel or Property ID. This is a problem as preferences can be hotel specific
    console.log(`Fetching profile ${params.guestId}`);
    const profile = await poly.ohip.property.getProfileById(env.inject('ohip.hostName'), parseInt(params.guestId), env.inject('ohip.appKey'), (params.propertyCode) ? params.propertyCode : env.inject('ohip.hotelId'), token);
    // if 204 could not find profile
    if (profile.status === 204) {
      const error: Error = {
        errorType: 'Guest Profile Not Found',
        code: 'ERROR',
        message: `Could not find guest profile with id ${params.guestId}`
      };
      return error;
    }
    // if can't read profile then throw error
    if (profile.status !== 200) {
      const err: any = profile;
      if (err.data.type) {
        const error: Error = {
          errorType: err.data.type,
          code: err.data['o:errorCode'],
          message: err.data.detail
        };
        return error;
      } else {
        throw new Error((err.detail) ? err.detail : JSON.stringify(err.data));
      }
    }

    console.log('found profile');
    // transform guest preferences
    const preferences: string[] = [];
    if (profile.data.profileDetails.preferenceCollection.preferenceType) {
      profile.data.profileDetails.preferenceCollection.preferenceType.forEach((prefType) => {
        if (prefType.preference && Array.isArray(prefType.preference)) {
          prefType.preference.forEach((prefValue) => {
            const pref = `${prefType.preferenceType}-${prefValue.preferenceValue}`;
            preferences.push(pref);
          });
        }
      });
    }
    
    // Transform to HTNG Guest object
    const htngGuest: Guest =  {
      name_suffix: profile.data.profileDetails.customer.personName[0]?.nameTitle,
      name_prefix: profile.data.profileDetails.customer.personName[1]?.nameTitle,
      name_first: profile.data.profileDetails.customer.personName[0]?.givenName,
      name_middle: profile.data.profileDetails.customer.personName[0]?.middleName,
      name_last: profile.data.profileDetails.customer.personName[0]?.surname,
      vip_code: profile.data.profileDetails.customer.vipStatus,
      company_name: profile.data.profileDetails.customer.legalCompany,
      prefered_language: profile.data.profileDetails.customer.language,
      profile_id: profile.data.profileIdList[0]?.id,
      loyalty: (profile.data.profileDetails.profileMemberships.profileMembership) ? {
        loyalty_program_type: profile.data.profileDetails.profileMemberships.profileMembership[0]?.programDescription,
        loyalty_level: profile.data.profileDetails.profileMemberships.profileMembership[0]?.membershipLevel,
        loyalty_membership_id: profile.data.profileDetails.profileMemberships.profileMembership[0]?.membershipId
      } : undefined,
      phone_mobile: (profile.data.profileDetails.telephones.telephoneInfo) ? profile.data.profileDetails.telephones.telephoneInfo[0]?.telephone.phoneNumber : undefined,
      email: (profile.data.profileDetails.emails.emailInfo) ? {
        email_type: profile.data.profileDetails.emails.emailInfo[0]?.email.typeDescription,
        email_is_primary: profile.data.profileDetails.emails.emailInfo[0]?.email.primaryInd,
        email_address:  profile.data.profileDetails.emails.emailInfo[0]?.email.emailAddress
      } : undefined,
      preferences: preferences
    };
  
    // Remove any properties with undefined values
    // TODO: find a better typed way to do this
    const res: any = htngGuest;
    Object.keys(res).forEach((key) => (res[key] === undefined || res[key].length === 0) && delete res[key]);
    return res;

  } catch (e: any) {
    const error: Error = {
      errorType: 'Error fetching guest profile',
      code: '500',
      message: e.message
    };
    return error;
  }
}

// const run = async()  => {
//   const guest = await getGuest({ 
//     guestId: '724797'
//     // propertyCode: 'SAND01CN'
//   }); // part profile -> 724915, full profile -> 724797
//   console.log(guest);
// };

// run();