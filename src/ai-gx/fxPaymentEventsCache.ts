import { vari, Ohip } from 'polyapi';

// TODO: use next line instead once Poly supports using interface imports
interface EventRecord extends Ohip.Payments.Adyen.PaymentEventHook$Callback$Event.NotificationRequestItem {}

// interface PaymentCache {
//     [key: string]: EventRecord;
// }

interface Error { error: string }

export enum OperationType {
    UPSERT = 'upsert',
    READ = 'read',
    DELETE = 'delete'
}

export async function paymentEventsCache(paymentId: string, operation: OperationType, createRecord?: EventRecord, ): Promise<EventRecord | Error | void> {
    const cache: any = await vari.ohip.paymentEventsCache.get();
    switch (operation) {
        case OperationType.UPSERT:
            if (!createRecord) {
                console.warn('Event must be provided for upsert operation.');
                return { error: 'no event payload provided'};
            }
            cache[paymentId] = createRecord;
            const upRecord = await vari.ohip.paymentEventsCache.update(cache);
            console.log("upserted record", upRecord);
            // no need to wait. can happen async. TODO: can be improved for a job that runs periodically
            deleteOlderEvents();
            return createRecord;

        case OperationType.READ:
            const readRecord = cache[paymentId];
            if (readRecord) {
                return readRecord;
            } else {
                return { error : `Record with Payment ID ${paymentId} not found.`};
            }

        case OperationType.DELETE:
            const deleteRecord = cache[paymentId];
            if (deleteRecord) {
                delete cache[paymentId];
                await vari.ohip.paymentEventsCache.update(cache);
                return;
            } else {
                return { error : `Record with Payment ID ${paymentId} not found.` };
            }

        default:
            return { error : 'Invalid operation type.' };
    }
}

// Function to delete events older than 24 hours
export async function deleteOlderEvents(olderThan: number = 24): Promise<void> {
    const cache: any = await vari.ohip.paymentEventsCache.get();
    const now = new Date();
    for (const paymentId in cache) {
        const eventDate = new Date(cache[paymentId].eventDate);
        console.log(eventDate);
        const timeDifference = now.getTime() - eventDate.getTime();
        const hoursDifference = timeDifference / (1000 * 60 * 60);
        console.log(hoursDifference,">",olderThan);
        if (hoursDifference > olderThan) {
            delete cache[paymentId];
        }
    }
    await vari.ohip.paymentEventsCache.update(cache);
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
// }

// run();