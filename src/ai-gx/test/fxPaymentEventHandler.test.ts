import poly, { polyCustom } from 'polyapi';
import { paymentEventServerHandler } from '../fxPaymentEventHandler';

jest.mock('polyapi', () => ({
  ohip: {
    aiGuest: {
      paymentEventsCache: jest.fn()
    }
  },
  // Use a writable property (number) so the implementation can assign 200/500
  polyCustom: {
    responseStatusCode: 0
  }
}));

describe('fxPaymentEventHandler', () => {
  it('handles payment events and caches them', async () => {
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

    await paymentEventServerHandler(mockPaymentEvent);

    expect(polyCustom.responseStatusCode).toBe(200);
    expect((poly.ohip.aiGuest.paymentEventsCache as jest.Mock)).toHaveBeenCalledWith(
      'mockLinkId',
      'upsert',
      mockPaymentEvent.notificationItems[0].NotificationRequestItem
    );
  });

  it('handles an exception if the payment event does not have right format', async () => {
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

    const response = await paymentEventServerHandler(mockPaymentEvent);

    expect(polyCustom.responseStatusCode).toBe(500);
    expect(response).toEqual('Error');
  });
});
