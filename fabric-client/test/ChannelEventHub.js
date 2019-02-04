/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';
/* eslint-disable no-throw-literal */

const rewire = require('rewire');
const ChannelEventHub = rewire('../lib/ChannelEventHub');
const Peer = rewire('../lib/Peer');
const Channel = rewire('../lib/Channel');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();
const sinon = require('sinon');
const Long = require('long');

describe('ChannelEventHub', () => {
	let revert;
	let sandbox;

	let FakeLogger;
	const tmpSetDelete = Set.prototype.delete;

	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();

		FakeLogger = {
			debug : () => {},
			error: () => {},
			warn: () => {}
		};
		sandbox.stub(FakeLogger);
		revert.push(ChannelEventHub.__set__('logger', FakeLogger));
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
		Set.prototype.delete = tmpSetDelete;
	});

	describe('#constructor', () => {
		let _setReplayDefaultsStub;
		beforeEach(() => {
			_setReplayDefaultsStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('ChannelEventHub.prototype._setReplayDefaults', _setReplayDefaultsStub));
		});

		it('should log on entry', () => {
			new ChannelEventHub({}, {});
			sinon.assert.calledWith(FakeLogger.debug, 'const ');
		});

		it('should call _setReplayDefaults', () => {
			new ChannelEventHub({}, {});
			sinon.assert.called(_setReplayDefaultsStub);
		});

		it('should throw if channel arg isnt given', () => {
			(() => {
				new ChannelEventHub();
			}).should.throw(/Missing required argument: channel/);
		});

		it('should create even if peer argument isnt given', () => {
			const hub = new ChannelEventHub({});
			should.equal(hub._peer, undefined);
		});
	});

	describe('#getName', () => {
		it('should call and return _peer.getName()', () => {
			const getNameStub = sandbox.stub().returns('name');
			const hub = new ChannelEventHub({}, {});
			hub._peer = {getName: getNameStub};
			hub.getName().should.equal('name');
			sinon.assert.called(getNameStub);
		});
	});

	describe('#getPeerAddr', () => {
		let hub;
		beforeEach(() => {
			hub = new ChannelEventHub('channel', 'peer');
		});

		it('should return null if peer is not set', () => {
			should.equal(hub.getPeerAddr(), null);
		});

		it('should return the addr if peer is set', () => {
			hub._peer = {_endpoint: {addr: 'addr'}};
			should.equal(hub.getPeerAddr(), 'addr');
		});
	});

	describe('#_assignPeer', () => {
		let hub, peer, channel;

		beforeEach(() => {
			peer = new Peer('grpc://host.com:9999', {name: 'mypeer'});
			channel = new Channel('mychannel', {});
			hub = new ChannelEventHub(channel, 'peer');
		});

		it('should reassign peer to channel event hub', () => {
			hub._assignPeer(peer);
			should.equal(hub.getPeerAddr(), 'host.com:9999');
		});

		it('should reassign peer to channel event hub', () => {
			channel.addPeer(peer);
			hub._assignPeer('mypeer');
			should.equal(hub.getPeerAddr(), 'host.com:9999');
		});

		it('should throw an error if a peer name not found', () => {
			(() => {
				hub._assignPeer('bad');
			}).should.throw('Peer with name "bad" not assigned to this channel');
		});
	});

	describe('#lastBlockNumber', () => {
		let hub;
		beforeEach(() => {
			hub = new ChannelEventHub('channel', 'peer');
		});

		it('should throw an error if a block has not been seen', () => {
			(() => {
				hub.lastBlockNumber();
			}).should.throw(/This ChannelEventHub has not seen a block from the peer/);
		});

		it('should return the last block seen', () => {
			hub._last_block_seen = 10;
			hub.lastBlockNumber().should.equal(10);
		});
	});

	describe('#_checkBlockNum', () => {
		let hub;
		beforeEach(() => {
			hub = new ChannelEventHub('channel', 'peer');
		});

		it('should return the last block seen', () => {
			hub._last_block_seen = 2;
			const result = hub._checkBlockNum('last_seen');
			result.should.equal(2);
		});

		it('should return newest when newest', () => {
			const result = hub._checkBlockNum('newest');
			result.should.equal('newest');
		});

		it('should return oldest when oldest', () => {
			const result = hub._checkBlockNum('oldest');
			result.should.equal('oldest');
		});

		it('should return Long 12 when "12"', () => {
			const result = hub._checkBlockNum('12');
			result.toInt().should.equal(12);
		});

		it('should return Long 12 when int 12', () => {
			const result = hub._checkBlockNum(12);
			result.toInt().should.equal(12);
		});

		it('should return Long 12 when Long 12', () => {
			const result = hub._checkBlockNum(Long.fromInt(12));
			result.toInt().should.equal(12);
		});

		it('should return null when null', () => {
			const result = hub._checkBlockNum(null);
			should.equal(result, null);
		});

		it('should throw an error if a block number is bad', () => {
			(() => {
				hub._checkBlockNum('bad');
			}).should.throw(/value:bad is not a valid number /);
		});

	});

	describe('#_checkEndBlock', () => {
		let hub;
		beforeEach(() => {
			hub = new ChannelEventHub('channel', 'peer');
		});

		it('should return the last block seen', () => {
			hub._last_block_seen = 2;
			const result = hub._checkEndBlock('last_seen');
			result.should.equal(2);
		});

		it('should return newest when newest', () => {
			const result = hub._checkEndBlock('newest');
			result.should.equal('newest');
		});

		it('should return oldest when oldest', () => {
			const result = hub._checkEndBlock('oldest');
			result.should.equal('oldest');
		});

		it('should return Long 12 when "12"', () => {
			const result = hub._checkEndBlock('12');
			result.toInt().should.equal(12);
		});

		it('should return Long 12 when int 12', () => {
			const result = hub._checkEndBlock(12);
			result.toInt().should.equal(12);
		});

		it('should return Long 12 when Long 12', () => {
			const result = hub._checkEndBlock(Long.fromInt(12));
			result.toInt().should.equal(12);
		});

		it('should return null when null', () => {
			const result = hub._checkEndBlock(null);
			should.equal(result, null);
		});

		it('should return Long 12 when int 12 and startBlock Long 12', () => {
			const result = hub._checkEndBlock(12, Long.fromInt(12));
			result.toInt().should.equal(12);
		});

		it('should throw an error when int 12 and startBlock Long 14', () => {
			(() => {
				hub._checkEndBlock(12, Long.fromInt(14));
			}).should.throw('"startBlock" (14) must not be greater than "endBlock" (12)');
		});

		it('should throw an error if a block number is bad', () => {
			(() => {
				hub._checkEndBlock('bad');
			}).should.throw(/value:bad is not a valid number /);
		});

	});

	describe('#_checkAllowRegistrations', () => {
		it ('should throw an error if registration is not allowed', () => {
			const hub = new ChannelEventHub('channel', 'peer');
			hub._start_stop_registration = true;
			(() => {
				hub._checkAllowRegistrations();
			}).should.throw(/This ChannelEventHub is not open to event listener registrations/);
		});

		it ('should not throw an error if registration is allowed', () => {
			const hub = new ChannelEventHub('channel', 'peer');
			hub._allowRegistration = true;
			(() => {
				hub._checkAllowRegistrations();
			}).should.not.throw(/This ChannelEventHub is not open to event listener registrations/);
		});
	});

	describe('#isconnected', () => {
		it('should return the value of the _connected property', () => {
			const hub = new ChannelEventHub('channel', 'peer');
			hub._connected = 'connected-status';
			hub.isconnected().should.equal(hub._connected);
		});
	});

	describe('#reconnect', () => {
		let hub;
		let connectStub;
		it('should add in the force options', () => {
			connectStub = sandbox.stub();
			hub = new ChannelEventHub('channel', 'peer');
			hub.connect = connectStub;

			hub.reconnect();

			sinon.assert.calledWith(connectStub, {'force': true});
		});
	});

	describe('#connect', () => {
		let _validateSignedEventStub;
		let getPeerAddrStub;
		let _connectStub;

		let hub;
		beforeEach(() => {
			_validateSignedEventStub = sandbox.stub();
			getPeerAddrStub = sandbox.stub();
			_connectStub = sandbox.stub();

			hub = new ChannelEventHub('channel', 'peer');
			hub._validateSignedEvent = _validateSignedEventStub;
			hub.getPeerAddr = getPeerAddrStub;
			hub._connect = _connectStub;
			hub._clientContext = {};
		});

		it('should throw an error if required fields are not instantiated', () => {
			(() => {
				hub.connect(true);
			}).should.throw(/Error connect the ChannelEventhub to peer, either the clientContext has not been properly initialized, missing userContext or admin identity or missing signedEvent/);
		});

		it('should call the correct logs on exit', () => {
			getPeerAddrStub.returns('peer');
			hub._clientContext._userContext = {};
			hub.connect(true);
			sinon.assert.calledWith(FakeLogger.debug, '%s - start peerAddr:%s', 'connect', 'peer');
			sinon.assert.calledWith(FakeLogger.debug, '%s - filtered block stream set to:%s', 'connect', false);
			sinon.assert.calledWith(FakeLogger.debug, '%s - signed event:%s', 'connect', false);
			sinon.assert.calledWith(FakeLogger.debug, '%s - end %s', 'connect', 'peer');
		});

		it('should validate a signed event', () => {
			getPeerAddrStub.returns('peer');
			hub._clientContext._userContext = {};
			hub.connect({signedEvent: 'signed-event'});
			sinon.assert.calledWith(_validateSignedEventStub, 'signed-event');
		});

		it('should not validate a null signed event', () => {
			getPeerAddrStub.returns('peer');
			hub._clientContext._userContext = {};
			hub.connect({signedEvent: null});
			sinon.assert.notCalled(_validateSignedEventStub);
		});

		it('should log when options are null', () => {
			getPeerAddrStub.returns('peer');
			hub._clientContext._userContext = {};
			hub.connect(null);
			sinon.assert.calledWith(FakeLogger.debug, '%s - using a filtered block stream by default', 'connect');
		});

		it('should log when options are undefined', () => {
			getPeerAddrStub.returns('peer');
			hub._clientContext._userContext = {};
			hub.connect();
			sinon.assert.calledWith(FakeLogger.debug, '%s - using a filtered block stream by default', 'connect');
		});

		it('should call _connect', () => {
			getPeerAddrStub.returns('peer');
			hub._clientContext._userContext = {};
			hub.connect();
			sinon.assert.calledWith(_connectStub, {});
		});

		it('should call the correct logs on startBlock', () => {
			hub._clientContext._userContext = {};
			hub.connect({startBlock: 1});
			sinon.assert.calledWith(FakeLogger.debug, '%s - options include startBlock of %s');
			sinon.assert.calledWith(FakeLogger.debug, '%s - options do not include endBlock');
			sinon.assert.calledWith(FakeLogger.debug, '%s - options do not include a target');
		});

		it('should call the correct logs on endBlock', () => {
			hub._clientContext._userContext = {};
			hub.connect({endBlock: 1});
			sinon.assert.calledWith(FakeLogger.debug, '%s - options include endBlock of %s');
			sinon.assert.calledWith(FakeLogger.debug, '%s - options do not include startBlock');
			sinon.assert.calledWith(FakeLogger.debug, '%s - options do not include a target');
		});

		it('should call the correct logs on startBlock and endBlock', () => {
			hub._clientContext._userContext = {};
			hub.connect({startBlock: 1, endBlock: 2});
			sinon.assert.calledWith(FakeLogger.debug, '%s - options include startBlock of %s');
			sinon.assert.calledWith(FakeLogger.debug, '%s - options include endBlock of %s');
			sinon.assert.calledWith(FakeLogger.debug, '%s - options do not include a target');
		});

		it('should call the correct logs on target', () => {
			hub._clientContext._userContext = {};
			hub._channel = {};
			hub._channel._getTargets = sandbox.stub().returns({});
			hub.connect({target: {}});
			sinon.assert.calledWith(FakeLogger.debug, '%s - options include a target');
			sinon.assert.calledWith(FakeLogger.debug, '%s - options do not include startBlock');
			sinon.assert.calledWith(FakeLogger.debug, '%s - options do not include endBlock');
		});
	});

	describe('#_connect', () => {
		let convertToLongStub;
		let _shutdownStub;
		let _disconnectStub;
		let setTimeoutStub;
		let clearTimeoutStub;
		let checkAndAddConfigSettingStub;
		let getConfigSettingStub;
		let eventProtoDeliverStub;
		let deliverFilteredStub;
		let deliverStub;
		let onStub;
		let _sendSignedRegistrationStub;
		let _sendRegistrationStub;
		let isStreamReadyStub;
		let decodeBlockStub;

		let hub;
		beforeEach(() => {
			convertToLongStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('utils.convertToLong', convertToLongStub));
			isStreamReadyStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('isStreamReady', isStreamReadyStub));
			_sendSignedRegistrationStub = sandbox.stub();
			_sendRegistrationStub = sandbox.stub();
			onStub = sandbox.stub();
			deliverFilteredStub = sandbox.stub().returns({on: onStub});
			deliverStub = sandbox.stub().returns({on: onStub});
			eventProtoDeliverStub = sandbox.stub().returns({deliverFiltered: deliverFilteredStub, deliver: deliverStub});
			revert.push(ChannelEventHub.__set__('_eventsProto.Deliver', eventProtoDeliverStub));
			setTimeoutStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('setTimeout', setTimeoutStub));
			clearTimeoutStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('clearTimeout', clearTimeoutStub));
			_shutdownStub = sandbox.stub();
			_disconnectStub = sandbox.stub();
			checkAndAddConfigSettingStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('utils.checkAndAddConfigSetting', checkAndAddConfigSettingStub));
			getConfigSettingStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('utils.getConfigSetting', getConfigSettingStub));
			decodeBlockStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__(' BlockDecoder.decodeBlock', decodeBlockStub));

			hub = new ChannelEventHub('channel', {_request_timeout: 1000, _endpoint: {addr: 'peer', creds: 'creds'}, _options: {}});
			hub._disconnect = _disconnectStub;
			hub._shutdown = _shutdownStub;
			hub._sendSignedRegistration = _sendSignedRegistrationStub;
			hub._sendRegistration = _sendRegistrationStub;
		});

		it('should log on entry', () => {
			hub._connect_running = true;
			hub._connect();
			sinon.assert.calledWith(FakeLogger.debug, '_connect - start - %s', new Date());
		});

		it('should log if _connect_running', () => {
			hub._connect_running = true;
			hub._connect();
			sinon.assert.calledWith(FakeLogger.debug, '_connect - connect is running');
		});

		it('should log if _connected', () => {
			hub._connected = true;
			hub._connect();
			sinon.assert.calledWith(FakeLogger.debug, '_connect - end - already connected');
		});

		it('should throw an error if there is no peer', () => {
			hub._peer = undefined;
			(() => {
				hub._connect();
			}).should.throw('Must set peer address before connecting.');
		});

		it('should set up the class before setting up the disconnect timeout', () => {
			setTimeoutStub.callsFake(() => {
				throw new Error('Disconnected');
			});

			(() => {
				hub._connect();
			}).should.throw('Disconnected');
			hub._connect_running.should.be.true;
			hub._current_stream.should.equal(1);
			sinon.assert.called(_shutdownStub);
			sinon.assert.calledWith(FakeLogger.debug, '_connect - start stream:', 1);
			sinon.assert.calledWithMatch(setTimeoutStub, Function, 1000);
		});

		it('should log and call _disconnect on timeout', () => {
			hub._disconnect.throws(new Error('Disconnected'));
			setTimeoutStub.yields();
			(() => {
				hub._connect();
			}).should.throw('Disconnected');
			sinon.assert.calledWith(FakeLogger.error, '_connect - timed out after:%s', 1000);
			hub._connect_running.should.be.false;
			sinon.assert.calledWithMatch(_disconnectStub, Error);
		});

		it('should generate the correct config and log it', () => {
			checkAndAddConfigSettingStub.onCall(0).returns({});
			checkAndAddConfigSettingStub.onCall(1).returns({});
			checkAndAddConfigSettingStub.onCall(2).returns({});
			getConfigSettingStub.withArgs('request-timeout', 3000).returns(1000);
			hub._connect();
			sinon.assert.calledWith(checkAndAddConfigSettingStub, 'grpc.keepalive_time_ms', 360000, {});
			sinon.assert.calledWith(getConfigSettingStub, 'request-timeout', 3000);
			sinon.assert.calledWith(checkAndAddConfigSettingStub, 'grpc.keepalive_timeout_ms', 1000, {});
			sinon.assert.calledWith(eventProtoDeliverStub, 'peer', 'creds', {});
			sinon.assert.called(deliverFilteredStub);
			sinon.assert.calledWithMatch(onStub, 'data', Function);
			sinon.assert.calledWithMatch(onStub, 'status', Function);
			sinon.assert.calledWithMatch(onStub, 'end', Function);
			sinon.assert.calledWithMatch(onStub, 'error', Function);
			sinon.assert.called(_sendRegistrationStub);
			sinon.assert.calledWith(FakeLogger.debug, '_connect - end stream:', 1);
		});

		it('should call stream on data and log about an unknown response', () => {
			setTimeoutStub.yields();
			hub._filtered_stream = true;
			checkAndAddConfigSettingStub.onCall(0).returns({});
			checkAndAddConfigSettingStub.onCall(1).returns({});
			checkAndAddConfigSettingStub.onCall(2).returns({});
			getConfigSettingStub.withArgs('request-timeout', 3000).returns(1000);
			isStreamReadyStub.returns(true);
			onStub.yields({Type: 'unknown'});
			hub._connect({signedEvent: true});
			sinon.assert.calledWith(deliverFilteredStub);
			sinon.assert.calledWith(FakeLogger.debug, 'on.data - block stream:%s _current_stream:%s  peer:%s', 1, 1, 'peer');
			sinon.assert.calledWith(FakeLogger.debug, 'on.data - grpc stream is ready :%s', true);
			sinon.assert.calledWith(FakeLogger.debug, 'on.data - unknown deliverResponse');
			sinon.assert.calledWith(FakeLogger.error, 'ChannelEventHub has received and unknown message type %s', 'unknown');
		});


		it('should call stream on data log about an success response and not success status', () => {
			hub._filtered_stream = false;
			checkAndAddConfigSettingStub.onCall(0).returns({});
			checkAndAddConfigSettingStub.onCall(1).returns({});
			checkAndAddConfigSettingStub.onCall(2).returns({});
			getConfigSettingStub.withArgs('request-timeout', 3000).returns(1000);
			isStreamReadyStub.returns(true);
			onStub.yields({Type: 'status', status: 'NOTSUCCESS'});
			hub._connect({signedEvent: true});
			sinon.assert.called(deliverStub);
			sinon.assert.called(clearTimeoutStub);
			sinon.assert.calledWith(FakeLogger.debug, 'on.data - status received - %s', 'NOTSUCCESS');
			sinon.assert.calledWithMatch(_disconnectStub, Error);
		});


		it('should call stream on data log about an success response and success status if _ending_block_seen and _last_block_seen set', () => {
			hub._ending_block_seen = 1;
			hub._ending_block_newest = 1;
			hub._last_block_seen = 1;
			checkAndAddConfigSettingStub.onCall(0).returns({});
			checkAndAddConfigSettingStub.onCall(1).returns({});
			checkAndAddConfigSettingStub.onCall(2).returns({});
			getConfigSettingStub.withArgs('request-timeout', 3000).returns(1000);
			isStreamReadyStub.returns(true);
			onStub.yields({Type: 'status', status: 'SUCCESS'});
			hub._connect({signedEvent: true});
			sinon.assert.calledWith(FakeLogger.debug, 'on.data - status received after last block seen: %s block_num:', 'SUCCESS', 1);
			sinon.assert.calledWith(FakeLogger.debug, 'on.data - status received when newest block seen: %s block_num:', 'SUCCESS', 1);
			sinon.assert.calledWithMatch(_disconnectStub, Error);
		});


		it('should call stream on data log about an success response and success status if _ending_block_seen and _last_block_seen not set', () => {
			checkAndAddConfigSettingStub.onCall(0).returns({});
			checkAndAddConfigSettingStub.onCall(1).returns({});
			checkAndAddConfigSettingStub.onCall(2).returns({});
			getConfigSettingStub.withArgs('request-timeout', 3000).returns(1000);
			isStreamReadyStub.returns(true);
			onStub.yields({Type: 'status', status: 'SUCCESS'});
			hub._connect({signedEvent: true});
		});

		it('should log if the stream id and _current stream are not the same', () => {
			const takeCurrentStreamOutOfSync = function () {
				this._current_stream++;
			};
			setTimeoutStub.callsFake(takeCurrentStreamOutOfSync.bind(hub));
			checkAndAddConfigSettingStub.onCall(0).returns({});
			checkAndAddConfigSettingStub.onCall(1).returns({});
			checkAndAddConfigSettingStub.onCall(2).returns({});
			getConfigSettingStub.withArgs('request-timeout', 3000).returns(1000);
			isStreamReadyStub.returns(true);
			onStub.yields({Type: 'status', status: 'SUCCESS'});
			hub._connect({signedEvent: true});
			sinon.assert.calledWith(FakeLogger.debug, 'on.data - incoming block was from a cancelled stream');
		});

		it('should log debug and errors if connected and an error is detected', () => {
			checkAndAddConfigSettingStub.onCall(0).returns({});
			checkAndAddConfigSettingStub.onCall(1).returns({});
			checkAndAddConfigSettingStub.onCall(2).returns({});
			getConfigSettingStub.withArgs('request-timeout', 3000).returns(1000);
			isStreamReadyStub.returns(true);
			onStub.yields({Type: 'block'});
			const fakeError = new Error('forced error');
			decodeBlockStub.throws(fakeError);
			hub._connect({signedEvent: true});
			sinon.assert.calledWith(FakeLogger.debug, 'on.data - first block received , this ChannelEventHub now registered');
			sinon.assert.calledWith(FakeLogger.error, 'ChannelEventHub has detected an error Error: forced error');
		});

		it('should log debug and errors if connected and a string error is detected', () => {
			hub._connected = true;
			checkAndAddConfigSettingStub.onCall(0).returns({});
			checkAndAddConfigSettingStub.onCall(1).returns({});
			checkAndAddConfigSettingStub.onCall(2).returns({});
			getConfigSettingStub.withArgs('request-timeout', 3000).returns(1000);
			isStreamReadyStub.returns(true);
			onStub.yields({Type: 'block'});
			decodeBlockStub.callsFake(() => {
				throw 'forced error';
			});
			hub._connect({signedEvent: true, force: true});
			sinon.assert.calledWith(FakeLogger.debug, 'on.data - new block received - check event registrations');
			sinon.assert.calledWith(FakeLogger.error, 'ChannelEventHub has detected an error forced error');
		});

		it('should create a block and update _last_seen_block', () => {
			checkAndAddConfigSettingStub.onCall(0).returns({});
			checkAndAddConfigSettingStub.onCall(1).returns({});
			checkAndAddConfigSettingStub.onCall(2).returns({});
			getConfigSettingStub.withArgs('request-timeout', 3000).returns(1000);
			isStreamReadyStub.returns(true);
			onStub.yields({Type: 'block'});
			decodeBlockStub.returns({header: {number: 1}});
			convertToLongStub.returns(1);
			hub._connect({signedEvent: true});
			sinon.assert.calledWith(convertToLongStub, 1);
			hub._last_block_seen.should.equal(1);
		});

		it('should parse a filtered block and update _last_seen_block', () => {
			checkAndAddConfigSettingStub.onCall(0).returns({});
			checkAndAddConfigSettingStub.onCall(1).returns({});
			checkAndAddConfigSettingStub.onCall(2).returns({});
			getConfigSettingStub.withArgs('request-timeout', 3000).returns(1000);
			isStreamReadyStub.returns(true);
			convertToLongStub.returns(1);
			onStub.yields({Type: 'filtered_block', filtered_block: {number: 1}});
			hub._connect({signedEvent: true});
			sinon.assert.calledWith(convertToLongStub, 1);
			hub._last_block_seen.should.equal(1);
		});

		it('should call disconnect if called with instance of Error', () => {
			checkAndAddConfigSettingStub.onCall(0).returns({});
			checkAndAddConfigSettingStub.onCall(1).returns({});
			checkAndAddConfigSettingStub.onCall(2).returns({});
			getConfigSettingStub.withArgs('request-timeout', 3000).returns(1000);
			isStreamReadyStub.returns(true);
			convertToLongStub.returns(1);
			const error = new Error('test error');
			onStub.yields(error);
			hub._connect({signedEvent: true});
			sinon.assert.calledWith(_disconnectStub, error);
		});
	});

	describe('#disconnect', () => {
		let hub;

		beforeEach(() => {
			hub = new ChannelEventHub('channel', 'peer');
		});

		it('should call a debug log', () => {
			hub._disconnect_running = true;
			hub.disconnect();
			sinon.assert.calledWith(FakeLogger.debug, 'disconnect - disconnect is running');
		});

		it('should log, call _disconnect and change disconnect_running to false', () => {
			hub._disconnect = sandbox.stub();
			hub.disconnect();
			hub._disconnect_running.should.be.false;
			sinon.assert.calledWith(hub._disconnect, sinon.match(Error));
		});

		it('handles errors thrown by block event listeners', () => {
			const onEventStub = sandbox.stub().throws('onEvent');
			const onErrorStub = sandbox.stub().throws('onError');
			hub.registerBlockEvent(onEventStub, onErrorStub, {});
			hub.registerBlockEvent(onEventStub, onErrorStub, {});

			hub.disconnect();

			sinon.assert.calledTwice(onErrorStub);
		});

		it('handles errors throw by tx event listeners', () => {
			const onEventStub = sandbox.stub().throws('onEvent');
			const txErrorStub = sandbox.stub().throws('tx onError');
			const allErrorStub = sandbox.stub().throws('all onError');
			hub.registerTxEvent('1', onEventStub, txErrorStub, {});
			hub.registerTxEvent('all', onEventStub, allErrorStub, {});

			hub.disconnect();

			sinon.assert.calledOnce(txErrorStub);
			sinon.assert.calledOnce(allErrorStub);
		});
	});

	describe('#close', () => {
		it('should be an alias of disconnect', () => {
			const hub = new ChannelEventHub('channel', 'peer');
			hub.disconnect = sandbox.stub();
			hub.close();
			sinon.assert.called(hub.disconnect);
		});
	});

	describe('#_disconnect', () => {
		it('should log and call the correct functions', () => {
			const _closeAllCallbacksStub = sandbox.stub();
			const _shutdownStub = sandbox.stub();
			const _setReplayDefaultsStub = sandbox.stub();
			const getPeerAddrStub = sandbox.stub().returns('addr');
			const hub = new ChannelEventHub('channel', 'peer');
			hub._closeAllCallbacks = _closeAllCallbacksStub;
			hub._shutdown = _shutdownStub;
			hub._setReplayDefaults = _setReplayDefaultsStub;
			hub.getPeerAddr = getPeerAddrStub;

			hub.disconnect({message:'error'});
			sinon.assert.called(_closeAllCallbacksStub);
			sinon.assert.called(_shutdownStub);
			sinon.assert.called(_setReplayDefaultsStub);
			hub._connected.should.be.false;
			hub._connect_running.should.be.false;
		});
	});

	describe('#_shutdown', () => {
		let cancelStub;
		let endStub;
		let hub;
		beforeEach(() => {
			cancelStub = sandbox.stub();
			endStub = sandbox.stub();
			hub = new ChannelEventHub('channel', 'peer');
		});

		it('should cancel and end the stream', () => {
			hub._stream = {cancel: cancelStub, end: endStub};
			hub._shutdown();
			sinon.assert.called(cancelStub);
			sinon.assert.called(endStub);
			should.equal(hub._stream, null);
		});

		it('should close the event client', () => {
			const closeStub = sandbox.stub();
			hub._event_client = {close: closeStub};
			hub._shutdown();
			sinon.assert.called(closeStub);
		});
	});

	describe('#_sendRegistration', () => {
		it('should call _stream.write with the correct params', () => {
			const newTransactionIDStub = sandbox.stub().returns('txId');
			const signStub = sandbox.stub().returns([100]);
			const _getSigningIdentityStub = sandbox.stub().returns({sign: signStub});
			const generateUnsignedRegistrationStub = sandbox.stub().returns('unsigned-registration');
			const writeStub = sandbox.stub();

			const hub = new ChannelEventHub('channel', 'peer');
			hub._stream = {write: writeStub};
			hub._clientContext = {newTransactionID: newTransactionIDStub, _getSigningIdentity: _getSigningIdentityStub};
			hub._getSigningIdentity = _getSigningIdentityStub;
			hub.generateUnsignedRegistration = generateUnsignedRegistrationStub;
			hub._sendRegistration();

			sinon.assert.calledWith(newTransactionIDStub, true);
			sinon.assert.calledWith(_getSigningIdentityStub, true);
			sinon.assert.calledWith(generateUnsignedRegistrationStub, {identity: _getSigningIdentityStub(), txId: 'txId'});
			sinon.assert.calledWith(signStub, 'unsigned-registration');
			sinon.assert.calledWith(writeStub, {signature: Buffer.from([100]), payload: 'unsigned-registration'});
		});
	});

	describe('#_validateSignedEvent', () => {
		let hub;
		beforeEach(() => {
			hub = new ChannelEventHub('channel', 'peer');
		});

		it ('should log entry', () => {
			hub._validateSignedEvent({signature: 'signature', payload: 'payload'});
			sinon.assert.calledWith(FakeLogger.debug, '%s - enter', '_validateSignedEvent');
		});

		it ('should log exit', () => {
			hub._validateSignedEvent({signature: 'signature', payload: 'payload'});
			sinon.assert.calledWith(FakeLogger.debug, '%s - exit', '_validateSignedEvent');
		});

		it('should throw an error if no signature is given', () => {
			(() => {
				hub._validateSignedEvent({});
			}).should.throw(/Empty signature in signed event/);
		});

		it('should throw an error if no payload is given', () => {
			(() => {
				hub._validateSignedEvent({signature: 'signature'});
			}).should.throw(/Empty payload for signed event/);
		});

		it('should return the correct event', () => {
			const event = hub._validateSignedEvent({signature: 'signature', payload: 'payload'});
			event.should.deep.equal({signature: 'signature', payload: 'payload'});
		});
	});

	describe('#_sendSignedRegistration', () => {
		it('should log on entry', () => {
			const hub = new ChannelEventHub('channel', 'peer');
			hub._stream = {write: sandbox.stub()};
			hub._sendSignedRegistration();
			sinon.assert.calledWith(FakeLogger.debug, '%s - enter', '_sendSignedRegistration');
		});

		it('should call _stream.write', () => {
			const writeStub = sandbox.stub();
			const hub = new ChannelEventHub('channel', 'peer');
			hub._stream = {write: writeStub};
			hub._sendSignedRegistration('signed-event');
			sinon.assert.calledWith(writeStub, 'signed-event');
		});
	});

	describe('#generateUnsignedRegistration', () => {
		let IdentityStub;
		let TransactionIDStub;
		let SeekPositionStub;
		let setNewestStub;
		let setOldestStub;
		let setSpecifiedStub;
		let SeekSpecifiedStub;
		let setNumberStub;
		let SeekNewestStub;
		let SeekOldestStub;
		let setStartStub;
		let setStopStub;
		let setBehaviorStub;
		let SeekInfoStub;
		let buildChannelHeaderStub;
		let getClientCertHashStub;
		let buildHeaderStub;
		let payloadStub;
		let setHeaderStub;
		let setDataStub;
		let toBufferStub;
		let getTransactionIDStub;
		let getNonceStub;

		let hub;
		beforeEach(() => {
			IdentityStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('Identity', IdentityStub));
			TransactionIDStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('TransactionID', TransactionIDStub));
			setNewestStub = sandbox.stub();
			setOldestStub = sandbox.stub();
			setSpecifiedStub = sandbox.stub();
			SeekPositionStub = sandbox.stub().returns({setNewest: setNewestStub, setOldest: setOldestStub, setSpecified: setSpecifiedStub});
			revert.push(ChannelEventHub.__set__('_abProto.SeekPosition', SeekPositionStub));
			setNumberStub = sandbox.stub();
			SeekSpecifiedStub = sandbox.stub().returns({setNumber: setNumberStub});
			revert.push(ChannelEventHub.__set__('_abProto.SeekSpecified', SeekSpecifiedStub));
			SeekNewestStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('_abProto.SeekNewest', SeekNewestStub));
			SeekOldestStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('_abProto.SeekOldest', SeekOldestStub));
			setStartStub = sandbox.stub();
			setStopStub = sandbox.stub();
			setBehaviorStub = sandbox.stub();
			toBufferStub = sandbox.stub();
			SeekInfoStub = sandbox.stub().returns({
				setStart: setStartStub, setStop: setStopStub, setBehavior: setBehaviorStub, toBuffer: toBufferStub
			});
			SeekInfoStub.SeekBehavior = {BLOCK_UNTIL_READT: ''};
			revert.push(ChannelEventHub.__set__('_abProto.SeekInfo', SeekInfoStub));
			ChannelEventHub.__set__('_abProto.SeekInfo.SeekBehavior.BLOCK_UNTIL_READY', 'BLOCK_UNTIL_READY');
			ChannelEventHub.__set__('_abProto.SeekInfo.SeekBehavior.FAIL_IF_NOT_READY', 'FAIL_IF_NOT_READY');
			buildChannelHeaderStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('clientUtils.buildChannelHeader', buildChannelHeaderStub));
			getClientCertHashStub = sandbox.stub();
			buildHeaderStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('clientUtils.buildHeader', buildHeaderStub));
			setHeaderStub = sandbox.stub();
			setDataStub = sandbox.stub();
			payloadStub = sandbox.stub().returns({setHeader: setHeaderStub, setData: setDataStub, toBuffer: toBufferStub});
			revert.push(ChannelEventHub.__set__('_commonProto.Payload', payloadStub));
			getTransactionIDStub = sandbox.stub();
			getNonceStub = sandbox.stub();
			TransactionIDStub.returns({getTransactionID: getTransactionIDStub, getNonce: getNonceStub});

			hub = new ChannelEventHub('channel', 'peer');
			hub._clientContext = {getClientCertHash: getClientCertHashStub};
		});

		it('should log on entry', () => {
			try {
				hub.generateUnsignedRegistration();
			} catch (err) {
				sinon.assert.calledWith(FakeLogger.debug, '%s - enter', 'generateUnsignedRegistration');
			}
		});

		it('should throw if options arg is not given', () => {
			(() => {
				hub.generateUnsignedRegistration();
			}).should.throw(/Missing Required Argument/);
		});

		it('should throw if no txId arg is given', () => {
			(() => {
				hub.generateUnsignedRegistration({identity: 'identity'});
			}).should.throw(/"options.txId" is required/);
		});

		it('should throw if no txId arg is given', () => {
			(() => {
				hub.generateUnsignedRegistration({txId: 'txId'});
			}).should.throw(/"options.identity" is required/);
		});

		it('should throw if no certificate arg is given', () => {
			(() => {
				hub.generateUnsignedRegistration({mspId: 'mspId'});
			}).should.throw(/"options.certificate" is required/);
		});

		it('should throw if no mspId arg is given', () => {
			(() => {
				hub.generateUnsignedRegistration({certificate: 'certificate'});
			}).should.throw(/"options.mspId" is required/);
		});

		it('should create a new Identity and TransactionID if they arent given', () => {
			TransactionIDStub.throws(Error);
			(() => {
				hub.generateUnsignedRegistration({mspId: 'mspId', certificate: 'certificate'});
			}).should.throw(Error);
			sinon.assert.calledWith(IdentityStub, 'certificate', null, 'mspId');
			sinon.assert.calledWith(TransactionIDStub, new IdentityStub(), false);
		});

		it('should run with startBlock at newest', () => {
			hub._starting_block_number = 'newest';
			hub.generateUnsignedRegistration({mspId: 'mspId', certificate: 'certificate'});
			sinon.assert.calledWith(SeekSpecifiedStub);
			sinon.assert.calledWith(setSpecifiedStub, new SeekSpecifiedStub());
			sinon.assert.called(SeekPositionStub);
			sinon.assert.called(SeekNewestStub);
			sinon.assert.calledWith(setNewestStub, new SeekNewestStub());
			sinon.assert.called(SeekInfoStub);
			sinon.assert.calledWith(setStartStub, new SeekPositionStub());
			sinon.assert.calledWith(setStopStub, new SeekPositionStub());
			sinon.assert.calledWith(setBehaviorStub, 'BLOCK_UNTIL_READY');
			sinon.assert.called(buildChannelHeaderStub);
			sinon.assert.called(getTransactionIDStub);
			sinon.assert.called(getClientCertHashStub);
			sinon.assert.called(getNonceStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(setHeaderStub);
			sinon.assert.called(setDataStub);
			sinon.assert.calledTwice(toBufferStub);
		});

		it('should run with startBlock at oldest', () => {
			hub._starting_block_number = 'oldest';
			hub.generateUnsignedRegistration({mspId: 'mspId', certificate: 'certificate'});
			sinon.assert.calledWith(SeekSpecifiedStub);
			sinon.assert.calledWith(setSpecifiedStub, new SeekSpecifiedStub());
			sinon.assert.called(SeekPositionStub);
			sinon.assert.called(SeekOldestStub);
			sinon.assert.calledWith(setOldestStub, new SeekOldestStub());
			sinon.assert.called(SeekInfoStub);
			sinon.assert.calledWith(setStartStub, new SeekPositionStub());
			sinon.assert.calledWith(setStopStub, new SeekPositionStub());
			sinon.assert.calledWith(setBehaviorStub, 'BLOCK_UNTIL_READY');
			sinon.assert.called(buildChannelHeaderStub);
			sinon.assert.called(getTransactionIDStub);
			sinon.assert.called(getClientCertHashStub);
			sinon.assert.called(getNonceStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(setHeaderStub);
			sinon.assert.called(setDataStub);
			sinon.assert.calledTwice(toBufferStub);
		});

		it('should run with startBlock:1 and endBlock:1', () => {
			hub._starting_block_number = 1;
			hub._ending_block_number = 1;
			hub.generateUnsignedRegistration({mspId: 'mspId', certificate: 'certificate'});
			sinon.assert.calledWith(SeekSpecifiedStub);
			sinon.assert.calledWith(setNumberStub, 1);
			sinon.assert.calledWith(setSpecifiedStub, new SeekSpecifiedStub());
			sinon.assert.called(SeekPositionStub);
			sinon.assert.called(SeekInfoStub);
			sinon.assert.calledWith(setStartStub, new SeekPositionStub());
			sinon.assert.calledWith(setStopStub, new SeekPositionStub());
			sinon.assert.calledWith(setBehaviorStub, 'FAIL_IF_NOT_READY');
			sinon.assert.called(buildChannelHeaderStub);
			sinon.assert.called(getTransactionIDStub);
			sinon.assert.called(getClientCertHashStub);
			sinon.assert.called(getNonceStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(setHeaderStub);
			sinon.assert.called(setDataStub);
			sinon.assert.calledTwice(toBufferStub);
		});

		it('should run with startBlock:1 and endBlock:1 given identity and txId', () => {
			hub._starting_block_number = 1;
			hub._ending_block_number = 1;
			hub.generateUnsignedRegistration({identity: 'identity', txId: new TransactionIDStub()});
			sinon.assert.calledWith(SeekSpecifiedStub);
			sinon.assert.calledWith(setNumberStub, 1);
			sinon.assert.calledWith(setSpecifiedStub, new SeekSpecifiedStub());
			sinon.assert.called(SeekPositionStub);
			sinon.assert.called(SeekInfoStub);
			sinon.assert.calledWith(setStartStub, new SeekPositionStub());
			sinon.assert.calledWith(setStopStub, new SeekPositionStub());
			sinon.assert.calledWith(setBehaviorStub, 'FAIL_IF_NOT_READY');
			sinon.assert.called(buildChannelHeaderStub);
			sinon.assert.called(getTransactionIDStub);
			sinon.assert.called(getClientCertHashStub);
			sinon.assert.called(getNonceStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(setHeaderStub);
			sinon.assert.called(setDataStub);
			sinon.assert.calledTwice(toBufferStub);
		});

		it('should run with startBlock:1 and endBlock:newest given identity and txId', () => {
			hub._starting_block_number = 1;
			hub._ending_block_number = 'newest';
			hub.generateUnsignedRegistration({identity: 'identity', txId: new TransactionIDStub(), mspId: 'mspId', certificate: 'certificate'});
			sinon.assert.calledWith(SeekSpecifiedStub);
			sinon.assert.calledWith(setNumberStub, 1);
			sinon.assert.calledWith(setSpecifiedStub, new SeekSpecifiedStub());
			sinon.assert.called(SeekNewestStub);
			sinon.assert.calledWith(setNewestStub, new SeekNewestStub());
			sinon.assert.called(SeekPositionStub);
			sinon.assert.called(SeekInfoStub);
			sinon.assert.calledWith(setStartStub, new SeekPositionStub());
			sinon.assert.calledWith(setStopStub, new SeekPositionStub());
			sinon.assert.calledWith(setBehaviorStub, 'FAIL_IF_NOT_READY');
			sinon.assert.called(buildChannelHeaderStub);
			sinon.assert.called(getTransactionIDStub);
			sinon.assert.called(getClientCertHashStub);
			sinon.assert.called(getNonceStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(setHeaderStub);
			sinon.assert.called(setDataStub);
			sinon.assert.calledTwice(toBufferStub);
		});

		it('should run with startBlock:1 and endBlock:1 given identity and txId', () => {
			hub._starting_block_number = 1;
			hub._ending_block_number = 1;
			hub.generateUnsignedRegistration({identity: 'identity', txId: new TransactionIDStub(), mspId: 'mspId'});
			sinon.assert.calledWith(SeekSpecifiedStub);
			sinon.assert.calledWith(setNumberStub, 1);
			sinon.assert.calledWith(setSpecifiedStub, new SeekSpecifiedStub());
			sinon.assert.called(SeekPositionStub);
			sinon.assert.called(SeekInfoStub);
			sinon.assert.calledWith(setStartStub, new SeekPositionStub());
			sinon.assert.calledWith(setStopStub, new SeekPositionStub());
			sinon.assert.calledWith(setBehaviorStub, 'FAIL_IF_NOT_READY');
			sinon.assert.called(buildChannelHeaderStub);
			sinon.assert.called(getTransactionIDStub);
			sinon.assert.called(getClientCertHashStub);
			sinon.assert.called(getNonceStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(setHeaderStub);
			sinon.assert.called(setDataStub);
			sinon.assert.calledTwice(toBufferStub);
		});

		it('should return the seek payload with zero blocks given identity and txId', () => {
			hub.generateUnsignedRegistration({identity: 'identity', txId: new TransactionIDStub(), mspId: 'mspId'});
			sinon.assert.called(SeekPositionStub);
			sinon.assert.called(SeekNewestStub);
			sinon.assert.calledWith(setNewestStub, new SeekNewestStub());
			sinon.assert.called(SeekPositionStub);
			sinon.assert.calledWith(SeekSpecifiedStub);
			sinon.assert.called(setNumberStub);
			sinon.assert.calledWith(setStartStub, new SeekPositionStub());
			sinon.assert.calledWith(setStopStub, new SeekPositionStub());
			sinon.assert.called(buildChannelHeaderStub);
			sinon.assert.called(getTransactionIDStub);
			sinon.assert.called(getClientCertHashStub);
			sinon.assert.called(getNonceStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(setHeaderStub);
			sinon.assert.called(setDataStub);
			sinon.assert.calledTwice(toBufferStub);
		});

		it('should return the seek payload with zero blocks given identity and txId', () => {
			hub._ending_block_number = 1;
			hub.generateUnsignedRegistration({identity: 'identity', txId: new TransactionIDStub(), mspId: 'mspId'});
			sinon.assert.called(SeekPositionStub);
			sinon.assert.called(SeekNewestStub);
			sinon.assert.calledWith(setNewestStub, new SeekNewestStub());
			sinon.assert.called(SeekPositionStub);
			sinon.assert.calledWith(SeekSpecifiedStub);
			sinon.assert.called(setNumberStub);
			sinon.assert.calledWith(setStartStub, new SeekPositionStub());
			sinon.assert.calledWith(setStopStub, new SeekPositionStub());
			sinon.assert.called(buildChannelHeaderStub);
			sinon.assert.called(getTransactionIDStub);
			sinon.assert.called(getClientCertHashStub);
			sinon.assert.called(getNonceStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(buildHeaderStub);
			sinon.assert.called(setHeaderStub);
			sinon.assert.called(setDataStub);
			sinon.assert.calledTwice(toBufferStub);
		});
	});

	describe('#_closeAllCallbacks', () => {
		let hub;

		beforeEach(() => {
			hub = new ChannelEventHub('channel', {_endpoint: {addr: 'peer'}});
		});

		it('should log on entry and exit', () => {
			hub._closeAllCallbacks();
			sinon.assert.calledWith(FakeLogger.debug, '%s - start', '_closeAllCallbacks - peer');
			sinon.assert.calledWith(FakeLogger.debug, '%s - blockOnErrors %s', '_closeAllCallbacks - peer', 0);
			sinon.assert.calledWith(FakeLogger.debug, '%s - transactionOnErrors %s', '_closeAllCallbacks - peer', 0);
			sinon.assert.calledWith(FakeLogger.debug, '%s - end', '_closeAllCallbacks - peer');
		});

		it('should log if no onError method in block registration', () => {
			hub._blockRegistrations = {reg1: {}};
			hub._closeAllCallbacks();
			sinon.assert.calledWith(FakeLogger.debug, '%s - no block error callback to call for %s', '_closeAllCallbacks - peer', 'reg1');
			hub._blockRegistrations.should.deep.equal({});
		});

		it('should log and call onError if onError method in block registration', () => {
			const onErrorStub = sandbox.stub();
			hub._blockRegistrations = {reg1: {onError: onErrorStub}};
			hub._closeAllCallbacks('Error');
			sinon.assert.calledWith(FakeLogger.debug, '%s - calling block error callback for %s', '_closeAllCallbacks - peer', 'reg1');
			sinon.assert.calledWith(onErrorStub, 'Error');
		});

		it('should log if no onError method on transaction registration', () => {
			hub._transactionRegistrations = {reg1: {}};
			hub._closeAllCallbacks();
			sinon.assert.calledWith(FakeLogger.debug, '%s - no transaction error callback to call for %s', '_closeAllCallbacks - peer', 'reg1');
			hub._transactionRegistrations.should.deep.equal({});
		});

		it('should log and call onError if onError method in block registration', () => {
			const onErrorStub = sandbox.stub();
			hub._transactionRegistrations = {reg1: {onError: onErrorStub}};
			hub._closeAllCallbacks('Error');
			sinon.assert.calledWith(FakeLogger.debug, '%s - calling transaction error callback for %s', '_closeAllCallbacks - peer', 'reg1');
			sinon.assert.calledWith(onErrorStub, 'Error');
		});

		it('should log for each chaincode registration', () => {
			hub._chaincodeRegistrants = {reg1: [{ccid: 'cc', eventNameFilter: 'event', event_reg: {}}]};
			hub._closeAllCallbacks();
			sinon.assert.calledWith(FakeLogger.debug, '%s - closing this chaincode event ccid:%s eventNameFilter:%s', '_closeAllCallbacks - peer', 'cc', 'event');
			hub._chaincodeRegistrants.should.deep.equal({});

		});

		it('should call onError if onError method in chaincode registration', () => {
			const onErrorStub = sandbox.stub();
			hub._chaincodeRegistrants = {reg1: [{ccid: 'cc', eventNameFilter: 'event', event_reg: {onError: onErrorStub}}]};
			hub._closeAllCallbacks('Error');
			sinon.assert.calledWith(onErrorStub, 'Error');
		});
	});

	describe('#_checkReplay', () => {
		let hub;
		beforeEach(() => {
			hub = new ChannelEventHub('channel', 'peer');
		});

		it('should return NO_START_STOP and log on entry and exit', () => {
			const result = hub._checkReplay({});
			result.should.equal(0);
			sinon.assert.calledWith(FakeLogger.debug, '_checkReplay - start');
			sinon.assert.calledWith(FakeLogger.debug, '_checkReplay - end');
		});

		it('should return START_ONLY with startBlock parameter of 1', () => {
			const result = hub._checkReplay({startBlock: 1});
			result.should.equal(1);
			hub._starting_block_number.toInt().should.equal(1);
			sinon.assert.calledWith(FakeLogger.debug, '_checkReplay - Event listening will start at block %s', Long.fromInt(1));
		});

		it('should return START_ONLY with startBlock parameter of string 1', () => {
			const result = hub._checkReplay({startBlock: '1'});
			result.should.equal(1);
			hub._starting_block_number.toInt().should.equal(1);
			sinon.assert.calledWith(FakeLogger.debug, '_checkReplay - Event listening will start at block %s', Long.fromInt(1));
		});

		it('should return START_ONLY with startBlock parameter of Long 1', () => {
			const result = hub._checkReplay({startBlock: Long.fromInt(1)});
			result.should.equal(1);
			hub._starting_block_number.toInt().should.equal(1);
			sinon.assert.calledWith(FakeLogger.debug, '_checkReplay - Event listening will start at block %s', Long.fromInt(1));
		});

		it('should return START_ONLY with startBlock parameter of newest', () => {
			const result = hub._checkReplay({startBlock: 'newest'});
			result.should.equal(1);
			hub._starting_block_number.should.equal('newest');
			sinon.assert.calledWith(FakeLogger.debug, '_checkReplay - Event listening will start at block %s', 'newest');
		});

		it('should return START_ONLY with startBlock parameter of oldest', () => {
			const result = hub._checkReplay({startBlock: 'oldest'});
			result.should.equal(1);
			hub._starting_block_number.should.equal('oldest');
			sinon.assert.calledWith(FakeLogger.debug, '_checkReplay - Event listening will start at block %s', 'oldest');
		});

		it('should return START_ONLY with startBlock parameter of last_seen', () => {
			hub._last_block_seen = 1;
			const result = hub._checkReplay({startBlock: 'last_seen'});
			result.should.equal(1);
			hub._starting_block_number.should.equal(1);
			sinon.assert.calledWith(FakeLogger.debug, '_checkReplay - Event listening will start at block %s', 1);
		});

		it('should return END_ONLY with endBlock parameter of 1', () => {
			const result = hub._checkReplay({endBlock: 1});
			result.should.equal(2);
			hub._ending_block_number.toInt().should.equal(1);
			sinon.assert.calledWith(FakeLogger.debug, '_checkReplay - Event listening will end at block %s', Long.fromInt(1));
		});

		it('should return END_ONLY with endBlock parameter of string 1', () => {
			const result = hub._checkReplay({endBlock: '1'});
			result.should.equal(2);
			hub._ending_block_number.toInt().should.equal(1);
			sinon.assert.calledWith(FakeLogger.debug, '_checkReplay - Event listening will end at block %s', Long.fromInt(1));
		});

		it('should return END_ONLY with endBlock parameter of Long 1', () => {
			const result = hub._checkReplay({endBlock: Long.fromInt(1)});
			result.should.equal(2);
			hub._ending_block_number.toInt().should.equal(1);
			sinon.assert.calledWith(FakeLogger.debug, '_checkReplay - Event listening will end at block %s', Long.fromInt(1));
		});

		it('should return END_ONLY with endBlock parameter of newest', () => {
			const result = hub._checkReplay({endBlock: 'newest'});
			result.should.equal(2);
			hub._ending_block_number.should.equal('newest');
			sinon.assert.calledWith(FakeLogger.debug, '_checkReplay - Event listening will end at block %s', 'newest');
		});

		it('should return END_ONLY with endBlock parameter of oldest', () => {
			const result = hub._checkReplay({endBlock: 'oldest'});
			result.should.equal(2);
			hub._ending_block_number.should.equal('oldest');
			sinon.assert.calledWith(FakeLogger.debug, '_checkReplay - Event listening will end at block %s', 'oldest');
		});

		it('should return END_ONLY with endBlock parameter of last_seen', () => {
			hub._last_block_seen = 1;
			const result = hub._checkReplay({endBlock: 'last_seen'});
			result.should.equal(2);
			hub._ending_block_number.should.equal(1);
			sinon.assert.calledWith(FakeLogger.debug, '_checkReplay - Event listening will end at block %s', 1);
		});

		it('should throw an error if startBlock is greater than endBlock', () => {
			(() => {
				hub._checkReplay({startBlock: 2, endBlock: '1'});
			}).should.throw('"startBlock" (2) must not be greater than "endBlock" (1)');
		});

		it('should throw an error if startBlock given and have _start_stop_registration', () => {
			hub._start_stop_registration = {};
			(() => {
				hub._checkReplay({startBlock: 1}, true);
			}).should.throw('Not able to connect with startBlock or endBlock when a registered listener has those options.');
			sinon.assert.calledWith(FakeLogger.error, 'This ChannelEventHub has a registered listener that has options of startBlock or endBlock');
		});

		it('should throw an error if endBlock given and have _start_stop_registration', () => {
			hub._start_stop_registration = {};
			(() => {
				hub._checkReplay({endBlock: 1}, true);
			}).should.throw('Not able to connect with startBlock or endBlock when a registered listener has those options.');
			sinon.assert.calledWith(FakeLogger.error, 'This ChannelEventHub has a registered listener that has options of startBlock or endBlock');
		});

		it('should throw an error if startBlock and have registered listeners', () => {
			hub._haveRegistrations = sandbox.stub();
			hub._haveRegistrations.returns(true);
			(() => {
				hub._checkReplay({startBlock: 1});
			}).should.throw('Only one event registration is allowed when startBlock or endBlock are used');
			sinon.assert.calledWith(FakeLogger.error, 'This ChannelEventHub is already registered with active listeners.');
		});

		it('should throw an error if endBlock and have registered listeners', () => {
			hub._haveRegistrations = sandbox.stub();
			hub._haveRegistrations.returns(true);
			(() => {
				hub._checkReplay({endBlock: 1});
			}).should.throw('Only one event registration is allowed when startBlock or endBlock are used');
			sinon.assert.calledWith(FakeLogger.error, 'This ChannelEventHub is already registered with active listeners.');
		});

		it('should throw an error if startBlock and endBlock and have registered listeners', () => {
			hub._haveRegistrations = sandbox.stub();
			hub._haveRegistrations.returns(true);
			(() => {
				hub._checkReplay({startBlock: 1, endBlock: 2});
			}).should.throw('Only one event registration is allowed when startBlock or endBlock are used');
			sinon.assert.calledWith(FakeLogger.error, 'This ChannelEventHub is already registered with active listeners.');
		});

		it('should throw an error if startBlock and _connected', () => {
			hub._connected = true;
			(() => {
				hub._checkReplay({startBlock: 1});
			}).should.throw('Event listeners that use startBlock or endBlock must be registered before connecting to the peer channel-based service');
			sinon.assert.calledWith(FakeLogger.error, 'This ChannelEventHub has already been connected to start receiving blocks.');
		});

		it('should throw an error if endBlock and _connected', () => {
			hub._connected = true;
			(() => {
				hub._checkReplay({endBlock: 1});
			}).should.throw('Event listeners that use startBlock or endBlock must be registered before connecting to the peer channel-based service');
			sinon.assert.calledWith(FakeLogger.error, 'This ChannelEventHub has already been connected to start receiving blocks.');
		});

		it('should throw an error if startBlock and endBlock and _connected', () => {
			hub._connected = true;
			(() => {
				hub._checkReplay({startBlock: 1, endBlock: 2});
			}).should.throw('Event listeners that use startBlock or endBlock must be registered before connecting to the peer channel-based service');
			sinon.assert.calledWith(FakeLogger.error, 'This ChannelEventHub has already been connected to start receiving blocks.');
		});

		it('should throw an error if startBlock and _start_stop_connect', () => {
			hub._start_stop_connect = true;
			(() => {
				hub._checkReplay({startBlock: 1});
			}).should.throw('Registrations with startBlock or endBlock are not allowed if this ChannelEventHub is connected with a startBlock or endBlock');
			sinon.assert.calledWith(FakeLogger.error, 'This ChannelEventHub has been connected with a startBlock or endBlock');
		});

		it('should throw an error if endBlock and _start_stop_connect', () => {
			hub._start_stop_connect = true;
			(() => {
				hub._checkReplay({endBlock: 1});
			}).should.throw('Registrations with startBlock or endBlock are not allowed if this ChannelEventHub is connected with a startBlock or endBlock');
			sinon.assert.calledWith(FakeLogger.error, 'This ChannelEventHub has been connected with a startBlock or endBlock');
		});

		it('should throw an error if startBlock and endBlock and _start_stop_connect', () => {
			hub._start_stop_connect = true;
			(() => {
				hub._checkReplay({startBlock: 1, endBlock: 2});
			}).should.throw('Registrations with startBlock or endBlock are not allowed if this ChannelEventHub is connected with a startBlock or endBlock');
			sinon.assert.calledWith(FakeLogger.error, 'This ChannelEventHub has been connected with a startBlock or endBlock');
		});
	});

	describe('#_haveRegistrations', () => {
		it('should return true if count is greater than 0', () => {
			const hub = new ChannelEventHub('channel', 'peer');
			hub._chaincodeRegistrants = {'key1': 'value1'};
			hub._blockRegistrations = {'key2': 'value2'};
			hub._transactionRegistrations = {'key3': 'value3'};
			hub._haveRegistrations().should.equal(true);
		});

		it('should return false if count is less than 1', () => {
			const hub = new ChannelEventHub('channel', 'peer');
			hub._chaincodeRegistrants = {};
			hub._blockRegistrations = {};
			hub._transactionRegistrations = {};
			hub._haveRegistrations().should.equal(false);
		});
	});

	describe('#_checkConnection', () => {
		let isStreamReadyStub;

		let hub;
		beforeEach(() => {
			isStreamReadyStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('isStreamReady', isStreamReadyStub));
			hub = new ChannelEventHub('channel', 'peer');
		});

		it('should log on entry and exit', () => {
			hub._checkConnection();
			sinon.assert.calledWith(FakeLogger.debug, '_checkConnection - start');
			sinon.assert.calledWith(FakeLogger.debug, '_checkConnection - end');
		});

		it('should log if not connected and connect is not running', () => {
			hub._checkConnection();
			sinon.assert.calledWith(FakeLogger.debug, '_checkConnection - connection has not been started');
		});

		it('should check stream and log if connected', () => {
			isStreamReadyStub.returns(true);
			hub._connected = true;
			hub._peer = {getUrl: () => 'peer'};
			hub._checkConnection();
			sinon.assert.calledWith(isStreamReadyStub, hub);
			sinon.assert.calledWith(FakeLogger.debug, '_checkConnection - %s with stream channel ready %s', 'peer', true);
		});

		it('should check stream and log if connect running', () => {
			isStreamReadyStub.returns(true);
			hub._connect_running = true;
			hub._peer = {getUrl: () => 'peer'};
			hub._checkConnection();
			sinon.assert.calledWith(isStreamReadyStub, hub);
			sinon.assert.calledWith(FakeLogger.debug, '_checkConnection - %s with stream channel ready %s', 'peer', true);
		});

		it('should call _diconnect and throw an error if not ready and connect is not running', () => {
			hub._disconnect = sandbox.stub();
			isStreamReadyStub.returns(false);
			hub._connected = true;
			hub._connect_running = false;
			hub._peer = {getUrl: () => 'peer'};
			(() => {
				hub._checkConnection();
			}).should.throw(/Connection is not READY/);
			sinon.assert.calledWith(FakeLogger.error, '_checkConnection - connection is not ready');
			sinon.assert.calledWith(hub._disconnect, sinon.match(Error));
		});
	});

	describe('#checkConnection', () => {
		let _connectStub;
		let isStreamReadyStub;
		let _disconnectStub;
		let resumeStub;

		let hub;
		beforeEach(() => {
			_connectStub = sandbox.stub();
			resumeStub = sandbox.stub();
			_disconnectStub = sandbox.stub();
			isStreamReadyStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('isStreamReady', isStreamReadyStub));
			hub = new ChannelEventHub('channel', {getUrl: () => 'peer'});
			hub._disconnect = _disconnectStub;
			hub._connect = _connectStub;
		});

		it('should log and call isStreamReady twice if force_reconnect is false', () => {
			isStreamReadyStub.returns(true);
			const status = hub.checkConnection(false);
			sinon.assert.calledWith(FakeLogger.debug, 'checkConnection - start force_reconnect:%s', false);
			sinon.assert.calledTwice(isStreamReadyStub);
			sinon.assert.calledWith(isStreamReadyStub, hub);
			sinon.assert.calledWith(FakeLogger.debug, 'checkConnection -  %s with stream channel ready %s', 'peer', true);
			status.should.be.true;
		});

		it('should throw a string and call _disconnect if _stream is not set but force_reconnect is', () => {
			hub._stream = {isPaused: () => {
				throw 'Error';
			}};
			hub.checkConnection(true);
			sinon.assert.called(FakeLogger.error);
			sinon.assert.calledWith(FakeLogger.error, 'checkConnection - error ::Error');
			sinon.assert.calledWithMatch(_disconnectStub, Error);
		});

		it('should throw a string and call _disconnect if _stream is not set but force_reconnect is', () => {
			hub._stream = {isPaused: () => {
				throw new Error();
			}};
			hub.checkConnection(true);
			sinon.assert.called(FakeLogger.error);
			sinon.assert.calledWithMatch(FakeLogger.error, Error);
			sinon.assert.calledWithMatch(_disconnectStub, Error);
		});

		it('should call resume if connection is paused', () => {
			hub._stream = {isPaused: () => true, resume: resumeStub};
			hub.checkConnection(true);
			sinon.assert.calledWith(FakeLogger.debug, 'checkConnection - grpc isPaused :%s', true);
			sinon.assert.called(resumeStub);
			sinon.assert.calledWith(FakeLogger.debug, 'checkConnection - grpc resuming');
		});

		it('should call connect if not ready', () => {
			isStreamReadyStub.returns(false);
			hub._stream = {isPaused: () => false};
			hub.checkConnection(true);
			sinon.assert.calledWith(_connectStub, {force: true});
			hub._connect_running.should.be.false;
		});

		it('should do nothing if not paused and ready', () => {
			isStreamReadyStub.returns(true);
			hub._stream = {isPaused: () => false};
			hub.checkConnection(true);
			sinon.assert.notCalled(_connectStub);
			sinon.assert.notCalled(_disconnectStub);
			hub._connect_running.should.be.false;
		});

		it('should call _connect if _stream not set', () => {
			isStreamReadyStub.returns(false);
			hub.checkConnection(true);
			sinon.assert.calledWith(FakeLogger.debug, 'checkConnection - stream was shutdown - will reconnected');
			sinon.assert.calledWith(_connectStub, {force: true});
			hub._connect_running.should.be.false;
		});
	});

	describe('#registerChaincodeEvent', () => {
		let _checkAllowRegistrationsStub;
		let _checkReplayStub;
		let EventRegistrationStub;
		let ChaincodeRegistrationStub;
		let _checkConnectionStub;
		let unregisterChaincodeEventStub;

		let hub;
		beforeEach(() => {
			_checkAllowRegistrationsStub = sandbox.stub();
			_checkReplayStub = sandbox.stub();
			EventRegistrationStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('EventRegistration', EventRegistrationStub));
			ChaincodeRegistrationStub = sandbox.stub();
			ChaincodeRegistrationStub.returns({event_reg: {}});
			revert.push(ChannelEventHub.__set__('ChaincodeRegistration', ChaincodeRegistrationStub));
			_checkConnectionStub = sandbox.stub();
			unregisterChaincodeEventStub = sandbox.stub();

			hub = new ChannelEventHub('channel', 'peer');
			hub._checkAllowRegistrations = _checkAllowRegistrationsStub;
			hub._checkReplay = _checkReplayStub;
			hub._checkConnection = _checkConnectionStub;
			hub.unregisterChaincodeEvent = unregisterChaincodeEventStub;
		});

		it('should throw if ccid is missing', () => {
			(() => {
				hub.registerChaincodeEvent();
			}).should.throw(Error, 'Missing "ccid" parameter');
		});

		it('should throw if eventname is missing', () => {
			(() => {
				hub.registerChaincodeEvent('ccid');
			}).should.throw(Error, 'Missing "eventname" parameter');
		});

		it('should throw if onEvent is missing', () => {
			(() => {
				hub.registerChaincodeEvent('ccid', 'eventname');
			}).should.throw(Error, 'Missing "onEvent" parameter');
		});

		it('should call _checkAllowRegistrations, _checkReplay and _checkConnection', () => {
			_checkReplayStub.returns(0);
			hub.registerChaincodeEvent('cc', 'event', 'onEvent', 'onError', 'options');
			sinon.assert.called(_checkAllowRegistrationsStub);
			sinon.assert.calledWith(_checkReplayStub, 'options');
			sinon.assert.calledWith(EventRegistrationStub, 'onEvent', 'onError', 'options', false, false);
			sinon.assert.calledWith(ChaincodeRegistrationStub, 'cc', 'event', new EventRegistrationStub());
			sinon.assert.called(_checkConnectionStub);
		});

		it('should use an existing cbtable', () => {
			const cc = {add: sandbox.stub()};
			hub._chaincodeRegistrants = {'cc': cc};
			_checkReplayStub.returns(2);
			hub.registerChaincodeEvent('cc', 'event', 'onEvent', 'onError', 'options');
			hub._start_stop_registration.unregister_action.should.be.instanceof(Function);
			hub._start_stop_registration.unregister_action();
			sinon.assert.called(unregisterChaincodeEventStub);
		});
	});

	describe('#unregisterChaincodeEvent', () => {
		let hub;

		beforeEach(() => {
			hub = new ChannelEventHub('channel', 'peer');
		});

		it('should log on entry', () => {
			(() => {
				hub.unregisterChaincodeEvent();
			}).should.throw();
			sinon.assert.calledWith(FakeLogger.debug, 'unregisterChaincodeEvent - start');
		});

		it('should throw an error if listen_handle is not given', () => {
			(() => {
				hub.unregisterChaincodeEvent();
			}).should.throw(Error, 'Missing "listener_handle" parameter');
		});

		it('should throw an error if chaincodeRegistrant is not found and throw is true', () => {
			(() => {
				hub.unregisterChaincodeEvent({ccid: 'unknown'}, true);
			}).should.throw(Error, 'No event registration for chaincode id unknown');
		});

		it('should call delete if chaincodeRegistrant is not found and throw is false', () => {
			sandbox.stub(Set.prototype, 'delete');
			hub._chaincodeRegistrants = {known: new Set()};
			hub.unregisterChaincodeEvent({ccid: 'known'}, false);
			sinon.assert.calledWith(Set.prototype.delete, {ccid: 'known'});
		});

		it('should call not delete the _chaincodeRegistrants entry if the set has length > 0', () => {
			hub._chaincodeRegistrants = {known: new Set([1])};
			hub.unregisterChaincodeEvent({ccid: 'known'}, false);
			hub._chaincodeRegistrants.known.should.deep.equal(new Set([1]));
		});

		it('should not call delete if cbtable not found', () => {
			sandbox.stub(Set.prototype, 'delete');
			hub.unregisterChaincodeEvent({ccid: 'known'}, false);
			sinon.assert.notCalled(Set.prototype.delete);
		});
	});

	describe('#registerBlockEvent', () => {
		let _checkAllowRegistrationsStub;
		let _checkReplayStub;
		let unregisterBlockEventStub;
		let _checkConnectionStub;
		let EventRegistrationStub;

		let hub;
		beforeEach(() => {
			EventRegistrationStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('EventRegistration', EventRegistrationStub));
			_checkAllowRegistrationsStub = sandbox.stub();
			_checkReplayStub = sandbox.stub();
			unregisterBlockEventStub = sandbox.stub();
			_checkConnectionStub = sandbox.stub();

			hub = new ChannelEventHub('channel', 'peeer');
			hub._checkAllowRegistrations = _checkAllowRegistrationsStub;
			hub._checkReplay = _checkReplayStub;
			hub.unregisterBlockEvent = unregisterBlockEventStub;
			hub._checkConnection = _checkConnectionStub;
		});

		it('should throw an error if onEvent is missing', () => {
			(() => {
				hub.registerBlockEvent();
			}).should.throw(/Missing "onEvent" parameter/);
		});

		it('should call _checkAllowRegistrations and _checkConnection', () => {
			const regNumber = hub.registerBlockEvent('onEvent', 'onError', 'options');
			sinon.assert.called(_checkAllowRegistrationsStub);
			sinon.assert.calledWith(_checkReplayStub, 'options');
			sinon.assert.calledWith(EventRegistrationStub, 'onEvent', 'onError', 'options', true, false);
			sinon.assert.called(_checkConnectionStub);
			regNumber.should.equal(1);
			hub._blockRegistrations[1].should.deep.equal(new EventRegistrationStub());
		});

		it('shold change default_disconnect to true', () => {
			_checkReplayStub.returns(2);
			hub.registerBlockEvent('onEvent', 'onError', 'options');
			sinon.assert.calledWith(EventRegistrationStub, 'onEvent', 'onError', 'options', true, true);
		});

		it('should set _start_stop_registration, unregister_action callback and call unregisterBlockEvent', () => {
			_checkReplayStub.returns(1);
			hub.registerBlockEvent('onEvent', 'onError', 'options');
			should.exist(hub._start_stop_registration);
			hub._start_stop_registration.unregister_action();
			sinon.assert.calledWith(unregisterBlockEventStub, 1);
		});
	});

	describe('#unregisterBlockEvent', () => {
		let hub;
		beforeEach(() => {
			hub = new ChannelEventHub('channel', 'peer');
		});

		it('should log on entry', () => {
			hub._blockRegistrations = {'block_num': 'data'};
			hub.unregisterBlockEvent('block_num');
			sinon.assert.calledWith(FakeLogger.debug, 'unregisterBlockEvent - start  %s', 'block_num');
		});

		it('should delete the registration from the _transactionRegistrations object', () => {
			hub._blockRegistrations = {'block_num': 'data'};
			hub.unregisterBlockEvent('block_num');
			hub._blockRegistrations.should.deep.equal({});
		});

		it('should throw if no transaction for txid found and throwError is true', () => {
			(() => {
				hub.unregisterBlockEvent(null, true);
			}).should.throw(/Block listener for block registration number "null" does not exist/);
		});

		it('should not throw if no transaction for txid found and throwError is false', () => {
			hub.unregisterBlockEvent(null, false);
		});
	});

	describe('#registerTxEvent', () => {
		let EventRegistrationsStub;
		let _checkAllowRegistrationsStub;
		let _checkReplayStub;
		let _checkConnectionStub;
		let unregisterTxEventStub;

		let hub;
		beforeEach(() => {
			EventRegistrationsStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('EventRegistration', EventRegistrationsStub));
			_checkAllowRegistrationsStub = sandbox.stub();
			_checkReplayStub = sandbox.stub();
			unregisterTxEventStub = sandbox.stub();
			_checkConnectionStub = sandbox.stub();

			hub = new ChannelEventHub('channel', 'peer');
			hub._checkAllowRegistrations = _checkAllowRegistrationsStub;
			hub._checkReplay = _checkReplayStub;
			hub.unregisterTxEvent = unregisterTxEventStub;
			hub._checkConnection = _checkConnectionStub;
		});

		it('should log on entry', () => {
			(() => {
				hub.registerTxEvent();
			}).should.throw();
			sinon.assert.calledWith(FakeLogger.debug, 'registerTxEvent start - txid:%s', undefined);
		});

		it('should throw if txid is missing', () => {
			(() => {
				hub.registerTxEvent();
			}).should.throw(Error, 'Missing "txid" parameter');
		});

		it('should throw if txid is not a string', () => {
			(() => {
				hub.registerTxEvent({});
			}).should.throw(Error, '"txid" parameter is not a string');
		});

		it('should throw if onEvent is missing', () => {
			(() => {
				hub.registerTxEvent('txid');
			}).should.throw(Error, 'Missing "onEvent" parameter');
		});

		it('should throw if transactionId has already been registered', () => {
			hub._transactionRegistrations = {'txid': {}};
			(() => {
				hub.registerTxEvent('txid', 'onEvent');
			}).should.throw(Error, 'TransactionId (txid) has already been registered');
		});

		it('should all _CheckAllowRegistrations and _checkReplay', () => {
			const txid = hub.registerTxEvent('txid', 'onEvent', 'onError', 'options');
			sinon.assert.calledWith(_checkAllowRegistrationsStub);
			sinon.assert.calledWith(_checkReplayStub, 'options');
			sinon.assert.calledWith(EventRegistrationsStub, 'onEvent', 'onError', 'options', true, false);
			txid.should.equal('txid');
		});

		it('should cahnge txid to lowercase change default_unregister to false and change default_disconnect to true', () => {
			_checkReplayStub.returns(2);
			const txid = hub.registerTxEvent('ALL', 'onEvent', 'onError', 'options');
			sinon.assert.calledWith(_checkAllowRegistrationsStub);
			sinon.assert.calledWith(_checkReplayStub, 'options');
			sinon.assert.calledWith(EventRegistrationsStub, 'onEvent', 'onError', 'options', false, true);
			txid.should.equal('all');
		});

		it('should set the unregister_action', () => {
			_checkReplayStub.returns(1);
			hub.registerTxEvent('ALL', 'onEvent', 'onError', 'options');
			hub._start_stop_registration.unregister_action();
			sinon.assert.calledWith(unregisterTxEventStub, 'all');
			sinon.assert.calledWith(_checkConnectionStub);
		});
	});

	describe('#unregisterTxEvent', () => {
		let hub;
		beforeEach(() => {
			hub = new ChannelEventHub('channel', 'peer');
		});

		it('should log on entry', () => {
			hub._transactionRegistrations = {'txid': 'data'};
			hub.unregisterTxEvent('txid');
			sinon.assert.calledWith(FakeLogger.debug, 'unregisterTxEvent txid txid');
		});

		it('should delete the registration from the _transactionRegistrations object', () => {
			hub._transactionRegistrations = {'txid': 'data'};
			hub.unregisterTxEvent('txid');
			hub._transactionRegistrations.should.deep.equal({});
		});

		it('should throw if no transaction for txid found and throwError is true', () => {
			(() => {
				hub.unregisterTxEvent(null, true);
			}).should.throw(/Transaction listener for transaction id "null" does not exist/);
		});

		it('should not throw if no transaction for txid found and throwError is false', () => {
			hub.unregisterTxEvent(null, false);
		});
	});

	describe('#_processBlockEvents', () => {
		let hub;
		beforeEach(() => {
			hub = new ChannelEventHub('channel', 'peer');
		});

		it('should return null and do nothing if there are no _blockRegistrations', () => {
			should.equal(hub._processBlockEvents(), undefined);
			sinon.assert.calledWith(FakeLogger.debug, '_processBlockEvents - no registered block event "listeners"');
		});

		it('should call onEvent for each block', () => {
			const onEventStub = sandbox.stub();
			hub._blockRegistrations = {key1: {onEvent: onEventStub}};
			hub._processBlockEvents('block');
			sinon.assert.calledWith(FakeLogger.debug, '_processBlockEvents - calling block listener callback');
			sinon.assert.calledWith(onEventStub, 'block');
		});

		it('handles errors thrown from block listeners', () => {
			const onEventStub = sandbox.stub().throws('onEvent');
			const onErrorStub = sandbox.stub().throws('onError');
			hub.registerBlockEvent(onEventStub, onErrorStub, {});
			hub.registerBlockEvent(onEventStub, onErrorStub, {});

			hub._processBlockEvents('block');

			sinon.assert.calledTwice(onEventStub);
		});
	});

	describe('#_processTxEvents', () => {
		let _checkTransactionIdStub;
		let hub;
		beforeEach(() => {
			_checkTransactionIdStub = sandbox.stub();
			hub = new ChannelEventHub('channel', 'peer');
			hub._checkTransactionId = _checkTransactionIdStub;

			revert.push(ChannelEventHub.__set__('_commonProto.BlockMetadataIndex.TRANSACTIONS_FILTER', 'transactions_filter'));
		});

		it('should log if there are no transaction registrations', () => {
			hub._transactionRegistrations = {};
			hub._processTxEvents();
			sinon.assert.calledWith(FakeLogger.debug, '_processTxEvents - no registered transaction event "listeners"');
		});

		it('should log if given a block number', () => {
			hub._transactionRegistrations = {'tx1': 'value'};
			hub._processTxEvents({number: 1});
			sinon.assert.calledWith(FakeLogger.debug, '_processTxEvents filtered block num=1');
		});

		it('should call _checkTransactionId for each filtered transaction', () => {
			const mockTransaction = {txid: 1, tx_validation_code: 'code'};
			hub._transactionRegistrations = {'tx1': 'value'};
			hub._processTxEvents({number: 1, filtered_transactions: [mockTransaction, mockTransaction]});
			sinon.assert.calledTwice(_checkTransactionIdStub);
			sinon.assert.calledWith(_checkTransactionIdStub, 1, 'code', 1);
		});

		it('should log if not given a block number', () => {
			hub._transactionRegistrations = {'tx1': 'value'};
			hub._processTxEvents({header: {number: 1}, metadata: {metadata: {}}, data: {data: {}}});
			sinon.assert.calledWith(FakeLogger.debug, '_processTxEvents block num=1');
		});

		it('should call _checkTransaction id for each data item', () => {
			hub._transactionRegistrations = {'tx1': 'value'};
			const mockData = {payload: {header: {channel_header: {tx_id: 1}}}};
			const statusCodes = {transactions_filter: ['code0', 'code1']};
			hub._processTxEvents({header: {number: 1}, metadata: {metadata: statusCodes}, data: {data: [mockData, mockData]}});
			sinon.assert.calledTwice(_checkTransactionIdStub);
			sinon.assert.calledWith(_checkTransactionIdStub, 1, 'code0', 1);
			sinon.assert.calledWith(_checkTransactionIdStub, 1, 'code1', 1);
		});

		it('handles errors thrown from tx event listeners', () => {
			hub = new ChannelEventHub('channel', 'peer');
			const fakeTx1 = {txid: '1'};
			const fakeTx2 = {txid: '2'};
			const block = {
				number: 1,
				filtered_transactions: [fakeTx1, fakeTx2]
			};
			const txOnEventStub = sandbox.stub().throws('tx onEvent');
			const allOnEventStub = sandbox.stub().throws('all onEvent');
			const onErrorStub = sandbox.stub().throws('onError');
			hub.registerTxEvent(fakeTx1.txid, txOnEventStub, onErrorStub, {});
			hub.registerTxEvent('all', allOnEventStub, onErrorStub, {});

			hub._processTxEvents(block);

			sinon.assert.calledOnce(txOnEventStub);
			sinon.assert.calledTwice(allOnEventStub);
		});
	});

	describe('#_checkTransactionId', () => {
		let _callTransactionListenerStub;
		let hub;
		beforeEach(() => {
			_callTransactionListenerStub = sandbox.stub();
			hub = new ChannelEventHub('channel', 'peer');
			hub._callTransactionListener = _callTransactionListenerStub;
		});

		it('should not call _callTransactionListener if trans_reg is null', () => {
			hub._transactionRegistrations = {};
			hub._checkTransactionId('txId', 'val_code', 1);
			sinon.assert.notCalled(_callTransactionListenerStub);
		});

		it('should call _callTransactionListener if trans_reg is not null', () => {
			hub._transactionRegistrations = {txId: 'transaction'};
			hub._checkTransactionId('txId', 'val_code', 1);
			sinon.assert.calledWith(_callTransactionListenerStub, 'txId', 'val_code', 1, 'transaction');
		});

		it('should call _callTransactionListener if all_trans_reg is not null', () => {
			hub._transactionRegistrations = {all: 'transaction'};
			hub._checkTransactionId('txId', 'val_code', 1);
			sinon.assert.calledWith(_callTransactionListenerStub, 'txId', 'val_code', 1, 'transaction');
		});
	});

	describe('#_callTransactionListener', () => {
		let _disconnectStub;
		let unregisterTxEventStub;
		let convertValidationCodeStub;
		let onEventStub;
		let hub;
		beforeEach(() => {
			_disconnectStub = sandbox.stub();
			unregisterTxEventStub = sandbox.stub();
			convertValidationCodeStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('convertValidationCode', convertValidationCodeStub));
			onEventStub = sandbox.stub();

			hub = new ChannelEventHub('channel', 'peer');
			hub.unregisterTxEvent = unregisterTxEventStub;
			hub._disconnect = _disconnectStub;
		});

		it('should log on entry', () => {
			hub._callTransactionListener('tx_id', 'val_code', 1, {onEvent: onEventStub});
			sinon.assert.calledWith(FakeLogger.debug, '_callTransactionListener - about to call the transaction call back for code=%s tx=%s', 'val_code', 'tx_id');
		});

		it('shold call convertValidationCode and trans_reg.onEvent', () => {
			convertValidationCodeStub.returns('status');
			hub._callTransactionListener('tx_id', 'val_code', 1, {onEvent: onEventStub});
			sinon.assert.calledWith(convertValidationCodeStub, 'val_code');
			sinon.assert.calledWith(onEventStub, 'tx_id', 'status', 1);
		});

		it('should call unregisterTxEvent and log', () => {
			hub._callTransactionListener('tx_id', 'val_code', 1, {onEvent: onEventStub, unregister: true});
			sinon.assert.calledWith(unregisterTxEventStub, 'tx_id');
			sinon.assert.calledWith(FakeLogger.debug, '_callTransactionListener - automatically unregister tx listener for %s', 'tx_id');
		});

		it('should call unregisterTxEvent and log', () => {
			hub._callTransactionListener('tx_id', 'val_code', 1, {onEvent: onEventStub, disconnect: true});
			sinon.assert.calledWith(FakeLogger.debug, '_callTransactionListener - automatically disconnect');
			sinon.assert.calledWithMatch(_disconnectStub, Error);
		});
	});

	describe('#_processChaincodeEvents', () => {
		let _callChaincodeListenerStub;
		let hub;
		beforeEach(() => {
			_callChaincodeListenerStub = sandbox.stub();
			hub = new ChannelEventHub('channel', 'peer');
			hub._callChaincodeListener = _callChaincodeListenerStub;

			revert.push(ChannelEventHub.__set__('_commonProto.BlockMetadataIndex.TRANSACTIONS_FILTER', 'transactions_filter'));
		});

		it('should log and return if no chaincodeRegistrants are present', () => {
			hub._chaincodeRegistrants = {};
			hub._processChaincodeEvents();
			sinon.assert.calledWith(FakeLogger.debug, '_processChaincodeEvents - no registered chaincode event "listeners"');
		});

		it('should do nothing if there are no filtered_transactions', () => {
			hub._chaincodeRegistrants = {'cc': 'val'};
			hub._processChaincodeEvents({number: 1});
			sinon.assert.notCalled(_callChaincodeListenerStub);
		});

		it('should do nothing if there are no transaction_actions on a filtered transaction', () => {
			hub._chaincodeRegistrants = {'cc': 'val'};
			hub._processChaincodeEvents({number: 1, filtered_transactions: [{}]});
			sinon.assert.notCalled(_callChaincodeListenerStub);
		});

		it('should do nothing if there are no chaincode_actions on a filtered transaction_actions', () => {
			hub._chaincodeRegistrants = {'cc': 'val'};
			hub._processChaincodeEvents({number: 1, filtered_transactions: [{transaction_actions: {}}]});
			sinon.assert.notCalled(_callChaincodeListenerStub);
		});

		it('should call _callChaincodeListener for every chaincode_action', () => {
			const mockAction = {chaincode_event: 'event'};
			hub._chaincodeRegistrants = {'cc': 'val'};
			hub._processChaincodeEvents({number: 1, filtered_transactions: [{txid: 'txid', tx_validation_code: 'code', transaction_actions: {chaincode_actions: [mockAction, mockAction]}}]});
			sinon.assert.calledTwice(_callChaincodeListenerStub);
			sinon.assert.calledWith(_callChaincodeListenerStub, 'event', 1, 'txid', 'code', true);
		});

		it('should log for for each data in the block', () => {
			hub._chaincodeRegistrants = {'cc': 'val'};
			hub._processChaincodeEvents({data: {data: ['data']}});
			sinon.assert.calledWith(FakeLogger.debug, '_processChaincodeEvents - trans index=0');
		});

		it('should log if an error is thrown when unmarshalling the transaction', () => {
			hub._chaincodeRegistrants = {'cc': 'val'};
			hub._processChaincodeEvents({data: {data: [undefined]}});
			sinon.assert.calledWithMatch(FakeLogger.error, 'on.data - Error unmarshalling transaction=');
		});

		it('should log if block is not of type endorser', () => {
			const mockData = {payload: {header: {channel_header: {type: 0}}}};
			hub._chaincodeRegistrants = {'cc': 'val'};
			hub._processChaincodeEvents({data: {data: [mockData]}});
			sinon.assert.calledWithMatch(FakeLogger.debug, '_processChaincodeEvents - block is not endorser transaction type');
		});

		it('should log if there are no transactions', () => {
			const mockData = {payload: {header: {channel_header: {type: 3}}}};
			hub._chaincodeRegistrants = {'cc': 'val'};
			hub._processChaincodeEvents({data: {data: [mockData]}});
			sinon.assert.calledWithMatch(FakeLogger.debug, '_processChaincodeEvents - no transactions or transaction actions');
		});

		it('should log if there are no transaction actions', () => {
			const mockData = {payload: {data: {}, header: {channel_header: {type: 3}}}};
			hub._chaincodeRegistrants = {'cc': 'val'};
			hub._processChaincodeEvents({data: {data: [mockData]}});
			sinon.assert.calledWithMatch(FakeLogger.debug, '_processChaincodeEvents - no transactions or transaction actions');
		});

		it('should log and call _callChaincodeListener', () => {
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
														extension: {events: 'ccevent'}
													}
												}
											}
										}
									]
								},
								header: {
									channel_header: {type: 3, tx_id: 'tx_id'}
								}
							}
						}
					]
				},
				metadata: {
					metadata: {'transactions_filter': ['code0']}
				},
				header: {number: 1}
			};
			hub._chaincodeRegistrants = {'cc': 'val'};
			hub._processChaincodeEvents(block);
			sinon.assert.calledWithMatch(FakeLogger.debug, '_processChaincodeEvents - chaincode_event %s', 'ccevent');
			sinon.assert.calledWith(_callChaincodeListenerStub, 'ccevent', 1, 'tx_id', 'code0', false);

		});
	});

	describe('#_callChaincodeListener', () => {
		let convertValidationCodeStub;
		let onEventStub;
		let deleteStub;
		let _disconnectStub;

		let hub;
		beforeEach(() => {
			convertValidationCodeStub = sandbox.stub();
			revert.push(ChannelEventHub.__set__('convertValidationCode', convertValidationCodeStub));
			onEventStub = sandbox.stub();
			deleteStub = sandbox.stub();
			_disconnectStub = sandbox.stub();

			hub = new ChannelEventHub('channel', 'peer');
		});

		it('should log and return if chaincode registrant is not found', () => {
			const res = hub._callChaincodeListener({chaincode_id: 'cc'}, 'block_num', 'tx_id', 'val_code', 'filtered');
			sinon.assert.calledWith(FakeLogger.debug, '_callChaincodeListener - no chaincode listeners found');
			should.equal(res, undefined);
		});

		it('should log and call convertValidationCode', () => {
			convertValidationCodeStub.returns('status');
			hub._chaincodeRegistrants = {cc: []};
			hub._callChaincodeListener({chaincode_id: 'cc'}, 'block_num', 'tx_id', 'val_code', 'filtered');
			sinon.assert.calledWith(convertValidationCodeStub, 'val_code');
			sinon.assert.calledWith(FakeLogger.debug, '_callChaincodeListener - txid=%s  val_code=%s', 'tx_id', 'status');
		});

		it('should log if the event name does not match the filter', () => {
			convertValidationCodeStub.returns('status');
			hub._chaincodeRegistrants = {cc: [{eventNameFilter: new RegExp('filter')}]};
			hub._callChaincodeListener({chaincode_id: 'cc'}, 'block_num', 'tx_id', 'val_code', 'filtered');
			sinon.assert.calledWith(FakeLogger.debug, '_callChaincodeListener - NOT calling chaincode listener callback');
		});

		it('should delete the payload from the chaincode event if filtered is true', () => {
			convertValidationCodeStub.returns('status');
			const chaincodeReg = {eventNameFilter: new RegExp(/event/), event_reg: {onEvent: onEventStub}};
			const chaincodeEvent = {chaincode_id: 'cc', event_name: 'event', payload: 'payload'};
			hub._chaincodeRegistrants = {cc: [chaincodeReg]};
			hub._callChaincodeListener(chaincodeEvent, 'block_num', 'tx_id', 'val_code', true);
			sinon.assert.called(onEventStub);
			sinon.assert.calledWith(onEventStub, {chaincode_id: 'cc', event_name: 'event'}, 'block_num', 'tx_id', 'status');
		});

		it('should call delete if unregister is true', () => {
			convertValidationCodeStub.returns('status');
			const chaincodeReg = {eventNameFilter: new RegExp(/event/), event_reg: {onEvent: onEventStub, unregister: true}};
			const chaincodeEvent = {chaincode_id: 'cc', event_name: 'event', payload: 'payload'};
			Set.prototype.delete = deleteStub;
			hub._chaincodeRegistrants = {cc: new Set([chaincodeReg])};
			hub._callChaincodeListener(chaincodeEvent, 'block_num', 'tx_id', 'val_code', false);
			sinon.assert.called(deleteStub);
			sinon.assert.calledWith(deleteStub, chaincodeReg);
			sinon.assert.calledWith(FakeLogger.debug, '_callChaincodeListener - automatically unregister tx listener for %s', 'tx_id');
			delete Set.prototype.delete;
		});

		it('should call disconnect if disconnect is true', () => {
			convertValidationCodeStub.returns('status');
			const chaincodeReg = {eventNameFilter: new RegExp(/event/), event_reg: {onEvent: onEventStub, disconnect: true}};
			const chaincodeEvent = {chaincode_id: 'cc', event_name: 'event', payload: 'payload'};
			hub._disconnect = _disconnectStub;
			hub._chaincodeRegistrants = {cc: [chaincodeReg]};
			hub._callChaincodeListener(chaincodeEvent, 'block_num', 'tx_id', 'val_code', false);
			sinon.assert.calledWith(_disconnectStub, sinon.match(Error));
		});
	});

	describe('#_checkReplayEnd', () => {
		let lteStub;
		let unregister_actionStub;
		let _disconnectStub;

		let hub;
		beforeEach(() => {
			lteStub = sandbox.stub();
			unregister_actionStub = sandbox.stub();
			_disconnectStub = sandbox.stub();
			hub = new ChannelEventHub('channel', 'peer');
			hub._disconnect = _disconnectStub;
		});

		it('should exit without calling if _ending_block_number is null', () => {
			hub._ending_block_number = null;
			hub._checkReplayEnd();
			hub._ending_block_seen.should.be.false;
			sinon.assert.notCalled(_disconnectStub);
			sinon.assert.notCalled(unregister_actionStub);
		});

		it('should exit if _ending_block_number is greater than _last_block_seen', () => {
			lteStub.returns(false);
			hub._ending_block_number = {lessThanOrEqual: lteStub};
			hub._checkReplayEnd();
			hub._ending_block_seen.should.be.false;
			sinon.assert.notCalled(_disconnectStub);
			sinon.assert.notCalled(unregister_actionStub);
			sinon.assert.calledWith(lteStub, null);
		});

		it('should exit if _start_stop_registration is null', () => {
			lteStub.returns(true);
			hub._last_block_seen = 1;
			hub._ending_block_number = {lessThanOrEqual: lteStub};
			hub._checkReplayEnd();
			hub._ending_block_seen.should.be.true;
			sinon.assert.notCalled(unregister_actionStub);
			sinon.assert.notCalled(_disconnectStub);
			sinon.assert.calledWith(lteStub, 1);
		});

		it('should exit if _start_stop_registration is not null and unregister is false', () => {
			lteStub.returns(true);
			hub._last_block_seen = 1;
			hub._start_stop_registration = {unregister: false};
			hub._ending_block_number = {lessThanOrEqual: lteStub};
			hub._checkReplayEnd();
			hub._ending_block_seen.should.be.true;
			sinon.assert.notCalled(unregister_actionStub);
			sinon.assert.notCalled(_disconnectStub);
			sinon.assert.calledWith(lteStub, 1);
		});

		it('should exit if _start_stop_registration is not null and unregister is true after calling unregister_action', () => {
			lteStub.returns(true);
			hub._last_block_seen = 1;
			hub._start_stop_registration = {unregister: true, unregister_action: unregister_actionStub};
			hub._ending_block_number = {lessThanOrEqual: lteStub};
			hub._checkReplayEnd();
			hub._ending_block_seen.should.be.true;
			sinon.assert.called(unregister_actionStub);
			sinon.assert.notCalled(_disconnectStub);
			sinon.assert.calledWith(lteStub, 1);
		});

		it('should exit if _start_stop_registration is not null and disconnect is true after calling disconnect', () => {
			lteStub.returns(true);
			hub._last_block_seen = 1;
			hub._start_stop_registration = {unregister: false, disconnect: true};
			hub._ending_block_number = {lessThanOrEqual: lteStub};
			hub._checkReplayEnd();
			hub._ending_block_seen.should.be.true;
			sinon.assert.calledWith(_disconnectStub, sinon.match(Error));
			sinon.assert.calledWith(lteStub, 1);
		});
	});

	describe('#_setReplayDefaults', () => {
		const hub = new ChannelEventHub('channel', 'peer');
		hub._setReplayDefaults();
		should.equal(hub._starting_block_number, null);
		should.equal(hub._ending_block_number, null);
		hub._ending_block_seen.should.be.false;
		hub._ending_block_newest.should.be.false;
		should.equal(hub._start_stop_registration, null);
	});
});


