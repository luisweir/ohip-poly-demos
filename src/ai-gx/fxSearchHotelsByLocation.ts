import poly, { vari } from 'polyapi';

interface Error { error: string }

interface Hotel {
  name: string;
  hotelId: string;
  description: string;
  street: string;
  city: string;
  state: string;
  country: string;
  website: string;
  phone: string;
  distance: number;
}

interface Hotels {
  hotels: Hotel[];
}

const hotels: Hotels = { hotels: [] };
const minDistance = 10;

// FIX: normalise units to what Google expects, use simple aliases.
// Why: caller may pass 'km' or 'mi'. Google needs 'metric' or 'imperial'.
function normaliseUnits(u: string) {
  const v = (u || '').toLowerCase().trim();
  if (['metric', 'km', 'kilometer', 'kilometre', 'kilometers', 'kilometres'].includes(v)) return 'metric';
  if (['imperial', 'mi', 'mile', 'miles'].includes(v)) return 'imperial';
  return 'imperial';
}

// FIX: normalise mode safely.
// Why: default to 'driving' if input is unexpected.
function normaliseMode(m: string) {
  const v = (m || '').toLowerCase().trim();
  if (['driving', 'walking', 'bicycling', 'transit'].includes(v)) return v;
  return 'driving';
}

// FIX: safe join for address parts, avoids doubled spaces and improves geocoding.
function joinAddress(parts: Array<string | undefined | null>) {
  return parts.filter(Boolean).join(', ');
}

