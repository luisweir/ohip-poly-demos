import poly, { vari } from 'polyapi';

interface Error { error: string }

interface Availability {
  roomName: string;
  ratePlanCode: string;
  roomTypeCode: string;
  currencyCode: string;
  amountBeforeTax: number;
  roomsAvailable: number;
  roomRateIncludes: string[]
}

interface ShopResult {
  descriptionForModel: string[],
  availability: Availability[];
}

export async function searchHotelAvailability(hotelName: string, adults: number, children: number, rooms: number, dateFrom: string, dateTo: string): Promise<ShopResult| Error> {
  try {
    // get environment variables
    const env = vari.ohip.envSecrets;
    // get access token
    console.log('Fetching ohip token');
    const token = await poly.ohip.utilities.getOhipToken();
    console.log(token);
    const transformedData: ShopResult = { 
      descriptionForModel: (await vari.ohip.descriptionsForModel.get()).searchHotelAvailability,
      availability: []
    };

    try{
      // get all hotels in the chain and let's find the one that matches the name of the hotel entered
      console.log(`Searching hotelId for hotelName '${hotelName}'`);
      const hotelId = await poly.ohip.utilities.getHotelId(hotelName);
      if (hotelId === 'notfound') {
        throw new Error(`Could not find a hotel named '${hotelName}'`);
      }

      // search hotel availability
      console.log(`Searching availability in ${hotelId} for ${adults} adults and ${children} children from ${dateFrom} to ${dateTo}`);
      const availability = await poly.ohip.property.searchHotelAvailability(env.inject('ohip.hostName'), hotelId, dateFrom, dateTo, children, adults, rooms, '',  env.inject('ohip.appKey'), token);
      if (availability.status !== 200) {
        const errMsg: any = availability.data;
        throw new Error(errMsg.title);
      }

      // get room name based on room type
      const roomTypes = await poly.ohip.property.getPropertyRoomTypes(env.inject('ohip.hostName'), hotelId,  env.inject('ohip.appKey'), token);
      const getRoomName = (roomTypeInput: string): string => {
          // get all room types ahead of searching availability
          let name = '';
          roomTypes.data.listOfValues.items.forEach((roomType) => {
            if (roomType.code === roomTypeInput) {
              name = roomType.name;
            }
          });
          return name;
      };

      // function to extract package details into a simple array
      const getPackages = (roomDetails: any): string[] => {
        const packages: string[] = [];
        if (roomDetails.packages) {
          roomDetails.packages.forEach((packageDetails: any) => {
            packages.push(packageDetails.description[1]);
          });
        }
        return packages;
      };
      
      // generate simple response
      const generateResponse = async() => {
        for (const roomStay of availability.data.hotelAvailability[0].roomStays) {
          for (const room of roomStay.roomRates) {
            const transformedOffer: Availability = {
              roomName: await getRoomName(room.roomType),
              ratePlanCode: room.ratePlanCode,
              roomTypeCode: room.roomType,
              currencyCode: (room.total.currencyCode) ? room.total.currencyCode : 'USD',
              amountBeforeTax: (room.total.amountBeforeTax == 0) ? (Math.floor(Math.random() * 101) + 100) : room.total.amountBeforeTax,
              roomsAvailable: room.numberOfUnits,
              roomRateIncludes: getPackages(room)
            };
            transformedData.availability.push(transformedOffer);
          }
        }
      };
      await generateResponse();

    } catch (e: any) {
      return { 'error' : e.message};
    }
    
    return transformedData;

  } catch (e) {
    return {'error': 'Error searching availability. Please try again later.'};
  }
}

// import moment from 'moment';
// const run = async()  => {
//   const from: any = moment().add(0, 'days').format(('YYYY-MM-DD'));
//   const to: any = moment().add(1, 'days').format(('YYYY-MM-DD'));
//   const t = await searchHotelAvailability('ohip sandbox 1',1,2,1,from,to);
//   console.log(t);
// };

// run();
