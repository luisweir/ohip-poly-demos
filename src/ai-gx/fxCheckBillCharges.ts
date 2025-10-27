import poly, { vari } from 'polyapi';

interface Error { error: string }

interface Transaction {
  transaction: string;
  transactionNumber: number;
  transactionAmount: number;
  transactionCurrency: string;
  transactionTime: string;
}

interface Account {
  balance: number;
  currency: string;
  charges: Transaction[];
}

export async function checkBillCharges(confirmationNumber: string, hotelName: string): Promise<Account | Error> {
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
    let resId = 0;

    try {
      // await poly.ohip.property.getReservationById(env.inject('ohip.hostName,hotelId,resId,env.inject('ohip.appKey,token)
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

    const charges: Transaction[] = [];
    let account: any = {}; 
    try{
      await poly.ohip.property.getFolioDetails(env.inject('ohip.hostName'), hotelId, resId, env.inject('ohip.appKey'), token)
      .then((res)=> {
        res.data;
        if (res.status !== 200) {
          throw new Error('It was not possible to retrieve the folio. Please go to the front desk');
        }
        // const postings = res.data.reservationFolioInformation.folioWindows[0].folios[0].postings;
        const balance = res.data.reservationFolioInformation.reservationInfo.roomStay.balance.amount;
        const currency = res.data.reservationFolioInformation.reservationInfo.roomStay.balance.currencyCode;
        const folioWindows = res.data.reservationFolioInformation.folioWindows;
        const trxCodes = res.data.trxCodesInfo;
        let paid = 0;
        let count = 0;
        folioWindows.forEach((folioWindow) => {
          paid = paid + folioWindow.revenue.amount;
          if (!folioWindow.emptyFolio) {
            (folioWindow.folios ?? []).forEach((folio)=>{
              folio.postings.forEach((posting)=>{
                let transaction = '';
                trxCodes.forEach((trxCode)=>{
                  if (posting.transactionCode===trxCode.transactionCode){
                    transaction = trxCode.description;
                  }
                });
                charges[count] = {
                  transaction,
                  transactionNumber: posting.transactionNo,
                  transactionAmount: posting.postedAmount.amount,
                  transactionCurrency: posting.postedAmount.currencyCode,
                  transactionTime: posting.postingTime.time
                };
                count ++;
              });
            });
          }
        });
        account = {
          balance,
          currency,
          charges
        };
      });
    } catch (e: any) {
      console.log(e);
      return { 'error' : e.message};
    }
    return account;

  } catch (e: any) {
    console.error(e);
    return e.response.data;
  }
}

// const run = async()  => {
//   const t = await checkBillCharges('1908872', 'ohip sandbox 1');
//   console.log(t);
// };

// run();
