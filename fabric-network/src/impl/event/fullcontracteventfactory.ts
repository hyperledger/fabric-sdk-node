/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {ContractEvent, TransactionEvent} from '../../events';
import {protos} from 'fabric-protos';
import {Mandatory} from '../gatewayutils';

export function newFullContractEvents(transactionEvent: TransactionEvent): ContractEvent[] {
	const transactionActions: protos.ITransactionAction[] = (transactionEvent.transactionData as protos.ITransaction).actions || [];
	return transactionActions.map((transactionAction) => {
		// payload is defined as 'bytes' in the protobuf.

		// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment
		const payload = transactionAction.payload as any;
		// payload has been decoded by fabric-common event service before being stored as TransactionEvent
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
		const chaincodeEvent = payload.action.proposal_response_payload.extension.events as Mandatory<protos.IChaincodeEvent>;
		return newFullContractEvent(transactionEvent, chaincodeEvent);
	});
}

function newFullContractEvent(transactionEvent: TransactionEvent, chaincodeEvent: Mandatory<protos.IChaincodeEvent>): ContractEvent {
	const contractEvent: ContractEvent = {
		chaincodeId: chaincodeEvent.chaincode_id,
		eventName: chaincodeEvent.event_name,
		payload: chaincodeEvent.payload as Buffer,
		getTransactionEvent: () => transactionEvent
	};
	return Object.freeze(contractEvent);
}
