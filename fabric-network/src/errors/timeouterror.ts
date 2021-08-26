/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {FabricError, FabricErrorInfo} from './fabricerror';

/**
 * Error indicating a timeout.
 * @extends module:fabric-network.FabricError
 * @memberof module:fabric-network
 */
export class TimeoutError extends FabricError {
	constructor(info?: string | FabricErrorInfo) {
		super(info);
		this.name = TimeoutError.name;
	}
}
