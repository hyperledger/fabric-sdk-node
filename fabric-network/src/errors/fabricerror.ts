/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FabricErrorInfo {
	message?: string;
	cause?: Error;
	transactionId?: string;
}

/**
 * Base type for Fabric-specific errors.
 * @memberof module:fabric-network
 * @property {Error} [cause] Underlying error that caused this error.
 * @property {string} [transactionId] ID of the associated transaction.
 */
export class FabricError extends Error {
	cause?: Error;
	transactionId?: string;

	/*
	 * Constructor.
	 * @param {(string|object)} [info] Either an error message (string) or additional properties to assign to this
	 * inctance (object).
	 */
	constructor(info?: string | FabricErrorInfo) {
		if (!info) {
			super();
		} else if (typeof info === 'string') {
			super(info);
		} else {
			super(info.message);
			Object.assign(this, info);
		}
		this.name = FabricError.name;
	}
}
