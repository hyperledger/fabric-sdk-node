/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContractEvent, TransactionEvent } from '../../events';

export function newFullContractEvents(transactionEvent: TransactionEvent): ContractEvent[] {
	const transactionActions: any[] = transactionEvent.transactionData.actions || [];
	return transactionActions.map((transactionAction) => {
		const chaincodeEvent = transactionAction.payload.action.proposal_response_payload.extension.events;
		return newFullContractEvent(transactionEvent, chaincodeEvent);
	});
}

function newFullContractEvent(transactionEvent: TransactionEvent, chaincodeEvent: any): ContractEvent {
	const contractEvent: ContractEvent = {
		chaincodeId: chaincodeEvent.chaincode_id,
		eventName: chaincodeEvent.event_name,
		payload: chaincodeEvent.payload,
		getTransactionEvent: () => transactionEvent
	};
	return Object.freeze(contractEvent);
}
