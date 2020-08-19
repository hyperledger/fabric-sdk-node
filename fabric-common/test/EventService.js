/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
/* eslint-disable no-throw-literal */

const rewire = require('rewire');
const EventService = rewire('../lib/EventService');
const Eventer = rewire('../lib/Eventer');
const Client = rewire('../lib/Client');
const User = require('../lib/User');
const EventListener = require('../lib/EventListener');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();
const sinon = require('sinon');
const Long = require('long');
const Writable = require('stream').Writable;
const util = require('util');

const TestUtils = require('./TestUtils');

describe('EventService', () => {
	TestUtils.setCryptoConfigSettings();

	let FakeLogger;
	let revert;
	let sandbox;
	const client = new Client('myclient');
	client._tls_mutual.clientCertHash = Buffer.from('clientCertHash');
	let channel;
	let eventService;
	let endpoint;
	let eventer;

	const user = User.createUser('user', 'password', 'mspid', TestUtils.certificateAsPEM, TestUtils.keyAsPEM);
	const idx = client.newIdentityContext(user);

	const tmpSetDelete = Set.prototype.delete;
	const chaincode_event = {
		chaincode_id: 'chaincode1',
		event_name: 'event1',
		tx_id: 'tx1',
		payload: 'payload'
	};
	const chaincode_event2 = {
		chaincode_id: 'chaincode2',
		event_name: 'event2',
		tx_id: 'tx2',
		payload: 'payload'
	};
	const block = {
		data: {
			data: [
				{
					payload: {
						data: {
							actions: [
								{
									payload: {
										action: {
											proposal_response_payload: {
												extension: {events: chaincode_event}
											}
										}
									}
								}
							]
						},
						header: {
							channel_header: {type: 3, tx_id: 'tx1', typeString: 'ENDORSER_TRANSACTION'}
						}
					}
				}
			]
		},
		metadata: {
			metadata: ['SIGNATURES', 'LAST_CONFIG', [0]]
		},
		header: {number: 1}
	};
	const filtered_block = {
		filtered_transactions: [
			{
				txid: 'tx1',
				tx_validation_code: 'valid',
				transaction_actions: {
					chaincode_actions: [{chaincode_event: chaincode_event}]
				}
			}, {
				txid: 'tx2',
				tx_validation_code: 'valid',
				transaction_actions: {
					chaincode_actions: [{chaincode_event: chaincode_event}, {chaincode_event: chaincode_event2}]
				}
			}, {
				txid: 'tx3',
				tx_validation_code: 'valid',
				transaction_actions: {
					chaincode_actions: [{chaincode_event: chaincode_event}]
				}
			}
		],
		number: 1
	};
	const block_and_private_data = {
		block: block,
		private_data_map: 'fake-private-map'
	};

	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();

		FakeLogger = {
			debug: () => {
			},
			error: () => {
			},
			warn: () => {
			}
		};
		sandbox.stub(FakeLogger);
		revert.push(EventService.__set__('logger', FakeLogger));

		channel = client.newChannel('mychannel');
		eventService = new EventService('myhub', channel);
		endpoint = client.newEndpoint({url: 'grpc://host:2700'});
		eventer = new Eventer('eventer1', client);
		eventer.endpoint = endpoint;
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
		Set.prototype.delete = tmpSetDelete;
	});

	describe('#constructor', () => {
		it('should log on entry', () => {
			new EventService({}, {});
			sinon.assert.calledWith(FakeLogger.debug, 'EventService.constructor[myhub] - start ');
		});
		it('should throw if name arg not given', () => {
			(() => {
				new EventService();
			}).should.throw(/Missing name parameter/);
		});
		it('should throw if channel arg not given', () => {
			(() => {
				new EventService('myhub');
			}).should.throw(/Missing channel parameter/);
		});
		it('should create and have these settings by default', () => {
			const eventService2 = new EventService('myhub', channel);
			eventService2.name.should.equal('myhub');
			eventService2.type.should.equal('EventService');
			eventService2.channel.should.be.deep.equal(channel);
			should.equal(eventService2.lastBlockNumber, null);
			eventService2.startBlock.should.equal('newest');
			should.equal(eventService2.endBlock, undefined);
			eventService2._endBlockSeen.should.be.false;
			eventService2._haveBlockListeners.should.be.false;
			eventService2._haveTxListeners.should.be.false;
			eventService2._haveChaincodeListeners.should.be.false;
			should.equal(eventService2.targets, null);
			should.equal(eventService2._currentEventer, null);
			eventService2._closeRunning.should.be.false;
			eventService2.blockType.should.be.equal('filtered');
			eventService2.replay.should.be.false;
			eventService2.startSpecified.should.be.false;
		});
	});

	describe('#setTargets', () => {
		it('should require targets', () => {
			(() => {
				eventService.setTargets();
			}).should.throw('Missing targets parameter');
		});
		it('should require targets as an array', () => {
			(() => {
				eventService.setTargets(eventer);
			}).should.throw('targets parameter is not an array');
		});
		it('should require targets as an empty array', () => {
			(() => {
				eventService.setTargets([]);
			}).should.throw('No targets provided');
		});
		it('should throw when target not connected', () => {
			(() => {
				eventer.isConnectable = sinon.stub().returns(false);
				eventService.setTargets([eventer]);
			}).should.throw('Eventer eventer1 is not connectable');
		});
		it('should handle connected target', () => {
			eventer.connected = true;
			eventService.setTargets([eventer]);
			should.equal(eventService.targets[0].type, 'Eventer');
			should.equal(eventService.targets[0].name, 'eventer1');
		});
		it('should handle connectable target', () => {
			eventer.connected = false;
			eventer.isConnectable = sinon.stub().returns(true);
			eventService.setTargets([eventer]);
			should.equal(eventService.targets[0].type, 'Eventer');
			should.equal(eventService.targets[0].name, 'eventer1');
		});
	});

	describe('#getLastBlockNumber', () => {
		it('should return null if no block seen', () => {
			should.equal(eventService.getLastBlockNumber(), null);
		});

		it('should return a long if it has been seen', () => {
			eventService.lastBlockNumber = Long.fromValue(1);
			should.equal(eventService.getLastBlockNumber().toInt(), 1);
		});
	});

	describe('#close', () => {
		it('should close', () => {
			eventService._close = sinon.stub();
			eventService.close();
			sinon.assert.called(eventService._close);
		});
	});

	describe('#_close', () => {
		it('should throw if reason_error arg not given', () => {
			(() => {
				eventService._close();
			}).should.throw(/Missing reasonError parameter/);
		});
		it('should see close is already running', () => {
			eventService._closeRunning = true;
			eventService._close(new Error('test'));
			sinon.assert.calledWith(FakeLogger.debug, '%s - close is running - exiting');
		});
		it('should close without an eventer endpoint being assigned', () => {
			eventService._closeAllCallbacks = sinon.stub();
			eventService._close(new Error('test'));
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
		});
		it('should close if the eventer assigned', () => {
			eventService._closeAllCallbacks = sinon.stub();
			eventService.eventer = sinon.stub();
			eventService.eventer.disconnect = sinon.stub();
			eventService._close(new Error('test'));
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
		});
	});

	describe('#build', () => {
		it('should require a idContext', () => {
			(() => {
				eventService.build();
			}).should.throw('Missing idContext parameter');
		});
		it('startBlock not greater than endBlock', () => {
			(() => {
				const options = {
					startBlock: 10,
					endBlock: 9
				};
				eventService.build(idx, options);
			}).should.throw('"startBlock" must not be greater than "endBlock"');
		});
		it('startBlock not greater than endBlock, newest is bigger than oldest', () => {
			(() => {
				const options = {
					startBlock: 'newest',
					endBlock: 'oldest'
				};
				eventService.build(idx, options);
			}).should.throw('"startBlock" must not be greater than "endBlock"');
		});
		it('startBlock not greater than endBlock, startBlock defaults to newest', () => {
			(() => {
				const options = {
					endBlock: 'oldest'
				};
				eventService.build(idx, options);
			}).should.throw('"startBlock" must not be greater than "endBlock"');
		});
		it('startBlock is not valid', () => {
			(() => {
				const options = {
					startBlock: 'bad',
					endBlock: 9
				};
				eventService.build(idx, options);
			}).should.throw('value:bad is not a valid number');
		});
		it('endBlock is not valid', () => {
			(() => {
				const options = {
					startBlock: 10,
					endBlock: 'bad'
				};
				eventService.build(idx, options);
			}).should.throw('value:bad is not a valid number');
		});
		it('endBlock is not valid', () => {
			(() => {
				const options = {
					startBlock: 10,
					endBlock: 'bad'
				};
				eventService.build(idx, options);
			}).should.throw('value:bad is not a valid number');
		});
		it('blocktype must be a string', () => {
			(() => {
				const options = {
					blockType: {}
				};
				eventService.build(idx, options);
			}).should.throw('"blockType must be a string');
		});
		it('blocktype must be valid', () => {
			(() => {
				const options = {
					blockType: 'bad'
				};
				eventService.build(idx, options);
			}).should.throw('Invalid blockType bad');
		});
		it('blocktype full', () => {
			const options = {
				blockType: 'full'
			};
			eventService.build(idx, options);
			should.exist(eventService._payload);
			should.equal(eventService.blockType, 'full');
		});
		it('blocktype filtered', () => {
			const options = {
				blockType: 'filtered'
			};
			eventService.build(idx, options);
			should.exist(eventService._payload);
			should.equal(eventService.blockType, 'filtered');
		});
		it('blocktype private', () => {
			const options = {
				blockType: 'private'
			};
			eventService.build(idx, options);
			should.exist(eventService._payload);
			should.equal(eventService.blockType, 'private');
		});
		it('should build with default options', () => {
			eventService.build(idx);
			should.exist(eventService._payload);
		});
		it('should build with startBlock and endBlock as valid numbers', () => {
			const options = {
				startBlock: 9,
				endBlock: 10
			};
			eventService.build(idx, options);
			should.exist(eventService._payload);
			should.equal(eventService.startSpecified, true);
		});
		it('should build with startBlock and endBlock as valid numbers', () => {
			const options = {
				startBlock: '9',
				endBlock: '10'
			};
			eventService.build(idx, options);
			should.exist(eventService._payload);
		});
		it('should build with startBlock and endBlock as valid numbers', () => {
			const options = {
				startBlock: Long.fromValue(9),
				endBlock: Long.fromValue(10)
			};
			eventService.build(idx, options);
			should.exist(eventService._payload);
		});
		it('should build with startBlock and endBlock as valid strings', () => {
			const options = {
				startBlock: 'newest',
				endBlock: 'newest'
			};
			eventService.build(idx, options);
			should.exist(eventService._payload);
		});
		it('should build with startBlock and endBlock as valid strings', () => {
			const options = {
				startBlock: 'oldest',
				endBlock: 'oldest'
			};
			eventService.build(idx, options);
			should.exist(eventService._payload);
		});
		it('should build with startBlock and endBlock as valid strings', () => {
			const options = {
				endBlock: 'newest'
			};
			eventService.build(idx, options);
			should.exist(eventService._payload);
		});
		it('should build with startBlock and endBlock as valid strings', () => {
			const options = {
				startBlock: 'oldest'
			};
			eventService.build(idx, options);
			should.exist(eventService._payload);
		});
		it('should build with startBlock and endBlock as valid strings', () => {
			const options = {
				startBlock: 'newest'
			};
			eventService.build(idx, options);
			should.exist(eventService._payload);
		});
	});

	describe('#send', () => {
		it('throws if targets is missing', async () => {
			await eventService.send().should.be.rejectedWith('Missing targets parameter');
		});
		it('throws if eventer stream is running', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.stream = sinon.stub();
			eventService._payload =  Buffer.from('payload');
			eventService._signature = Buffer.from('signature');
			await eventService.send({targets: [eventer1]}).should.be.rejectedWith('Event service eventer1 is currently listening');
		});
		it('throws if eventer is not connected', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.isConnectable = sinon.stub().returns(false);
			eventer1.checkConnection = sinon.stub().returns(false);
			eventService._payload =  Buffer.from('payload');
			eventService._signature = Buffer.from('signature');
			await eventService.send({targets: [eventer1]}).should.be.rejectedWith('Event service eventer1 is not connected');
		});
		it('runs ok', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.isConnectable = sinon.stub().returns(true);
			eventer1.connect = sinon.stub().resolves(true);
			eventer1.checkConnection = sinon.stub().resolves(true);
			sinon.stub(eventService, '_startService').resolves(eventer1);
			eventService._payload =  Buffer.from('payload');
			eventService._signature = Buffer.from('signature');
			await eventService.send({targets: [eventer1]});
			eventService._currentEventer.should.be.deep.equal(eventer1);
		});
		it('rejects if not built and signed', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.checkConnection = sinon.stub().returns(true);
			await eventService.send({targets: [eventer1]}).should.be.rejectedWith('The send payload has not been built');
		});
		it('rejects and has failed stream message', async () => {
			const eventer1 = client.newEventer('eventer1');
			sinon.stub(eventService, '_startService').rejects(Error('failed'));
			eventService._payload =  Buffer.from('payload');
			eventService._signature = Buffer.from('signature');
			eventer1.isConnectable = sinon.stub().returns(true);
			eventer1.connect = sinon.stub().resolves(true);
			eventer1.checkConnection = sinon.stub().resolves(true);
			await eventService.send({targets: [eventer1]}).should.be.rejectedWith('failed');
			sinon.assert.calledWith(FakeLogger.error, '%s - Starting stream to %s failed');
		});
	});

	describe('#_startService', () => {
		let eventProtoDeliverStub;
		let deliverFilteredStub;
		let deliverStub;
		let deliverWithPrivateDataStub;
		let onStub;
		let isStreamReadyStub;
		let decodeBlockStub;
		let decodeBlockWithPrivateData;

		beforeEach(() => {
			isStreamReadyStub = sandbox.stub();
			revert.push(EventService.__set__('isStreamReady', isStreamReadyStub));
			decodeBlockStub = sandbox.stub();
			decodeBlockStub.returns(block);
			revert.push(EventService.__set__(' BlockDecoder.decodeBlock', decodeBlockStub));
			decodeBlockWithPrivateData = sandbox.stub();
			decodeBlockWithPrivateData.returns(block_and_private_data);
			revert.push(EventService.__set__(' BlockDecoder.decodeBlockWithPrivateData', decodeBlockWithPrivateData));

			onStub = sandbox.stub();
			deliverWithPrivateDataStub = sandbox.stub().returns({on: onStub});
			deliverFilteredStub = sandbox.stub().returns({on: onStub});
			deliverStub = sandbox.stub().returns({on: onStub});
			eventProtoDeliverStub = sandbox.stub().returns({
				deliverFiltered: deliverFilteredStub,
				deliver: deliverStub,
				deliverWithPrivateData: deliverWithPrivateDataStub
			});
			revert.push(Eventer.__set__('fabproto6.services.protos.Deliver', eventProtoDeliverStub));

			eventService = new EventService('myhub', channel);
		});
		it('throws timeout on stream', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.endpoint = endpoint;
			eventer1.checkConnection = sinon.stub().returns(true);
			const stream = sinon.stub();
			stream.on = sinon.stub();
			stream.write = sinon.stub();
			eventer1.setStreamByType = function() {
				this.stream = stream;
			};
			eventService.blockType = 'full';
			await eventService._startService(eventer1, {}, 10).should.be.rejectedWith('Event service timed out - Unable to start listening');
		});
		it('throws timeout on stream', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.endpoint = endpoint;
			eventer1.checkConnection = sinon.stub().returns(true);
			const stream = sinon.stub();
			stream.on = sinon.stub();
			stream.write = sinon.stub();
			eventer1.setStreamByType = function() {
				this.stream = stream;
			};
			eventService.blockType = 'full';
			eventService.startSpecified = true;
			await eventService._startService(eventer1, {}, 10);
			eventService.close();
		});
		it('throws error on stream write', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.endpoint = endpoint;
			eventer1.checkConnection = sinon.stub().returns(true);
			const stream = sinon.stub();
			stream.on = sinon.stub();
			stream.write = sinon.stub().throws(Error('failed write'));
			eventer1.setStreamByType = function() {
				this.stream = stream;
			};
			eventService.blockType = 'full';
			await eventService._startService(eventer1, {}, 10).should.be.rejectedWith('failed write');
		});
		it('rejects error on stream receive error', async () => {
			util.inherits(Writer, Writable);
			function Writer(opt) {
				Writable.call(this, opt);
			}
			Writer.prototype._write = function(data, encoding, callback) {
				const myErr = new Error('ForcedError');
				myErr.code = 14;
				callback(myErr);
			};
			const stream = new Writer({objectMode: true});
			const eventer1 = client.newEventer('eventer1');
			eventer1.endpoint = endpoint;
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.setStreamByType = function() {
				this.stream = stream;
			};
			eventService.blockType = 'full';
			await eventService._startService(eventer1, {}, 10).should.be.rejectedWith('ForcedError');
		});
		it('rejects error on stream receive error with eventer assigned', async () => {
			util.inherits(Writer, Writable);
			function Writer(opt) {
				Writable.call(this, opt);
			}
			Writer.prototype._write = function(data, encoding, callback) {
				const myErr = new Error('ForcedError');
				myErr.code = 14;
				callback(myErr);
			};
			const stream = new Writer({objectMode: true});
			const eventer1 = client.newEventer('eventer1');
			eventer1.endpoint = endpoint;
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.setStreamByType = function() {
				this.stream = stream;
			};
			eventService.blockType = 'full';
			eventService._close = sinon.stub();
			eventService._currentEventer = sinon.stub();
			eventService._currentEventer.disconnect = sinon.stub();
			await eventService._startService(eventer1, {}, 10).should.be.rejectedWith('ForcedError');
			sinon.assert.called(eventService._close);
		});
		it('should call stream on data and log about an unknown response', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.waitForReady = sandbox.stub().resolves();
			await eventer1.connect(endpoint);
			eventService.blockType = 'full';
			onStub.yields({Type: 'unknown'});
			// TEST CALL
			await eventService._startService(eventer1, {}, 3000);
			sinon.assert.called(deliverStub);
			sinon.assert.calledWith(FakeLogger.error, 'on.data %s- unknown deliverResponse type %s');
		});
		it('should call stream on data and log about a block response with no listeners', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.waitForReady = sandbox.stub().resolves();
			await eventer1.connect(endpoint);
			eventService.blockType = 'full';
			onStub.yields({Type: 'block', block: block});
			// TEST CALL for full block
			await eventService._startService(eventer1, {}, 3000);
			sinon.assert.called(deliverStub);
			sinon.assert.calledWith(FakeLogger.debug, 'on.data %s- have full block data');
		});
		it('should call stream on data and log about a filtered block response with no listeners', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.waitForReady = sandbox.stub().resolves();
			await eventer1.connect(endpoint);
			eventService.blockType = 'filtered';
			onStub.yields({Type: 'filtered_block', filtered_block: filtered_block});
			// TEST CALL for filtered data
			await eventService._startService(eventer1, {}, 3000);
			sinon.assert.called(deliverFilteredStub);
			sinon.assert.calledWith(FakeLogger.debug, 'on.data %s- have filtered block data');
		});
		it('should call stream on data and log about a private block response with no listeners', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.waitForReady = sandbox.stub().resolves();
			await eventer1.connect(endpoint);
			eventService.blockType = 'private';
			onStub.yields({Type: 'block_and_private_data', block_and_private_data: block_and_private_data});
			// TEST CALL for private data
			await eventService._startService(eventer1, {}, 3000);
			sinon.assert.called(deliverWithPrivateDataStub);
			sinon.assert.called(decodeBlockWithPrivateData);
			sinon.assert.calledWith(FakeLogger.debug, 'on.data %s- have full block data with private data');
		});
		it('should call stream on data and log about a block response with matching endblock', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.waitForReady = sandbox.stub().resolves();
			await eventer1.connect(endpoint);
			eventService.blockType = 'full';
			eventService.endBlock = Long.fromValue(1);
			onStub.yields({Type: 'block', block: 'place holder'});
			eventService._close = sinon.stub();
			// TEST CALL
			await eventService._startService(eventer1, {}, 3000);
			sinon.assert.called(deliverStub);
			sinon.assert.called(eventService._close);
			sinon.assert.calledWith(FakeLogger.debug, 'on.data %s- incoming block number %s');
		});
		it('should call stream on data and catch an error', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.waitForReady = sandbox.stub().resolves();
			await eventer1.connect(endpoint);
			eventService.blockType = 'full';
			onStub.yields({Type: 'block', block: 'place holder'});
			eventService._close = sinon.stub();
			eventService._processEndBlock = sinon.stub().throws(Error('onData Error'));
			// TEST CALL
			await eventService._startService(eventer1, {}, 3000);
			sinon.assert.called(deliverStub);
			sinon.assert.called(eventService._close);
			sinon.assert.calledWith(FakeLogger.error, 'on.data %s- EventService has detected an error %s');
		});
		it('should call close when on data with SUCCESS status and end block seen', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.waitForReady = sandbox.stub().resolves();
			await eventer1.connect(endpoint);
			eventService.blockType = 'full';
			onStub.yields({Type: 'status', status: 'SUCCESS'});
			eventService._close = sinon.stub();
			eventService._endBlockSeen = true;
			eventService.lastBlockNumber = Long.fromValue(1);
			eventService.endBlock = Long.fromValue(1);
			// TEST CALL
			await eventService._startService(eventer1, {}, 3000);
			sinon.assert.called(deliverStub);
			sinon.assert.notCalled(eventService._close);
			sinon.assert.calledWith(FakeLogger.debug, 'on.data %s- received type status of SUCCESS');
			sinon.assert.calledWith(FakeLogger.debug, 'on.data %s- status received after last block seen: %s blockNumber: %s');
		});
		it('should call close when on data with status SUCCESS and end block seen and newest block seen', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.waitForReady = sandbox.stub().resolves();
			await eventer1.connect(endpoint);
			eventService.blockType = 'full';
			onStub.yields({Type: 'status', status: 'SUCCESS'});
			eventService._close = sinon.stub();
			eventService._endBlockSeen = false;
			eventService.lastBlockNumber = Long.fromValue(1);
			eventService.endBlock = 'newest';
			// TEST CALL
			await eventService._startService(eventer1, {}, 3000);
			sinon.assert.called(deliverStub);
			sinon.assert.called(eventService._close);
			sinon.assert.calledWith(FakeLogger.debug, 'on.data %s- received type status of SUCCESS');
			sinon.assert.calledWith(FakeLogger.debug, 'on.data %s- status received when newest block seen: %s blockNumber: %s');
		});
		it('should call close when on data with status SUCCESS and end block not seen', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.waitForReady = sandbox.stub().resolves();
			await eventer1.connect(endpoint);
			eventService.blockType = 'full';
			onStub.yields({Type: 'status', status: 'SUCCESS'});
			eventService._close = sinon.stub();
			eventService._endBlockSeen = false;
			eventService.lastBlockNumber = Long.fromValue(1);
			eventService.endBlock = Long.fromValue(3);
			// TEST CALL
			await eventService._startService(eventer1, {}, 3000);
			sinon.assert.called(deliverStub);
			sinon.assert.called(eventService._close);
			sinon.assert.calledWith(FakeLogger.debug, 'on.data %s- received type status of SUCCESS');
			sinon.assert.calledWith(FakeLogger.error, 'on.data %s- status SUCCESS received before the configured endblock has been seen');
		});
		it('should close when on data with status of SUCCESS and end block not seen with still need blocks', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.waitForReady = sandbox.stub().resolves();
			await eventer1.connect(endpoint);
			eventService.blockType = 'full';
			onStub.yields({Type: 'status', status: 'SUCCESS'});
			eventService._close = sinon.stub();
			eventService._endBlockSeen = false;
			eventService.lastBlockNumber = Long.fromValue(4);
			eventService.endBlock = Long.fromValue(3);
			// TEST CALL
			await eventService._startService(eventer1, {}, 3000);
			sinon.assert.called(deliverStub);
			sinon.assert.called(eventService._close);
			sinon.assert.calledWith(FakeLogger.debug, 'on.data %s- received type status of SUCCESS');
			sinon.assert.calledWith(FakeLogger.error, 'on.data %s- status SUCCESS received while blocks are required');
		});
		it('should close when on data with status of NOT FOUND end block not seen', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.waitForReady = sandbox.stub().resolves();
			await eventer1.connect(endpoint);
			eventService.blockType = 'full';
			onStub.yields({Type: 'status', status: 'NOT_FOUND'});
			eventService._close = sinon.stub();
			eventService._endBlockSeen = false;
			eventService.lastBlockNumber = Long.fromValue(1);
			eventService.endBlock = Long.fromValue(3);
			// TEST CALL
			await eventService._startService(eventer1, {}, 3000);
			sinon.assert.called(deliverStub);
			sinon.assert.called(eventService._close);
			sinon.assert.calledWith(FakeLogger.debug, 'on.data %s- received type status of NOT_FOUND');
			sinon.assert.calledWith(FakeLogger.error, 'on.data %s- Configured endblock does not exist');
		});
		it('should close when on data with status of NOT FOUND and still need blocks', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.waitForReady = sandbox.stub().resolves();
			await eventer1.connect(endpoint);
			eventService.blockType = 'full';
			onStub.yields({Type: 'status', status: 'NOT_FOUND'});
			eventService._close = sinon.stub();
			eventService._endBlockSeen = false;
			eventService.lastBlockNumber = Long.fromValue(1);
			eventService.endBlock = null;
			// TEST CALL
			await eventService._startService(eventer1, {}, 3000);
			sinon.assert.called(deliverStub);
			sinon.assert.called(eventService._close);
			sinon.assert.calledWith(FakeLogger.debug, 'on.data %s- received type status of NOT_FOUND');
			sinon.assert.calledWith(FakeLogger.error, 'on.data %s- NOT_FOUND status received - last block received %s');
		});
		it('should call stream on data with type status of SUCCESS', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.waitForReady = sandbox.stub().resolves();
			await eventer1.connect(endpoint);
			eventService.blockType = 'full';
			onStub.yields({Type: 'status', status: 'SUCCESS'});
			eventService._close = sinon.stub();
			// TEST CALL
			await eventService._startService(eventer1, {}, 3000);
			sinon.assert.called(deliverStub);
			sinon.assert.notCalled(eventService._close);
			sinon.assert.calledWith(FakeLogger.debug, 'on.data %s- received type status of SUCCESS');
		});
		it('should call stream on data with type status of not SUCCESS', async () => {
			const eventer1 = client.newEventer('eventer1');
			eventer1.checkConnection = sinon.stub().returns(true);
			eventer1.waitForReady = sandbox.stub().resolves();
			await eventer1.connect(endpoint);
			eventService.blockType = 'full';
			onStub.yields({Type: 'status', status: 'BAD'});
			eventService._close = sinon.stub();
			// TEST CALL
			await eventService._startService(eventer1, {}, 3000);
			sinon.assert.called(deliverStub);
			sinon.assert.called(eventService._close);
			sinon.assert.calledWith(FakeLogger.error, 'on.data %s- unexpected deliverResponse status received - %s');
		});
	});

	describe('#isStarted', () => {
		it('should return true', () => {
			eventService._currentEventer = sinon.stub();
			eventService._currentEventer.isStreamReady = sinon.stub().returns(true);
			const results = eventService.isStarted();
			results.should.be.true;
		});
		it('should return false', () => {
			eventService._currentEventer = sinon.stub();
			eventService._currentEventer.isStreamReady = sinon.stub().returns(false);
			const results = eventService.isStarted();
			results.should.be.false;
		});
		it('should return false when no eventer assigned', () => {
			const results = eventService.isStarted();
			results.should.be.false;
		});
	});

	describe('#hasListeners', () => {
		it('should return true', () => {
			eventService._eventListenerRegistrations.set('something', 'else');
			const results = eventService.hasListeners();
			results.should.be.true;
		});
		it('should return false', () => {
			const results = eventService.hasListeners();
			results.should.be.false;
		});
	});

	describe('#_closeAllCallbacks', () => {
		it('should run when no event registrations', () => {
			eventService._closeAllCallbacks();
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
		});
		it('should remove call all and remove all registrations', () => {
			const registrations = new Map();
			const eventOnEventStub1 = sinon.stub();
			registrations.set('event1', {onEvent: eventOnEventStub1});
			eventService._eventListenerRegistrations = registrations;
			eventService._closeAllCallbacks();
			sinon.assert.called(eventOnEventStub1);
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
			sinon.assert.calledWith(FakeLogger.debug, '%s - tell listener of the error:%s');
			should.equal(registrations.size, 0);
		});
	});

	describe('#_checkBlockNum', () => {
		it('should run when undefined', () => {
			const results = eventService._checkBlockNum();
			should.equal(results, null);
		});
		it('should run when null', () => {
			const results = eventService._checkBlockNum(null);
			should.equal(results, null);
		});
		it('should return newest', () => {
			const results = eventService._checkBlockNum('NEWEST');
			should.equal(results, 'newest');
		});
		it('should return oldest', () => {
			const results = eventService._checkBlockNum('Oldest');
			should.equal(results, 'oldest');
		});
		it('should return 10 Long', () => {
			const results = eventService._checkBlockNum('10');
			results.should.be.deep.equal(Long.fromValue(10));
		});
		it('should return 10 Long', () => {
			const results = eventService._checkBlockNum(10);
			results.should.be.deep.equal(Long.fromValue(10));
		});
	});

	describe('#unregisterEventListener', () => {
		it('should throw if eventListener not given', () => {
			(() => {
				eventService.unregisterEventListener();
			}).should.throw(/Missing eventListener parameter/);
		});
		it('should throw if eventListener not found', () => {
			(() => {
				eventService.unregisterEventListener('bad');
			}).should.throw(/eventListener not found/);
		});
		it('should not throw if eventListener not found', () => {
			eventService.unregisterEventListener('bad', true);
		});
		it('should run when found', () => {
			const eventListener = new EventListener('eventService', 'block', sinon.stub());
			const registrations = new Map();
			registrations.set(eventListener, eventListener);
			eventService._eventListenerRegistrations = registrations;
			const results = eventService.unregisterEventListener(eventListener);
			should.equal(results, eventService);
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
		});
		it('should set the have flags', () => {
			const registrations = new Map();
			const eventListener = new EventListener('eventService', 'block', sinon.stub());
			registrations.set(eventListener, eventListener);
			const eventListener1 = new EventListener('eventService', 'block', sinon.stub());
			registrations.set(eventListener1, eventListener1);
			const eventListener2 = new EventListener('eventService', 'tx', sinon.stub(), null, 'txid');
			registrations.set(eventListener2, eventListener2);
			const eventListener3 = new EventListener('eventService', 'chaincode', sinon.stub(), null, 'eventname', 'chaincode');
			registrations.set(eventListener3, eventListener3);
			eventService._eventListenerRegistrations = registrations;
			const results = eventService.unregisterEventListener(eventListener);
			should.equal(results, eventService);
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
			eventService._haveBlockListeners.should.be.true;
			eventService._haveTxListeners.should.be.true;
			eventService._haveChaincodeListeners.should.be.true;
		});
	});

	describe('#registerChaincodeListener', () => {
		it('should throw if chaincodeId not given', () => {
			(() => {
				eventService.registerChaincodeListener();
			}).should.throw(/Missing chaincodeId parameter/);
		});
		it('should throw if eventName not given', () => {
			(() => {
				eventService.registerChaincodeListener('chaincodeId');
			}).should.throw(/Missing eventName parameter/);
		});
		it('should throw if callback not given', () => {
			(() => {
				eventService.registerChaincodeListener('chaincodeId', 'eventname');
			}).should.throw(/Missing callback parameter/);
		});
		it('should set the have flag', () => {
			eventService._haveChaincodeListeners.should.be.false;
			eventService.registerChaincodeListener('chaincodeId', 'eventname', sinon.stub());
			eventService._haveChaincodeListeners.should.be.true;
		});
		it('should set the have flag with options', () => {
			eventService._haveChaincodeListeners.should.be.false;
			eventService.registerChaincodeListener('chaincoderId', 'eventname', sinon.stub(), {unregister: false});
			eventService._haveChaincodeListeners.should.be.true;
		});
	});

	describe('#registerBlockListener', () => {
		it('should throw if callback not given', () => {
			(() => {
				eventService.registerBlockListener();
			}).should.throw(/Missing callback parameter/);
		});
		it('should set the have flag', () => {
			eventService._haveBlockListeners.should.be.false;
			eventService.registerBlockListener(sinon.stub());
			eventService._haveBlockListeners.should.be.true;
		});
		it('should set the have flag with options', () => {
			eventService._haveBlockListeners.should.be.false;
			eventService.registerBlockListener(sinon.stub(), {unregister: false});
			eventService._haveBlockListeners.should.be.true;
		});
	});

	describe('#registerTransactionListener', () => {
		it('should throw if txid not given', () => {
			(() => {
				eventService.registerTransactionListener();
			}).should.throw(/Missing txid parameter/);
		});
		it('should throw if callback not given', () => {
			(() => {
				eventService.registerTransactionListener('txid');
			}).should.throw(/Missing callback parameter/);
		});
		it('should set the have flag', () => {
			eventService._haveTxListeners.should.be.false;
			eventService.registerTransactionListener('txid', sinon.stub());
			eventService._haveTxListeners.should.be.true;
		});
		it('should set the have flag', () => {
			eventService._haveTxListeners.should.be.false;
			eventService.registerTransactionListener('txid', sinon.stub(),  {unregister: false});
			eventService._haveTxListeners.should.be.true;
		});
		it('should set the have flag when txid=all unregister false', () => {
			eventService._haveTxListeners.should.be.false;
			const eventListener = eventService.registerTransactionListener('ALL', sinon.stub(),  {unregister: false});
			eventService._haveTxListeners.should.be.true;
			should.equal(eventListener.unregister, false);
			should.equal(eventListener.event, 'all');
		});
		it('should set the have flag when txid=all unregister true', () => {
			eventService._haveTxListeners.should.be.false;
			const eventListener = eventService.registerTransactionListener('ALL', sinon.stub(),  {unregister: true});
			eventService._haveTxListeners.should.be.true;
			should.equal(eventListener.unregister, true);
			should.equal(eventListener.event, 'all');
		});
		it('should set the have flag when txid=all and default options', () => {
			eventService._haveTxListeners.should.be.false;
			const eventListener = eventService.registerTransactionListener('ALL', sinon.stub());
			eventService._haveTxListeners.should.be.true;
			should.equal(eventListener.unregister, false);
			should.equal(eventListener.event, 'all');
		});
	});

	describe('#_processEndBlock', () => {
		it('should do nothing if no block', () => {
			(() => {
				eventService._processEndBlock();
			}).should.throw(/Missing blockNumber parameter/);
		});
		it('should do nothing if no registrations', () => {
			eventService._processEndBlock('block_num');
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
		});
		it('should do nothing if no end block defined', () => {
			eventService.registerBlockListener(sinon.stub());
			eventService._processEndBlock('block');
			sinon.assert.calledWith(FakeLogger.debug, '%s - %s, no end block defined');
		});
		it('should call the callback with the block number', () => {
			const callback1 = sinon.stub();
			eventService.registerBlockListener(callback1, {endBlock: 10});
			eventService.registerBlockListener(callback1, {endBlock: 10});
			eventService._processEndBlock(Long.fromValue(10));
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
			sinon.assert.called(callback1);
		});
		it('should not call the callback with the block number', () => {
			const callback1 = sinon.stub();
			eventService.registerBlockListener(callback1, {endBlock: 11});
			eventService.registerBlockListener(callback1, {endBlock: 11});
			eventService._processEndBlock(Long.fromValue(10));
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
			sinon.assert.calledWith(FakeLogger.debug, '%s - %s, end block: %s not seen');
		});
	});

	describe('#_processBlockEvents', () => {
		it('should do nothing if no block registrations', () => {
			eventService._processBlockEvents();
			sinon.assert.calledWith(FakeLogger.debug, '%s - no block listeners');
		});
		it('should process the block', () => {
			const block_callback = sinon.stub();
			const block_reg = eventService.registerBlockListener(block_callback);
			eventService._processBlockEvents('full', 'filtered', 'private_data', 1);
			sinon.assert.calledWith(FakeLogger.debug, '%s - calling block listener callback');
			sinon.assert.called(block_callback);
			should.equal(eventService._eventListenerRegistrations.has(block_reg), true);
		});
		it('should process the block and remove registration', () => {
			const block_callback = sinon.stub();
			const block_reg = eventService.registerBlockListener(block_callback, {unregister: true});
			eventService._processBlockEvents('full', 'filtered', 'private_data', 1);
			sinon.assert.calledWith(FakeLogger.debug, '%s - calling block listener callback');
			sinon.assert.called(block_callback);
			should.equal(eventService._eventListenerRegistrations.has(block_reg), false);
		});
	});

	describe('#_processTxEvents', () => {
		it('should do nothing if no tx registrations', () => {
			eventService._processTxEvents();
			sinon.assert.calledWith(FakeLogger.debug, '%s - no tx listeners');
		});
		it('should work with filtered block', () => {
			eventService.registerTransactionListener('tx1', sinon.stub(), {unregister: false});
			const fake_callTransactionListener = sinon.stub();
			eventService._callTransactionListener = fake_callTransactionListener;
			eventService._processTxEvents('full', {filtered_transactions: [{txid: 'tx1', tx_validation_code: 'valid', type: 3}], number: 1});
			sinon.assert.calledWith(FakeLogger.debug, '%s filtered block number=%s');
			sinon.assert.called(fake_callTransactionListener);
		});
		it('should work with full block', () => {
			eventService.registerTransactionListener('tx1', sinon.stub(), {unregister: true});
			const fake_callTransactionListener = sinon.stub();
			eventService._callTransactionListener = fake_callTransactionListener;
			eventService._processTxEvents(block);
			sinon.assert.calledWith(FakeLogger.debug, '%s full block number=%s');
			sinon.assert.called(fake_callTransactionListener);
		});
	});

	describe('#_callTransactionListener', () => {
		it('should call tx callback and not remove the registration', () => {
			const tx_callback = sinon.stub();
			const tx_reg = eventService.registerTransactionListener('tx1', tx_callback, {unregister: false});

			eventService._callTransactionListener('tx1', 'valid', 1);
			sinon.assert.calledWith(FakeLogger.debug, '%s - about to call the transaction call back with code=%s tx=%s');
			sinon.assert.called(tx_callback);
			should.equal(eventService._eventListenerRegistrations.has(tx_reg), true);
		});
		it('should call tx callback and remove the registration', () => {
			const tx_callback = sinon.stub();
			const tx_reg = eventService.registerTransactionListener('tx1', tx_callback, {unregister: true});

			eventService._callTransactionListener('tx1', 'valid', 1);
			sinon.assert.calledWith(FakeLogger.debug, '%s - about to call the transaction call back with code=%s tx=%s');
			sinon.assert.called(tx_callback);
			should.equal(eventService._eventListenerRegistrations.has(tx_reg), false);
		});
		it('should call tx callback and remove the registration', () => {
			const tx_callback = sinon.stub();
			const tx_reg = eventService.registerTransactionListener('tx2', tx_callback, {unregister: true});

			eventService._callTransactionListener('tx1', 'valid', 1);
			sinon.assert.calledWith(FakeLogger.debug, '%s - tx listener for %s - not called');
			sinon.assert.notCalled(tx_callback);
			should.equal(eventService._eventListenerRegistrations.has(tx_reg), true);
		});
	});

	describe('#_processChaincodeEvents', () => {
		it('should do nothing if no chaincode registrations', () => {
			eventService._processTxEvents();
			sinon.assert.calledWith(FakeLogger.debug, '%s - no tx listeners');
		});
		it('should work with filtered block', () => {
			const chaincode_callback = sinon.stub();
			const chainocode_reg = eventService.registerChaincodeListener('chaincode1', 'event1', chaincode_callback, {unregister: true});

			eventService._processChaincodeEvents(block, filtered_block);
			sinon.assert.calledWith(FakeLogger.debug, '%s - calling callback - %s');
			sinon.assert.called(chaincode_callback);
			should.equal(eventService._eventListenerRegistrations.has(chainocode_reg), false);
		});
		it('should get an array with 3 events on a filtered block', () => {
			let chaincode_events;
			const chaincode_callback = (error, event) => {
				if (error) {
					throw Error('This should not happen');
				}
				chaincode_events = event.chaincodeEvents;
			};
			const chainocode_reg = eventService.registerChaincodeListener('chaincode1', 'event1', chaincode_callback, {unregister: true});

			eventService._processChaincodeEvents(block, filtered_block);
			sinon.assert.calledWith(FakeLogger.debug, '%s - calling callback - %s');
			should.equal(eventService._eventListenerRegistrations.has(chainocode_reg), false);
			should.equal(chaincode_events.length, 3);
		});
		it('should get an array with 1 events on a filtered block', () => {
			let chaincode_events;
			const chaincode_callback = (error, event) => {
				if (error) {
					throw Error('This should not happen');
				}
				chaincode_events = event.chaincodeEvents;
			};
			const chainocode_reg = eventService.registerChaincodeListener('chaincode2', 'event2', chaincode_callback, {unregister: true});

			eventService._processChaincodeEvents(block, filtered_block);
			sinon.assert.calledWith(FakeLogger.debug, '%s - calling callback - %s');
			should.equal(eventService._eventListenerRegistrations.has(chainocode_reg), false);
			should.equal(chaincode_events.length, 1);
		});
		it('should work with full block', () => {
			const chaincode_callback = sinon.stub();
			const chainocode_reg = eventService.registerChaincodeListener('chaincode1', 'event1', chaincode_callback, {unregister: true});

			eventService._processChaincodeEvents(block);
			sinon.assert.calledWith(FakeLogger.debug, '%s - calling callback - %s');
			sinon.assert.called(chaincode_callback);
			should.equal(eventService._eventListenerRegistrations.has(chainocode_reg), false);
		});
		it('should work with filtered block not remove reg', () => {
			const chaincode_callback = sinon.stub();
			const chainocode_reg = eventService.registerChaincodeListener('chaincode1', 'event1', chaincode_callback, {unregister: false});

			eventService._processChaincodeEvents(block, filtered_block);
			sinon.assert.calledWith(FakeLogger.debug, '%s - calling callback - %s');
			sinon.assert.called(chaincode_callback);
			should.equal(eventService._eventListenerRegistrations.has(chainocode_reg), true);
		});
		it('should work with full block and not remove reg', () => {
			const chaincode_callback = sinon.stub();
			const chainocode_reg = eventService.registerChaincodeListener('chaincode1', 'event1', chaincode_callback, {unregister: false});

			eventService._processChaincodeEvents(block);
			sinon.assert.calledWith(FakeLogger.debug, '%s - calling callback - %s');
			sinon.assert.called(chaincode_callback);
			should.equal(eventService._eventListenerRegistrations.has(chainocode_reg), true);
		});
		it('should not call reg and not remove', () => {
			const chaincode_callback = sinon.stub();
			const chainocode_reg = eventService.registerChaincodeListener('chaincode1', 'event2', chaincode_callback, {unregister: true});

			eventService._processChaincodeEvents(block, filtered_block);
			sinon.assert.calledWith(FakeLogger.debug, '%s - NOT queuing chaincode event: %s');
			should.equal(eventService._eventListenerRegistrations.has(chainocode_reg), true);
		});
		it('should not call reg and not remove', () => {
			const chaincode_callback = sinon.stub();
			const chainocode_reg = eventService.registerChaincodeListener('chaincode1', 'event2', chaincode_callback, {unregister: true});

			eventService._processChaincodeEvents(block);
			sinon.assert.calledWith(FakeLogger.debug, '%s - NOT queuing chaincode event: %s');
			should.equal(eventService._eventListenerRegistrations.has(chainocode_reg), true);
		});
		it('should not have an error', () => {
			const chaincode_callback = sinon.stub();
			eventService.registerChaincodeListener('chaincode1', 'event2', chaincode_callback, {unregister: true});

			eventService._processChaincodeEvents(block, {});
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
		});
		it('should not have an error', () => {
			const chaincode_callback = sinon.stub();
			eventService.registerChaincodeListener('chaincode1', 'event2', chaincode_callback, {unregister: true});

			eventService._processChaincodeEvents(block, {filtered_transactions: [{}]});
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
		});
		it('should not have an error with no chaincode actions', () => {
			const chaincode_callback = sinon.stub();
			eventService.registerChaincodeListener('chaincode1', 'event2', chaincode_callback, {unregister: true});

			eventService._processChaincodeEvents(block, {filtered_transactions: [{transaction_actions: {}}]});
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
		});
		it('should not have an error with no chaincode_action in chaincode_actions', () => {
			const chaincode_callback = sinon.stub();
			eventService.registerChaincodeListener('chaincode1', 'event2', chaincode_callback, {unregister: true});

			eventService._processChaincodeEvents(block,
				{filtered_transactions: [{transaction_actions: {chaincode_actions: [{chaincode_event: {}}]}}]});
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
		});
		it('should not have an error with non endorser block', () => {
			const chaincode_callback = sinon.stub();
			eventService.registerChaincodeListener('chaincode1', 'event2', chaincode_callback, {unregister: true});

			eventService._processChaincodeEvents({data: {data: [{payload: {header: {channel_header: {type: 1}}}}]}});
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
		});
		it('should not have an error with non endorser block', () => {
			const chaincode_callback = sinon.stub();
			eventService.registerChaincodeListener('chaincode1', 'event2', chaincode_callback, {unregister: true});

			eventService._processChaincodeEvents({data: {data: [{payload: {header: {channel_header: {type: 3}}}}]}});
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
		});
		it('should not have an error with non endorser block', () => {
			const chaincode_callback = sinon.stub();
			eventService.registerChaincodeListener('chaincode1', 'event2', chaincode_callback, {unregister: true});

			eventService._processChaincodeEvents({
				data: {
					data: [
						{
							payload: {
								header: {channel_header: {type: 3}},
								data: {
									actions: [
										{payload: {}}
									]
								}
							}
						}
					]
				}
			});
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
		});
	});

	describe('#_queueChaincodeEvent', () => {
		it('should work', () => {
			eventService.registerChaincodeListener('chaincode1', 'event1', sinon.stub(), {unregister: true});
			eventService._queueChaincodeEvent(chaincode_event, 1, 'tx1', 'valid', new Map());
			sinon.assert.calledWith(FakeLogger.debug, '%s - queuing chaincode event: %s');
		});
	});

	describe('#getTransactionListener', () => {
		it('should not find listener', () => {
			eventService.registerTransactionListener('tx1', sinon.stub());
			const listener = eventService.getTransactionListener('tx2');
			should.equal(listener, null);
		});

		it('should find listener', () => {
			const tx1 = eventService.registerTransactionListener('tx1', sinon.stub());
			const listener = eventService.getTransactionListener('tx1');
			should.equal(listener, tx1);
		});
	});
});
