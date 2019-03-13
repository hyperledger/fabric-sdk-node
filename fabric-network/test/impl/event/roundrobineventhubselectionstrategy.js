/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');

const RoundRobinEventHubSelectionStrategy = require('fabric-network/lib/impl/event/roundrobineventhubselectionstrategy');
const Peer = require('fabric-client/lib/Peer');

describe('RoundRobinEventHubSelectionStrategy', () => {
	let sandbox;
	let peer1, peer2;
	let strategy;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		peer1 = sandbox.createStubInstance(Peer);
		peer1.getName.returns('peer1');
		peer2 = sandbox.createStubInstance(Peer);
		peer2.getName.returns('peer2');
		strategy = new RoundRobinEventHubSelectionStrategy([peer1, peer2]);
	});

	afterEach(() => {
		sandbox.reset();
	});

	describe('#constructor', () => {
		it('should create an of peers', () => {
			expect(strategy.peers).to.be.instanceOf(Array);
			expect(strategy.peers).to.deep.equal([peer1, peer2]);
		});

		it('should create an empty array of peers by default', () => {
			const testStrategy = new RoundRobinEventHubSelectionStrategy();
			expect(testStrategy.peers).to.deep.equal([]);
		});
	});

	describe('#getNextPeer', () => {
		let nextPeerStrategy;
		before(() => {
			nextPeerStrategy = new RoundRobinEventHubSelectionStrategy([peer1, peer2]);
		});

		it('should pick peer1 next', () => {
			expect(nextPeerStrategy.getNextPeer()).to.deep.equal(peer1);
		});
		it('should pick peer2 next', () => {
			expect(nextPeerStrategy.getNextPeer()).to.deep.equal(peer2);
		});
	});

	describe('#updateEventHubAvailability', () => {
		it('should not throw if a dead peer is not given', () => {
			expect(() => strategy.updateEventHubAvailability()).not.to.throw();
		});
	});
});
