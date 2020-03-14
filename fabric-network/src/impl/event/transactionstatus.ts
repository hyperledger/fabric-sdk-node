/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// @ts-ignore no implicit any
import protos = require('fabric-protos');

function newCodeToStatusMap(): { [code: number]: string } {
	const result: { [code: number]: string } = {};
	for (const [status, code] of Object.entries(protos.protos.TxValidationCode as { [status: string]: number })) {
		result[code] = status;
	}
	return result;
}

const codeToStatusMap = Object.freeze(newCodeToStatusMap());

export const VALID_STATUS = 'VALID';

export function getStatusForCode(code: number): string {
	const status = codeToStatusMap[code];
	if (!status) {
		throw new Error('Unexpected transaction status code: ' + code);
	}
	return status;
}
