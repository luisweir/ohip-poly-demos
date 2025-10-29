import { tabi, Ohip } from 'polyapi';

// TODO: use next line instead once Poly supports using interface imports
interface EventRecord extends Ohip.Payments.Adyen.PaymentEventHook$Callback$Event.NotificationRequestItem {}

interface Error {
  error: string;
}

export enum OperationType {
  UPSERT = 'upsert',
  READ = 'read',
  DELETE = 'delete',
}

export async function paymentEventsCache( paymentId: string, operation: OperationType, createRecord?: EventRecord): Promise<EventRecord | Error | void> {
  
  // declare in outer scope so it is visible after the try/catch
  let existing: { id: string; event: EventRecord } | null = null;

  try {
    existing = await tabi.ohip.paymentEventsCache.selectOne({
      where: { linkId: { equals: paymentId } },
    });
  } catch (e) {
    console.error('Error searching for event', e);
    return { error: 'Error searching for event.' };
  }
  
  switch (operation) {
    case OperationType.UPSERT: {
      if (!createRecord) {
        console.warn('Event must be provided for upsert operation.');
        return { error: 'no event payload provided' };
      }

      const rowData: any = {
        linkId: paymentId,
        event: createRecord,
      };

      try {
        if (!existing) {
          await tabi.ohip.paymentEventsCache
            .insertOne({ data: rowData })
            .then(() => {
              console.log('✅ Successfully inserted payment event in tabi');
            })
            .catch((e: any) => {
              console.error(
                `❌ Problem inserting payment event: ${e?.response?.data?.error}: ${e?.response?.data?.message}`,
              );
            });
        } else {
          await tabi.ohip.paymentEventsCache
            .upsertOne({ data: rowData })
            .then(() => {
              console.log('✅ Successfully upserted payment event in tabi');
            })
            .catch((e: any) => {
              console.error(
                `❌ Problem upserting payment event: ${e?.response?.data?.error}: ${e?.response?.data?.message}`,
              );
            });
        }

        // Re-implemented as an schedule job
        // deleteOlderEvents().catch((e) => {
        //   console.warn('deleteOlderEvents encountered an error:', e);
        // });

        return createRecord;
      } catch (e) {
        console.error('Error during UPSERT for payment event', e);
        return { error: 'Error upserting payment event.' };
      }
    }

    case OperationType.READ: {
      try {
        if (existing) {
          return existing.event as any;
        } else {
          return { error: `Record with Payment ID ${paymentId} not found.` };
        }
      } catch (e) {
        console.error('Error reading payment event', e);
        return { error: `Record with Payment ID ${paymentId} not found.` };
      }
    }

    case OperationType.DELETE: {
      try {
        if(!existing)
          return { error: `Record with Payment ID ${paymentId} not found.` };

        // Physical delete of the payment event by linkId
        const row: any = await tabi.ohip.paymentEventsCache.deleteOne(existing.id)
        .then(() => {
          console.log('✅ Deleted payment event in tabi');
        })
        .catch((e: any) => {
          console.error(
            `❌ Problem marking payment event as deleted: ${e?.response?.data?.error}: ${e?.response?.data?.message}`,
          );
        });
        return;

      } catch (e) {
        console.error('Error deleting payment event', e);
        return { error: `Record with Payment ID ${paymentId} not found.` };
      }
    }

    default:
      return { error: 'Invalid operation type.' };
  }
}

 // Function to delete events older than x hours
export async function prunePayEvents(eventPayload: any, headersPayload: any, paramsPayload: any): Promise<void> {
  try {
    const olderThan = paramsPayload.olderThan;
    const cutoff = new Date(Date.now() - olderThan * 60 * 60 * 1000).toISOString();
    await tabi.ohip.paymentEventsCache
      .deleteMany({
        where: {
          createdAt: { lt: cutoff },
        },
      })
      .then((res) => {
        console.log(`🧹 Pruned ${res.deleted} payment events older than ${olderThan}h`);
      })
      .catch((e: any) => {
        console.error(
          `❌ Problem pruning old payment events: ${e?.response?.data?.error}: ${e?.response?.data?.message}`,
        );
      });
  } catch (e) {
    console.warn('deleteOlderEvents failed:', e);
  }
}

// async function run(){
//     const payEvent: any = {
//         'additionalData': {
//             'cardSummary': '1111',
//             'shopperCountry': 'GB',
//             'shopperIP': '86.145.197.79',
//             'hmacSignature': 'akCBVuU3lCBd5vScyNkkknzNMHVn5NgbxqNI5PKsA4A=',
//             'expiryDate': '03/2030',
//             'billingAddress.street': 'Private Drive',
//             'shopperName': '[first name=John, infix=null, last name=Doe, gender=null]',
//             'cardBin': '444433',
//             'billingAddress.city': 'Surrey',
//             'recurringProcessingModel': 'CardOnFile',
//             'paymentMethodVariant': 'visacorporatecredit',
//             'billingAddress.country': 'GB',
//             'authCode': '000661',
//             'paymentLinkId': 'PL5B5B6A418FAB0CC1',
//             'cardHolderName': 'H Potter',
//             'billingAddress.houseNumberOrName': '4',
//             'shopperEmail': 'john.doe@email.com',
//             'checkout.cardAddedBrand': 'visacorporatecredit',
//             'billingAddress.stateOrProvince': 'N/A',
//             'billingAddress.postalCode': 'GU2 1AB',
//             'issuerCountry': 'GB',
//             'shopperTelephone': '+447575666777',
//             'threeds2.cardEnrolled': 'false',
//             'paymentMethod': 'visa',
//             'shopperLocale': 'en-UK',
//             'shopperReference': 'UNIQUE00010'
//         },
//         'amount': {
//             'currency': 'USD',
//             'value': 10
//         },
//         'eventCode': 'AUTHORISATION',
//         'eventDate': '2025-10-27T11:01:13+02:00',
//         'merchantAccountCode': 'Oracle097ECOM',
//         'merchantReference': 'REF12345910',
//         'operations': [
//             'CANCEL',
//             'CAPTURE',
//             'REFUND'
//         ],
//         'paymentMethod': 'visa',
//         'pspReference': 'B239D6R7QV5X8N82',
//         'reason': '000661:1111:03/2030',
//         'success': 'true'
//     };
//     const linkId = payEvent.additionalData.paymentLinkId;
//     await paymentEventsCache(linkId, OperationType.UPSERT, payEvent);
//     const event = await paymentEventsCache(linkId, OperationType.READ);
//     console.log(event);
//     await paymentEventsCache(linkId, OperationType.DELETE);
//     await prunePayEvents({},{},{ olderThan: 0.01 });
// }

// run();