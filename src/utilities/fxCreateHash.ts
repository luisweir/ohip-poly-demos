import { createHmac } from 'crypto';

export async function createHash(hotelName: string, enterpriseId: string, chainCode: string): Promise<string> {
  try {
    // derive secret from input variables (2nd char ASCII of each)
    const codeAt = (s: string) => (s?.length >= 2 ? s.charCodeAt(1) : 0);
    const derivedSecret = [hotelName, enterpriseId, chainCode]
      .map(codeAt)
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');

    // create HMAC-SHA256 using enterpriseId, chainCode, and hotelName
    const message = `${enterpriseId}:${chainCode}:${hotelName}`;
    const hash = createHmac('sha256', derivedSecret).update(message).digest('hex');

    return hash;

  } catch (e: any) {
    console.log(e);
    return 'notfound';
  }
}

// const run = async() => {
//   const res = await createHash('mucu1ua.hospitality-api.us-ashburn-1.ocs.oc-test.com','OCR4ENT','OHIPLAB');
//   console.log(res);
// };

// run();
