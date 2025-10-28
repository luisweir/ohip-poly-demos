import poly, { vari } from 'polyapi';

interface Error { error: string }

interface Response {
  successful: boolean
}

interface ConciergeService {
  Description: string;
  PackageAmount: number;
  CurrencyCode: string;
  TransactionCode: number;
}

interface ServicesCollection {
  ConciergeServiceNames: {
    [key: string]: ConciergeService; // key is package code
  }
}

/**
 * Build concierge services from OPERA packages that can be sold ad hoc.
 * Criteria: sellSeparate = true, group = false, within begin and end dates if present.
 */
export async function getConciergeServices(
  hotelName: string,
  dateFrom: string,  // YYYY-MM-DD (arrival)
  dateTo: string,    // YYYY-MM-DD (departure)
  adults: number,
  children: number
): Promise<ServicesCollection | Error> {
  try {
    const env = vari.ohip.envSecrets;
    const token = await poly.ohip.utilities.getOhipToken();

    const hotelId = await poly.ohip.utilities.getHotelId(hotelName);
    if (hotelId === 'notfound') {
      throw new Error(`Could not find a hotel named '${hotelName}'`);
    }

    const res = await poly.ohip.property.getPackages(
      env.inject('ohip.hostName'),
      dateTo,
      adults,
      children,
      hotelId,
      dateFrom,
      env.inject('ohip.appKey'),
      token
    );

    const out: ServicesCollection = { ConciergeServiceNames: {} };

    const packagesList =
      res?.data?.packageCodesList?.packageCodes?.[0]?.packageCodeInfo ?? [];

    const refDate = new Date(dateFrom);

    for (const p of packagesList) {
      const code: string = p.code;
      const header = p.header ?? {};
      const primary = header.primaryDetails ?? {};
      const txn = header.transactionDetails ?? {};
      const posting = header.postingAttributes ?? {};

      if (posting?.sellSeparate !== true) continue;
      if (p?.group === true) continue;

      const begin = primary.beginSellDate ? new Date(primary.beginSellDate) : null;
      const end = primary.endSellDate ? new Date(primary.endSellDate) : null;
      if (begin && refDate < begin) continue;
      if (end && refDate > end) continue;

      const desc: string = primary.shortDescription || primary.description || code;

      const amount: number =
        typeof posting.calculatedPrice === 'number' ? posting.calculatedPrice : 0;

      const currency: string = txn.currency || 'USD';

      const txnCodeRaw = txn?.packagePostingRules?.transactionCode?.code as string | number | undefined;
      const txnCode = txnCodeRaw !== undefined ? parseInt(String(txnCodeRaw), 10) : NaN;
      if (!Number.isFinite(txnCode)) continue;

      out.ConciergeServiceNames[code] = {
        Description: desc,
        PackageAmount: amount,
        CurrencyCode: currency,
        TransactionCode: txnCode
      };
    }

    return out;
  } catch (e: any) {
    if ('response' in e) return e.response.data;
    return { error: `${e}` };
  }
}

/**
 * Adds a concierge package multiple times based on stay length and party size.
 * Quantity is computed as: nights * (adults + children).
 */
export async function requestConciergeService(
  confirmationNumber: string,
  hotelName: string,
  conciergeServiceCode: string, // package code from getConciergeServices
  dateFrom: string,             // YYYY-MM-DD (arrival)
  dateTo: string,               // YYYY-MM-DD (departure)
  adults: number,
  children: number
): Promise<Response | Error> {
  try {
    const env = vari.ohip.envSecrets;
    const token = await poly.ohip.utilities.getOhipToken();

    const hotelId = await poly.ohip.utilities.getHotelId(hotelName);
    if (hotelId === 'notfound') {
      throw new Error(`Could not find a hotel named '${hotelName}'`);
    }

    // derive quantity = nights * persons
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const nights = Math.max(0, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)); // end exclusive
    const persons = Math.max(0, (adults || 0) + (children || 0));
    const totalQuantity = nights * persons;

    // fetch available services to resolve pricing and transaction code
    const services = await getConciergeServices(
      hotelName,
      dateFrom,
      dateTo,
      adults,
      children
    );

    if (!('ConciergeServiceNames' in services)) {
      const err = services as Error;
      throw new Error(err.error || 'Failed to get concierge services');
    }

    const svc = services.ConciergeServiceNames[conciergeServiceCode];
    if (!svc) {
      throw new Error(
        `Concierge service ${conciergeServiceCode} not found. Please use a valid code from getConciergeServices`
      );
    }

    // if totalQuantity is 0, nothing to add
    if (totalQuantity <= 0) {
      return { successful: true };
    }

    // locate reservation id
    const confNumber = parseInt(confirmationNumber, 10);
    let resId = 0;

    try {
      const res = await poly.ohip.property.getReservationByConfirmationNumber(
        env.inject('ohip.hostName'),
        hotelId,
        confNumber,
        env.inject('ohip.appKey'),
        token
      );

      if (res.data.reservations.totalPages === 0) {
        throw new Error(`Reservation with confirmation number ${confNumber} not found`);
      }
      resId = parseInt(
        res.data.reservations.reservationInfo[0].reservationIdList[0].id,
        10
      );
      console.log(`Confirmation number ${confNumber} = Reservation Id ${resId}`);
    } catch (e: any) {
      return { error: e.message };
    }

    // expected payload by addCharges
    const transactionPayload = {
      PackageAmount: svc.PackageAmount,
      CurrencyCode: svc.CurrencyCode,
      TransactionCode: svc.TransactionCode
    };

    for (let i = 1; i <= totalQuantity; i++) {
      try {
        console.log(`Adding ${conciergeServiceCode} ${i} of ${totalQuantity}`);
        const res = await poly.ohip.property.addCharges(
          env.inject('ohip.hostName'),
          hotelId,
          resId,
          env.inject('ohip.appKey'),
          token,
          transactionPayload
        );

        if (res.status !== 201) {
          const error: any = res;
          throw new Error(error.data?.title || 'Failed to add charge');
        }
      } catch (e: any) {
        throw new Error(e?.message || String(e));
      }
    }

    return { successful: true };
  } catch (e: any) {
    if ('response' in e) {
      return e.response.data;
    } else {
      return { error: `${e}` };
    }
  }
}

// /** Example runner */
// const run = async () => {
//   const hotelName = 'ohip sandbox 01';
//   const dateFrom = '2025-10-27';
//   const dateTo = '2025-10-29'; // 2 nights
//   const adults = 2;
//   const children = 2;

//   const services = await getConciergeServices(hotelName, dateFrom, dateTo, adults, children);
//   console.log(services);

//   if ('ConciergeServiceNames' in services) {
//     const keys = Object.keys(services.ConciergeServiceNames);
//     if (keys.length > 0) {
//       const randomService = keys[Math.floor(Math.random() * keys.length)];
//       console.log(`Requesting ${randomService} driven by nights * persons`);
//       const request = await requestConciergeService(
//         '2797189',
//         hotelName,
//         randomService,
//         dateFrom,
//         dateTo,
//         adults,
//         children
//       );
//       console.log(request);
//     } else {
//       console.log('No concierge services available for the given params.');
//     }
//   }
// };
// run();