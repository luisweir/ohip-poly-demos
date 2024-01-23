import poly, { vari } from 'polyapi';
import { paths, components, operations } from './api-spec/htng-ex';
import moment from 'moment';

// Used https://github.com/drwpow/openapi-typescript/tree/main/packages/openapi-typescript to generate types directly from oas spec
// npx openapi-typescript ./src/htng-ex/api-spec/htng-api.json -o ./src/htng-ex/htng-ex.ts
type InputParams = paths['/reservation/{reservationId}']['parameters']['path'];
type Reservation = components['schemas']['Reservation'];
type Guest = components['schemas']['Guest'];
/* TODO: 
  - No input for hotel id. This is a problem as unless you’re calling a CRS hotelId is required
  - how to extend input parameters and responses? OC has a lot more info about a profile, HTNG only offers a small subset
  - HTNG express doesn't support concept of Hotel or Property ID. This is a problem as unless you’re calling a CRS hotelId is required
  - Is the reservation ID an OC confirmation number? or an OC reservation Id? or an external reservation Id? for now supporting all via extensions (default internal)
*/
type Error = operations['get-reservations']['responses'][529]['content']['application/json'];

export enum ReservationIdentifier {
  internal = 'internal',
  confirmation = 'confirmation',
  external = 'external',
}

export enum GuestFetchInstruction {
  self = 'self',
  full = 'full'
}

interface ExtendedInput extends InputParams {
  propertyCode?: string
  reservationIdType?: ReservationIdentifier,
  guestFetchInstructions?: GuestFetchInstruction
}

