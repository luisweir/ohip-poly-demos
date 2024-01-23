import poly, { Ohip, polyCustom } from 'polyapi';

// Uncomment to test locally via ts-node
// poly.ohip.payments.adyen.paymentEventHook(async(event, headers, params) => {
//   paymentEventServerHandler(event);
// });

// // To be used only when running in the server. Requires a new trigger to be created.
export async function paymentEventServerHandler(paymentEvent: Ohip.Payments.Adyen.PaymentEventHook$Callback$Event.Argument | undefined): Promise<string>{
  try {
    console.log('Processing event: ', paymentEvent);
    const event = paymentEvent?.notificationItems[0].NotificationRequestItem;
    const linkId = event?.additionalData.paymentLinkId || '';
    console.log(`Received new event with pay link id: ${linkId}. Storing to cache.`, event);
    await poly.ohip.aiGuest.paymentEventsCache(linkId, 'upsert', event);
    polyCustom.responseStatusCode = 200;
    return '[accepted]';
  } catch (e) {
    console.error('Error processing event',e);
    polyCustom.responseStatusCode = 500;
    return 'Error';
  }
}
