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
    const prefCollection: any = (profile.data as any)?.profileDetails?.preferenceCollection;
    if (prefCollection) {
      // Shape 1: { preferenceType: Array<{ preferenceType: string, preference: Array<{ preferenceValue: string }> }> }
      if (Array.isArray(prefCollection.preferenceType)) {
        prefCollection.preferenceType.forEach((pt: any) => {
          const typeCode = pt?.preferenceType;
          const prefArr = pt?.preference;
          if (typeCode && Array.isArray(prefArr)) {
            prefArr.forEach((p: any) => {
              const value = p?.preferenceValue;
              if (value) preferences.push(`${typeCode}:${value}`);
            });
          }
        });
      }
      // Shape 2: Array<{ preferenceType: string, preference: Array<{ preferenceValue: string }> }>
      else if (Array.isArray(prefCollection)) {
        (prefCollection as any[]).forEach((pt: any) => {
          const typeCode = pt?.preferenceType;
          const prefArr = pt?.preference;
          if (typeCode && Array.isArray(prefArr)) {
            prefArr.forEach((p: any) => {
              const value = p?.preferenceValue;
              if (value) preferences.push(`${typeCode}:${value}`);
            });
          }
        });
      }
    }
    
    // Transform to HTNG Guest object
    const details: any = (profile.data as any)?.profileDetails;
    const customer: any = details?.customer;
    const personName0: any = customer?.personName?.[0];
    const personName1: any = customer?.personName?.[1];
    const telephones: any = details?.telephones?.telephoneInfo?.[0]?.telephone;
    const emails: any[] | undefined = details?.emails?.emailInfo;
    const memberships: any[] | undefined = (details?.profileMemberships as any)?.profileMembership;
    const primaryMembership: any | undefined = Array.isArray(memberships) ? memberships[0] : undefined;

    const htngGuest: Guest =  {
      name_suffix: personName0?.nameTitle ?? personName0?.nameSuffix,
      name_prefix: personName1?.nameTitle,
      name_first: personName0?.givenName,
      name_middle: personName0?.middleName,
      name_last: personName0?.surname,
      vip_code: customer?.vipStatus ?? customer?.vip?.vipCode,
      company_name: customer?.legalCompany ?? customer?.company?.companyName,
      prefered_language: customer?.language,
      profile_id: (profile.data as any).profileIdList?.[0]?.id,
      loyalty: primaryMembership ? {
        loyalty_program_type: primaryMembership?.programDescription,
        loyalty_level: primaryMembership?.membershipLevel,
        loyalty_membership_id: primaryMembership?.membershipId
      } : undefined,
      phone_mobile: telephones?.phoneNumber ?? telephones,
      email: emails ? {
        email_type: emails?.[0]?.email?.typeDescription,
        email_is_primary: emails?.[0]?.email?.primaryInd,
        email_address:  emails?.[0]?.email?.emailAddress
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

const run = async()  => {
  const guest = await getGuest({ 
    guestId: '1592359'
    // propertyCode: 'OHIPSB01'
  }); // part profile -> 1592359, full profile -> TBC
  console.log(guest);
};

run();
