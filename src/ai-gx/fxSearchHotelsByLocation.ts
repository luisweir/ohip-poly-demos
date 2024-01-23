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

export async function searchHotelsByLocation(
  hotelDestination: string,
  minDistanceToHotel = minDistance,
  imperialOrMetricDistance = 'imperial',
  distanceDrivingOrWalkingOrBicyclingOrTransit = 'walking',
  twoLetterLanguageCode = 'en'
  ): Promise<Hotels| Error> {
  
  try {
    // get environment variables
    const env = vari.ohip.envSecrets;
    // get access token
    console.log('Fetching ohip token');
    const token = await poly.ohip.utilities.getOhipToken();

    console.log(token);
    
    // // get all hotels
    const hotelsInChain = await poly.ohip.property.getAllHotelsInChain(env.inject('ohip.hostName'), env.inject('ohip.hotelId'), env.inject('ohip.appKey'), token);
    if (!hotelsInChain.data.listOfValues) throw new Error('Not able to get list of hotels. Verify that user has correct access rights');
    console.log(`Found ${hotelsInChain.data.listOfValues.items.length} hotels in the chain`);
    
    const getHotelDetails = async() => {
      const promises = hotelsInChain.data.listOfValues.items.map(async(hotelDetails) => {
        console.log(`Getting details for hotel ${hotelDetails.code} - ${hotelDetails.name}`);
        const hotelDetail = await poly.ohip.property.getHotelDetails(env.inject('ohip.hostName'), hotelDetails.code, env.inject('ohip.appKey'),  token);
        const hotel: Hotel = {
          name: hotelDetails.name.toLocaleLowerCase(),
          hotelId: hotelDetails.code,
          description: hotelDetails.description,
          street: (hotelDetail.data.hotelConfigInfo.address.addressLine[0]) ? hotelDetail.data.hotelConfigInfo.address.addressLine[0] : '',
          city: (hotelDetail.data.hotelConfigInfo.address.cityName) ? hotelDetail.data.hotelConfigInfo.address.cityName : '',
          state: (hotelDetail.data.hotelConfigInfo.address.state) ? hotelDetail.data.hotelConfigInfo.address.state : '',
          country: (hotelDetail.data.hotelConfigInfo.address.country.code) ? hotelDetail.data.hotelConfigInfo.address.country.code : '',
          website: (hotelDetail.data.hotelConfigInfo.communication.webPage.value) ? hotelDetail.data.hotelConfigInfo.communication.webPage.value : '',
          phone: (hotelDetail.data.hotelConfigInfo.communication.phoneNumber.phoneNumber) ? hotelDetail.data.hotelConfigInfo.communication.phoneNumber.phoneNumber : '',
          distance: -1
        };
        hotels.hotels.push(hotel);
      });
      await Promise.all(promises);
    };
    await getHotelDetails();

    let hotelAddresses = '';
    hotels.hotels.forEach((hotel) =>{
      console.log(hotelAddresses);
      const address = `${hotel.street} ${hotel.city} ${hotel.state} ${hotel.country}`;
      const bar = (hotelAddresses) ? '|' : '';
      hotelAddresses = hotelAddresses + bar + address;
    });

    //show all hotels found
    let metric, mode = '';
    switch (imperialOrMetricDistance.toLocaleLowerCase()) {
      case 'imperial' || 'metric':
        metric = imperialOrMetricDistance.toLocaleLowerCase();
        break;
      default:
        metric = 'imperial';
    }
    switch (distanceDrivingOrWalkingOrBicyclingOrTransit.toLocaleLowerCase()) {
      case 'driving' || 'walking' || 'bicycling' || 'transit':
        mode = distanceDrivingOrWalkingOrBicyclingOrTransit.toLocaleLowerCase();
        break;
      default:
        metric = 'imperial';
        mode = 'driving';
    }
    console.log(`Calculating hotel distances from: ${hotelDestination} to ${hotelAddresses}`);
    const hotelDistances = await poly.google.maps.distanceToHotels(env.inject('google.appKey'), metric, hotelAddresses, hotelDestination, twoLetterLanguageCode, mode);
    console.log(hotelDistances);
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
    await assignDistanceToHotels();

    // print all hotels found with distances
    console.table(hotels.hotels);
    const dis = (minDistanceToHotel <= 0) ? minDistance : minDistanceToHotel;
    console.log(`Filtering hotels that are less than ${minDistanceToHotel} away`);
    const findClosestHotels = (): Hotels=> {
      const result = hotels.hotels.filter(hotel =>
          (hotel.distance <= dis && hotel.distance >= 0)
      );
      if (result.length===0) throw new Error('Did not find any hotel nearby your destination');
      return { 'hotels': result };
    };
    return findClosestHotels();

  } catch (e: any) {
    if ('response' in e) {
      return e.response.data;
    } else {
      return { error: `${e}`};
    }
  }
}

// const run = async()  => {
//   const res = await poly.ohip.aiGuest.searchHotelsByLocation('Buckingham Palace, London','5','km','walking','en');
//   console.log(res);
// };

// run();
