import dotenv from 'dotenv';
import moment from 'moment';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../logger';
import { searchHotelsByLocation } from './fxSearchHotelsByLocation';
import { searchHotelAvailability } from './fxSearchHotelAvailability';
import { createResWithPayLink } from './fxCreateResWithPayLink';
import { checkInGuest } from './fxCheckIn';
import { getConciergeServices, requestConciergeService } from './fxConciergeServices';
import { checkBillCharges } from './fxCheckBillCharges';
dotenv.config({path: process.env.ENVPATH || './.env'});

type Options = {
  from: any;
  to: any;
  now: any;
  location: string;
  adults: number;
  children: number;
  childrenAges: string;
  rooms: number;
  firstNames: string;
  lastNames: string;
  title: string;
  phone: string;
  email: string
};

const run = async(options: Options)  => {
  log.info(`Searching for a hotel in ${options.location}`);
  const locationHotels = await searchHotelsByLocation(options.location);
  let hotelId = '';
  let hotelName = '';
  if('hotels' in locationHotels){
    hotelName = locationHotels.hotels[0].name;
    hotelId = locationHotels.hotels[0].hotelId;
    log.info(`selecting the first hotel found: ${hotelName} with hotelId ${hotelId}`);
  } else {
    log.error(`No hotels in ${options.location}`);
    process.exit(1);
  }

  log.info(`Searching for a hotel in ${options.location} from ${options.from} to ${options.to}`);
  const shop = await searchHotelAvailability(
    hotelName,
    options.adults,
    options.children,
    options.rooms,
    options.from,
    options.to);
  if ('availability' in shop) {
    log.info(`Found ${shop.availability.length} rooms`);

    if (shop.availability.length === 0) {
      log.error('No rooms available');
      process.exit(1);
    }

    // pick random offer
    const random = Math.floor(Math.random() * shop.availability.length);
    const offer = shop.availability[random];
    log.info(`Picked ${offer.roomName} at ${offer.amountBeforeTax} ${offer.currencyCode}`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    let booking = null;
    let payLink = uuidv4();
    // eslint-disable-next-line no-constant-condition
    while (true) {   
      booking = await createResWithPayLink(
        hotelName,
        options.adults,
        options.children,
        options.childrenAges,
        options.from,
        options.to,
        options.rooms,
        offer.ratePlanCode,
        offer.roomTypeCode,
        offer.amountBeforeTax,
        'GB',
        'en-UK',
        offer.currencyCode,
        payLink
      );
      log.info(booking);
    
      // Check if booking.operaConfirmationNumber exists, and if so break the loop
      if ('operaConfirmationNumber' in booking) {
        log.info('Booking confirmed with operaConfirmationNumber:', booking.operaConfirmationNumber);
        break;
      } 
      // if pay link provided, ask user to complete payment
      if ('url' in booking) {
        payLink = booking.linkId;
        await new Promise((resolve) => {
          rl.question('Open the URL in a browser and complete the payment. Then hit enter.', (input) => resolve(input));
        });
        // delay of 5 secs to allow adyen event to arrive to the  cache
        console.log('Pausing for 20 seconds to ensure event is in cache');
        const sleep = (ms = 20000) => {
          return new Promise(resolve => setTimeout(resolve, ms));
        };
        await sleep();
      }
      // if error then exit
      if ('error' in booking) {
        log.error(booking.error);
        process.exit(1);
      }
    }
    // now check in guest, book service and get bill
    const roomAssigned = await checkInGuest(booking.operaConfirmationNumber, hotelName);
    if ('guestCheckedIn' in roomAssigned) {
      log.info(`Successfully checked-in. Room ${roomAssigned.roomNumber} assigned`);
      log.info('Getting available concierge services');
      const services = await getConciergeServices(hotelName,options.from,options.to,options.adults,options.children);
      log.info(services);
      if ('ConciergeServiceNames' in services) {
        const randomService = Object.keys(services.ConciergeServiceNames)[Math.floor(Math.random() * Object.keys(services.ConciergeServiceNames).length)];
        const randomQuantity = (Math.floor(Math.random() * 2)) + 1;
        log.info(`Randomly picked ${randomService} with quantity ${randomQuantity} and now requesting service`);
        const request = await requestConciergeService(booking.operaConfirmationNumber, hotelName, randomService,options.from,options.to,options.adults,options.children);
        log.info(request);
        if ('successful' in request) {
          // check the bill
          const bill = await checkBillCharges(booking.operaConfirmationNumber, hotelName);
          if ('balance' in bill) {
            log.info(bill);
            rl.close();
          } else {
            log.error(bill.error);
            rl.close();
          }
        } else {
          log.error('Could not request concierge service');
          rl.close();
        }
      } else {
        log.error('Could not get concierge services');
        rl.close();
      }   
    } else {
      log.error(roomAssigned.error);
      rl.close();
    }
  } else {
    log.error(shop.error);
  }
};

// load variables from env
const from = process.env.FROM ||  moment().format('YYYY-MM-DD');
const options: Options = {
  from: from,
  to: moment(from).add((process.env.TO || 1), 'days').format('YYYY-MM-DD'),
  now: from + moment().format(' HH:mm:ss'),
  location: process.env.LOCATION || 'Leamington',
  adults: Number(process.env.ADULTS) || 1,
  children: Number(process.env.CHILDREN) || 0,
  childrenAges: process.env.CHILDREN_AGES || '0',
  rooms: Number(process.env.ROOMS) || 1,
  firstNames: process.env.FIRST_NAMES || 'Peter',
  lastNames: process.env.LAST_NAMES ||'Rabbit',
  title: process.env.TITLE || 'Sir',
  phone: process.env.PHONE || '+447572339889',
  email: process.env.EMAIL || 'peter.rabbit@oracle.com'
};
console.log(options);
run(options);