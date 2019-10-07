/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const rewire = require('rewire');
const CommitterRewire = rewire('../lib/Committer');
const Committer = require('../lib/Committer');
const Client = require('../lib/Client');
const EventEmitter = require('events').EventEmitter;
const PassThrough = require('stream').PassThrough;
const Writable = require('stream').Writable;
const util = require('util');

const chai = require('chai');
chai.should();
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const sinon = require('sinon');

describe('Committer', () => {
	const client = new Client('myclient');
	let orderer;
	let endpoint;
	let broadcast;

	beforeEach(async () => {
		orderer = new CommitterRewire('myorderer', client, 'msp1');
		endpoint = client.newEndpoint({url: 'grpc://host:2700'});
		orderer.endpoint = endpoint;
		orderer.connected = true;
		orderer.options = {};
		orderer.service = sinon.stub();
		broadcast = sinon.stub();
		orderer.service.broadcast = broadcast;
	});

	describe('#constructor', () => {
		it('should require name', () => {
			(() => {
				new Committer();
			}).should.throw('Missing name parameter');
		});
		it('should require client', () => {
			(() => {
				new Committer('name');
			}).should.throw('Missing client parameter');
		});
	});

	describe('#sendBroadcast', () => {
		it('should reject if no envelope', async () => {
			await orderer.sendBroadcast().should.be.rejectedWith(/Missing envelope parameter/);
		});
		it('should reject if not connected', async () => {
			orderer.connected = false;
			await orderer.sendBroadcast('send').should.be.rejectedWith(/is not connected/);
		});
		it('should reject on timeout', async () => {
			const response = new EventEmitter({objectMode: true});
			response.write = sinon.stub();
			response.end = sinon.stub();
			broadcast.returns(response);

			await orderer.sendBroadcast({info: 'inform'}, 1).should.be.rejectedWith(/REQUEST TIMEOUT/);
		});
		it('should reject on invalid request', async () => {
			const response = new PassThrough({objectMode: true});
			response.cancel = sinon.stub();
			response.write({invalid: 'response'});
			broadcast.returns(response);

			await orderer.sendBroadcast('hello').should.be.rejectedWith(/SYSTEM ERROR/);
		});
		it('should reject on receiving an error', async () => {
			util.inherits(Writer, Writable);
			function Writer(opt) {
				Writable.call(this, opt);
			}
			Writer.prototype._write = function(data, encoding, callback) {
				callback(new Error('FORCED_ERROR'));
			};
			const response = new Writer({objectMode: true});
			broadcast.returns(response);

			await orderer.sendBroadcast({status: 'SUCCESS', info: 'my info'}).should.be.rejectedWith(/FORCED_ERROR/);
		});
		it('should reject on receiving an service error', async () => {
			util.inherits(Writer, Writable);
			function Writer(opt) {
				Writable.call(this, opt);
			}
			Writer.prototype._write = function(data, encoding, callback) {
				const myErr = new Error('ForcedError');
				myErr.code = 14;
				callback(myErr);
			};
			const response = new Writer({objectMode: true});
			broadcast.returns(response);

			await orderer.sendBroadcast({status: 'SUCCESS', info: 'my info'}).should.be.rejectedWith(/SERVICE UNAVAILABLE/);
		});
		it('should reject on receiving a 500 error', async () => {
			util.inherits(Writer, Writable);
			function Writer(opt) {
				Writable.call(this, opt);
			}
			Writer.prototype._write = function(data, encoding, callback) {
				const myErr = {};
				myErr.code = 500;
				callback(myErr);
			};
			const response = new Writer({objectMode: true});
			broadcast.returns(response);

			await orderer.sendBroadcast({status: 'SUCCESS', info: 'my info'}).should.be.rejected;
		});
		it('should reject on receiving a valid response', async () => {
			const response = new PassThrough({objectMode: true});
			response.setEncoding = function () { };
			response.cancel = sinon.stub();
			broadcast.returns(response);

			await orderer.sendBroadcast({status: 'SUCCESS', info: 'my info'}).should.be.eventually.deep.equal({status: 'SUCCESS', info: 'my info'});

		});
	});
});
