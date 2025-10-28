import poly, { vari, Ohip } from 'polyapi';

interface Error { error: string }

//TODO: this should not be required. Bug needs fixing so complex interfaces from external files are maintained in custom functions
type EventRecord = Ohip.Payments.Adyen.PaymentEventHook$Callback$Event.NotificationRequestItem;

type ConfirmationNumber= {
  operaConfirmationNumber: string;
};

type ChildrenAges = {
  age: number;
}

type PaymentLink = {
  messageToUser: string;
  instructionsForModel: string;
  linkId: string;
  url: string;
};

// needed to match Adyen's card brands with OPERA's card types. TO-DO should really be a vari
const replaceCreditCardNames = (input: string): string => {
  const replacements: Record<string, string> = {
    visa: 'VA',
    mastercard: 'MC',
    amex: 'AX',
    diners: 'DS'
  };
  const regex = new RegExp(Object.keys(replacements).join('|'), 'gi');
  return input.replace(regex, match => replacements[match.toLowerCase()] || match);
};

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function createResWithPayLink(
  hotelName: string,
  numberOfAdults: number,
  numberOfChildren: number,
  commaSeparatedChildrenAges: string,
  dateFrom: string,
  dateTo: string,
  numberOfRooms: number,
  ratePlanCode: string,
  roomTypeCode: string,
  AmountBeforeTax: number,
  browserCountryCode: string,
  browserLocale: string,
  countryCodeCurrency: string,
  linkId?: string,
): Promise<ConfirmationNumber | PaymentLink | Error> {
  try {
    // get environment variables
    const env = vari.ohip.envSecrets;
    // get access token
    console.log('Fetching ohip token');
    const token = await poly.ohip.utilities.getOhipToken();

    // validate date format YYYY-MM-DD
    const isYYYYMMDD = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    if (!isYYYYMMDD(dateFrom) || !isYYYYMMDD(dateTo)) {
      throw new Error('dateFrom and dateTo must be strings in format YYYY-MM-DD');
    }

    // prepare children ages and if not sent correctly throw error
    const rawAges = commaSeparatedChildrenAges.split(',');
    const childrenAges: ChildrenAges[] = [];
    if (numberOfChildren>0){
      if (numberOfChildren !== rawAges.length){
        throw new Error('Make sure ages are entered for all children as comma separated values');
      } else {
        rawAges.forEach((age) => {
          childrenAges.push({'age': parseInt(age)});
        });
      }
    }
    
    // verify that a pay by link has been generated including guest details
    console.log(`Verifying if payment link ${linkId} exists or if it has been completed`);
    const getPayLinkDetails = await poly.ohip.payments.adyen.getPayByLinkDetails(env.inject('adyen.hostName'),(linkId) ? linkId : '', env.inject('adyen.appKey'));
    // const linkMessage =  `Please click on the provided URL to securely provide guest and payment details and then resubmit the reservation. Your card will be charged with 0.10 ${countryCodeCurrency} for authorization purposes. By entering the details on the provided link you are given us concent to store your payment details for later processing during hotel check out`;

    const linkMessage = {
      messageToUser: `Open the secure link below to enter guest and payment details, then return here to tell me you've completed it. We will not complete the booking at this step. A small authorisation of 0.10 ${countryCodeCurrency} will be placed on your card. By submitting the form you give consent for us to store your payment details for processing at hotel check out.`,
      instructionsForModel: `Do not consider the booking as complete. Wait for the user to confirm they have completed the payment link step (for example, by saying "done", "completed", "finished", or any equivalent confirmation). When they do, attempt the booking again and include the provided linkId so the payment details are linked to the reservation. Keep the same hotel and room selection unless the user changes them.`
    };

    if (getPayLinkDetails.status !== 200) {
      console.log('Payment link does not exist. Generating a new one');
      const uniqueRef = generateUUID();
      const createLink = await poly.ohip.payments.adyen.createPayByLink(
        env.inject('adyen.hostName'),
        env.inject('adyen.appKey'),
        {
          PaymentReference: uniqueRef,
          PaymentAmount: 10, // this is 0.10, it's just for payment authorization
          CurrencyCode: countryCodeCurrency,
          PurchaseDescription: `Booking details: adults: ${numberOfAdults}, children: ${numberOfChildren}, from: ${dateFrom}, to: ${dateTo}, rooms: ${numberOfRooms}, rate code: ${ratePlanCode}, room type: ${roomTypeCode}`,
          CountryCode: browserCountryCode,
          'Adyen-MerchantAccount': 'Oracle097ECOM',
          Locale: browserLocale,
          'Adyen-ShopperReference': 'not_provided' // using this value mandatory for Adyen to generate an OPI token
        }
      );
      if (createLink.status === 201) {
        return {
          ...linkMessage,
          linkId: createLink.data.id,
          url: createLink.data.url
        };
      } else {
        const error: any = createLink;
        throw new Error(`Error when generating pay by link: "${error.data.message}"`);
      }
    } else if (getPayLinkDetails.data.status !== 'completed') {
      console.log('Payment link exists but not completed. Returning again');
      return {
        ...linkMessage,
        linkId: getPayLinkDetails.data.id,
        url: getPayLinkDetails.data.url
      };
    }

    // get all hotels in the chain and let's find the one that matches the name of the hotel entered
    console.log(`Searching hotelId for hotelName '${hotelName}'`);
    const hotelId = await poly.ohip.utilities.getHotelId(hotelName);
    if (hotelId === 'notfound') {
      throw new Error(`Could not find a hotel named '${hotelName}'`);
    }

    console.log('Fetching cached payment event');
    // TODO: as per above, should not really need type EventRecord;
    const eventRecord: EventRecord = await poly.ohip.aiGuest.paymentEventsCache((linkId) ? linkId : '', 'read');
    if ('error' in eventRecord) {
      throw new Error(`Could not find details for linkId '${linkId}'`);
    }
    
    let confNumber = '';
    let resId = '';
    const guestName = eventRecord.additionalData.shopperName.match(/first name=(.*?),.*?last name=(.*?),/);
    const opi = (await vari.ohip.envSettings.get()).opi;
    console.log(`is OPI enabled? ${opi}`);

    if ((await vari.ohip.envSettings.get()).opi === true) {
      console.log('OPI is enabled, creating reservation with payment token');
      // prep the body of the reservation
      const resBody =  {
        AmountBeforeTax: AmountBeforeTax,
        CurrencyCode: countryCodeCurrency,
        DateFrom: dateFrom,
        DateTo: dateTo,
        Adults: numberOfAdults,
        Children: numberOfChildren,
        ChildrenAges: childrenAges,
        RoomTypeCode: roomTypeCode,
        RatePlanCode: ratePlanCode,
        NumberOfUnits: numberOfRooms,
        GuestFirstName: guestName ? guestName[1] : '',
        GuestLastName: guestName ? guestName[2] : '',
        GuestHouseNameOrNumber: eventRecord.additionalData['billingAddress.houseNumberOrName'],
        GuestAddressStreet: eventRecord.additionalData['billingAddress.street'],
        GuestAddressCity: eventRecord.additionalData['billingAddress.city'],
        GuestAddressPostalCode: eventRecord.additionalData['billingAddress.postalCode'],
        GuestAddressState: eventRecord.additionalData['billingAddress.stateOrProvince'],
        GuestAddressCountry: eventRecord.additionalData['billingAddress.country'],
        GuestEmail: eventRecord.additionalData.shopperEmail,
        GuestPhoneNumber: eventRecord.additionalData.shopperTelephone,
        CardType: replaceCreditCardNames(eventRecord.additionalData.paymentMethod),
        PaymentToken: eventRecord.additionalData['opi.transToken'],
        Last4Digits: eventRecord.additionalData.cardSummary,
        'ExpiryYY-MM': `${eventRecord.additionalData.expiryDate.split('/')[1].substring(2, 4)}-${eventRecord.additionalData.expiryDate.split('/')[0]}`,
        NameOnCard: eventRecord.additionalData.cardHolderName,
        citId: '' //place holder for now
      };

      // Create reservation against property API
      console.log(resBody);
      // console.log(`executing: await poly.ohip.property.createReservation(${env.inject('ohip.hostName},${hotelId},${env.inject('ohip.appKey},token...,${JSON.stringify(resBody)})`);
      await poly.ohip.property.createReservationWithToken(
          env.inject('ohip.hostName'),
          hotelId,
          env.inject('ohip.appKey'),
          token,
          resBody
      ).then((res) => {
        if (res.status === 201) {
          const resLinks = res.data.links[0].href.split('/');
          resId =  resLinks[resLinks.length-1];
          console.log(`OPERA Confirmation Number: ${confNumber}`);
        } else {
          console.log(res);
          const error: any = res.data;
          throw new Error((error.detail) ? error.detail : JSON.stringify(error.data));
        }
      });
    } else {
      console.log('OPI is not enabled, creating reservation without payment token (hardcoded cc details)');
      // search hotel availability
      const resBody =  {
        AmountBeforeTax: AmountBeforeTax,
        CurrencyCode: countryCodeCurrency,
        DateFrom: dateFrom,
        DateTo: dateTo,
        Adults: numberOfAdults,
        Children: numberOfChildren,
        ChildrenAges: childrenAges,
        RoomTypeCode: roomTypeCode,
        RatePlanCode: ratePlanCode,
        NumberOfUnits: numberOfRooms,
        GuestFirstName: guestName ? guestName[1] : '',
        GuestLastName: guestName ? guestName[2] : '',
        GuestHouseNameOrNumber: eventRecord.additionalData['billingAddress.houseNumberOrName'],
        GuestAddressStreet: eventRecord.additionalData['billingAddress.street'],
        GuestAddressCity: eventRecord.additionalData['billingAddress.city'],
        GuestAddressPostalCode: eventRecord.additionalData['billingAddress.postalCode'],
        GuestAddressState: eventRecord.additionalData['billingAddress.stateOrProvince'],
        GuestAddressCountry: eventRecord.additionalData['billingAddress.country'],
        GuestEmail: eventRecord.additionalData.shopperEmail
      };
      // create res without hardcoded cc details as OPI isn't enabled
      await poly.ohip.property.createReservation(
        env.inject('ohip.hostName'),
        hotelId,
        env.inject('ohip.appKey'),
        token,
        resBody
        ).then((res) => {
          if (res.status === 201) {
            const resLinks = res.data.links[0].href.split('/');
            resId =  resLinks[resLinks.length-1];
            console.log(`OPERA Confirmation Number: ${confNumber}`);
          } else {
            const error: any = res.data;
            throw new Error((error.title) ? error.title : JSON.stringify(error.data));
          }
        });
    }

    // now we get the confirmation number
    const res = await poly.ohip.property.getReservationById(env.inject('ohip.hostName'), hotelId, Number(resId), env.inject('ohip.appKey'), token);
    if (res.data.reservations.reservation[0]) {
      confNumber = res.data.reservations.reservation[0].reservationIdList[1].id;
    } else {
      console.log(`No reservation found in OPERA Cloud Property with id ${resId}`); 
    }

    return {'operaConfirmationNumber': confNumber};

  } catch (e: any) {
    if ('response' in e) {
      return e.response.data;
    } else {
      return { error: `${e}`};
    }
  }
}

// import moment from 'moment';
// const run = async() => {
//   const from: string = moment().add(0, 'days').format('YYYY-MM-DD');
//   const to: string = moment().add(1, 'days').format('YYYY-MM-DD');
//   // const linkId = generateUUID();
//   const linkId  = 'DUMMYTEXT'; // change dummy text to paylink ID for res creation
//   const res = await createResWithPayLink('ohip sandbox 01',1,0,'', from,to,1,'BARNR','ECO',175, 'US', 'en-US','USD', linkId);
//   console.log(res);
// };

// run();
