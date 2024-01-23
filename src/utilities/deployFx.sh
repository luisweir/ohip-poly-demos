#!/bin/bash
CONTEXT=ohip.utilities
npx poly function add getOhipToken src/utilities/fxGetToken.ts --context $CONTEXT --server --description "Get an OHIP token and cache it. Renew it 5 minutes before it expires" &&
npx poly function add getHotelId src/utilities/fxGetHotelid.ts --context $CONTEXT --server --description "Get the hotelId for an OPERA Cloud property using its hotel name"
