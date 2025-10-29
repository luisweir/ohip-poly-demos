import poly, { vari } from 'polyapi';
import moment from 'moment';

interface Error { error: string }


interface Response {
  guestCheckedIn: boolean, 
  roomNumber: number
}

export async function checkInGuest(confirmationNumber: string, hotelName: string): Promise<Response | Error> {
  try {
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
    let arrivalDate: any;
    let departureDate = '';
    let roomType: any;
    let resId = 0;

    try {
      // Get Property Business date
      let businessDate = '';
      await poly.ohip.property.getBusinessDate(env.inject('ohip.hostName'), hotelId, env.inject('ohip.appKey'), token)
        .then((res) => {
          businessDate = res.data.hotels[0].businessDate;
          console.log(`Property business date: ${businessDate}`);
          // check if property business date is behind
          // const now: any = moment().format('YYYY-MM-DD');
          // if (moment(businessDate).isBefore(now)) throw new Error(`OPERA Cloud business date is behind (${businessDate})`);
        });
      await poly.ohip.property.getReservationByConfirmationNumber(env.inject('ohip.hostName'), hotelId, confNumber, env.inject('ohip.appKey'), token)
      .then(async(res) => {
        if (res.data.reservations.totalPages === 0) {
          throw new Error(`Reservation with confirmation number ${confNumber} not found`);
        }
        resId = parseInt(res.data.reservations.reservationInfo[0].reservationIdList[0].id);
        roomType = res.data.reservations.reservationInfo[0].roomStay.roomType;
        arrivalDate = res.data.reservations.reservationInfo[0].roomStay.arrivalDate;
        departureDate = res.data.reservations.reservationInfo[0].roomStay.departureDate;
        console.log(`arrival date = ${arrivalDate}`);
        if (!moment(arrivalDate, 'YYYY-MM-DD').isSame(businessDate)) {
          throw new Error(`Property not ready for online check-in (business date ${businessDate} different to arrival date ${arrivalDate})`);
        } else {
          console.log(`resId ${resId} and roomType ${roomType} identified for confirmation number ${confNumber}`);
        }
      });
    } catch (e: any) {
      return { 'error' : e.message};
    }

    // pre-check in with arrival time
    const dateTime = moment().format('YYYY-MM-DD HH:mm:ss');
    console.log(dateTime);
    await poly.ohip.property.preCheckIn(env.inject('ohip.hostName'), hotelId, resId, env.inject('ohip.appKey'),token, { 'ArrivalTime' : dateTime })
      .then(()=>{console.log(`successfully pre-checked in reservation with confirmation number ${confNumber}`);});

    // find an available room
    let randomRoomId = 0;
    console.log(`Searching available rooms from ${arrivalDate} to ${departureDate} for roomType ${roomType}`);
    try {
      await poly.ohip.property.getAvailableRooms(env.inject('ohip.hostName'), hotelId, arrivalDate, departureDate, roomType, env.inject('ohip.appKey'), token)
      .then((res)=>{
        if (res.data.totalPages === 0) {
          throw new Error('Unfortunately the hotel does not currently have any rooms ready yet. Please check-in at the front desk');
        }
        const rooms = res.data.hotelRoomsDetails.room;
        console.log(`The hotel has ${rooms.length} rooms available`);
        const randomRoom = rooms[Math.floor(Math.random() * rooms.length)];
        randomRoomId = parseInt(randomRoom.roomId);
        console.log(`Randomly picked room ${randomRoomId}`);
      });
    } catch (e: any) {
      return { 'error' : e.message};
    }

    const assignRoom = await poly.ohip.property.assignRoom(env.inject('ohip.hostName'), hotelId, resId, env.inject('ohip.appKey'), token, { 'RoomId' :  randomRoomId });
    if (assignRoom.status !== 201) {
      const e: any = assignRoom;
      console.log(JSON.stringify(e));
      if(e.data['o:errorCode']==='FOF01290') {
        throw new Error(`The guest already has a room ${parseInt(e.data.detail.match(/\d+/)?.[0] || '', 10)} assigned`);
      } else {
        throw new Error(`There was an error assigning room number ${randomRoomId}, Please check in at front desk`);
      }
    }

    // check-in the guest
    const checkIn = await poly.ohip.property.checkIn(env.inject('ohip.hostName'), hotelId, resId, env.inject('ohip.appKey'), token, { 'RoomId':  randomRoomId});
    if (checkIn.status !== 201) {
      throw new Error('There was an error checking in, Please check in at front desk');
    }

    // finally return the response
    return { 'guestCheckedIn' : true, 'roomNumber' : randomRoomId };

  } catch (e: any) {
    if ('response' in e) {
      return e.response.data;
    } else {
      return { error: `${e}`};
    }
  }
}

/*
// const run = async()  => {
//   const t = await checkInGuest('2798268', 'ohip sandbox 01');
//   console.log(t);
// };

// run();
*/
