/*
 * Copyright IBM Corp. All Rights Reserved.
 *
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
		stub.setEvent('create', Buffer.from('createValueTransactionContent'));

		return 'eventName "create" set with value "createValueTransactionContent"';
	}

	async privateValuePut(ctx) {
		const {stub} = ctx;
		const privateValue = Buffer.from('myprivatedata');
		console.info('put private data of length ==>' + privateValue.length + '<==');
		console.info('put private data of ==>' + privateValue.toString('utf8') + '<==');

		await stub.putPrivateData('collectionEvents', 'myprivatekey', privateValue);

		stub.setEvent('dc', Buffer.from('content'));
	}

	async privateValueGet(ctx) {
		const {stub} = ctx;

		const privateValue = await stub.getPrivateData('collectionEvents', 'myprivatekey');
		console.info('get private data of length ==>' + privateValue.length + '<==');
		console.info('get private data of ==>' + privateValue.toString('utf8') + '<==');

		stub.setEvent('dc', Buffer.from('content'));
	}

	async createValueDisconnect(ctx) {
		const {stub} = ctx;
		stub.setEvent('publicDC', Buffer.from('createValueDisconnectContent'));
	}
}

module.exports = Events;
