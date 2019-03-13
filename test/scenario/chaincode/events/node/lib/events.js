/**
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-console */

'use strict';
const {Contract} = require('fabric-contract-api');

class Events extends Contract {
	async initLedger(ctx) {
		console.info('Instantiated events');
	}

	async createValue(ctx) {
		const {stub} = ctx;
		stub.setEvent('create', Buffer.from('content'));
	}

	async createValueDisconnect(ctx) {
		const {stub} = ctx;
		stub.setEvent('dc', Buffer.from('content'));
	}
}

module.exports = Events;
