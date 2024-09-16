import poly, { vari } from 'polyapi';
import WebSocket from 'ws';
import { Client, createClient as createWSClient, SubscribePayload } from 'graphql-ws';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';

interface RunStatus {
    run: boolean;
  }

enum bucketTypes {
    HOUR = 'HOUR',
    MINUTE = 'MINUTE',
    SECOND = 'SECOND'
}

interface IStrIndex {
    [index: string]: number;
}

export const errorCodeMappings: { [id: string] : string; } = {
    '1000': 'Normal Closure',
    '1001': 'Going Away',
    '1002': 'Protocol Error',
    '1003': 'Unsupported Data',
    '1004': '(For future)',
    '1005': 'No Status Received',
    '1006': 'Abnormal Closure (Refresh ?)',
    '1007': 'Invalid frame payload data',
    '1008': 'Policy Violation',
    '1009': 'Message too big',
    '1010': 'Missing Extension',
    '1011': 'Internal Error',
    '1012': 'Service Restart',
    '1013': 'Try Again Later',
    '1014': 'Bad Gateway',
    '1015': 'TLS Handshake',
    '4409': 'Too many requests'
};

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface OAuthOptions {
    // Define the properties here based on your application's requirements
}

export class GsClient {
    private static instance: GsClient | null = null;
    private activeSocket: WebSocket | null = null;
    private windowCount: number;
    private statsSummary: IStrIndex;
    private stats: IStrIndex;
    private client: Client | undefined;
    private clientId: any;
    private envSettings: any;
    private url: string;
    public offset: number;
    private started: boolean;

    private constructor() {
        this.clientId = null;
        this.url = '';
        this.offset = 0;
        this.windowCount = 0;
        this.statsSummary = {};
        this.stats = {};
        this.registerShutdownHook(); // make sure to dispose and terminate the client on shutdown
        this.started = false;
    }

    public static getInstance(): GsClient {
        if (!GsClient.instance) {
            GsClient.instance = new GsClient();
        }
        return GsClient.instance;
    }

    public registerShutdownHook(): void {
        const delay = promisify(setTimeout);
        const handleShutdown = async(signal: string) => {
            console.log(`Received ${signal} signal`);
            this.terminateClient(signal);
            await delay(2000);  // wait for 2 seconds before exiting
            await this.clearClientStatus(null, false);
            process.exit(0);
        };
        process.on('SIGINT', () => handleShutdown('SIGINT'));
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    }

    private async clearClientStatus(clientId: any, status: boolean) {
        if (this.clientId === (await vari.ohip.sclient.clientStatus.get()).clientId) {
            if (clientId === null) {
                console.log(`Shutdown detected. Setting client status to ${clientId}:${status}`);
            } else {
                console.log(`Clearing client status as ${clientId}:${status} and offset ${this.offset}`);
            }
            await vari.ohip.sclient.offset.update(this.offset);
            await vari.ohip.sclient.clientStatus.update({ clientId: clientId, connected: status });
        } else {
            console.log(`Not clearing status as client ${this.clientId} not connected`);
        }
        return;
    }

    public terminateClient(reason: string) {
        console.log(`Terminating client: ${reason}`);
        this.activeSocket?.send(`{"id":"${this.clientId}", "type":"complete"}`, (error) => {if (error) console.error(error);});
        if (this.client !== undefined) {
            this.disposeAndTerminate(this.client);
            this.printAndClearStatsIfAny();
        }
    }

