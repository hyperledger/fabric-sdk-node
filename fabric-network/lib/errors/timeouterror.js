/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const FabricError = require('./fabricerror');

/**
 * Error indicating a timeout.
 * @extends module:fabric-network.FabricError
 * @memberof module:fabric-network
 */
class TimeoutError extends FabricError {
	constructor(info) {
		super(info);
	}
}

module.exports = TimeoutError;
