import poly from 'polyapi';
import { vari, polyCustom } from 'polyapi';
import { searchHotelsByLocation } from './fxSearchHotelsByLocation';
import { searchHotelAvailability } from './fxSearchHotelAvailability';
import { createResWithPayLink } from './fxCreateResWithPayLink';
import { checkInGuest } from './fxCheckIn';
import { getConciergeServices, requestConciergeService } from './fxConciergeServices';
import { checkBillCharges } from './fxCheckBillCharges';
import { paymentEventsCache, deleteOlderEvents, OperationType } from './fxPaymentEventsCache';
import { paymentEventServerHandler } from './fxPaymentEventHandler';

jest.mock('polyapi', () => ({
  ohip: {
    utilities: {
      getOhipToken: jest.fn(),
      getHotelId: jest.fn()
    },
    aiGuest: {
      paymentEventsCache: jest.fn()
    },
    property: {
      searchHotelAvailability: jest.fn(),
      getHotelDetails: jest.fn(),
      getAllHotelsInChain: jest.fn(),
      getPropertyRoomTypes: jest.fn(),
      createReservationWithToken: jest.fn(),
      createReservation: jest.fn(),
      getReservationDetails: jest.fn(),
      getReservationByConfirmationNumber: jest.fn(),
      getBusinessDate: jest.fn(),
      preCheckIn: jest.fn(),
      getAvailableRooms: jest.fn(),
      assignRoom: jest.fn(),
      checkIn: jest.fn(),
      addCharges: jest.fn(),
      getFolioDetails: jest.fn(),
      getPackages: jest.fn(),
      getReservationById: jest.fn()
    },
    payments: {
      adyen: {
        getPayByLinkDetails: jest.fn(),
        createPayByLink: jest.fn()
      }
    }
  },
  polyCustom: {
    responseStatusCode: jest.fn()
  },
  google: {
    maps: {
      distanceToHotels: jest.fn()
    }
  },
  vari: {
    ohip: {
      envSettings: {
        get: jest.fn() 
      },
      envSecrets: {
        inject: jest.fn()
      },
      descriptionsForModel: {
        get: jest.fn()
      },
      conciergeLoV: {
        get: jest.fn()
      },
      paymentEventsCache: {
        get: jest.fn(),
        update: jest.fn()
      }
    }
  }
}));

describe('searchHotelsByLocation', () => {
  it('should search for hotels based on location and distance', async() => {
    const mockToken = 'mockToken';
    const mockHotelsInChain = {
      data: {
        listOfValues: {
          items: [{ name: 'Hotel1', code: 'H1', description: 'Desc1' }]
        }
      }
    };
    const mockHotelDetails = {
      data: {
        hotelConfigInfo: {
          address: {
            addressLine: ['Street 1'],
            cityName: 'City 1',
            state: 'State 1',
            country: { code: 'Country 1' }
          },
          communication: {
            webPage: { value: 'website1' },
            phoneNumber: { phoneNumber: 'phone1' }
          }
        }
      }
    };
    const mockHotelDistances = {
      data: { rows: [{ elements: [{ status: 'OK', distance: { value: 1609 } }] }] }
    };

    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(mockToken);
    (poly.ohip.property.getAllHotelsInChain as jest.Mock).mockResolvedValue(mockHotelsInChain);
    (poly.ohip.property.getHotelDetails as jest.Mock).mockResolvedValue(mockHotelDetails);
    (poly.google.maps.distanceToHotels as jest.Mock).mockResolvedValue(mockHotelDistances);
    (vari.ohip.envSecrets.inject as jest.Mock).mockReturnValue('mockToken');

    const result = await searchHotelsByLocation(
      'Test Location',
      2,
      'imperial',
      'walking',
      'en'
    );

    expect(result).toEqual({
      hotels: [
        {
          name: 'hotel1',
          hotelId: 'H1',
          description: 'Desc1',
          street: 'Street 1',
          city: 'City 1',
          state: 'State 1',
          country: 'Country 1',
          website: 'website1',
          phone: 'phone1',
          distance: 1
        }
      ]
    });
    expect(poly.ohip.utilities.getOhipToken).toHaveBeenCalled();
    expect(poly.ohip.property.getAllHotelsInChain).toHaveBeenCalled();
    expect(poly.ohip.property.getHotelDetails).toHaveBeenCalled();
    expect(poly.google.maps.distanceToHotels).toHaveBeenCalled();
  });
});