export async function searchHotelsByLocation(
  hotelDestination: string,
  minDistanceToHotel = minDistance,
  imperialOrMetricDistance = 'imperial',
  distanceDrivingOrWalkingOrBicyclingOrTransit = 'walking',
  twoLetterLanguageCode = 'en'
): Promise<Hotels | Error> {

  try {
    // get environment variables
    const env = vari.ohip.envSecrets;

    // get access token
    console.log('Fetching ohip token');
    const token = await poly.ohip.utilities.getOhipToken();
    console.log(token);

    // get all hotels
    const hotelsInChain = await poly.ohip.property.getAllHotelsInChain(
      env.inject('ohip.hostName'),
      env.inject('ohip.hotelId'),
      env.inject('ohip.appKey'),
      token
    );

    if (!hotelsInChain.data.listOfValues) {
      throw new Error('Not able to get list of hotels. Verify that user has correct access rights');
    }
    console.log(`Found ${hotelsInChain.data.listOfValues.items.length} hotels in the chain`);

    const getHotelDetails = async () => {
      const promises = hotelsInChain.data.listOfValues.items.map(async (hotelDetails: any) => {
        console.log(`Getting details for hotel ${hotelDetails.code} - ${hotelDetails.name}`);
        const hotelDetail = await poly.ohip.property.getHotelDetails(
          env.inject('ohip.hostName'),
          hotelDetails.code,
          env.inject('ohip.appKey'),
          token
        );
        const cfg = hotelDetail?.data?.hotelConfigInfo || {};
        const addr = cfg?.address || {};
        const comm = cfg?.communication || {};

        const hotel: Hotel = {
          name: String(hotelDetails.name || '').toLocaleLowerCase(),
          hotelId: hotelDetails.code,
          description: hotelDetails.description,
          street: addr.addressLine?.[0] || '',
          city: addr.cityName || '',
          state: addr.state || '',
          country: addr.country?.code || '',
          website: comm.webPage?.value || '',
          phone: comm.phoneNumber?.phoneNumber || '',
          distance: -1
        };
        hotels.hotels.push(hotel);
      });
      await Promise.all(promises);
    };
    await getHotelDetails();

    // Build the pipe-delimited address list for Distance Matrix
    let hotelAddresses = '';
    hotels.hotels.forEach((hotel) => {
      // BAD: building with raw string interpolation and spaces, leads to poor geocoding and duplicates
      // const address = `${hotel.street} ${hotel.city} ${hotel.state} ${hotel.country}`;

      // FIX: join with commas and skip empties, improves geocoding quality and readability
      const address = joinAddress([hotel.street, hotel.city, hotel.state, hotel.country]);

      const bar = hotelAddresses ? '|' : '';
      hotelAddresses = hotelAddresses + bar + address;
    });

    // BAD: unit switch only recognises 'imperial', everything else silently falls back,
    // and default also rewrites 'mode' unexpectedly in the second switch.
    /*
    let metric, mode = '';
    switch (imperialOrMetricDistance.toLocaleLowerCase()) {
      case 'imperial':
      case 'imperial':
        metric = imperialOrMetricDistance.toLocaleLowerCase();
        break;
      default:
        metric = 'imperial';
    }
    switch (distanceDrivingOrWalkingOrBicyclingOrTransit.toLocaleLowerCase()) {
      case 'driving':
      case 'walking':
      case 'bicycling':
      case 'transit':
        mode = distanceDrivingOrWalkingOrBicyclingOrTransit.toLocaleLowerCase();
        break;
      default:
        metric = 'imperial';
        mode = 'driving';
    }
    */

    // FIX: proper normalisation, no cross-assignment, explicit defaults
    const units = normaliseUnits(imperialOrMetricDistance);
    const mode = normaliseMode(distanceDrivingOrWalkingOrBicyclingOrTransit);

    console.log(`Calculating hotel distances from: ${hotelDestination} to ${hotelAddresses} (units=${units}, mode=${mode})`);

    const hotelDistances = await poly.google.maps.distanceToHotels(
      env.inject('google.appKey'),
      units,            // pass 'metric' or 'imperial' only
      hotelAddresses,
      hotelDestination,
      twoLetterLanguageCode,
      mode
    );
    console.log(hotelDistances);

    // BAD: parseFloat on 'distance.text' like '1,094 mi' results in 1, corrupting distances.
    /*
    const assignDistanceToHotels = async(): Promise<void> => {
      await new Promise<void>((resolve) => {
        if (hotelDistances.data.rows) {
          for (let i = 0; i < hotelDistances.data.rows.length; i++) {
            const elements = hotelDistances.data.rows[i].elements;
            if (elements && elements[0] && elements[0].distance) {
              const dis = parseFloat(elements[0].distance.text);
              hotels.hotels[i].distance = dis;
            }
          }
        }
        resolve();
      });
    };
    */

    // FIX: use 'distance.value' in metres, convert to km or miles, round to one decimal
    // Why: avoids locale formatting issues and commas in text
    const assignDistanceToHotels = async (): Promise<void> => {
      await new Promise<void>((resolve) => {
        const rows = hotelDistances?.data?.rows || [];
        for (let i = 0; i < rows.length; i++) {
          const el = rows[i]?.elements?.[0];
          if (el?.status === 'OK' && typeof el?.distance?.value === 'number') {
            const metres: number = el.distance.value;
            const dist = units === 'metric' ? metres / 1000 : metres / 1609.344;
            hotels.hotels[i].distance = Math.round(dist * 10) / 10;
          } else {
            hotels.hotels[i].distance = -1;
          }
        }
        resolve();
      });
    };
    await assignDistanceToHotels();

    // print all hotels found with distances
    console.table(hotels.hotels);

    // BAD: log says 'less than {minDistanceToHotel}', but code uses 'dis' which may override.
    // The logic is fine, but the message can be misleading.
    const dis = (minDistanceToHotel <= 0) ? minDistance : minDistanceToHotel;

    // FIX: log the effective radius being used to avoid confusion
    console.log(`Filtering hotels that are less than ${dis} away`);

    const findClosestHotels = (): Hotels => {
      const result = hotels.hotels.filter(hotel => (hotel.distance <= dis && hotel.distance >= 0));
      if (result.length === 0) throw new Error('Did not find any hotel nearby your destination');
      return { hotels: result };
    };

    return findClosestHotels();

  } catch (e: any) {
    if ('response' in e) {
      return e.response.data;
    } else {
      return { error: `${e}` };
    }
  }
}

// // Demo runner
// const run = async () => {
//   // BAD: passing 'km' used to fall back to imperial silently.
//   // FIX: after normalisation, 'km' maps to 'metric' and works as expected.
//   const res = await searchHotelsByLocation('Empire State building', 11, 'miles', 'driving', 'en');
//   console.log(res);
// };

// run();
