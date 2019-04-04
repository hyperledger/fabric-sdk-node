/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const BaseCheckpointer = require('./../../../lib/impl/event/basecheckpointer');

class InMemoryCheckpointer extends BaseCheckpointer {
	constructor() {
		super();
		this.checkpoint = {};
	}

	async load() {
		return this.checkpoint;
	}

	async save(transactionId, blockNumber) {
		if (Number(blockNumber) !== Number(this.checkpoint.blockNumber)) {
			this.checkpoint = {blockNumber: Number(blockNumber), transactionIds: [transactionId]};
		} else {
			this.checkpoint.transactionIds.push(transactionId);
		}
	}
}

module.exports = InMemoryCheckpointer;
