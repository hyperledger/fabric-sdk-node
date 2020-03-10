/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export class ContractEvent {
	public readonly chaincodeId: string;
	public readonly eventName: string;
	public readonly payload: Buffer;

	constructor(chaincodeId: string, eventName: string, payload: Buffer) {
		this.chaincodeId = chaincodeId;
		this.eventName = eventName;
		this.payload = payload;
	}
}

export type ContractListener = (event: ContractEvent) => Promise<void>;
