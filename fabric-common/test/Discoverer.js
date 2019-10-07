/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
/* eslint-disable no-useless-call */

const rewire = require('rewire');
const DiscovererRewire = rewire('../lib/Discoverer');
const Discoverer = require('../lib/Discoverer');
const Client = require('../lib/Client');

const chai = require('chai');
chai.should();
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const sinon = require('sinon');

describe('Discoverer', () => {
	const client = new Client('myclient');
	let discoverer;
	let endpoint;

	beforeEach(async () => {
		discoverer = new DiscovererRewire('mydiscoverer', client, 'msp1');
		endpoint = client.newEndpoint({url: 'grpc://host:2700'});
		discoverer.endpoint = endpoint;
		discoverer.connected = true;
		discoverer.options = {};
		discoverer.service = sinon.stub();
	});

	describe('#constructor', () => {
		it('should require name', () => {
			(() => {
				new Discoverer();
			}).should.throw('Missing name parameter');
		});
		it('should require client', () => {
			(() => {
				new Discoverer('name');
			}).should.throw('Missing client parameter');
		});
	});

	describe('#sendDiscovery', () => {
		it('should reject if no envelope', async () => {
			await discoverer.sendDiscovery().should.be.rejectedWith(/Missing signedEnvelope parameter/);
		});

		it('should reject if not connected', async () => {
			discoverer.connected = false;
			await discoverer.sendDiscovery('send').should.be.rejectedWith(/is not connected/);
		});
		it('should reject on timeout', async () => {
			function Fake(params, callback) {
				setTimeout(() => {
					callback.call(null, 'timeout not honoured');
				}, 10);
			}
			discoverer.service.discover = sinon.stub().callsFake(Fake);

			await discoverer.sendDiscovery('send', 0).should.be.rejectedWith(/REQUEST TIMEOUT/);

		});
		it('should reject Error object on discover response error string', async () => {
			function Fake(params, callback) {
				callback.call(null, 'i_am_an_error', null);
			}
			discoverer.service.discover = sinon.stub().callsFake(Fake);

			await discoverer.sendDiscovery('send').should.be.rejectedWith(/i_am_an_error/);
		});
		it('should reject Error object on send discover error object', async () => {
			function Fake(params, callback) {
				callback.call(null, new Error('FORCED_ERROR'), null);
			}
			discoverer.service.discover = sinon.stub().callsFake(Fake);

			await discoverer.sendDiscovery('send').should.be.rejectedWith(/FORCED_ERROR/);
		});

		it('should eject on undefined discover response', async () => {
			function Fake(params, callback) {
				callback.call(null, null, null);
			}
			discoverer.service.discover = sinon.stub().callsFake(Fake);

			await discoverer.sendDiscovery('send').should.be.rejectedWith('GRPC service failed to get a proper response from the peer grpc://host:2700.');
		});
		it('should get the discover response if returned', async () => {
			function Fake(params, callback) {
				callback.call(null, null, {response: {status: 400, message: 'fail_string'}});
			}
			discoverer.service.discover = sinon.stub().callsFake(Fake);

			const results = await discoverer.sendDiscovery('send');
			results.response.status.should.equal(400);
			results.response.message.should.equal('fail_string');
			results.connection.name.should.equal('mydiscoverer');
			results.connection.url.should.equal('grpc://host:2700');
		});
	});
});
