/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {ContractEvent, TransactionEvent} from '../../events';
import * as fabproto6 from 'fabric-protos';

export function newFullContractEvents(transactionEvent: TransactionEvent): ContractEvent[] {
	// eslint-disable-next-line max-len
	const transactionActions: fabproto6.protos.ITransactionAction[] = (transactionEvent.transactionData as fabproto6.protos.ITransaction).actions || [];
	return transactionActions.map((transactionAction) => {
		// payload is defined as 'bytes' in the protobuf.

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const payload = transactionAction.payload as any;
		// payload has been decoded by fabric-common event service before being stored as TransactionEvent
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const chaincodeEvent = payload.action.proposal_response_payload.extension.events;
		return newFullContractEvent(transactionEvent, chaincodeEvent);
	});
}

function newFullContractEvent(transactionEvent: TransactionEvent, chaincodeEvent: fabproto6.protos.ChaincodeEvent): ContractEvent {
	const contractEvent: ContractEvent = {
		chaincodeId: chaincodeEvent.chaincode_id,
		eventName: chaincodeEvent.event_name,
		payload: chaincodeEvent.payload as Buffer,
		getTransactionEvent: () => transactionEvent
	};
	return Object.freeze(contractEvent);
}