describe('convertValidationCode', () => {
	let convertValidationCode;
	const _validation_codes = {10: 'code1'};

	before(() => {
		convertValidationCode = ChannelEventHub.__get__('convertValidationCode');
		ChannelEventHub.__set__('_validation_codes', _validation_codes);
	});

	it('should return the code if it is a string', () => {
		convertValidationCode('code2').should.equal('code2');
	});

	it('should retrieve the code from a list and return it', () => {
		convertValidationCode(10).should.equal('code1');
	});
});

describe('isStreamReady', () => {
	let isStreamReady;
	let FakeLogger;
	let mockStream = {};

	before(() => {
		isStreamReady = ChannelEventHub.__get__('isStreamReady');
	});

	beforeEach(() => {
		FakeLogger = {
			debug: () => {}
		};
		sinon.stub(FakeLogger);
		ChannelEventHub.__set__('logger', FakeLogger);
	});

	it('should return a defualt false ready status', () => {
		isStreamReady({}).should.be.false;
		sinon.assert.notCalled(FakeLogger.debug);
	});

	it('should log evetyhing and return true ready status', () => {
		mockStream = {readable: true, writable: true, reading: true, read_status: true, received_status: true};
		isStreamReady({_stream: mockStream, getPeerAddr: () => 'peer'}).should.be.true;
		sinon.assert.calledWith(FakeLogger.debug, '%s - stream.readable %s :: %s', 'isStreamReady', true, 'peer');
		sinon.assert.calledWith(FakeLogger.debug, '%s - stream.writable %s :: %s', 'isStreamReady', true, 'peer');
		sinon.assert.calledWith(FakeLogger.debug, '%s - stream.reading %s :: %s', 'isStreamReady', true, 'peer');
		sinon.assert.calledWith(FakeLogger.debug, '%s - stream.read_status %s :: %s', 'isStreamReady', true, 'peer');
		sinon.assert.calledWith(FakeLogger.debug, '%s - stream.received_status %s :: %s', 'isStreamReady', true, 'peer');
	});
});


