/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const rewire = require('rewire');
const EventerRewire = rewire('../lib/Eventer');
const Eventer = require('../lib/Eventer');
const Client = require('../lib/Client');


const chai = require('chai');
const should = chai.should();
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const sinon = require('sinon');
const FILTERED_BLOCK = 'filtered';
const FULL_BLOCK = 'full';
const PRIVATE_BLOCK = 'private';

describe('Eventer', () => {
	const client = new Client('myclient');
	let eventer;
	let endpoint;

	beforeEach(async () => {
		eventer = new EventerRewire('myeventer', client, 'msp1');
		endpoint = client.newEndpoint({url: 'grpc://host:2700'});
		eventer.endpoint = endpoint;
		eventer.connected = false;
		eventer.isConnectable = sinon.stub().returns(true);
		eventer.options = {};
		eventer.service = sinon.stub();
		eventer.service.close = sinon.stub();
		eventer.service.deliverFiltered = sinon.stub().returns(FILTERED_BLOCK);
		eventer.service.deliver = sinon.stub().returns(FULL_BLOCK);
		eventer.service.deliverWithPrivateData = sinon.stub().returns(PRIVATE_BLOCK);
		eventer.stream = sinon.stub();
		eventer.stream.cancel = sinon.stub();
		eventer.stream.resume = sinon.stub();
		eventer.stream.end = sinon.stub();

		sinon.addBehavior('setsConnected', (fake, n) => {
			eventer.connected = n;
		});
	});

	describe('#constructor', () => {
		it('should require name', () => {
			(() => {
				new Eventer();
			}).should.throw('Missing name parameter');
		});
		it('should require client', () => {
			(() => {
				new Eventer('name');
			}).should.throw('Missing client parameter');
		});
	});
	describe('#disconnect', () => {
		it('should run when not connected', () => {
			eventer.disconnect();
			should.equal(eventer.stream, null);
		});
		it('should disconnect', () => {
			eventer.stream = null;
			eventer.disconnect();
			should.equal(eventer.stream, null);
		});
	});
	describe('#checkConnection', () => {
		it('should return true when connected start true with reset (default)', async () => {
			eventer.connected = true;
			const results = await eventer.checkConnection();
			should.equal(results, true);
		});
		it('should return true when connected start false with no reset', async () => {
			eventer.connected = false;
			const results = await eventer.checkConnection(false);
			should.equal(results, false);
		});
		it('should return true with waitForReady throws with reset', async () => {
			eventer.disconnect = sinon.stub();
			eventer.waitForReady = sinon.stub().rejects();
			const results = await eventer.checkConnection();
			should.equal(results, false);
		});
		it('should return true with waitForReady sets connected true', async () => {
			eventer.connected = true;
			eventer.disconnect = sinon.stub();
			eventer.waitForReady = sinon.stub().setsConnected(true);
			const results = await eventer.checkConnection();
			should.equal(results, true);
		});
		it('should return true with waitForReady false resetConnection false', async () => {
			eventer.connected = true;
			eventer.disconnect = sinon.stub();
			eventer.waitForReady = sinon.stub().setsConnected(false);
			eventer.resetConnection = sinon.stub().setsConnected(false);
			const results = await eventer.checkConnection();
			should.equal(results, false);
		});
		it('should return true with waitForReady false resetConnection true', async () => {
			eventer.connected = true;
			eventer.disconnect = sinon.stub();
			eventer.waitForReady = sinon.stub().setsConnected(false);
			eventer.resetConnection = sinon.stub().setsConnected(true);
			const results = await eventer.checkConnection();
			should.equal(results, true);
		});
		it('should return true with connected false resetConnection false', async () => {
			eventer.connected = false;
			eventer.disconnect = sinon.stub();
			eventer.resetConnection = sinon.stub().setsConnected(false);
			const results = await eventer.checkConnection();
			should.equal(results, false);
		});
		it('should return true with connected false resetConnection true', async () => {
			eventer.connected = false;
			eventer.disconnect = sinon.stub();
			eventer.resetConnection = sinon.stub().setsConnected(true);
			const results = await eventer.checkConnection();
			should.equal(results, true);
		});
	});
	describe('#isStreamReady', () => {
		it('should return true when paused and resumed', () => {
			eventer.stream.isPaused = sinon.stub().returns(true);
			eventer.stream.readable = true;
			eventer.stream.writable = true;
			const results = eventer.isStreamReady();
			should.equal(results, true);
		});
		it('should return true when not paused', () => {
			eventer.stream.isPaused = sinon.stub().returns(false);
			eventer.stream.readable = true;
			eventer.stream.writable = true;
			const results = eventer.isStreamReady();
			should.equal(results, true);
		});
		it('should return false when not paused and stream not readable', () => {
			eventer.stream.isPaused = sinon.stub().returns(false);
			eventer.stream.readable = false;
			eventer.stream.writable = false;
			const results = eventer.isStreamReady();
			should.equal(results, false);
		});
		it('should return false when stream does not exist', () => {
			eventer.stream = null;
			const results = eventer.isStreamReady();
			should.equal(results, false);
		});
	});
	describe('#setStreamByType', () => {
		it('should setStreamByType FILTERED_BLOCK ', () => {
			eventer.setStreamByType(FILTERED_BLOCK);
			eventer.stream.should.be.equal(FILTERED_BLOCK);
		});
		it('should setStreamByType FULL_BLOCK ', () => {
			eventer.setStreamByType(FULL_BLOCK);
			eventer.stream.should.be.equal(FULL_BLOCK);
		});
		it('should setStreamByType PRIVATE_BLOCK ', () => {
			eventer.setStreamByType(PRIVATE_BLOCK);
			eventer.stream.should.be.equal(PRIVATE_BLOCK);
		});
		it('should not setStreamByType with null', () => {
			(() => {
				eventer.setStreamByType();
			}).should.throw('Missing blockType parameter');
		});
		it('should not setStreamByType with unknown', () => {
			(() => {
				eventer.setStreamByType('bad');
			}).should.throw('Unknown block type');
		});
	});
});
