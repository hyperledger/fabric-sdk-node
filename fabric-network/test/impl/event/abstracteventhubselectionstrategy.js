/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
const expect = chai.expect;

const AbstractEventHubSelectionStrategy = require('fabric-network/lib/impl/event/abstracteventhubselectionstrategy');

describe('AbstractEventHubStrategy', () => {
	let strategy;
	let peers;

	beforeEach(() => {
		peers = ['peer1'];
		strategy = new AbstractEventHubSelectionStrategy(peers);
	});
	describe('#getNextPeer', () => {
		it('should throw', () => {
			expect(() => strategy.getNextPeer()).to.throw(/Abstract/);
		});
	});
	describe('#updateEventHubAvailability', () => {
		it('should throw', () => {
			expect(strategy.updateEventHubAvailability()).to.be.undefined;
		});
	});

	describe('#getPeers', () => {
		it('should return a list of peers', () => {
			expect(strategy.getPeers()).to.equal(peers);
		});
	});
});
