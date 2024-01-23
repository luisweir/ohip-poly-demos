import poly, { vari } from 'polyapi';

export async function getHotelId(hotelName: string): Promise<string> {
  try {
    // get environment variables
    const env = vari.ohip.envSecrets;
    // get access token
    console.log('Fetching ohip token');
    const token = await poly.ohip.utilities.getOhipToken();

    // get all hotels in the chain and let's find the one that matches the name of the hotel entered
    console.log(`Searching hotelId for '${hotelName}'`);
    const hotelsInChain = (await poly.ohip.property.getAllHotelsInChain(env.inject('ohip.hostName'), env.inject('ohip.hotelId'), env.inject('ohip.appKey'), token)).data.listOfValues.items;
    let found = false;
    let hotelId = '';
    hotelsInChain.forEach((hotel)=>{
      console.log(hotel, hotelName);
      if (hotel.name.toLowerCase()===hotelName.toLowerCase()){
        hotelId = hotel.code;
        found = true;
        console.log(`Found hotelId ${hotelId}`);
      }
    });
    if (!found) {
      throw new Error(`Could not find a hotel named '${hotelName}'`);
    }

    return hotelId;

  } catch (e: any) {
    console.log(e);
    return 'notfound';
  }
}

// const run = async() => {
//   const res = await getHotelId('ohip sandbox 1');
//   console.log(res);
// };

// run();