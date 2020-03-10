/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Logger from '../../logger';
import { Network } from '../../network';
import { BlockListener, FilteredBlockEvent, BlockEvent } from './blocklistener';
import { ContractEvent, ContractListener } from './contractlistener';
import { ListenerSession } from './listenersession';
// @ts-ignore no implicit any
import protos = require('fabric-protos');
const logger = Logger.getLogger('ContractListenerSession');

export class ContractListenerSession implements ListenerSession {
	private readonly listener: ContractListener;
	private chaincodeId: string;
	private network: Network;
	private blockListener: BlockListener;

	constructor(listener: ContractListener, chaincodeId: string, network: Network) {
		this.listener = listener;
		this.chaincodeId = chaincodeId;
		this.network = network;
		this.blockListener = (blockEvent: BlockEvent) => this.onBlockEvent(blockEvent);
	}

	public async start() {
		await this.network.addBlockListener(this.blockListener);
	}

	public close() {
		this.network.removeBlockListener(this.blockListener);
	}

	private async onBlockEvent(blockEvent: BlockEvent): Promise<void> {
		if (blockEvent.type === 'filtered') {
			await this.getContractEventsforFilteredBlock(blockEvent as FilteredBlockEvent);
		} else {
			throw new Error(`Unexpected block event type: ${blockEvent.type}`);
		}
	}

	private async getContractEventsforFilteredBlock(blockEvent: FilteredBlockEvent) {

		// For filtered blocks
		if (blockEvent.blockData.filtered_transactions) {
			// const blockNumber: string = blockEvent.filteredBlock.number;

			for (const filteredTransaction of blockEvent.blockData.filtered_transactions) {

				// const transactionId: string = filteredTransaction.txid;
				// const transactionValidationCode: string = this.getTransactionValidationCode(filteredTransaction);

				// TODO: any cast, type for FilteredTransaction.transaction_actions needed
				const transactionActions: any = filteredTransaction.transaction_actions;

				if (transactionActions && transactionActions.chaincode_actions) {

					for (const chaincodeAction of transactionActions.chaincode_actions) {

						// TODO: delete payload? it's empty for filtered transactions:
						// delete chaincodeAction.chaincode_event.payload;

						const chaincodeEvent = chaincodeAction.chaincode_event;
						// TODO: proper regex check here
						if (chaincodeEvent.chaincode_id === this.chaincodeId) {

							const contractEvent = new ContractEvent(this.chaincodeId, chaincodeEvent.event_name, chaincodeEvent.payload);

							try {
								await this.listener(contractEvent);
							} catch (error) {
								// TODO: log an error or warning?
								logger.error('Error notifying listener', error);
							}
						}
					}
				}
			}
		}
	}

	// TODO: enable for populating transactionEvents
	// TODO: any cast, filteredTransaction, need type for filteredTransaction.tx_validation_code
	private getTransactionValidationCode(filteredTransaction: any): string {
		// Validation codes sorting, get from enum in fabric-protos
		const transactionValidationCodes: any = {};
		// TODO: get this from transaction.proto in a better way?
		const keys: string[] = Object.keys(protos.protos.TxValidationCode);
		for (const key of keys) {
			const value: number = protos.protos.TxValidationCode[key];
			transactionValidationCodes[value] = key;
		}

		// TODO: any cast, need types
		let transactionValidationCode: any = filteredTransaction.tx_validation_code;

		if (typeof transactionValidationCode !== 'string') {
			transactionValidationCode = transactionValidationCodes[transactionValidationCode];
		}
		return transactionValidationCode;
	}
}

// some logic for full blocks
// if (blockEvent.block) {
// 	for (let i = 0; i < blockEvent.block.data.data.length; i++) {
// 		const env: any = blockEvent.block.data.data[i];
// 		const channelHeader: any = env.payload.header.channel_header;
// 		if (channelHeader.type === 3) { // only ENDORSER_TRANSACTION have chaincode events
// 			const transaction: any = env.payload.data;
// 			if (transaction && transaction.actions) {
// 				for (const payload of transaction.actions) {
// 					const chaincodeEvent: any = payload.action.proposal_response_payload.extension.events;
// 					const transactionStatusCodes: any = blockEvent.block.metadata.metadata[protos.common.BlockMetadataIndex.TRANSACTIONS_FILTER];
// 					const transactionStatusCode = transactionStatusCodes[i];
// 				}
// 			}
// 		}
// 	}
