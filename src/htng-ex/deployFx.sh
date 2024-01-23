#!/bin/bash
CONTEXT=ohip.htngexpress
npx poly function add getGuest src/htng-ex/fxGetGuest.ts --context $CONTEXT --server --description "HTNG Express function to get guest profiles" &&
npx poly function add getReservation src/htng-ex/fxGetReservation.ts --context $CONTEXT --description "HTNG Express function to get a single reservation with all details" --server &&
npx poly function add searchReservations src/htng-ex/fxSearchReservations.ts --context $CONTEXT --server --description "HTNG Express function to search reservations"