describe('ChaincodeRegistration', () => {
	let ChaincodeRegistration;

	before(() => {
		ChaincodeRegistration = ChannelEventHub.__get__('ChaincodeRegistration');
	});

	describe('#constructor', () => {
		it('should set the correct properties', () => {
			const ccReg = new ChaincodeRegistration('ccid', /eventNameFilter/, 'event_reg');
			ccReg.ccid.should.equal('ccid');
			ccReg.eventNameFilter.should.deep.equal(new RegExp(/eventNameFilter/));
			ccReg.event_reg.should.equal('event_reg');
		});
	});
});

describe('EventRegistration', () => {
	let sandbox;
	let FakeLogger;
	let EventRegistration;

	before(() => {
		EventRegistration = ChannelEventHub.__get__('EventRegistration');
	});

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		FakeLogger = {debug: () => {}};
		sandbox.stub(FakeLogger);
		ChannelEventHub.__set__('logger', FakeLogger);
	});

	describe('#constructor', () => {
		it('should log if unregister is not defined', () => {
			new EventRegistration('onEvent', 'onError', {});
			sinon.assert.calledWith(FakeLogger.debug, 'const-EventRegistration - unregister was not defined');
		});

		it('should set unregister if it is boolean', () => {
			const reg = new EventRegistration('onEvent', 'onError', {unregister: true});
			reg.unregister.should.be.true;
		});

		it('should throw an error if unregister is not undefined, null or boolean', () => {
			(() => {
				new EventRegistration('onEvent', 'onError', {unregister: 'string'});
			}).should.throw(/Event registration has invalid value for "unregister" option/);
		});

		it('should log if disconnect is not defined', () => {
			new EventRegistration('onEvent', 'onError', {});
			sinon.assert.calledWith(FakeLogger.debug, 'const-EventRegistration - disconnect was not defined');
		});

		it('should set disconnect if it is boolean', () => {
			const reg = new EventRegistration('onEvent', 'onError', {disconnect: true});
			reg.disconnect.should.be.true;
		});

		it('should throw an error if disconnect is not undefined, null or boolean', () => {
			(() => {
				new EventRegistration('onEvent', 'onError', {disconnect: 'string'});
			}).should.throw(/Event registration has invalid value for "disconnect" option/);
		});

		it('should set the correct parameters', () => {
			const reg = new EventRegistration('onEvent', 'onError', null, 'default_unregister', 'default_disconnect');
			reg._onEventFn.should.equal('onEvent');
			reg._onErrorFn.should.equal('onError');
			reg.unregister.should.equal('default_unregister');
			reg.disconnect.should.equal('default_disconnect');
			reg.unregister_action.should.be.instanceof(Function);
			should.equal(reg.unregister_action(), undefined);
		});
	});
});
