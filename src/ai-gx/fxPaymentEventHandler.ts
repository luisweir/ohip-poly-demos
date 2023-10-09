import poly, { Ohip} from 'polyapi';

interface EventRecord extends Ohip.Payments.Adyen.PaymentEventHook$Callback$Event.Argument {}

// To be used only when running in the server. Requires a new trigger to be created.
export async function paymentEventServerHandler(paymentEvent: EventRecord){
  try {
    const linkId = paymentEvent?.notificationItems[0].NotificationRequestItem.additionalData.paymentLinkId || '';
    const event = paymentEvent?.notificationItems[0].NotificationRequestItem;
    console.log(event);
    console.log(`Received new event with pay link id: ${linkId}. Storing to cache.`, event);
    await poly.ohip.aiGuest.paymentEventsCache(linkId, 'upsert', event);
  } catch (e) {
    console.error('Error processing event',e);
  }
}

// // To be used only when running in the client. Mainly for testing purposes
// export async function paymentEventClientHandler() {
//   console.log('Waiting to receive events....');
//   poly.ohip.payments.adyen.paymentEventHook(async(paymentEvent) => {
//     try {
//       const linkId = paymentEvent?.notificationItems[0].NotificationRequestItem.additionalData.paymentLinkId || '';
//       const event = paymentEvent?.notificationItems[0].NotificationRequestItem;
//       console.log(`Received new event with pay link id: ${linkId}. Storing to cache.`, event);
//       await poly.ohip.aiGuest.paymentEventsCache(linkId, 'upsert', event);
//     } catch (e) {
//       console.error('Error processing event',e);
//     }
//   });
// }
// paymentEventClientHandler();