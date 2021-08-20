/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fabproto6 from 'fabric-protos';

export const VALID_STATUS = 'VALID';

export function getStatusForCode(code: number): string {
	const status = fabproto6.protos.TxValidationCode[code];
	if (!status) {
		throw new Error(`Unexpected transaction status code: ${code}`);
	}

	return status;
}
