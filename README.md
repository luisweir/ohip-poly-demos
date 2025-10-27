
![Daily Unit Test Run](https://github.com/luisweir/ohip-poly-demos/workflows/Daily%20Unit%20Test%20Run/badge.svg)

# OHIP + Poly

With over [3K APIs](https://blogs.oracle.com/hospitality/post/latest-ohip-release-debuts-with-more-than-3000-api-capabilities) already exposed and [publicly available](https://github.com/oracle/hospitality-api-docs) in Github, OHIP is revolutionizing the way hospitality integrations are done. In just over two years, we've dramatically simplified the integration process through turnkey sandboxes, over [2,000 Postman recipes](https://www.postman.com/hospitalityapis/workspace/oracle-hospitality-apis/overview), and an [engaged community nearing 3,000 members](https://blogs.oracle.com/hospitality/post/connect-learn-grow-introducing-the-new-hospitality-apis-innovation-open-forum).

By collaborating with [PolyApi](https://PolyApi.io/), we aim to elevate hospitality integrations even further. Our goal is to unlock the full potential of Artificial Intelligence and Large Language Models (LLMs) to simplify the integration process even more by:
- Rapidly enabling and exposing APIs for AI consumption. We know AI agents necessitate specialized interfaces tailored for the specific conversational interactions and user experiences they facilitate. Simply having APIs is no sufficient.
- Facilitating AI-assisted development of integrations. With an AI assistant available directly within the IDE (currently supporting VS Code) which has been automatically pre-trained in OHIP APIs, developers can effortlessly discover and implement integrations to OPERA Cloud.

In this repository, we are showcasing samples on how [PolyApi's](https://PolyApi.io/) technology can by applied to enable AI guest journeys via AI agent prompts and also to implement custom adapters and integrations.

- [OHIP + Poly](#ohip--poly)
  - [Demos](#demos)
    - [AI Guest Experience:](#ai-guest-experience)
      - [Features:](#features)
    - [HTNG Express](#htng-express)
      - [Features:](#features-1)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Install NodeJs and Typescript](#install-nodejs-and-typescript)
    - [Configure Poly](#configure-poly)
      - [Create An API Key](#create-an-api-key)
  - [Using AI Guest Experience](#using-ai-guest-experience)
    - [Create and Update Vari's](#create-and-update-varis)
    - [Training](#training)
    - [Configure Adyen's webhook](#configure-adyens-webhook)
      - [Deploy](#deploy)
      - [Test Locally And Deploy](#test-locally-and-deploy)
  - [Using HTNG Express](#using-htng-express)
      - [Deploy](#deploy-1)
      - [Test Locally](#test-locally)
  - [To-do](#to-do)
  - [License](#license)
  - [Disclaimer](#disclaimer)

## Demos

### AI Guest Experience:

This demo code tailors OHIP APIs into specialized single-purpose functions that are optimized for seamless integration with AI agents. These functions empower AI agents to deliver a comprehensive guest journey by offering a prompt with a diverse range of services in a human-like conversation. These include hotel regional search, real-time availability checks, secure reservation bookings via pay-by-link to ensure data privacy (no personal details in AI prompt are entered), guest check-ins, and the ability to enhance stays through add-on services like breakfast, among others.

#### Features:
- Custom functions for:
  - **OHIP Token Lifecycle Management**: Reuse a single token throughout its full lifespan and renew only when necessary.
  - **Regional Hotel Searches**: Utilize OPERA Cloud's property location details and the [Google Distance Matrix API](https://developers.google.com/maps/documentation/distance-matrix/overview) to verify distances from a desired destination.
  - **Availability Searches**: Search for available properties within a specified hotel chain.
  - **Reservation Creation**: Create reservations with or without a payment token, depending on whether OPI is enabled, using [Adyen's Pay by Link feature](https://www.adyen.com/en_GB/pay-by-link).
  - **Check-in Process**: Use an OPERA Cloud confirmation number to check into a reservation.
  - **Concierge Services**: Search for and order services like taxi bookings, bike rentals, and attraction tickets. Available services can be dynamically configured through a variable list of values.
  - **Bill Review**: Examine charges incurred during the stay.
- **Vari Secret**: Secure and convenient provision of environment access credentials.
- **Vari Variables**: Effortless management of environment settings, value lists, and token management.

### HTNG Express

An [HTNG Express](https://www.htngexpress.com/) demo adapter, crafted as a PolyApi custom function, enables developers to quickly and seamlessly build HTNG Express clients for integration with OPERA Cloud. By utilizing the sophisticated features of the PolyApi AI Assistant, the development process is significantly simplified, resulting in faster time to market and improved developer-experience.

#### Features:
- **OHIP Token Lifecycle Management**: Reuse a single token throughout its full lifespan and renew only when necessary.
- **Custom Functions**: three custom functions supporting the main operations (get guest profile, get reservation and search reservations) available at the time this project was created.

## Prerequisites

- **OHIP credentials** for a given [OPERA Cloud](https://www.oracle.com/uk/hospitality/hotel-property-management/hotel-pms-software/) chain.
  - If you're an OPERA Cloud customer, you'll get OHIP with OPERA Cloud.
  - If you're an OPERA Cloud partner, follow [this steps](https://docs.oracle.com/cd/F29336_01/doc.201/f27480/c_gs.htm#OHIPU-GettingStartedWithIntegrationPlatfo-7FAAA0AF) to quickly get access to a sandbox.
- **PolyApi key**. Can be obtained by registering via [PolyApi.io](https://PolyApi.io/).
- AI Guest Experience (only):
  - [Google Maps API key](https://developers.google.com/maps/documentation/distance-matrix/overview) -setup steps on the on the same link.
  - **Adyen's sandbox credentials** - [register here](https://www.adyen.com/signup) for access.
  > Note: after getting access to the Adyen sandbox, send an email to (support@adyen.com) and ask for the following account properties to be enabled: `StoreTokenNoShopperReferenceProvided`, `RechargeSynchronousStoreDetails` and `CheckoutPayByLinkIncludeOpiTransToken`. This is mandatory in order to obtained an OPI compatible payment token.
- [Postman](https://www.postman.com/downloads/).

## Installation

## Install NodeJs and Typescript

- Install node:

  To easily install multiple versions of node locally, it is recommended to first install [node version manager (nvm)](https://github.com/nvm-sh/nvm) and then install the require version as following:

  ```bash
  NODE_VERSION=22.20.0
  nvm install $NODE_VERSION
  nvm alias default $NODE_VERSION
  nvm use default #to set this version of node as default in your environment
  nvm use #to set the node version based on the .nvmrc file (if file exists)
  ```

  > the above assumes you've installed nvm as described [here](https://github.com/nvm-sh/nvm), including [this step](https://github.com/nvm-sh/nvm#nvmrc).

- Install the node modules used in the project:

  ```bash
  npm install typescript
  ```

  > don't run `npm install` yet

### Configure Poly

Configuring PolyApi for the demos on this project consists of 2 steps:

#### Create An API Key
Although you would've received an API key when you registered to access PolyApi, this is likely an admin key which we don't want to use for these projects. Instead create a new API key by:

1. [Register](https://na1.polyapi.io/canopy/polyui/signup) to use PolyAPI.
2. Open Postman and import the collections and environments available in the [postman](./postman) folder.
3. In a browser, open the follwing URL *https://`{{Poly Host}}`/canopy/polyui/collections/environments* where `Poly Host` is the Poly Instance where your tenant resides. Then login using your `Admin Key` (the one provided after [registation](https://na1.polyapi.io/canopy/polyui/signup) to PolyAPI).
4. Open the `OHIP-POLY` environment and set the corresponding values for the following variables:

  - *Poly-Host*: The host name of the Poly Instance where your tenant resides (same as step 1)

  - *polyApiKey-Admin*: the admin key provided upon registration to PolyAPI.

  - *Poly-Tenant-Id*: you can optain it via the Canopy URL: *https://`{{Poly Host}}`/canopy/polyui/collections/environments*

  - *Poly-Environment-Id*: tyou can optain it via the Canopy URL: *https://`{{Poly Host}}`/canopy/polyui/collections/environments*

5. Go to *https://`{{Poly Host}}`/canopy/polyui/collections/users* to create a new user with all permissions enabled. 

6. Go to *https://`{{Poly Host}}`/canopy/polyui/collections/api-keys* and then:
  - Click on `Create`.
  - Then enter a name of the application.
  - Select the environment associated with the user (same env as previous step) .
  - Leave the `User` radio box selected.
  - Leave the Expires empty (this is demo).
  - Set all permissions to true (again just for simplicity as this is a demo).

7. Install and configure PolyApi as following:

   - To install Poly run:

   ```bash
   npm install polyapi
   ```

   - Then to configure Poly run:

   ```bash
   npx poly setup
   ```

   - When prompted, enter the Poly Instance URL and and the API Key recently created.

   - Configure the PolyApi Assistant by also setting **Api Base Url** and **Key** in the VS Code settings.

  > Refer to [PolyAPI's Quickstart](https://docs.polyapi.io/quickstart.html) guide for further guidance on how to set up Poly.

## Using AI Guest Experience

### Create and Update Vari's
Vari's is how PolyApi refers to environment variables and secrets. All demos in this project make use of vari's. To create them follow this steps:

1- Open the OHIP-POLY environment and set the corresponding values for the following variables:
  - *HostName*: OHIPs API Gateway URL. You can obtain this value from the environment tab of the OHIP development portal. Refer to the [OHIP user guide](https://docs.oracle.com/cd/F29336_01/doc.201/f27480/t_environments_gateways_and_credentials.htm#OHIPU-EnvironmentsGatewaysAndCredentials-B637B444) for how-to steps. If you are a partner you can use the [partner sandbox](https://docs.oracle.com/cd/F29336_01/doc.201/f27480/t_getting_started_for_partners.htm#OHIPU-QuickStartForPartnersUsingThePartne-7D3250F7) details.
  - *CLIENT_SECRET* & *CLIENT_SECRET*: 
  - *AppKey*: An OHIP application key. You can obtain this value from the application tab of the OHIP development portal. Refer to the [OHIP user guide](https://docs.oracle.com/cd/F29336_01/doc.201/f27480/c_register_and_manage_applications.htm#OHIPU-RegisterAndManageApplications-D59DF702) for how-to steps.
  - *HotelId*: a default hotel Id is required to perform common operations like obtaining hotels in a chain. If you are a partner you can use the [partner sandbox](https://docs.oracle.com/cd/F29336_01/doc.201/f27480/t_getting_started_for_partners.htm#OHIPU-QuickStartForPartnersUsingThePartne-7D3250F7) details.
  - *GoogleMaps-AppKey*: an [application key](https://developers.google.com/maps/documentation/javascript/get-api-key) to be able to call the Google Maps API.
  - *Adyen-HostName*: [Adyen's sandbox](https://www.adyen.com/signup) hostname URl. It's set by default but may be different in your environment.
  - *Adyen-AppKey*: an [Adyen API key](https://docs.adyen.com/development-resources/api-credentials/).
  - *Adyen-MerchantAccount*: The Adyen's merchant account generated upon the creation of your environment. You can also get it from the Adyen Dev Portal via `Settings` >  `Merchant Accounts`.
- Open the OHIP-POLY postman collections and execute:
  - `Poly Config > Create Env Secrets`
  - `Poly Config > Create Env Settings`
  - `Poly Config > Create Token Variable`
  - `Poly Config > Create Env Descriptions For Model`
  - `Poly Config > Create Concierge LoV`
  - `Collections For Training > AI Guest Journey > Pay By Link > Payment Event Hook`

### Training

- [Click here](https://eu1.polyapi.io/postman/scripts.zip) to download the latest Poly Postman training scripts.
- Unzip the downloaded file.
- Select the `Train` collection, then click on `Scripts`.
- Update the `Pre-req` and `Post-req` based on the downloaded scripts earlier.
- Modify the `Pre-req` script to pick up the Poly env details from the postman environment:

```js
const polyHost = pm.environment.get('Poly-Host');
const apiKey = pm.environment.get('polyApiKey');

pm.environment.set('polyData', {
    hostUrl: polyHost,
    polyApiKey: apiKey
});
```

- Modify the `OHIP-Poly` environment to set the applicable variable values based on your OPERA Cloud instance.
- Drag the `Collections For Training` and drop it under `Train`.
- Expand the `Train > AI Guest Journey` folder, and train all calls as following:
  - First in Postman click on the `console` menu tab at the bottom left of the postman window.
  - Under ` > Shop & Book > Property` select `List All Properties` and hit `Send`. Look at the console and you should see `Function trained` if training was successful. 
  - Repeat the same steps for all collections under `Collections For Training`.
  
  > Note: for each call you'll be making to train, ensure you've sent the environment variables.

### Configure Adyen's webhook

Login to Adyen's Sandbox and perform the following steps:

- Open postman and run `Poly Config > Get Webhooks`. Then
  - Look for the `paymentEventHook` hook. Select the `Id`, right click on top of it, then click on `Set as variable` , find `Adyen-WebhookUrl` and select it.
  - Run `Poly Config > Get Webhook Details` and take note of `Url` element.
- From the **Developers** section, click on **Webhooks**.
- Click on **(+) Webhook** (on the top right) to create a new webhook.
- **Add** a **Standard Webhook**.
- Edit **Server Configuration** and enter the URL for `paymentEventHook` (previously obtained) and select **TLSv1.2** as **Encryption protocol**.
- On the **Additional Settings** edit **Card** and tick all boxes.
- Finally click **Save**.
- Send an email to (support@adyen.com) and ask for the following account features to be enabled in your account: `StoreTokenNoShopperReferenceProvided`, `RechargeSynchronousStoreDetails` and `CheckoutPayByLinkIncludeOpiTransToken`. This is mandatory in order to obtained an OPI compatible payment token.

#### Deploy

- Execute the following command to deploy all custom functions.

```bash
./src/ai-gx/deployFx.sh
```

#### Test Locally And Deploy

- Create a file called `.env` in the root directory and set the following environment variables. Adjust as desired.

```bash
LOGLEVEL=info
#YYYY-MM-DD
FROM=2023-08-31
NIGHTS=2
LOCATION=naples
ADULTS=2
CHILDREN=2
# ages comma separated
CHILDREN_AGES='5,9'
ROOMS=1
FIRST_NAMES='john'
LAST_NAMES='Doe'
TITLE='Mr'
PHONE='+447575222333'
EMAIL='john.doe@domain.com'
```

> To use an environment file other than `.env` set the environment variable `ENVPATH` to the relative path of the env file. E.g. `export ENVPATH=./dev.env`

- In a terminal prompt run:

```bash
ts-node/ai-gx/tryFlow.ts
```

Assuming the test runs successfully, now we can create a new AI plugin:

- Open the OHIP-POLY postman collections and execute in sequence
  - `Poly Config > Get Custom Functions` and from the response payload take note of all the function Id's for all the custom functions.
  - `Poly Config > Get Webhooks` and from the response payload take not of the Id for webhook `paymentEventHook`.
  - Edit the collection `Poly Config > Create Pay Hook Handler` by replacing the value of `webhookHandleId` with the Id of `paymentEventHook` (collected in previous step) and `serverFunctionId` with the Id of custom function  `paymentEventServerHandler` (collected from the GET call on the first step above). Then click *Send*.
  - Edit the collection `Poly Config > Create AI GX Plugin` by replacing all the custom function Id's with the ones obtained in the previous step. Then click *Send*.
  - Take note of the `plugin_url` . Then you can set up your AI agent integration by following the steps [in this video](https://vimeo.com/826376377).
- Try prompts like:

```
Hotels within walking distance from buckingham palace
```
or

```
Is there any availability for tonight
```
or

```
Book me a room for 2 people and 3 kids
```
or

```
Check me in the hotel
```
or

```
Check me in the hotel
```
or

```
Add breakfast to my room
```

or

```
Book me a ticket for the london eye
```

or

```
What is my current bill?
```

## Using HTNG Express

#### Deploy

- Execute the following command to deploy all custom functions.

```bash
./htng-ex/deployFx.sh
```

#### Test Locally

- Run `ts-node/htng-ex/tryFlow.ts` to test the custom functions locally. Take note of all the function Id's for all the custom functions.

## To-do

- Upsell with Nor1 APIs
- Check out functionality
- Simphony services (during stay)

## License

This project and all content within is available under the [Universal Permissive License v 1.0](https://oss.oracle.com/licenses/upl).

See [LICENSE](LICENSE.txt) for more details.

## Disclaimer

This is NOT an official or supported project by Oracle. This project is intended solely for demonstration purposes and should be used at your own risk. No warranty or guarantee of reliability, accuracy, or completeness is provided. Any use of this project is solely at your own risk and we are not responsible for any losses or damages incurred.