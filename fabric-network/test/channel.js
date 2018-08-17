/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const sinon = require('sinon');
const rewire = require('rewire');

const InternalChannel = rewire('fabric-client/lib/Channel');
const Peer = InternalChannel.__get__('ChannelPeer');
const Client = require('fabric-client');
const TransactionID = require('fabric-client/lib/TransactionID.js');
const FABRIC_CONSTANTS = require('fabric-client/lib/Constants');

const chai = require('chai');
chai.use(require('chai-as-promised'));

const Channel = require('../lib/channel');
const Network = require('../lib/network');
const Contract = require('../lib/contract');


describe('Channel', () => {

	let sandbox = sinon.createSandbox();
	let clock;

	let mockChannel, mockClient;
	let mockPeer1, mockPeer2, mockPeer3;
	let channel;
	let mockTransactionID, mockNetwork;

	beforeEach(() => {
		clock = sinon.useFakeTimers();
		mockChannel = sinon.createStubInstance(InternalChannel);
		mockClient = sinon.createStubInstance(Client);
		mockTransactionID = sinon.createStubInstance(TransactionID);
		mockTransactionID.getTransactionID.returns('00000000-0000-0000-0000-000000000000');
		mockClient.newTransactionID.returns(mockTransactionID);
		mockChannel.getName.returns('testchainid');

		mockPeer1 = sinon.createStubInstance(Peer);
		mockPeer1.index = 1; // add these so that the mockPeers can be distiguished when used in WithArgs().
		mockPeer1.getName.returns('Peer1');

		mockPeer2 = sinon.createStubInstance(Peer);
		mockPeer2.index = 2;
		mockPeer2.getName.returns('Peer2');

		mockPeer3 = sinon.createStubInstance(Peer);
		mockPeer3.index = 3;
		mockPeer3.getName.returns('Peer3');

		mockNetwork = sinon.createStubInstance(Network);
		mockNetwork.getOptions.returns({useDiscovery: false});
		channel = new Channel(mockNetwork, mockChannel);

	});

	afterEach(() => {
		sandbox.restore();
		clock.restore();
	});


	describe('#_initializeInternalChannel', () => {
		let peerArray;
		let mockPeer4, mockPeer5;
		beforeEach(() => {
			mockPeer4 = sinon.createStubInstance(Peer);
			mockPeer4.index = 4;
			mockPeer5 = sinon.createStubInstance(Peer);
			mockPeer5.index = 5;

			mockPeer1.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(true);
			mockPeer2.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
			mockPeer3.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(true);
			mockPeer4.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(true);
			mockPeer5.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
			peerArray = [mockPeer1, mockPeer2, mockPeer3, mockPeer4, mockPeer5];
			mockChannel.getPeers.returns(peerArray);
		});

		it('should initialize the channel using the first peer', async () => {
			mockChannel.initialize.resolves();
			await channel._initializeInternalChannel();
			sinon.assert.calledOnce(mockChannel.initialize);
		});

		it('should try other peers if initialization fails', async () => {
			channel.initialized = false;
			// create a real mock
			mockChannel.initialize.onCall(0).rejects(new Error('connect failed'));
			mockChannel.initialize.onCall(1).resolves();
			await channel._initializeInternalChannel();
			sinon.assert.calledTwice(mockChannel.initialize);
			sinon.assert.calledWith(mockChannel.initialize.firstCall, {target: mockPeer1});
			sinon.assert.calledWith(mockChannel.initialize.secondCall, {target: mockPeer3});
		});

		it('should fail if all peers fail', async () => {
			channel.initialized = false;
			mockChannel.initialize.onCall(0).rejects(new Error('connect failed'));
			mockChannel.initialize.onCall(1).rejects(new Error('connect failed next'));
			mockChannel.initialize.onCall(2).rejects(new Error('connect failed again'));
			let error;
			try {
				await channel._initializeInternalChannel();
			} catch(_error) {
				error = _error;
			}
			error.should.match(/connect failed again/);
			sinon.assert.calledThrice(mockChannel.initialize);
			sinon.assert.calledWith(mockChannel.initialize.firstCall, {target: mockPeer1});
			sinon.assert.calledWith(mockChannel.initialize.secondCall, {target: mockPeer3});
			sinon.assert.calledWith(mockChannel.initialize.thirdCall, {target: mockPeer4});
		});

		it('should fail if there are no LEDGER_QUERY_ROLE peers', async () => {
			channel.initialized = false;
			mockPeer1.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
			mockPeer2.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
			mockPeer3.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
			mockPeer4.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
			mockPeer5.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
			peerArray = [mockPeer1, mockPeer2, mockPeer3, mockPeer4, mockPeer5];
			mockChannel.getPeers.returns(peerArray);
			return channel._initializeInternalChannel()
				.should.be.rejectedWith(/no suitable peers available to initialize from/);
		});
	});

	describe('#initialize', () => {
		it('should return with no action if already initialized', () => {
			channel.initialized = true;
			channel._initialize();
		});

		it('should initialize the internal channels', async () => {
			channel.initialized = false;
			sandbox.stub(channel, '_initializeInternalChannel').returns();
			sandbox.stub(channel, '_mapPeersToMSPid').returns({});
			await channel._initialize();
			channel.initialized.should.equal(true);
		});
	});

	describe('#_mapPeersToMSPid', () => {
		let peerArray;
		let mockPeer4, mockPeer5;
		beforeEach(() => {
			mockPeer4 = sinon.createStubInstance(Peer);
			mockPeer4.index = 4;
			mockPeer5 = sinon.createStubInstance(Peer);
			mockPeer5.index = 5;

			mockPeer1.getMspid.returns('MSP01');
			mockPeer2.getMspid.returns('MSP02');
			mockPeer3.getMspid.returns('MSP03');
			mockPeer4.getMspid.returns('MSP03'); // duplicate id
			mockPeer5.getMspid.returns();
			peerArray = [mockPeer1, mockPeer2, mockPeer3, mockPeer4, mockPeer5];
			mockChannel.getPeers.returns(peerArray);
		});

		it('should initialize the peer map', async () => {
			const peermap = channel._mapPeersToMSPid();
			peermap.size.should.equal(3);
			peermap.get('MSP01').should.deep.equal([mockPeer1]);
			peermap.get('MSP02').should.deep.equal([mockPeer2]);
			peermap.get('MSP03').should.deep.equal([mockPeer3, mockPeer4]);
		});

		it('should throw error if no peers associated with MSPID', async () => {
			mockChannel.getPeers.returns([]);
			(() => {
				channel._mapPeersToMSPid();
			}).should.throw(/no suitable peers associated with mspIds were found/);
		});
	});

	describe('#getInternalChannel', () => {
		it('should return the fabric-client channel object', () => {
			channel.getInternalChannel().should.equal(mockChannel);
		});
	});

	describe('#getPeerMap', () => {
		it('should return the peer map', () => {
			const map = new Map();
			channel.peerMap = map;
			channel.getPeerMap().should.equal(map);
		});
	});

	describe('#getContract', () => {
		it('should return a cached contract object', () => {
			const mockContract = sinon.createStubInstance(Contract);
			channel.contracts.set('foo', mockContract);
			channel.getContract('foo').should.equal(mockContract);
		});

		it('should create a non-existent contract object', () => {
			const contract = channel.getContract('bar');
			contract.should.be.instanceof(Contract);
			contract.chaincodeId.should.equal('bar');
		});
	});

	describe('#_dispose', () => {
		it('should cleanup the channel object', () => {
			const mockContract = sinon.createStubInstance(Contract);
			channel.contracts.set('foo', mockContract);
			channel.contracts.size.should.equal(1);
			channel.initialized = true;
			channel._dispose();
			channel.contracts.size.should.equal(0);
			channel.initialized.should.equal(false);
		});
	});

});