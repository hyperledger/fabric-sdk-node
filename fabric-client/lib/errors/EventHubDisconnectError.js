/*
 Copyright 2019, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

/**
 * Error when an event hub is disconnected.
 * @interface
 * @memberof module:fabric-network
 * @property {String} [message] The error message
 */
class EventHubDisconnectError extends Error {
	constructor(message) {
		super(message);
	}
}

module.exports = EventHubDisconnectError;