// TODO: once is clear how to extend inputParams modify hotelId input
export async function getReservation(params: ExtendedInput): Promise<Reservation| Error> {
  try {
    // get environment variables
    const env = vari.ohip.envSecrets;
    // get access token
    console.log('Fetching ohip token');
    const token = await poly.ohip.utilities.getOhipToken();

    let resId = 0;
    switch (params.reservationIdType) {
      case ReservationIdentifier.confirmation:
        console.log(`Fetching reservation with confirmation number ${params.reservationId}`);
        const resConfId = await poly.ohip.property.getReservationByConfirmationNumber(env.inject('ohip.hostName'), (params.propertyCode) ? params.propertyCode : env.inject('ohip.hotelId'), parseInt(params.reservationId), env.inject('ohip.appKey'), token);
        // if 204 could not find profile
        if (resConfId.status === 204) {
          const error: Error = {
            errorType: 'Reservation Not Found',
            code: 'ERROR',
            message: `Could not find reservation with confirmation number ${params.reservationId}`
          };
          return error;
        }
        // if can't read profile then throw error
        if (resConfId.status !== 200) {
          const err: any = resConfId;
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
        // get reservation number
        resId = parseInt(resConfId.data.reservations.reservationInfo[0].reservationIdList[0].id);
        break;
      
      case ReservationIdentifier.external:
        console.log(`Fetching reservation with external confirmation number ${params.reservationId}`);
        const resExtId = await poly.ohip.property.getReservationByExternalId(env.inject('ohip.hostName'), (params.propertyCode) ? params.propertyCode : env.inject('ohip.hotelId'), params.reservationId, env.inject('ohip.appKey'), token);
        // if 204 could not find profile
        if (resExtId.status === 204) {
          const error: Error = {
            errorType: 'Reservation Not Found',
            code: 'ERROR',
            message: `Could not find reservation with confirmation number ${params.reservationId}`
          };
          return error;
        }
        // if can't read profile then throw error
        if (resExtId.status !== 200) {
          const err: any = resExtId;
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
        // get reservation number
        resId = parseInt(resExtId.data.reservations.reservationInfo[0].reservationIdList[0].id);
        break;
      
      default:
        resId = parseInt(params.reservationId);
    }

    const readResult = await poly.ohip.property.getReservationDetails(env.inject('ohip.hostName'), (params.propertyCode) ? params.propertyCode : env.inject('ohip.hotelId'), resId, env.inject('ohip.appKey'), token);
    
    if (readResult.status === 204) {
      const notFound: Error = {
        errorType: 'Not found',
        code: '404',
        message: `Could not read reservation with id ${resId} in hotel ${ params.propertyCode ? params.propertyCode : ''}`
      };
      return notFound;
    }

    const operaReservation = readResult.data;
    
    // Helper functions
    const concatenateWithSemicolon = (values: any) => {
      if (!values) {
        return '';
      }
      return values.join('; ');
    };
    
    const transformExternalConfirmationCodes = (externalCodes: any) => {
      if (!externalCodes) {
        return '';
      }
      return externalCodes.map((code: any) => code.split(':').join(':'));
    };

    const concatenatePreferenceTypeWithValue = (preferences: any) => {
      if (!Array.isArray(preferences) || preferences.length === 0) {
        return [];
      }
      const transformedList = [];
      for (const item of preferences) {
        const preferenceType = item.preferenceType;
        for (const preferenceItem of item.preference) {
          const preferenceValue = preferenceItem.preferenceValue;
          transformedList.push(`${preferenceType}:${preferenceValue}`);
        }
      }
      return transformedList;
    }; 

    const getGuest = async(operaProfileId: string) => {
      console.log(`Fetching htng profile ${operaProfileId} from ${(params.propertyCode) ? params.propertyCode : '**secret**'}`);
      return await poly.ohip.htngexpress.getGuest({ guestId: operaProfileId, propertyCode: (params.propertyCode) ? params.propertyCode : env.inject('ohip.hotelId')});
    };

    // TODO: should not have to use any
    const transformGuest = async(guest: any): Promise<Guest> => {
      const customer = guest.profileInfo.profile.customer;
      const personName = customer.personName[0];
      const telephone = guest.profileInfo.profile.telephones?.telephoneInfo[0]?.telephone;
      const email = guest.profileInfo.profile.emails?.emailInfo;
      let htngGuest: Guest;
      if (params.guestFetchInstructions === GuestFetchInstruction.self) {
        htngGuest =  {
          name_suffix: personName?.nameTitle,
          name_prefix: customer?.personName[1]?.nameTitle,
          name_first: personName?.givenName,
          name_middle: personName?.middleName,
          name_last: personName?.surname,
          vip_code: customer?.vipStatus,
          prefered_language: customer?.language,
          profile_id: guest.profileInfo.profileIdList[0]?.id,
          phone_mobile: telephone,
          email: (email) ? {
            email_type: email[0]?.email.typeDescription,
            email_is_primary: email[0]?.email.primaryInd,
            email_address:  email[0]?.email.emailAddress
          } : undefined,
          preferences: []
        };
      } else {
        htngGuest = await getGuest(guest.profileInfo.profileIdList[0]?.id);
      }
      return htngGuest;
    };

    const companyNames = [
      ...operaReservation.reservations.reservation[0].reservationProfiles.reservationProfile
          .filter(profile => profile.reservationProfileType === 'Company')
          .map(profile => profile.profile?.company?.companyName),
      operaReservation.reservations.reservation[0].reservationGuests[0]?.profileInfo?.profile?.customer?.personName.find(name => name.nameType === 'Primary')?.surname
    ];

    const removeUndefined = (obj: any) => {
      for (const k in obj) {
          if (obj[k] === undefined) {
              delete obj[k];
          } else if (typeof obj[k] === 'object' && obj[k] !== null) {
              removeUndefined(obj[k]);
          }
      }
      return obj;
    };

    // Transformation of operaReservation to htngReservation
    const htngReservation = {
      primary_guest: await transformGuest(operaReservation?.reservations?.reservation?.[0]?.reservationGuests[0]),
      additional_guests: await Promise.all(operaReservation?.reservations?.reservation?.[0]?.reservationGuests.slice(1).map(transformGuest)),
      property: {
        property_code:  (params.propertyCode) ? params.propertyCode : '',
        chain_code: '' // TODO: also fetch chain
      },
      arrival_date: moment(operaReservation?.reservations?.reservation?.[0]?.roomStay?.arrivalDate).format('YYYY-MM-DD'),
      departure_date: moment(operaReservation?.reservations?.reservation?.[0]?.roomStay?.departureDate).format('YYYY-MM-DD'),
      arrival_estimated_time: moment.utc(operaReservation?.reservations?.reservation?.[0]?.roomStay?.expectedTimes?.reservationExpectedArrivalTime)?.toISOString(),
      departure_estimated_time: moment.utc(operaReservation?.reservations?.reservation?.[0]?.roomStay?.expectedTimes?.reservationExpectedDepartureTime)?.toISOString(),
      number_of_adults: operaReservation?.reservations?.reservation?.[0]?.roomStay?.guestCounts?.adults ?? 0,
      number_of_children: operaReservation?.reservations?.reservation?.[0]?.roomStay?.guestCounts?.children ?? 0,
      room_type_code: operaReservation?.reservations?.reservation?.[0]?.roomStay?.currentRoomInfo?.roomType,
      // room_type_name: operaReservation?.reservations?.reservation?.[0]?.roomStay?.currentRoomInfo?.roomType, // TODO: is this really needed? will require an additional call
      room_number: operaReservation?.reservations?.reservation?.[0]?.roomStay?.currentRoomInfo?.roomId,
      company_name: concatenateWithSemicolon(companyNames),
      reservation_status_pms: operaReservation?.reservations?.reservation?.[0]?.reservationStatus,
      reservation_status_htng: undefined, // TODO: map PMS reservations status to HTNG reservation status
      group_code: concatenateWithSemicolon(operaReservation?.reservations?.reservation?.[0]?.reservationProfiles?.reservationProfile.filter(profile => profile.reservationProfileType === 'Group').map(profile => profile.profileIdList[0].id)),
      pms_reservation_id: operaReservation?.reservations?.reservation?.[0]?.reservationIdList[0].id,
      pms_confirmation_code: operaReservation?.reservations?.reservation?.[0]?.reservationIdList[1].id,
      pms_reservation_id_share_with: concatenateWithSemicolon(operaReservation?.reservations?.reservation?.[0]?.linkedReservation?.reservationInfo?.map(info => info.reservationIdList?.find(id => id.type === 'Reservation')?.id)),
      external_confirmation_code: transformExternalConfirmationCodes(operaReservation?.reservations?.reservation?.[0]?.externalReferences?.map(ref => `${ref.idContext}:${ref.id}`)),
      reservation_preference_code: concatenatePreferenceTypeWithValue(operaReservation?.reservations?.reservation?.[0]?.preferenceCollection),
      currency_code: operaReservation?.reservations?.reservation?.[0]?.roomStay?.roomRates?.[0]?.rates?.rate?.[0]?.base?.currencyCode,
      is_posting_allowed: operaReservation?.reservations?.reservation?.[0]?.cashiering?.billingPrivileges?.postStayCharging,
      room_rate_info: operaReservation?.reservations?.reservation?.[0]?.roomStay?.roomRates?.map(rate => ({
        end_date: moment(rate.end).format('YYYY-MM-DD'),
        number_of_adults: rate.guestCounts?.adults ?? 0,
        number_of_children: rate.guestCounts?.children ?? 0,
        rate_plan_code: rate.ratePlanCode,
        rate_plan_name: rate.ratePlanCode,
        room_rate: rate.total?.amountBeforeTax?.toFixed(2) ?? '0.00'
      })) ?? []
    };
    
    // Remove any properties with undefined values and return
    return removeUndefined(htngReservation);
  
  } catch (e: any) {
    const error: Error = {
      errorType: 'Error fetching reservation',
      code: '500',
      message: e.message
    };
    return error;
  }
}

// const run = async()  => {
//   const res = await getReservation({ 
//     reservationId: '118474',
//     propertyCode: 'SAND01CN',
//     reservationIdType: ReservationIdentifier.internal,
//     guestFetchInstructions: GuestFetchInstruction.full
//   }); 
//   /*
//     res with partial details: conf number: 1840002
//     res with all details: red Id: 118474, conf number: 1846543, ext Id: 12344567
//   */
//   console.log(res);
// };

// run();