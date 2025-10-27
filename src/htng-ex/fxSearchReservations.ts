import poly, { vari } from 'polyapi';
import { paths, components, operations } from './api-spec/htng-ex';
import moment from 'moment';

// Used https://github.com/drwpow/openapi-typescript/tree/main/packages/openapi-typescript to generate types directly from oas spec
// npx openapi-typescript ./src/htng-ex/api-spec/htng-api.json -o ./src/htng-ex/htng-ex.ts
type InputParams = paths['/reservations/{fromDate}/{toDate}']['parameters']['path'];
type Reservation = components['schemas']['Reservation'];
type Guest = components['schemas']['Guest'];
/* TODO: 
  - What is the main use case for this capability? serving a UI? extracting data ?
  - Pagination not supported
  - what do the from/to dates represent? creation dates? or arrival dates? pr departure dates?
  - Is this assuming a hotel specific search? multi-hotel search? if so, hotelId or hotelId's are a must. Had to specify this via extension
  - Why is preferences a required response element in a search? 
  - Not clear what to return if no reservations are found given there are no results. No response type for 204 or 404
  - What error codes to use in errors? the OPERA code?
  - No HATEOAS support is that deliberate? should be supported
*/
type Error = operations['get-reservations']['responses'][529]['content']['application/json'];

export enum RangeType {
  arrivals = 'arrivals',
  departures = 'departures'
}

export enum OrderBy {
  room = 'Room',
  arrivalDate = 'ArrivalDate',
  departureDate = 'DepartureDate',
  guestLastName = 'GuestSurname',
}

export enum SortOrder {
  asc = 'ASC',
  desc = 'DESC'
}

interface ExtendedInput extends InputParams {
  rangeType?: RangeType,
  propertyCode?: string,
  guestLastName?: string,
  guestFirstName?: string,
  orderBy?: OrderBy,
  sortOrder?: SortOrder
}

