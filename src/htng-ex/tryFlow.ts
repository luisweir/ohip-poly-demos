import { log } from '../logger';
import { getGuest } from './fxGetGuest';
import { getReservation, ReservationIdentifier, GuestFetchInstruction } from './fxGetReservation';
import { searchReservations, RangeType, OrderBy, SortOrder } from './fxSearchReservations';

const run = async()  => {

  log.info('fetching profile');
  const guest = await getGuest({ 
    guestId: '724797'
  });
  log.info(guest);
  if ('errorType' in guest) {
    log.error('Error fetching guest profile');
    process.exit(1);
  }

  log.info('fetching reservation using reservation id');
  const res1 = await getReservation({ 
    reservationId: '118474',
    guestFetchInstructions: GuestFetchInstruction.full
  });
  log.info(res1);
  if ('errorType' in res1) {
    log.error('Error fetching reservation using reservation id');
    process.exit(1);
  }

  log.info('fetching same reservation using confirmation number');
  const res2 = await getReservation({ 
    reservationId: '1846543',
    propertyCode: 'SAND01CN',
    reservationIdType: ReservationIdentifier.confirmation,
    guestFetchInstructions: GuestFetchInstruction.self
  }); 
  log.info(res2);
  if ('errorType' in res2) {
    log.error('Error fetching reservation using confirmation number');
    process.exit(1);
  }

  log.info('fetching same reservation using external id');
  const res3 = await getReservation({ 
    reservationId: '12344567',
    propertyCode: 'SAND01CN',
    reservationIdType: ReservationIdentifier.external,
    guestFetchInstructions: GuestFetchInstruction.self
  }); 
  log.info(res3);
  if ('errorType' in res3) {
    log.error('Error fetching reservation using external id');
    process.exit(1);
  }

  const search = await searchReservations({ 
    fromDate: '2023-08-31',
    toDate: '2023-09-01',
    rangeType: RangeType.arrivals,
    propertyCode: 'SAND01CN',
    guestLastName: 'W',
    guestFirstName: 'L',
    orderBy: OrderBy.guestLastName,
    sortOrder: SortOrder.desc
  }); 
  log.info(search);
  if ('errorType' in search) {
    log.error('Error searching reservations');
    process.exit(1);
  }
};

run();