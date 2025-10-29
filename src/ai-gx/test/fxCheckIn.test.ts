import poly from 'polyapi';
import { vari } from 'polyapi';
import { checkInGuest } from '../fxCheckIn';

jest.mock('polyapi', () => ({
  ohip: {
    utilities: {
      getOhipToken: jest.fn(),
      getHotelId: jest.fn()
    },
    property: {
      getBusinessDate: jest.fn(),
      getReservationByConfirmationNumber: jest.fn(),
      preCheckIn: jest.fn(),
      getAvailableRooms: jest.fn(),
      assignRoom: jest.fn(),
      checkIn: jest.fn()
    }
  },
  vari: {
    ohip: {
      envSecrets: {
        inject: jest.fn()
      }
    }
  }
}));

describe('fxCheckIn edge cases', () => {
  const token = 't';
  const hotelId = 'H1';
  const confNumber = '12345';
  const businessDate = '2025-01-01';

  beforeEach(() => {
    jest.clearAllMocks();
    (vari.ohip.envSecrets.inject as jest.Mock).mockImplementation((k: string) => k);
    (poly.ohip.utilities.getOhipToken as jest.Mock).mockResolvedValue(token);
    (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue(hotelId);
    (poly.ohip.property.getBusinessDate as jest.Mock).mockResolvedValue({
      data: { hotels: [{ businessDate }] }
    });
  });

  it('errors when hotel is not found', async () => {
    (poly.ohip.utilities.getHotelId as jest.Mock).mockResolvedValue('notfound');
    const res = await checkInGuest(confNumber, 'NoHotel');
    expect((res as any).error).toContain("Error: Could not find a hotel named 'NoHotel'");
  });

  it('errors when reservation is not found', async () => {
    (poly.ohip.property.getReservationByConfirmationNumber as jest.Mock).mockResolvedValue({
      data: { reservations: { totalPages: 0 } }
    });

    const res = await checkInGuest(confNumber, 'HOG');
    expect((res as any).error).toContain(`Reservation with confirmation number ${parseInt(confNumber)} not found`);
  });

  it('errors when business date is different from arrival date', async () => {
    (poly.ohip.property.getReservationByConfirmationNumber as jest.Mock).mockResolvedValue({
      data: {
        reservations: {
          totalPages: 1,
          reservationInfo: [
            {
              reservationIdList: [{ id: '1' }],
              roomStay: {
                roomType: 'RT1',
                arrivalDate: '2025-01-02', // different to businessDate
                departureDate: '2025-01-03'
              }
            }
          ]
        }
      }
    });

    const res = await checkInGuest(confNumber, 'HOG');
    expect((res as any).error).toContain('Property not ready for online check-in');
  });

  it('errors when there are no available rooms', async () => {
    // ensure arrival date equals business date so it reaches availability lookup
    (poly.ohip.property.getReservationByConfirmationNumber as jest.Mock).mockResolvedValue({
      data: {
        reservations: {
          totalPages: 1,
          reservationInfo: [
            {
              reservationIdList: [{ id: '1' }],
              roomStay: {
                roomType: 'RT1',
                arrivalDate: businessDate,
                departureDate: '2025-01-02'
              }
            }
          ]
        }
      }
    });
    (poly.ohip.property.preCheckIn as jest.Mock).mockResolvedValue({});
    (poly.ohip.property.getAvailableRooms as jest.Mock).mockResolvedValue({
      data: { totalPages: 0 }
    });

    const res = await checkInGuest(confNumber, 'HOG');
    expect((res as any).error).toContain('Unfortunately the hotel does not currently have any rooms ready yet');
  });

  it('errors when assignRoom indicates already assigned room', async () => {
    // reach assignRoom
    (poly.ohip.property.getReservationByConfirmationNumber as jest.Mock).mockResolvedValue({
      data: {
        reservations: {
          totalPages: 1,
          reservationInfo: [
            {
              reservationIdList: [{ id: '1' }],
              roomStay: {
                roomType: 'RT1',
                arrivalDate: businessDate,
                departureDate: '2025-01-02'
              }
            }
          ]
        }
      }
    });
    (poly.ohip.property.preCheckIn as jest.Mock).mockResolvedValue({});
    (poly.ohip.property.getAvailableRooms as jest.Mock).mockResolvedValue({
      data: { totalPages: 1, hotelRoomsDetails: { room: [{ roomId: 101 }] } }
    });
    (poly.ohip.property.assignRoom as jest.Mock).mockResolvedValue({
      status: 400,
      data: { 'o:errorCode': 'FOF01290', detail: 'Already has room 101 assigned' }
    });

    const res = await checkInGuest(confNumber, 'HOG');
    expect((res as any).error).toContain('Error: The guest already has a room 101 assigned');
  });

  it('errors when assignRoom fails with other error', async () => {
    (poly.ohip.property.getReservationByConfirmationNumber as jest.Mock).mockResolvedValue({
      data: {
        reservations: {
          totalPages: 1,
          reservationInfo: [
            {
              reservationIdList: [{ id: '1' }],
              roomStay: {
                roomType: 'RT1',
                arrivalDate: businessDate,
                departureDate: '2025-01-02'
              }
            }
          ]
        }
      }
    });
    (poly.ohip.property.preCheckIn as jest.Mock).mockResolvedValue({});
    (poly.ohip.property.getAvailableRooms as jest.Mock).mockResolvedValue({
      data: { totalPages: 1, hotelRoomsDetails: { room: [{ roomId: 101 }] } }
    });
    (poly.ohip.property.assignRoom as jest.Mock).mockResolvedValue({
      status: 500,
      data: { 'o:errorCode': 'OTHER', detail: 'X' }
    });

    const res = await checkInGuest(confNumber, 'HOG');
    expect((res as any).error).toContain('Error: There was an error assigning room number 101');
  });

  it('errors when checkIn returns non-201', async () => {
    (poly.ohip.property.getReservationByConfirmationNumber as jest.Mock).mockResolvedValue({
      data: {
        reservations: {
          totalPages: 1,
          reservationInfo: [
            {
              reservationIdList: [{ id: '1' }],
              roomStay: {
                roomType: 'RT1',
                arrivalDate: businessDate,
                departureDate: '2025-01-02'
              }
            }
          ]
        }
      }
    });
    (poly.ohip.property.preCheckIn as jest.Mock).mockResolvedValue({});
    (poly.ohip.property.getAvailableRooms as jest.Mock).mockResolvedValue({
      data: { totalPages: 1, hotelRoomsDetails: { room: [{ roomId: 101 }] } }
    });
    (poly.ohip.property.assignRoom as jest.Mock).mockResolvedValue({ status: 201 });
    (poly.ohip.property.checkIn as jest.Mock).mockResolvedValue({ status: 500 });

    const res = await checkInGuest(confNumber, 'HOG');
    expect((res as any).error).toContain('Error: There was an error checking in, Please check in at front desk');
  });
});