describe('searchHotelAvailability', () => {
  it('should search for hotel availability based on given parameters', async() => {
    // Mock data
    const mockToken = 'mockToken';
    const mockHotelId = 'H1';
    const mockAvailability = {
      status: 200,
      data: {
        hotelAvailability: [
          {
            roomStays: [
              {
                roomRates: [
                  {
                    roomType: 'RT1',
                    ratePlanCode: 'RPC1',
                    total: {
                      currencyCode: 'USD',
                      amountBeforeTax: 100
                    },
                    numberOfUnits: 2
                  }
                ]
              }
            ]
          }
        ]
      }
    };
    const mockRoomTypes = {
      data: {
        listOfValues: {
          items: [{ code: 'RT1', name: 'RoomType1' }]
        }
      }
    };
    const mockDescriptions = ['mockDescription'];

    // Expected result
    const expectedResult = {
      descriptionForModel: mockDescriptions,
      availability: [
        {
          roomName: 'RoomType1',
          ratePlanCode: 'RPC1',
          roomTypeCode: 'RT1',
          currencyCode: 'USD',
          amountBeforeTax: 100,
          roomsAvailable: 2,
          roomRateIncludes: [] // Assuming no packages included
        }
      ]
    };

    // Mock function implementations
    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(mockToken);
    (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue(mockHotelId);
    (poly.ohip.property.searchHotelAvailability as jest.Mock).mockResolvedValue(
      mockAvailability
    );
    (poly.ohip.property.getPropertyRoomTypes as jest.Mock).mockResolvedValue(
      mockRoomTypes
    );
    (vari.ohip.envSecrets.inject as jest.Mock).mockReturnValue('mockValue');
    (vari.ohip.descriptionsForModel.get as jest.Mock).mockResolvedValue({
      searchHotelAvailability: mockDescriptions
    });

    // Perform the test
    const result = await searchHotelAvailability(
      'Test Hotel',
      2,
      1,
      1,
      '2023-01-01',
      '2023-01-02'
    );

    // Assertions
    expect(result).toEqual(expectedResult);

    // Verify that the mock functions were called
    expect(poly.ohip.utilities.getOhipToken).toHaveBeenCalled();
    expect(poly.ohip.utilities.getHotelId).toHaveBeenCalledWith('Test Hotel');
    expect(poly.ohip.property.searchHotelAvailability).toHaveBeenCalled();
    expect(poly.ohip.property.getPropertyRoomTypes).toHaveBeenCalled();
  });
});

describe('createResWithPayLink', () => {
  it('should successfully create a reservation with a payment link', async() => {
    // Mock data
    const mockToken = 'mockToken';
    const mockHotelId = 'mockHotelId';
    const mockPayLinkDetails = {
      status: 200,
      data: {
        id: 'mockLinkId',
        status: 'completed',
        shopperReference: 'mockShopperReference',
        billingAddress: {
          houseNumberOrName: '123',
          street: 'Mock Street',
          city: 'Mock City',
          postalCode: '12345',
          stateOrProvince: 'Mock State',
          country: 'Mock Country'
        }
      }
    };
    const mockPaymentToken = {
      data: {
        storedPaymentMethods: [
          {
            id: 'mockPaymentMethodId',
            type: 'card',
            brand: 'Visa',
            holderName: 'John Doe',
            lastFour: '1234',
            expiryYear: '2025',
            expiryMonth: '12'
          }
        ]
      }
    };
    const mockReservationDetails = {
      data: {
        reservations: {
          reservation: [
            {
              reservationIdList: [
                { id: '123', type: 'internal' },
                { id: 'mockConfirmationNumber', type: 'external' }
              ]
            }
          ]
        }
      }
    };
    const mockEnvSettings = {
      opi: true
    };

    const mockedPayEvent = {
      additionalData: {
          cardSummary: '1234',
          shopperCountry: 'Mock Country',
          shopperIP: '86.145.197.79',
          hmacSignature: 'MockSignature',
          expiryDate: '12/2025',
          'billingAddress.street': 'Mock Street',
          shopperName: '[first name=John, infix=null, last name=Doe, gender=null]',
          cardBin: '444433',
          'billingAddress.city': 'Mock City',
          recurringProcessingModel: 'CardOnFile',
          paymentMethodVariant: 'visacorporatecredit',
          'billingAddress.country': 'Mock Country',
          authCode: '000661',
          paymentLinkId: 'mockLinkId',
          cardHolderName: 'John Doe',
          'billingAddress.houseNumberOrName': '123',
          shopperEmail: 'john.doe@email.com',
          'checkout.cardAddedBrand': 'visacorporatecredit',
          'billingAddress.stateOrProvince': 'Mock State',
          'billingAddress.postalCode': '12345',
          issuerCountry: 'GB',
          shopperTelephone: '+447575666777',
          'threeds2.cardEnrolled': 'false',
          paymentMethod: 'visa',
          shopperLocale: 'en-UK',
          shopperReference: 'UNIQUE00010'
      },
      amount: {
          currency: 'USD',
          value: 10
      },
      eventCode: 'AUTHORISATION',
      eventDate: '2023-09-05T20:01:13+02:00',
      merchantAccountCode: 'Oracle097ECOM',
      merchantReference: 'mockShopperReference',
      operations: [
          'CANCEL',
          'CAPTURE',
          'REFUND'
      ],
      paymentMethod: 'visa',
      pspReference: 'B239D6R7QV5X8N82',
      reason: '000661:1111:03/2030',
      success: 'true'
    };

    // Mock function implementations
    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(mockToken);
    (poly.ohip.aiGuest.paymentEventsCache as jest.Mock).mockResolvedValue(mockedPayEvent);
    (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue(mockHotelId);
    (poly.ohip.payments.adyen.getPayByLinkDetails as jest.Mock).mockResolvedValue(mockPayLinkDetails);
    (poly.ohip.property.createReservationWithToken as jest.Mock).mockResolvedValue({
      status: 201,
      data: { links: [{ rel: 'self', href: '/reservations/123' }] }
    });
    (poly.ohip.property.getReservationById as jest.Mock).mockResolvedValue(mockReservationDetails);
    (vari.ohip.envSettings.get as jest.Mock).mockResolvedValue(mockEnvSettings);
    (vari.ohip.envSecrets.inject as jest.Mock).mockReturnValue('mockInjectedValue');

    // Perform the test
    const dateFrom = "2025-01-01";
    const dateTo = "2025-01-02";
    const result = await createResWithPayLink(
      'hotelName',
      1,
      0,
      '',
      dateFrom,
      dateTo,
      1,
      'rateCode',
      'roomType',
      100,
      'US',
      'en-US',
      'USD'
    );

    // Assertions
    expect(result).toEqual({
      operaConfirmationNumber: 'mockConfirmationNumber'
    });

    // Check if mock functions were called
    expect(poly.ohip.utilities.getOhipToken).toHaveBeenCalled();
    expect(poly.ohip.utilities.getHotelId).toHaveBeenCalled();
    expect(poly.ohip.aiGuest.paymentEventsCache).toHaveBeenCalled();
    expect(poly.ohip.payments.adyen.getPayByLinkDetails).toHaveBeenCalled();
    expect(poly.ohip.property.createReservationWithToken).toHaveBeenCalled();
    expect(poly.ohip.property.getReservationById).toHaveBeenCalled();
    expect(vari.ohip.envSettings.get).toHaveBeenCalled();
  });

  it('should successfully create a reservation without a payment token when opi is false', async() => {
    // Mock data for opi: false
    const mockEnvSettingsOpiFalse = {
      opi: false
    };

    (poly.ohip.property.createReservation as jest.Mock).mockResolvedValue({
      status: 201,
      data: { links: [{ rel: 'self', href: '/reservations/123' }] }
    });
    (vari.ohip.envSettings.get as jest.Mock).mockResolvedValue(mockEnvSettingsOpiFalse);

    // Perform the test
    const dateFrom = "2025-01-01";
    const dateTo = "2025-01-02";
    const result = await createResWithPayLink(
      'hotelName',
      1,
      0,
      '',
      dateFrom,
      dateTo,
      1,
      'rateCode',
      'roomType',
      100,
      'US',
      'en-US',
      'USD'
    );

    // Assertions
    expect(result).toEqual({
      operaConfirmationNumber: 'mockConfirmationNumber'
    });

    // Check if mock functions were called
    expect(poly.ohip.utilities.getOhipToken).toHaveBeenCalled();
    expect(poly.ohip.utilities.getHotelId).toHaveBeenCalled();
    expect(poly.ohip.payments.adyen.getPayByLinkDetails).toHaveBeenCalled();
    expect(poly.ohip.property.createReservation).toHaveBeenCalled(); // This should be called when opi is false
    expect(poly.ohip.property.getReservationById).toHaveBeenCalled();
    expect(vari.ohip.envSettings.get).toHaveBeenCalled();
  });
});

describe('checkInGuest', () => {
  it('should successfully check in a guest', async() => {
    // Mock data
    const mockToken = 'mockToken';
    const mockHotelId = 'H1';
    const mockBusinessDate = '2023-01-01';
    const mockArrivalDate = '2023-01-01';
    const mockRoomType = 'RT1';
    const mockResId = 1;
    const mockRoomId = 101;

    // Mock function implementations
    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(mockToken);
    (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue(mockHotelId);
    (poly.ohip.property.getBusinessDate as jest.Mock).mockResolvedValue({ data: { hotels: [{ businessDate: mockBusinessDate }] } });
    (poly.ohip.property.getReservationByConfirmationNumber as jest.Mock).mockResolvedValue({
      data: {
        reservations: {
          totalPages: 1,
          reservationInfo: [
            {
              reservationIdList: [{ id: mockResId.toString() }],
              roomStay: {
                roomType: mockRoomType,
                arrivalDate: mockArrivalDate
              }
            }
          ]
        }
      }
    });
    (poly.ohip.property.getAvailableRooms as jest.Mock).mockResolvedValue({
      data: {
        totalPages: 1,
        hotelRoomsDetails: {
          room: [
            { roomId: mockRoomId }
          ]
        }
      }
    });
    (poly.ohip.property.assignRoom as jest.Mock).mockResolvedValue({ status: 201 });
    (poly.ohip.property.checkIn as jest.Mock).mockResolvedValue({ status: 201 });
    (poly.ohip.property.preCheckIn as jest.Mock).mockResolvedValue({});
    (vari.ohip.envSecrets.inject as jest.Mock).mockReturnValue('mockInjectedValue');

    const guestArrivalTime = "2025-01-01 16:00:00";
    const result = await checkInGuest('12345', 'Test Hotel', guestArrivalTime);

    // Assertions
    expect(result).toEqual({
      guestCheckedIn: true,
      roomNumber: mockRoomId
    });

    // Check if mock functions were called
    expect(poly.ohip.utilities.getOhipToken).toHaveBeenCalled();
    expect(poly.ohip.utilities.getHotelId).toHaveBeenCalledWith('Test Hotel');
    expect(poly.ohip.property.getBusinessDate).toHaveBeenCalled();
    expect(poly.ohip.property.getReservationByConfirmationNumber).toHaveBeenCalled();
    expect(poly.ohip.property.preCheckIn).toHaveBeenCalled();
    expect(poly.ohip.property.getAvailableRooms).toHaveBeenCalled();
    expect(poly.ohip.property.assignRoom).toHaveBeenCalled();
    expect(poly.ohip.property.checkIn).toHaveBeenCalled();
  });

  // You can add more test cases to handle error scenarios
});

describe('getConciergeServices', () => {
  it('should return a list of concierge services', async() => {
    const hotelName = 'Test Hotel';
    const dateFrom = '2025-01-01';
    const dateTo = '2025-01-02';
    const adults = 2;
    const children = 0;

    const mockToken = 'mockToken';
    const mockHotelId = 'H1';

    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(mockToken);
    (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue(mockHotelId);

    const getPackagesResponse = {
      data: {
        packageCodesList: {
          packageCodes: [
            {
              packageCodeInfo: [
                {
                  code: 'Service1',
                  header: {
                    primaryDetails: {
                      shortDescription: 'Description1'
                    },
                    transactionDetails: {
                      currency: 'USD',
                      packagePostingRules: { transactionCode: { code: '1001' } }
                    },
                    postingAttributes: {
                      sellSeparate: true,
                      calculatedPrice: 10
                    }
                  }
                },
                {
                  code: 'GroupPkg',
                  group: true,
                  header: {
                    primaryDetails: { shortDescription: 'ShouldSkip' },
                    transactionDetails: {
                      currency: 'USD',
                      packagePostingRules: { transactionCode: { code: '1002' } }
                    },
                    postingAttributes: { sellSeparate: true, calculatedPrice: 20 }
                  }
                }
              ]
            }
          ]
        }
      }
    };

    (poly.ohip.property.getPackages as jest.Mock).mockResolvedValue(getPackagesResponse);
    (vari.ohip.envSecrets.inject as jest.Mock).mockImplementation((key: string) => key);

    const result = await getConciergeServices(hotelName, dateFrom, dateTo, adults, children);

    expect(result).toEqual({
      ConciergeServiceNames: {
        Service1: {
          Description: 'Description1',
          PackageAmount: 10,
          CurrencyCode: 'USD',
          TransactionCode: 1001
        }
      }
    });
    expect(poly.ohip.property.getPackages).toHaveBeenCalled();
  });
});

describe('requestConciergeService', () => {
  it('should successfully request a concierge service', async() => {
    // Mock data
    const mockToken = 'mockToken';
    const mockHotelId = 'mockHotelId';
    const dateFrom = '2025-01-01';
    const dateTo = '2025-01-02';
    const adults = 2;
    const children = 0;

    const mockReservation = {
      data: {
        reservations: {
          totalPages: 1,
          reservationInfo: [
            {
              reservationIdList: [
                { id: '1' }
              ]
            }
          ]
        }
      }
    };

    // Mock function implementations
    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(mockToken);
    (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue(mockHotelId);
    (poly.ohip.property.getReservationByConfirmationNumber as jest.Mock).mockResolvedValue(mockReservation);
    (poly.ohip.property.addCharges as jest.Mock).mockResolvedValue({ status: 201 });
    (vari.ohip.envSecrets.inject as jest.Mock).mockImplementation((key: string) => key);

    const getPackagesResponse = {
      data: {
        packageCodesList: {
          packageCodes: [
            {
              packageCodeInfo: [
                {
                  code: 'Service1',
                  header: {
                    primaryDetails: { shortDescription: 'Description1' },
                    transactionDetails: {
                      currency: 'USD',
                      packagePostingRules: { transactionCode: { code: '1001' } }
                    },
                    postingAttributes: { sellSeparate: true, calculatedPrice: 10 }
                  }
                }
              ]
            }
          ]
        }
      }
    };
    (poly.ohip.property.getPackages as jest.Mock).mockResolvedValue(getPackagesResponse);

    const result = await requestConciergeService(
      '12345',
      'Test Hotel',
      'Service1',
      dateFrom,
      dateTo,
      adults,
      children
    );

    expect(result).toEqual({ successful: true });
    expect(poly.ohip.utilities.getOhipToken).toHaveBeenCalled();
    expect(poly.ohip.utilities.getHotelId).toHaveBeenCalledWith('Test Hotel');
    expect(poly.ohip.property.getReservationByConfirmationNumber).toHaveBeenCalledWith(
      expect.any(String),
      mockHotelId,
      parseInt('12345'),
      expect.any(String),
      mockToken
    );
    expect(poly.ohip.property.addCharges).toHaveBeenCalledTimes(2); // nights(1) * persons(2)
    expect(poly.ohip.property.getPackages).toHaveBeenCalled();
  });
});

describe('checkBillCharges', () => {
  it('should successfully return account details and charges', async() => {
    // Mock data
    const mockToken = 'mockToken';
    const mockHotelId = 'mockHotelId';
    const mockResId = 1;
    const mockFolioDetails = {
      status: 200,
      data: {
        reservationFolioInformation: {
          reservationInfo: {
            roomStay: {
              balance: {
                amount: 0,
                currencyCode: 'USD'
              }
            }
          },
          folioWindows: [
            {
              revenue: { amount: 181, currencyCode: 'USD' },
              emptyFolio: false,
              folios: [
                {
                  postings: [
                    {
                      transactionCode: '9000',
                      transactionNo: 278484,
                      postedAmount: {
                        amount: 181,
                        currencyCode: 'USD'
                      },
                      postingTime: { time: '2023-07-25 05:48:09.0' }
                    },
                    {
                      transactionCode: '9980',
                      transactionNo: 277520,
                      postedAmount: {
                        amount: 75,
                        currencyCode: 'USD'
                      },
                      postingTime: { time: '2023-07-23 06:08:11.0' }
                    },
                    {
                      transactionCode: '5010',
                      transactionNo: 278248,
                      postedAmount: {
                        amount: 22,
                        currencyCode: 'USD'
                      },
                      postingTime: { time: '2023-07-23 05:34:51.0' }
                    }
                    // ... Add more postings as needed
                  ]
                }
              ]
            }
            // ... Add more folioWindows as needed
          ]
        },
          trxCodesInfo: [
            {
              transactionCode: '9000',
              description: 'Cash'
            },
            {
              transactionCode: '9980',
              description: 'Accommodation Wrapper'
            },
            {
              transactionCode: '5010',
              description: 'Tickets'
            }
            // ... Add more trxCodesInfo as needed
          ]
      }
    };
    
    
    // Mock function implementations
    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(mockToken);
    (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue(mockHotelId);
    (poly.ohip.property.getReservationByConfirmationNumber as jest.Mock).mockResolvedValue({
      data: {
        reservations: {
          totalPages: 1,
          reservationInfo: [
            {
              reservationIdList: [{ id: mockResId.toString() }]
            }
          ]
        }
      }
    });
    (poly.ohip.property.getFolioDetails as jest.Mock).mockResolvedValue(mockFolioDetails);
    (vari.ohip.envSecrets.inject as jest.Mock).mockReturnValue('mockInjectedValue');

    // Perform the test
    const result = await checkBillCharges('12345', 'Test Hotel');

    // Expected Result
    const expectedResult = {
      balance: 0,  // The balance amount in mockFolioDetails is 0
      currency: 'USD',  // The currency code in mockFolioDetails is 'USD'
      charges: [
        {
          transaction: 'Cash',
          transactionNumber: 278484,
          transactionAmount: 181,
          transactionCurrency: 'USD',
          transactionTime: '2023-07-25 05:48:09.0'
        },
        {
          transaction: 'Accommodation Wrapper',
          transactionNumber: 277520,
          transactionAmount: 75,
          transactionCurrency: 'USD',
          transactionTime: '2023-07-23 06:08:11.0'
        },
        {
          transaction: 'Tickets',
          transactionNumber: 278248,
          transactionAmount: 22,
          transactionCurrency: 'USD',
          transactionTime: '2023-07-23 05:34:51.0'
        }
      ]
    };
    
    // Assertions
    expect(result).toEqual(expectedResult);

    // Check if mock functions were called
    expect(poly.ohip.utilities.getOhipToken).toHaveBeenCalled();
    expect(poly.ohip.utilities.getHotelId).toHaveBeenCalledWith('Test Hotel');
    expect(poly.ohip.property.getReservationByConfirmationNumber).toHaveBeenCalled();
    expect(poly.ohip.property.getFolioDetails).toHaveBeenCalled();
  });

});

describe('paymentEventsCache', () => {
  // Common mock data
  let mockEventRecord: any;
  let mockCache: any;
  const currentDate = new Date();
  const pastDate = new Date();
  pastDate.setHours(pastDate.getHours() - 25);

  // Set up common mocks and data before each test
  beforeEach(() => {
    mockEventRecord = {
      additionalData: {
        cardSummary: '1111',
        shopperCountry: 'GB'
      },
      eventDate: '2023-09-05T20:01:13+02:00'
    };
    mockCache = {
      paymentId1: { ...mockEventRecord, eventDate: currentDate.toISOString() },
      paymentId2: { ...mockEventRecord, eventDate: currentDate.toISOString() },
      paymentId3: { ...mockEventRecord, eventDate: pastDate.toISOString()},
      paymentId4: { ...mockEventRecord, eventDate: pastDate.toISOString()}
    };
    (vari.ohip.paymentEventsCache.get as jest.Mock).mockResolvedValue(mockCache);
    (vari.ohip.paymentEventsCache.update as jest.Mock).mockResolvedValue(mockCache);
  });

  it('should upsert a payment event successfully', async() => {
    const event: any = { ...mockEventRecord, eventDate: '2023-09-05T20:02:13+02:00' };
    const result = await paymentEventsCache('paymentId5', OperationType.UPSERT, event);
    expect(result).toEqual(event);
  });

  it('should read a payment event successfully', async() => {
    const result = await paymentEventsCache('paymentId1', OperationType.READ);
    expect(result).toEqual(mockCache['paymentId1']);
  });

  it('should delete a payment event successfully', async() => {
    await paymentEventsCache('paymentId2', OperationType.DELETE);
    expect(vari.ohip.paymentEventsCache.update).toHaveBeenCalled;
  });

  it('should delete events older than 24 hours', async() => {
    const currentEvents = {
      paymentId1: { ...mockEventRecord, eventDate: currentDate.toISOString() },
      paymentId2: { ...mockEventRecord, eventDate: currentDate.toISOString() }
    };
    await deleteOlderEvents();
    expect(vari.ohip.paymentEventsCache.get).toHaveBeenCalled;
    expect(vari.ohip.paymentEventsCache.update).toHaveBeenCalledTimes(4); // 1 from this test 3 from before
    expect(vari.ohip.paymentEventsCache.update).toHaveBeenCalledWith(currentEvents);
  });
});

describe('paymentEventServerHandler', () => {
  it('should handle payment events and cache them', async() => {
    const mockPaymentEvent: any = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
              additionalData: {
                paymentLinkId: 'mockLinkId'
              }
          }
        }
      ]
    };
    polyCustom.responseStatusCode as unknown as jest.Mock;
    poly.ohip.aiGuest.paymentEventsCache as jest.Mock;
    const response = await paymentEventServerHandler(mockPaymentEvent);
    expect(polyCustom.responseStatusCode).toBe(200);
    expect(poly.ohip.aiGuest.paymentEventsCache).toHaveBeenCalledWith('mockLinkId', 'upsert', mockPaymentEvent.notificationItems[0].NotificationRequestItem);
  });

  it('should handle an exception if the payment event does not have right format', async() => {
    const mockPaymentEvent: any = {
      someName: [
        {
          someMessage: {
              someData: {
                data: 'data'
              }
          }
        }
      ]
    };
    polyCustom.responseStatusCode as unknown as jest.Mock;
    poly.ohip.aiGuest.paymentEventsCache as jest.Mock;
    const response = await paymentEventServerHandler(mockPaymentEvent);
    expect(polyCustom.responseStatusCode).toBe(500);
    expect(poly.ohip.aiGuest.paymentEventsCache).toThrowError;
    expect(response).toEqual('Error');
  });
});
