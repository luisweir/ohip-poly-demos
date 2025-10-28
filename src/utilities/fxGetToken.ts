import { error } from 'console';
import poly, { vari, tabi } from 'polyapi';

export const decodeJWT = (token: string) => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // add padding if needed
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
    const json = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    console.error('Error decoding token:', e);
    return null;
  }
};

export async function getOhipToken(): Promise<string> {
  // get environment variables
  const env = vari.ohip.envSecrets;
  const now = Math.floor(Date.now() / 1000);
  const refreshThreshold = 300; // 5 minutes

  // derive key/hash for token record
  const hash = await poly.ohip.utilities.createHash(
    env.inject('ohip.hostName'),
    env.inject('ohip.enterpriseId'),
    env.inject('ohip.chainCode'),
  );

  // read persisted token
  const row = await tabi.ohip.tokens.selectOne({
    where: { hashKey: { equals: hash } },
  });

  const storedToken: string = row?.token ?? '';
  let secondsLeft = -1;

  if (storedToken) {
    let decoded: any = null;
    try {
      decoded = decodeJWT(storedToken);
    } catch (e) {
      console.log(`Cached token is not a valid JWT. Will fetch a new token.`);
    }
    if (decoded?.exp && Number.isFinite(decoded.exp)) {
      const toUtc = (s: number) => new Date(s * 1000).toISOString();
      const issuedAt = Number.isFinite(decoded.iat) ? decoded.iat : undefined;
      secondsLeft = decoded.exp - now;
      console.log([
        `Issued at: ${issuedAt ? toUtc(issuedAt) : 'n/a'}`,
        `Expires at: ${toUtc(decoded.exp)}`,
        `Now:        ${toUtc(now)}`,
        `Time left:  ${(secondsLeft / 60).toFixed(2)} minutes`,
        `Threshold:  ${(refreshThreshold / 60).toFixed(0)} minutes`,
      ].join('\n'));
    } else {
      console.log(`Cached token is not a valid JWT. Will fetch a new token.`);
    }
  } else {
    console.log(`No cached token found for hash ${hash}. Will fetch a new token.`);
  }

  const needsRefresh = secondsLeft <= refreshThreshold;
  console.log('Requires refreshing?',needsRefresh);

  if (!needsRefresh) {
    return storedToken;
  }

  // fetch a new access token
  let token = (
    await poly.ohip.auth.getAccessToken(
      env.inject('ohip.hostName'),
      env.inject('ohip.appKey'),
      env.inject('ohip.enterpriseId'),
      env.inject('ohip.clientSecret'),
      env.inject('ohip.clientId'),
    )
  ).data.access_token as string;

  console.log(`Got new token ${token.slice(0,10)}...`)

  let decodedNew: any = {};
  try {
    decodedNew = decodeJWT(token) || {};
  } catch (e) {
    console.log('New token is not a valid JWT. Proceeding without decoding.');
    decodedNew = {};
  }
  const newExpiry: number = decodedNew.exp || 0;
  const newScopes: string = decodedNew.scope || '';

  // Creates a new record or updates if it already exists
  if(!row){
    console.log("Inserting new token in tabi");
    await tabi.ohip.tokens.insertOne({
      data: {
        hashKey: hash,
        hostName: env.inject('ohip.hostName'),
        enterpriseId: env.inject('ohip.enterpriseId'),
        chainCode: env.inject('ohip.chainCode'),
        scopes: newScopes,
        token,
        expiry: newExpiry,
      },
    })
    .then(()=>{console.log("✅ Successfully inserted token in tabi");})
    .catch((e)=>{
      console.error(`❌ Problem inserting token: ${e.response.data.error}: ${e.response.data.message}`);
    });
  } else {
    console.log("Updating existing token in tabi");
    await tabi.ohip.tokens.upsertOne({
      data: {
        hashKey: hash,
        hostName: env.inject('ohip.hostName'),
        enterpriseId: env.inject('ohip.enterpriseId'),
        chainCode: env.inject('ohip.chainCode'),
        scopes: newScopes,
        token,
        expiry: newExpiry,
      },
    })
    .then(()=>{console.log("✅ Successfully updated token in tabi");})
    .catch((e)=>{
      console.error(`❌ Problem updating token: ${e.response.data.error}: ${e.response.data.message}`);
    });
  }

  return token;
}

// Runner for local testing
// const run = async () => {
//   console.log('Fetching OHIP token...');
//   const token = await getOhipToken();
//   console.log('✅ Token retrieved successfully:');
//   console.log(`${token.slice(0,10)}...`);
// };

// run();
