/*
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import sinon = require('sinon');
import chai = require('chai');
const expect = chai.expect;

import {Channel, Endorser} from 'fabric-common';

import {Network, NetworkImpl} from '../../../src/network';
import {ConnectedGatewayOptions, Gateway} from '../../../src/gateway';

import {AllForTxStrategy} from '../../../src/impl/event/allfortxstrategy';
import {AnyForTxStrategy} from '../../../src/impl/event/anyfortxstrategy';
import {TransactionEventHandler, TxEventHandlerFactory} from '../../../src/impl/event/transactioneventhandler';
import * as EventStrategies from '../../../src/impl/event/defaulteventhandlerstrategies';

describe('DefaultEventHandlerStrategies', () => {
	const expectedStrategyTypes = {
		MSPID_SCOPE_ALLFORTX: AllForTxStrategy,
		MSPID_SCOPE_ANYFORTX: AnyForTxStrategy,
		NETWORK_SCOPE_ALLFORTX: AllForTxStrategy,
		NETWORK_SCOPE_ANYFORTX: AnyForTxStrategy,
		PREFER_MSPID_SCOPE_ALLFORTX: AllForTxStrategy,
		PREFER_MSPID_SCOPE_ANYFORTX: AnyForTxStrategy
	};
	const strategyNames = Object.keys(expectedStrategyTypes);

	const stubPeer1 = sinon.createStubInstance(Endorser);
	const stubPeer2 = sinon.createStubInstance(Endorser);
	const orgPeers = [stubPeer1];
	const networkPeers = [stubPeer1, stubPeer2];
	const expectedStrategyPeers = {
		MSPID_SCOPE_ALLFORTX: orgPeers,
		MSPID_SCOPE_ANYFORTX: orgPeers,
		NETWORK_SCOPE_ALLFORTX: networkPeers,
		NETWORK_SCOPE_ANYFORTX: networkPeers,
		PREFER_MSPID_SCOPE_ALLFORTX: orgPeers,
		PREFER_MSPID_SCOPE_ANYFORTX: orgPeers,
	};

	let gateway: sinon.SinonStubbedInstance<Gateway>;
	let network: sinon.SinonStubbedInstance<Network>;
	const transactionId = 'TX_ID';
	const mspId = 'MSP_ID';
	const otherMspId = 'OTHER_MSP_ID';

	beforeEach(() => {
		const channel = sinon.createStubInstance(Channel);
		channel.getEndorsers.withArgs().returns(networkPeers);
		channel.getEndorsers.withArgs(mspId).returns(orgPeers);
		channel.getEndorsers.withArgs(otherMspId).returns([]);

		gateway = sinon.createStubInstance(Gateway);
		gateway.getOptions.returns({} as ConnectedGatewayOptions);
		gateway.getIdentity.returns({
			mspId,
			type: 'stub'
		});

		network = sinon.createStubInstance(NetworkImpl);
		network.getChannel.returns(channel);
		network.getGateway.returns(gateway as unknown as Gateway);
	});

	afterEach(() => {
		sinon.restore();
	});

	strategyNames.forEach((strategyName) => describe(strategyName, () => {

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const createTxEventHandler:TxEventHandlerFactory = EventStrategies[strategyName];

		let eventHandler;

		beforeEach(() => {
			eventHandler = createTxEventHandler(transactionId, network);
		});

		it('Returns a TransactionEventHandler', () => {
			expect(eventHandler).to.be.an.instanceOf(TransactionEventHandler);
		});

		it('Sets transaction ID on event handler', () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			expect(eventHandler.transactionId).to.equal(transactionId);
		});

		it('Sets correct strategy on event handler', () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const expectedType = expectedStrategyTypes[strategyName];
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			expect(eventHandler.strategy).to.be.an.instanceOf(expectedType);
		});

		it('Sets correct peers', () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const expectedPeers = expectedStrategyPeers[strategyName];
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
			expect(eventHandler.strategy.getPeers()).to.equal(expectedPeers);
		});
	}));

	strategyNames.filter((strategyName) => strategyName.startsWith('PREFER_')).forEach((strategyName) => describe(`${strategyName} (no peers in organization)`, () => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const createTxEventHandler:TxEventHandlerFactory = EventStrategies[strategyName];

		let eventHandler;

		beforeEach(() => {
			gateway.getIdentity.returns({
				mspId: otherMspId,
				type: 'stub'
			});
			eventHandler = createTxEventHandler(transactionId, network);
		});

		it('Sets correct peers', () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
			expect(eventHandler.strategy.getPeers()).to.equal(networkPeers);
		});
	}));
});
