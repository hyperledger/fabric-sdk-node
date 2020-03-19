/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import sinon = require('sinon');
import chai = require('chai');
const expect = chai.expect;
import Long = require('long');

import { Block, Channel, Client, Endorser, Eventer, EventInfo, FilteredBlock, FilteredTransaction, IdentityContext } from 'fabric-common';
import * as protos from 'fabric-protos';
import { BlockEvent, ContractEvent, ContractListener, ListenerOptions } from '../../../src/events';
import { Network, NetworkImpl } from '../../../src/network';
import * as testUtils from '../../testutils';
import { StubEventService } from './stubeventservice';
import Contract = require('../../../src/contract');
import ContractImpl = require('../../../src/contract');
import Gateway = require('../../../src/gateway');

interface StubContractListener extends ContractListener {
	completePromise: Promise<ContractEvent[]>;
}

describe('contract event listener', () => {
	let eventService: StubEventService;
	let gateway: sinon.SinonStubbedInstance<Gateway>;
	let network: Network;
	let channel: sinon.SinonStubbedInstance<Channel>;
	let listener: StubContractListener;
	let spyListener: sinon.SinonSpy<[ContractEvent], Promise<void>>;
	let contract: Contract;
	const eventName = 'eventName';
	const chaincodeId = 'bourbons';
	const eventPayload = 'payload';

	beforeEach(async () => {
		eventService = new StubEventService('stub');

		gateway = sinon.createStubInstance(Gateway);
		gateway.identityContext = sinon.createStubInstance(IdentityContext);
		gateway.getIdentity.returns({
			mspId: 'mspId'
		});

		channel = sinon.createStubInstance(Channel);
		channel.newEventService.returns(eventService);

		const endorser = sinon.createStubInstance(Endorser);
		(endorser as any).name = 'endorser';
		channel.getEndorsers.returns([endorser]);

		const client = sinon.createStubInstance(Client);
		const eventer = sinon.createStubInstance(Eventer);
		client.newEventer.returns(eventer);
		(channel as any).client = client;

		network = new NetworkImpl(gateway, channel);

		listener = testUtils.newAsyncListener<ContractEvent>();
		spyListener = sinon.spy(listener);

		const namespace: string = 'biscuitContract';
		const collections: string[] = ['collection1', 'collection2'];
		contract = new ContractImpl(network, chaincodeId, namespace, collections);
	});

	afterEach(() => {
		sinon.restore();
	});

	// Following functions required to populate a real event info structure from fabric-protos
	function newEvent(blockNumber: number): EventInfo {
		return {
			eventService,
			blockNumber: Long.fromNumber(blockNumber),
			block: newFullBlock(blockNumber)
		};
	}

	function newPrivateEvent(blockNumber: number): EventInfo {
		return Object.assign(newEvent(blockNumber), {
			privateData: [
				'PRIVATE_DATA'
			]
		});
	}

	function newFullBlock(blockNumber: number): Block {
		const block = new protos.common.Block();
		block.data = new protos.common.BlockData();
		block.metadata = new protos.common.BlockMetadata();
		block.metadata.metadata = [];
		block.metadata.metadata[protos.common.BlockMetadataIndex.TRANSACTIONS_FILTER] = [];
		return block;
	}

	function addTransaction(event: EventInfo, transaction: any, statusCode: number = protos.protos.TxValidationCode.VALID): void {
		event.block.data.data.push(newEnvelope(transaction));

		const transactionStatusCodes = event.block.metadata.metadata[protos.common.BlockMetadataIndex.TRANSACTIONS_FILTER];
		transactionStatusCodes.push(statusCode);
	}

	function newEnvelope(transaction: any): any {
		const channelHeader = new protos.common.ChannelHeader();
		channelHeader.type = protos.common.HeaderType.ENDORSER_TRANSACTION;

		const payload = new protos.common.Payload();
		payload.header = new protos.common.Header();
		payload.header.channel_header = channelHeader;
		payload.data = transaction;

		const envelope = new protos.common.Envelope();
		envelope.payload = payload;

		return envelope;
	}

	function newTransaction(ccId: string = contract.chaincodeId): any {
		const transaction = new protos.protos.Transaction();
		transaction.actions.push(newTransactionAction(ccId));
		return transaction;
	}

	function newTransactionAction(ccId: string): any {
		const transactionAction = new protos.protos.TransactionAction();
		transactionAction.payload = newChaincodeActionPayload(ccId);
		return transactionAction;
	}

	function newChaincodeActionPayload(ccId: string): any {
		const chaincodeActionPayload = new protos.protos.ChaincodeActionPayload();
		chaincodeActionPayload.action = newChaincodeEndorsedAction(ccId);
		return chaincodeActionPayload;
	}

	function newChaincodeEndorsedAction(ccId: string): any {
		const endorsedAction = new protos.protos.ChaincodeEndorsedAction();
		endorsedAction.proposal_response_payload = newProposalResponsePayload(ccId);
		return endorsedAction;
	}

	function newProposalResponsePayload(ccId: string): any {
		const proposalResponsePayload = new protos.protos.ProposalResponsePayload();
		proposalResponsePayload.extension = newChaincodeAction(ccId);
		return proposalResponsePayload;
	}

	function newChaincodeAction(ccId: string): any {
		const chaincodeAction = new protos.protos.ChaincodeAction();
		chaincodeAction.events = newChaincodeEvent(ccId);
		return chaincodeAction;
	}

	function newChaincodeEvent(ccId: string): any {
		const chaincodeEvent = new protos.protos.ChaincodeEvent();
		chaincodeEvent.chaincode_id = ccId;
		chaincodeEvent.event_name = eventName;
		chaincodeEvent.payload = Buffer.from(eventPayload, 'utf8');
		return chaincodeEvent;
	}

	function newFilteredEvent(blockNumber: number): EventInfo {
		return {
			eventService,
			blockNumber: new Long(blockNumber),
			filteredBlock: newFilteredBlock(blockNumber)
		};
	}

	function newFilteredBlock(blockNumber: number): FilteredBlock {
		const filteredBlock = new protos.protos.FilteredBlock();
		filteredBlock.number = blockNumber;
		filteredBlock.filtered_transactions = [];
		return filteredBlock;
	}

	function addFilteredTransaction(event: EventInfo, filteredTransaction: FilteredTransaction): void {
		event.filteredBlock.filtered_transactions.push(filteredTransaction);
	}

	function newFilteredTransaction(ccId: string = contract.chaincodeId): FilteredTransaction {
		const filteredTransaction = new protos.protos.FilteredTransaction();
		filteredTransaction.tx_validation_code = 'VALID';
		filteredTransaction.transaction_actions = newFilteredTransactionAction(ccId);
		return filteredTransaction;
	}

	function newFilteredTransactionAction(ccId: string): any {
		const filteredTransactionAction = new protos.protos.FilteredTransactionActions();
		filteredTransactionAction.chaincode_actions = [newFilteredChaincodeAction(ccId)];
		return filteredTransactionAction;
	}

	function newFilteredChaincodeAction(ccId: string): any {
		const filteredChaincodeAction = new protos.protos.FilteredChaincodeAction();
		filteredChaincodeAction.chaincode_event = newChaincodeEvent(ccId);
		return filteredChaincodeAction;
	}

	function assertCanNavigateEvents(contractEvent: ContractEvent) {
		const transactionEvent = contractEvent.getTransactionEvent();
		expect(transactionEvent).to.exist; // tslint:disable-line: no-unused-expression
		expect(transactionEvent.getContractEvents()).to.contain(contractEvent);

		const blockEvent = transactionEvent.getBlockEvent();
		expect(blockEvent).to.exist; // tslint:disable-line: no-unused-expression
		expect(blockEvent.getTransactionEvents()).to.contain(transactionEvent);
	}

	it('add listener returns the listener', async () => {
		const result = await contract.addContractListener(listener);
		expect(result).to.equal(listener);
	});

	it('listener not called if block contains no chaincode events', async () => {
		const event = newEvent(1); // Block event with no chaincode events
		const blockListener = testUtils.newAsyncListener<BlockEvent>();

		await contract.addContractListener(spyListener);
		await network.addBlockListener(blockListener);
		eventService.sendEvent(event);
		await blockListener.completePromise;

		sinon.assert.notCalled(spyListener);
	});

	it('listener receives events', async () => {
		const event = newEvent(1);
		addTransaction(event, newTransaction());

		await contract.addContractListener(spyListener);
		eventService.sendEvent(event);
		await listener.completePromise;

		sinon.assert.calledOnceWithExactly(spyListener, sinon.match({ chaincodeId, eventName }));
	});

	it('stops listening for events after the listener has been removed', async () => {
		const event = newEvent(1);
		addTransaction(event, newTransaction());
		const blockListener = testUtils.newAsyncListener<BlockEvent>();

		await contract.addContractListener(spyListener);
		contract.removeContractListener(spyListener);
		await network.addBlockListener(blockListener);
		eventService.sendEvent(event);
		await blockListener.completePromise;

		sinon.assert.notCalled(spyListener);
	});

	it('listener is invoked for each contract event in a block', async () => {
		listener = testUtils.newAsyncListener<ContractEvent>(2);
		spyListener = sinon.spy(listener);

		const event = newEvent(1);
		const transaction = newTransaction();
		addTransaction(event, transaction);
		addTransaction(event, transaction);

		await contract.addContractListener(spyListener);
		eventService.sendEvent(event);
		await listener.completePromise;

		sinon.assert.calledWith(spyListener.getCall(0), sinon.match({ chaincodeId, eventName }));
		sinon.assert.calledWith(spyListener.getCall(1), sinon.match({ chaincodeId, eventName }));
	});

	it('listener only receives events matching its chaincode id', async () => {
		const badEvent = newEvent(1);
		addTransaction(badEvent, newTransaction('fabCar')); // Event for another contract

		const goodEvent = newEvent(2);
		addTransaction(goodEvent, newTransaction());

		await contract.addContractListener(spyListener);
		eventService.sendEvent(badEvent);
		eventService.sendEvent(goodEvent);
		await listener.completePromise;

		sinon.assert.calledOnceWithExactly(spyListener, sinon.match({ chaincodeId, eventName }));
	});

	it('error thrown by listener does not disrupt other listeners', async () => {
		listener = testUtils.newAsyncListener<ContractEvent>(2);
		spyListener = sinon.spy(listener);
		const errorListener = sinon.fake.rejects(new Error('LISTENER_ERROR'));

		const transaction = newTransaction();

		const event1 = newEvent(1);
		addTransaction(event1, transaction);

		const event2 = newEvent(2);
		addTransaction(event1, transaction);

		await contract.addContractListener(errorListener);
		await contract.addContractListener(spyListener);
		eventService.sendEvent(event1);
		eventService.sendEvent(event2);
		await listener.completePromise;

		sinon.assert.calledTwice(spyListener);
	});

	it('error thrown by listener does not prevent subsequent contract events being processed', async () => {
		listener = testUtils.newAsyncListener<ContractEvent>(2);
		const fake = sinon.fake(async (e) => {
			await listener(e);
			throw new Error('LISTENER_ERROR');
		});

		const event = newEvent(1);
		const transaction = newTransaction();
		addTransaction(event, transaction);
		addTransaction(event, transaction);

		await contract.addContractListener(fake);
		eventService.sendEvent(event);
		await listener.completePromise;

		sinon.assert.calledTwice(fake);
	});

	it('replay contract listener does not receive events earlier than start block', async () => {
		const transaction = newTransaction();

		const event1 = newEvent(1);
		addTransaction(event1, transaction);

		const event2 = newEvent(2);
		addTransaction(event2, transaction);

		const options: ListenerOptions = {
			startBlock: 2
		};

		await contract.addContractListener(listener, options);
		eventService.sendEvent(event1);
		eventService.sendEvent(event2);
		const args = await listener.completePromise;

		const blockNumber = args[0].getTransactionEvent().getBlockEvent().blockNumber.toNumber();
		expect(blockNumber).to.equal(options.startBlock);
	});

	it('listener defaults to full blocks', async () => {
		const eventServiceManager = (network as any).eventServiceManager;
		const stub = sinon.stub(eventServiceManager, 'startEventService');

		await contract.addContractListener(listener);

		sinon.assert.calledOnceWithExactly(stub, sinon.match.any, sinon.match.has('blockType', 'full'));
	});

	it('listener can receive filtered blocks', async () => {
		const eventServiceManager = (network as any).eventServiceManager;
		const stub = sinon.stub(eventServiceManager, 'startEventService');
		const event = newFilteredEvent(1);
		addFilteredTransaction(event, newFilteredTransaction());

		const options: ListenerOptions = {
			type: 'filtered'
		};
		await contract.addContractListener(listener, options);
		eventService.sendEvent(event);
		await listener.completePromise;

		sinon.assert.calledOnceWithExactly(stub, sinon.match.any, sinon.match.has('blockType', options.type));
	});

	it('listener can receive private blocks', async () => {
		const eventServiceManager = (network as any).eventServiceManager;
		const stub = sinon.stub(eventServiceManager, 'startEventService');
		const event = newPrivateEvent(1);
		addTransaction(event, newTransaction());

		const options: ListenerOptions = {
			type: 'private'
		};
		await contract.addContractListener(listener, options);
		eventService.sendEvent(event);
		await listener.completePromise;

		sinon.assert.calledOnceWithExactly(stub, sinon.match.any, sinon.match.has('blockType', options.type));
	});

	it('listener does not receive events for invalid transactions', async () => {
		const badEvent = newEvent(1);
		addTransaction(badEvent, newTransaction(), protos.protos.TxValidationCode.MVCC_READ_CONFLICT);

		const goodEvent = newEvent(2);
		addTransaction(badEvent, newTransaction());

		await contract.addContractListener(listener);
		eventService.sendEvent(badEvent);
		eventService.sendEvent(goodEvent);

		const contractEvents = await listener.completePromise;
		expect(contractEvents[0].getTransactionEvent()).to.include({ isValid: true }); // tslint:disable-line: no-unused-expression
	});

	it('filtered events do not contain payload', async () => {
		const event = newFilteredEvent(1);
		addFilteredTransaction(event, newFilteredTransaction());

		const options: ListenerOptions = {
			type: 'filtered'
		};
		await contract.addContractListener(listener, options);
		eventService.sendEvent(event);
		const contractEvents = await listener.completePromise;

		expect(contractEvents[0].payload).to.be.undefined; // tslint:disable-line: no-unused-expression
	});

	it('full events contain payload', async () => {
		const event = newEvent(1);
		addTransaction(event, newTransaction());

		const options: ListenerOptions = {
			type: 'full'
		};
		await contract.addContractListener(listener, options);
		eventService.sendEvent(event);
		const contractEvents = await listener.completePromise;

		expect(contractEvents[0].payload?.toString()).to.equal(eventPayload);
	});

	it('can navigate event heirarchy for filtered events', async () => {
		const event = newFilteredEvent(1);
		addFilteredTransaction(event, newFilteredTransaction());

		const options: ListenerOptions = {
			type: 'filtered'
		};
		await contract.addContractListener(listener, options);
		eventService.sendEvent(event);
		const [contractEvent] = await listener.completePromise;

		assertCanNavigateEvents(contractEvent);
	});

	it('can navigate event heirarchy for full events', async () => {
		const event = newEvent(1);
		addTransaction(event, newTransaction());

		const options: ListenerOptions = {
			type: 'full'
		};
		await contract.addContractListener(listener, options);
		eventService.sendEvent(event);
		const [contractEvent] = await listener.completePromise;

		assertCanNavigateEvents(contractEvent);
	});

	it('can navigate event heirarchy for private events', async () => {
		const event = newPrivateEvent(1);
		addTransaction(event, newTransaction());

		const options: ListenerOptions = {
			type: 'private'
		};
		await contract.addContractListener(listener, options);
		eventService.sendEvent(event);
		const [contractEvent] = await listener.completePromise;

		assertCanNavigateEvents(contractEvent);
		expect(contractEvent.getTransactionEvent().privateData).to.equal(event.privateData[0]);
	});
});