    public getClient(): Client {
        console.log('Creating client');
        console.log(`Using clientId: ${this.clientId}`);
        let timedOut: any;
        return createWSClient({
            webSocketImpl: WebSocket,
            url: this.url,
            generateID: () => {
                return this.clientId;
            },
            connectionParams: async() => {
                console.log(`Starting from offset ${ (this.offset) ? this.offset : 'latest'}`);
                const token = await poly.ohip.utilities.getOhipToken();
                console.log(`Fetched token: ${token}`);
                return {
                    'Authorization': `Bearer ${token}`,
                    'x-app-key': `${this.envSettings.appKey}`
                };
            },
            shouldRetry: () => true,
            lazy: true,
            keepAlive: (this.envSettings.ping), // frequency to ping server
            on: {
                connecting: () => {
                    console.log(`Connecting to socket ${this.url}`);
                },
                connected: (socket: any) => {
                    this.activeSocket = socket;
                    vari.ohip.sclient.clientStatus.update({clientId: this.clientId, connected: true});
                    console.log('Connected to socket');
                },
                closed: async(event: any) => {
                    console.log(`Socket closed with event ${event.code} (${errorCodeMappings[event.code]}) :: ${event.reason}`);
                    await this.clearClientStatus(this.clientId, false);
                },
                ping: (received) => {
                    if (!received) // sent
                        console.log('Ping sent');
                        timedOut = setTimeout(() => {
                            if (this.activeSocket && this.activeSocket.readyState === WebSocket.OPEN) {
                                console.error('Ping timeout, refreshing connection');
                                this.startConsuming(true);
                            }
                        }, this.envSettings.ping / 2); // if pong not received within this timeframe then recreate connection
                },
                pong: (received) => {
                    if (received) {
                        console.log('Pong received');
                        clearTimeout(timedOut);
                    } // pong is received, clear connection close timeout
                },
                error: (error) => {
                    console.error(error);
                }
            }
        });
    }

    public createQuery(chainCode: string | undefined, offset?: number | null, hotelCode?: string | null, delta?: boolean): any {
        console.log(`Creating query for chainCode: ${chainCode}, offset: ${(offset !== null) ? offset : 'latest'}, hotelCode: ${hotelCode}, delta: ${delta}`);
        const query = `subscription {
                newEvent (input:{chainCode: "${chainCode}"
                    ${ (offset!==null) ? `, offset: "${offset}"` : '' }
                    ${ (hotelCode!==null) ? `, hotelCode: "${hotelCode}"` : '' }
                    ${ (delta!==null) ? `, delta: ${delta}` : '' }}){
                    metadata {
                        offset
                        uniqueEventId
                    }
                    moduleName
                    eventName
                    primaryKey
                    timestamp
                    hotelId
                    publisherId
                    actionInstanceId
                    detail {
                        elementName
                        elementType
                        elementSequence
                        elementRole
                        newValue
                        oldValue
                        scopeFrom
                        scopeTo
                    }
                }
            }`;
        return query.replace(/\s+/g, ' ').trim();
    }

    public async subscribe<T>(client: Client): Promise<any>{
        const query = this.createQuery(this.envSettings.chainCode, this.offset, this.envSettings.hotelId, this.envSettings.delta);
        const payload: SubscribePayload = {query};
        return new Promise<T>((resolve, reject) => {
            let result: any;
            console.log(`Posting ${query}`);
            if (client) {
                client.subscribe<T>(payload, {
                    next: (data) => {
                        result = data;
                        this.offset = Number(result.data.newEvent.metadata.offset) + 1;
                        this.setStat(result.data.newEvent.eventName);
                        const event = result.data;
                        console.log(`${event.newEvent.eventName}, offset ${event.newEvent.metadata.offset}, primaryKey ${event.newEvent.primaryKey}${(event.newEvent.hotelId) ? `, HotelID: ${event.newEvent.hotelId}` : ''}, Created at: ${event.newEvent.timestamp}`);
                    },
                    error: (error) => {
                        console.error('Subscription error:', error);
                        reject(error);
                    },
                    complete: async() => {
                        console.log('Connection Completed');
                        resolve(result);
                    }
                });
            }
        });
    }

    private setStat(eventName: string) {
        this.windowCount = this.windowCount + 1; 
        // total events per event type
        if (!this.statsSummary[eventName]){
            this.statsSummary[eventName] = 1;
        } else {
            this.statsSummary[eventName] = this.statsSummary[eventName] + 1;
        }
         // total events per time bucket
        if (this.envSettings.timeBucket !== undefined) {
            const now = new Date(Date.now());
            let timeBucket = '';
            switch (this.envSettings.timeBucket) {
                case bucketTypes.HOUR:
                    timeBucket = `${now.getHours()}h`;
                    break;
                case bucketTypes.MINUTE:
                    timeBucket = `${now.getHours()}h:${now.getMinutes()}m`;
                    break;
                case bucketTypes.SECOND:
                    timeBucket = `${now.getHours()}h:${now.getMinutes()}m:${now.getSeconds()}s`;
                    break;
            }
            if (!this.stats[timeBucket]){
                this.stats[timeBucket] = 1;
            } else {
                this.stats[timeBucket] = this.stats[timeBucket] + 1;
            }
        }
    }