// TODO: once is clear how to extend inputParams modify hotelId input
export async function searchReservations(params: ExtendedInput): Promise<Reservation| Error> {
  try {
    // get environment variables
    const env = vari.ohip.envSecrets;
    // get access token
    console.log('Fetching ohip token');
    const token = await poly.ohip.utilities.getOhipToken();

    let arrivalsFromDate, arrivalsToDate, departureFromDate, departureToDate;
    switch(params.rangeType) {
      case RangeType.arrivals:
        arrivalsFromDate = params.fromDate;
        arrivalsToDate = params.toDate;
        departureFromDate = '';
        departureToDate = '';
        break;
      case RangeType.departures:
        arrivalsFromDate = '';
        arrivalsToDate = '';
        departureFromDate = params.fromDate;
        departureToDate = params.toDate;
        break;
      default:
        arrivalsFromDate = params.fromDate;
        arrivalsToDate = params.toDate;
        departureFromDate = '';
        departureToDate = '';
    }

    const searchResult = (await poly.ohip.property.searchReservationsByDateRangeAndGuestNames(
      env.inject('ohip.hostName'),
      (params.propertyCode) ? params.propertyCode : env.inject('ohip.hotelId'),
      arrivalsFromDate,
      arrivalsToDate,
      departureFromDate,
      departureToDate,
      (params.orderBy) ? params.orderBy : OrderBy.arrivalDate,
      (params.sortOrder) ? params.sortOrder : SortOrder.asc,
      (params.guestLastName) ? params.guestLastName : '',
      (params.guestFirstName) ? params.guestFirstName : '',
      env.inject('ohip.appKey'),
      token
    ));

    if (searchResult.data.reservations.totalResults === 0) {
      const notFound: Error = {
        errorType: 'Not found',
        code: '404',
        message: `Did not find any reservations in range ${params.fromDate} to ${params.toDate} in hotel ${(params.propertyCode) ? params.propertyCode : ''}`
      };
      return notFound;
    }

    const operaReservations = searchResult.data;
    console.log(`Found ${operaReservations.reservations.reservationInfo.length} reservations in range`);
    
    const transformExternalConfirmationCodes = (externalCodes: any) => {
      if (!externalCodes) {
        return '';
      }
      return externalCodes.map((code: any) => code.split(':').join(':'));
    };

    // TODO: should not have to use any
    const mainGuest = async(guest: any): Promise<Guest> => {
      const htngGuest: Guest =  {
        name_suffix: guest?.givenName,
        name_prefix: guest?.nameTitle,
        name_first: guest?.givenName,
        name_middle: guest?.middleName,
        name_last: guest?.surname,
        vip_code: guest.vip?.vipCode,
        prefered_language: guest?.language,
        profile_id: guest.id,
        email: guest?.email,
        preferences: []
      };
      return htngGuest;
    };

    // TODO: should not have to use any
    const accompanyGuest = async(guest: any): Promise<Guest> => {
      return {
        name_first: guest?.firstName,
        name_last: guest?.surname,
        profile_id: guest.profileIdList[0].id,
        preferences: []
      };
    };

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

    const htngReservations = await Promise.all(operaReservations.reservations.reservationInfo.map(async operaReservation => ({
      primary_guest: await mainGuest(operaReservation.reservationGuest),
      additional_guests: await Promise.all(operaReservation.reservationGuest?.accompanyGuests.map(accompanyGuest)),
      property: {
        property_code: (params.propertyCode) ? params.propertyCode : '',
        chain_code: '' // TODO: also fetch chain
      },
      arrival_date: moment(operaReservation.roomStay.arrivalDate).format('YYYY-MM-DD'),
      departure_date: moment(operaReservation.roomStay.departureDate).format('YYYY-MM-DD'),
      arrival_estimated_time: operaReservation.roomStay.expectedTimes.reservationExpectedArrivalTime ? moment.utc(operaReservation.roomStay.expectedTimes.reservationExpectedArrivalTime)?.toISOString() : null,
      departure_estimated_time: operaReservation.roomStay.expectedTimes.reservationExpectedDepartureTime ? moment.utc(operaReservation.roomStay.expectedTimes.reservationExpectedDepartureTime)?.toISOString() : null,
      number_of_adults: operaReservation.roomStay.adultCount ?? 0,
      number_of_children: operaReservation.roomStay.childCount ?? 0,
      room_type_code: operaReservation.roomStay.roomType,
      // room_type_name: operaReservation.roomStay.roomType, // TODO: is this really needed? will require an additional call
      room_number: operaReservation.roomStay.roomId ?? undefined,
      company_name: operaReservation.attachedProfiles.map((profile: any) => profile.name).join(';'),
      reservation_status_pms: operaReservation.reservationStatus,
      reservation_status_htng: undefined, // TODO: map PMS reservations status to HTNG reservation status
      group_code: operaReservation.attachedProfiles.filter((profile: any) => profile.reservationProfileType === 'Group').map((profile: any) => profile.profileIdList[0].id).join(';'),
      pms_reservation_id: operaReservation.reservationIdList[0].id,
      pms_confirmation_code: operaReservation.reservationIdList[1].id,
      external_confirmation_code: transformExternalConfirmationCodes((operaReservation as any).externalReferences?.map((ref: any) => `${ref.idContext}:${ref.id}`)), //TODO: workaround as poly isn't generating full object (this might already be fixed in develop)
      currency_code: operaReservation.roomStay.balance?.currencyCode
    })));
    
    // Remove any properties with undefined values and return
    return removeUndefined(htngReservations);
  
  } catch (e: any) {
    const error: Error = {
      errorType: 'Error fetching reservation',
      code: '500',
      message: e.message
    };
    return error;
  }
}

const run = async()  => {
  const res = await searchReservations({ 
    fromDate: '2025-10-25',
    toDate: '2025-10-30',
    rangeType: RangeType.arrivals,
    propertyCode: 'OHIPSB01',
    guestLastName: 'Smith',
    guestFirstName: 'John',
    orderBy: OrderBy.guestLastName,
    sortOrder: SortOrder.desc
  }); 
  console.log(res);
};

run();