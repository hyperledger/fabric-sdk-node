/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const FabricError = require('./fabricerror');

/**
 * Error indicating a transaction error.
 * @extends module:fabric-network.FabricError
 * @memberof module:fabric-network
 */
class TransactionError extends FabricError {
	constructor(info) {
		super(info);
	}
}

module.exports = TransactionError;