    private printAndClearStats() {
        const seconds = Math.floor(this.envSettings.tokenExpiry/1000);
        console.log(`${this.windowCount} events processed in ${seconds} second window`);
        console.table(this.statsSummary);
        if (this.envSettings.tokenExpiry !== undefined) {
            this.stats['AVERAGE'] = Math.round(Object.values(this.stats).reduce((prev: number, curr: number) => prev + curr) / Object.values(this.stats).length);
            console.table(this.stats);
        }
        this.stats = {};
        this.statsSummary = {};
        this.windowCount = 0;
    }

    public async startConsuming(reconnect = false, reason = '') {
        this.terminateClient('Refreshing connection');
        // add delay so on:closed() has time to update client status
        await new Promise(resolve => setTimeout(resolve, 2000));
        const clientStatus = await vari.ohip.sclient.clientStatus.get();
        console.log(clientStatus);
        if ((this.clientId === clientStatus.clientId && clientStatus.connected === false) || clientStatus.clientId === null) {
            if (reconnect) {
                console.log(`Refreshing an existing connection in ${this.envSettings.delayToConnect}ms (${reason})`);
                await this.delay(this.envSettings.delayToConnect);
            } else {
                console.log('Initiating a new connection');
            }
            try {
                this.client = this.getClient();
                await this.subscribe(this.client);
            } catch (error) {
                console.error(error);
                console.log(`Retrying in ${this.envSettings.delayToConnect} milliseconds`);
                setTimeout(() => this.startConsuming(true), this.envSettings.delayToConnect);
            }
        } else {
            console.log(`Client ${this.clientId} is trying to connect however ${clientStatus.clientId} is already connected`);
            return null;
        }
    }

    public async start(envSettings: any, offset: number, url: string) {
        if (this.started) {
            console.log('Client has already started.');
            return;
        }
        this.clientId = uuidv4();
        if ((await vari.ohip.sclient.clientStatus.get()).clientId === null)
            await vari.ohip.sclient.clientStatus.update({clientId: this.clientId, connected: false});
        // quick delay to avoid conflict due to initial racing condition
        await new Promise(resolve => setTimeout(resolve, 3000));
        this.client = undefined;
        this.envSettings = envSettings;
        this.offset = offset;
        this.url = url;
        this.started = true;
        setImmediate(() => this.startConsuming(false));
        setInterval(() => {this.startConsuming(true);}, this.envSettings.tokenExpiry);
    }

    private async disposeAndTerminate(client: Client) {
        await client.dispose();
        this.activeSocket?.terminate();
    }

    private printAndClearStatsIfAny() {
        if (this.windowCount > 0) {
            this.printAndClearStats();
        }
    }

    private delay(ms: number) {
        return new Promise( resolve => setTimeout(resolve, ms) );
    }

    public async generateHash(key: string): Promise<string> {
        const keyUint8 = new TextEncoder().encode(key);
        const hashBuffer = await crypto.subtle.digest('SHA-256', keyUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }
}

// main function
export async function sclient(): Promise<{offset: number, status: vari.Ohip.Sclient.ClientStatus.ValueType}> {
    const client: GsClient = GsClient.getInstance();
    const envSettings = await vari.ohip.sclient.envSettings.get();
    const offset = await vari.ohip.sclient.offset.get();
    const url = envSettings.wsUrl + '?key=' + await client.generateHash(envSettings.appKey);
    try {
        console.log('Starting client');
        client.start(envSettings, offset, url);
    } catch {
        console.error('Error establishing socket connection');
    }
    const status = await vari.ohip.sclient.clientStatus.get();
    return {offset, status};
}

sclient().then(status => console.log(status));
