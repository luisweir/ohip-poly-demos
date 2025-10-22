import poly, { vari } from 'polyapi';

export const decodeJWT = (token: string) => {
  try {
    const base64Url = token.split('.')[1]; // Get payload
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error decoding token:', e);
    return null;
  }
};

export async function getOhipToken(): Promise<string> {
  try {
    // get environment variables
    const env = vari.ohip.envSecrets;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const thresholdSeconds = 300; // 5 minutes before expiration
    const storedToken = await vari.ohip.token.get();
    let expirationTimestamp = 0;
    let exp = 0;

    try {
      const decodedToken: any = decodeJWT(storedToken);
      expirationTimestamp = decodedToken.exp;
      exp = expirationTimestamp - currentTimestamp;
      console.log(`Token has ${(exp/60).toFixed(2)} minutes remaining. If less or equal to ${thresholdSeconds/60} will fetch new token`);
    } catch {
        // whatever was stored wasn't a token so new token will be fetched
        console.log(`Stored token = '${storedToken}' isn't a valid JWT. Will fetch a new token`);
    }

    if (exp <= thresholdSeconds) {
      // get access token
      const token = (await poly.ohip.auth.getAccessToken(
        env.inject('ohip.hostName'),
        env.inject('ohip.appKey'),
        env.inject('ohip.clientSecret'),
        env.inject('ohip.clientId'),
        {
          Username: env.inject('ohip.username'),
          Password: env.inject('ohip.password')
        }
      )).data.access_token;
      await vari.ohip.token.update(token);
      return token;
    } else {
      return storedToken;
    }

  } catch (e: any) {
    if ('response' in e) {
      return e.response.data;
    } else {
      return e;
    }
  }
}

// const run = async()  => {
//   const res = await getOhipToken();
//   console.log(res);
// };

// run();
