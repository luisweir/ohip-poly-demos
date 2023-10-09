import poly, { vari } from 'polyapi';

interface Error { error: string }

interface Response {
  successful: boolean
}

interface ConciergeService {
  Description: string
  PackageAmount: number
}

interface ServicesCollection {
  ConciergeServiceNames: {
    [key: string]: ConciergeService;
  }
}

export async function getConciergeServices(): Promise<ServicesCollection | Error> {
  try {
    const addonsLov: any = await vari.ohip.conciergeLoV.get();
    for (const key in addonsLov) {
      delete addonsLov[key].TransactionCode;
    }
    return {
      ConciergeServiceNames: { ...addonsLov }
    };
  } catch (e: any) {
    return e.response.data;
  }
}

export async function requestConciergeService(confirmationNumber: string, hotelName: string, conciergeService: string, quantity: number): Promise<Response | Error> {
  try {
    // get all lov with all services available
    const addonsLov: any = await vari.ohip.conciergeLoV.get();
    // make sure the concierge service provided exists and if not throw error for AI to use an existing one
    const transaction = addonsLov[conciergeService];
    if (transaction) {
      delete transaction.description; 
    } else {
      throw new Error(`Concierge service ${conciergeService} not found. Please use a valid service fetched from getConciergeServices`);
    }

    // get environment variables
    const env = vari.ohip.envSecrets;
    // get access token
    console.log('Fetching ohip token');
    const token = await poly.ohip.utilities.getOhipToken();
    
    // get all hotels in the chain and let's find the one that matches the name of the hotel entered
    console.log(`Searching hotelId for hotelName '${hotelName}'`);
    const hotelId = await poly.ohip.utilities.getHotelId(hotelName);
    if (hotelId === 'notfound') {
      throw new Error(`Could not find a hotel named '${hotelName}'`);
    }

    // extract room type from res and check if arrival date equals today
    const confNumber = parseInt(confirmationNumber);
    let resId = 0;

    try {
      await poly.ohip.property.getReservationByConfirmationNumber(env.inject('ohip.hostName'), hotelId, confNumber, env.inject('ohip.appKey'), token)
        .then((res) => {
          if (res.data.reservations.totalPages === 0) {
            throw new Error(`Reservation with confirmation number ${confNumber} not found`);
          }
          resId = parseInt(res.data.reservations.reservationInfo[0].reservationIdList[0].id);
          console.log(`Confirmation number ${confNumber} = Reservation Id ${resId}`);
        });
    } catch (e: any) {
      return { 'error' : e.message};
    }

    for (let i = 1; i <= quantity; i++) {
      try {
        console.log(`Adding concierge service ${conciergeService} ${i} of ${quantity}`);
        await poly.ohip.property.addCharges(env.inject('ohip.hostName'), hotelId, resId, env.inject('ohip.appKey'), token, transaction)
        .then((res)=> {
          if (res.status !== 201) {
            const error: any = res;
            throw new Error(error.data.title);
          }
        });
      } catch (e: any) {
        throw new Error(e.message);
      }
    }

    return { 'successful' : true };

  } catch (e: any) {
    if ('response' in e) {
      return e.response.data;
    } else {
      return { error: `${e}`};
    }
  }
}

// const run = async()  => {
//   const services = await getConciergeServices();
//   console.log(services);
//   if ('ConciergeServiceNames' in services) {
//     const randomService = Object.keys(services.ConciergeServiceNames)[Math.floor(Math.random() * Object.keys(services.ConciergeServiceNames).length)];
//     const randomQuantity = (Math.floor(Math.random() * 2)) + 1;
//     console.log(`Randomly picked ${randomService} with quantity ${randomQuantity} and now requesting service`);
//     const request = await requestConciergeService('1908872', 'ohip sandbox 1', randomService,randomQuantity);
//     console.log(request);
//   }
// };
// run();
