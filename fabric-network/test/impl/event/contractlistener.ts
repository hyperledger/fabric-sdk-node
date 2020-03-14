/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import sinon = require('sinon');
import chai = require('chai');
const expect = chai.expect;
import Long = require('long');

import { Channel, Client, Endorser, Eventer, EventInfo, FilteredBlock, FilteredTransaction, IdentityContext } from 'fabric-common';
import * as protos from 'fabric-protos';
import { BlockEvent, ContractEvent, ContractListener, ListenerOptions } from '../../../src/events';
import { Network, NetworkImpl } from '../../../src/network';
import * as testUtils from '../../testutils';
import { StubEventService } from './stubeventservice';
import Contract = require('../../../src/contract');
import ContractImpl = require('../../../src/contract');
import Gateway = require('../../../src/gateway');
import Sinon = require('sinon');

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
	const eventName: string = 'eventName';
	const chaincodeId: string = 'bourbons';

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
			blockNumber: new Long(blockNumber),
			filteredBlock: newFilteredBlock(blockNumber)
		};
	}

	function addTransaction(event: EventInfo, filteredTransaction: FilteredTransaction): void {
		event.filteredBlock.filtered_transactions.push(filteredTransaction);
	}

	function newFilteredBlock(blockNumber: number): FilteredBlock {
		const filteredBlock = new protos.protos.FilteredBlock();
		filteredBlock.number = blockNumber;
		filteredBlock.filtered_transactions = [];
		return filteredBlock;
	}

	function newFilteredTransaction(ccId: string = contract.chaincodeId): FilteredTransaction {
		const filteredTransaction = new protos.protos.FilteredTransaction();
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

	function newChaincodeEvent(ccId: string): any {
		const chaincodeEvent = new protos.protos.ChaincodeEvent();
		chaincodeEvent.chaincode_id = ccId;
		chaincodeEvent.event_name = eventName;
		return chaincodeEvent;
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
		addTransaction(event, newFilteredTransaction());

		await contract.addContractListener(spyListener);
		eventService.sendEvent(event);
		await listener.completePromise;

		sinon.assert.calledOnceWithExactly(spyListener, sinon.match({ chaincodeId, eventName }));
	});

	it('stops listening for events after the listener has been removed', async () => {
		const event = newEvent(1);
		addTransaction(event, newFilteredTransaction());
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

		const event1 = newEvent(1);
		addTransaction(event1, newFilteredTransaction());
		addTransaction(event1, newFilteredTransaction());

		await contract.addContractListener(spyListener);
		eventService.sendEvent(event1);
		await listener.completePromise;

		sinon.assert.calledWith(spyListener.getCall(0), sinon.match({ chaincodeId, eventName }));
		sinon.assert.calledWith(spyListener.getCall(1), sinon.match({ chaincodeId, eventName }));
	});

	it('listener only receives events matching its chaincode id', async () => {
		const badEvent = newEvent(1);
		addTransaction(badEvent, newFilteredTransaction('fabCar')); // event for another contract

		const goodEvent = newEvent(2);
		addTransaction(goodEvent, newFilteredTransaction());

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

		const event1 = newEvent(1);
		addTransaction(event1, newFilteredTransaction());
		const event2 = newEvent(2);
		addTransaction(event2, newFilteredTransaction());

		await contract.addContractListener(errorListener);
		await contract.addContractListener(spyListener);
		eventService.sendEvent(event1);
		eventService.sendEvent(event2);
		await listener.completePromise;

		sinon.assert.calledTwice(spyListener);
	});

	it('error thrown by listener does not prevent subsequent contract events being processed', async () => {
		listener = testUtils.newAsyncListener<ContractEvent>(2);
		const fake = sinon.fake(async (event) => {
			await listener(event);
			throw new Error('LISTENER_ERROR');
		});

		const event1 = newEvent(1);
		addTransaction(event1, newFilteredTransaction());
		addTransaction(event1, newFilteredTransaction());

		await contract.addContractListener(fake);
		eventService.sendEvent(event1);
		await listener.completePromise;

		sinon.assert.calledTwice(fake);
	});

	it('replay contract listener does not receive events earlier than start block', async () => {
		const event1 = newEvent(1);
		addTransaction(event1, newFilteredTransaction());
		const event2 = newEvent(2);
		addTransaction(event2, newFilteredTransaction());

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
});
