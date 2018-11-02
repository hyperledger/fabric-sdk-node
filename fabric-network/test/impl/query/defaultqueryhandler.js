/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const rewire = require('rewire');

const DefaultQueryHandler = require('../../../lib/impl/query/defaultqueryhandler');
const TransactionID = require('fabric-client/lib/TransactionID');
const Channel = rewire('fabric-client/lib/Channel');
const Peer = Channel.__get__('ChannelPeer');
const FABRIC_CONSTANTS = require('fabric-client/lib/Constants');

const sinon = require('sinon');
const chai = require('chai');
const should = chai.should();
chai.use(require('chai-as-promised'));

describe('DefaultQueryHandler', () => {
	let mockPeer1, mockPeer2, mockPeer3, mockPeer4;
	let mockPeerMap, mockTransactionID, mockChannel;
	let queryHandler;

	beforeEach(() => {
		mockPeer1 = sinon.createStubInstance(Peer);
		mockPeer1.getName.returns('Peer1');
		mockPeer1.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.CHAINCODE_QUERY_ROLE).returns(true);
		mockPeer1.index = 1;
		mockPeer2 = sinon.createStubInstance(Peer);
		mockPeer2.getName.returns('Peer2');
		mockPeer2.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.CHAINCODE_QUERY_ROLE).returns(false);
		mockPeer2.index = 2;
		mockPeer3 = sinon.createStubInstance(Peer);
		mockPeer3.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.CHAINCODE_QUERY_ROLE).returns(true);
		mockPeer3.getName.returns('Peer3');
		mockPeer3.index = 3;
		mockPeer4 = sinon.createStubInstance(Peer);
		mockPeer4.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.CHAINCODE_QUERY_ROLE).returns(true);
		mockPeer4.getName.returns('Peer4');
		mockPeer4.index = 4;
		mockPeerMap = new Map();
		mockPeerMap.set('mspid', [mockPeer1, mockPeer2, mockPeer3, mockPeer4]);

		mockTransactionID = sinon.createStubInstance(TransactionID);
		mockChannel = sinon.createStubInstance(Channel);
		queryHandler = new DefaultQueryHandler(mockChannel, 'mspid', mockPeerMap);
	});
	afterEach(() => {
		sinon.restore();
	});

	describe('#constructor', () => {
		it('should create a list of all queryable peers', () => {
			queryHandler.allQueryablePeers.length.should.equal(3);
			queryHandler.allQueryablePeers.should.deep.equal([mockPeer1, mockPeer3, mockPeer4]);
		});

		it('should handle no peers gracefully', () => {
			queryHandler = new DefaultQueryHandler(mockChannel, 'mspid2', mockPeerMap);
			queryHandler.allQueryablePeers.length.should.equal(0);
		});

	});

	describe('#queryChaincode', () => {
		let errorResponse;
		let validResponse;
		let failResponse;
		let emptyResponse;

		beforeEach(() => {
			errorResponse = new Error('Chaincode error response');
			errorResponse.status = 500;
			errorResponse.isProposalResponse = true;

			validResponse = Buffer.from('hello world');
			failResponse = new Error('Failed to contact peer');
			emptyResponse = Buffer.from('');

			mockChannel.queryByChaincode.resolves([validResponse]);
		});

		it('should not switch to another peer if peer returns a payload which is an error', async () => {
			mockChannel.queryByChaincode.resolves([errorResponse]);
			try {
				await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
				should.fail('expected error to be thrown');
			} catch (error) {
				error.message.should.equal(errorResponse.message);
				sinon.assert.calledWith(mockChannel.queryByChaincode, {
					targets: [mockPeer1],
					chaincodeId: 'chaincodeId',
					txId: mockTransactionID,
					fcn: 'myfunc',
					args: ['arg1', 'arg2']
				});
				queryHandler.queryPeerIndex.should.equal(0);
			}
		});

		it('should choose a valid peer', async () => {
			const result = await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);

			sinon.assert.calledWith(mockChannel.queryByChaincode, {
				targets: [mockPeer1],
				chaincodeId: 'chaincodeId',
				txId: mockTransactionID,
				fcn: 'myfunc',
				args: ['arg1', 'arg2']
			});
			queryHandler.queryPeerIndex.should.equal(0);
			result.equals(validResponse).should.be.true;
		});

		it('should cache a valid peer and reuse', async () => {
			await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			const result = await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);

			sinon.assert.calledTwice(mockChannel.queryByChaincode);
			sinon.assert.alwaysCalledWith(mockChannel.queryByChaincode, {
				targets: [mockPeer1],
				chaincodeId: 'chaincodeId',
				txId: mockTransactionID,
				fcn: 'myfunc',
				args: ['arg1', 'arg2']
			});
			queryHandler.queryPeerIndex.should.equal(0);
			result.equals(validResponse).should.be.true;
		});

		it('should choose a valid peer if any respond with an error', async () => {
			mockChannel.queryByChaincode.onFirstCall().resolves([failResponse]);
			mockChannel.queryByChaincode.onSecondCall().resolves([failResponse]);
			mockChannel.queryByChaincode.onThirdCall().resolves([validResponse]);

			const result = await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);

			sinon.assert.calledThrice(mockChannel.queryByChaincode);
			sinon.assert.calledWith(mockChannel.queryByChaincode, {
				targets: [mockPeer4],
				chaincodeId: 'chaincodeId',
				txId: mockTransactionID,
				fcn: 'myfunc',
				args: ['arg1', 'arg2']
			});
			queryHandler.queryPeerIndex.should.equal(2);
			result.equals(validResponse).should.be.true;
		});

		it('should handle when the last successful peer fails', async () => {
			mockChannel.queryByChaincode.onFirstCall().resolves([validResponse]);
			mockChannel.queryByChaincode.onSecondCall().resolves([failResponse]);
			mockChannel.queryByChaincode.onThirdCall().resolves([validResponse]);

			let result = await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			result.equals(validResponse).should.be.true;
			result = await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);

			result.equals(validResponse).should.be.true;
			sinon.assert.calledThrice(mockChannel.queryByChaincode);
			sinon.assert.calledWith(mockChannel.queryByChaincode.firstCall, sinon.match({targets: [mockPeer1]}));
			sinon.assert.calledWith(mockChannel.queryByChaincode.secondCall, sinon.match({targets: [mockPeer1]}));
			sinon.assert.calledWith(mockChannel.queryByChaincode.thirdCall, sinon.match({targets: [mockPeer3]}));
			queryHandler.queryPeerIndex.should.equal(1);
			result.equals(validResponse).should.be.true;

		});

		it('should throw if all peers respond with errors', () => {
			mockChannel.queryByChaincode.onFirstCall().resolves([new Error('FAIL_1')]);
			mockChannel.queryByChaincode.onSecondCall().resolves([new Error('FAIL_2')]);
			mockChannel.queryByChaincode.onThirdCall().resolves([new Error('FAIL_3')]);

			return queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2'])
				.should.be.rejectedWith(/No peers available.+FAIL_3/);
		});

		it('should throw if no peers are suitable to query', () => {
			mockPeer1 = sinon.createStubInstance(Peer);
			mockPeer1.getName.returns('Peer1');
			mockPeer1.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.CHAINCODE_QUERY_ROLE).returns(false);
			mockPeer1.index = 1;
			mockPeerMap = new Map();
			mockPeerMap.set('mspid2', [mockPeer1, mockPeer2]);
			queryHandler = new DefaultQueryHandler(mockChannel, 'mspid2', mockPeerMap);

			return queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2'])
				.should.be.rejectedWith(/No peers have been provided/);
		});

		it('throws if peers return no responses', () => {
			mockChannel.queryByChaincode.resolves([]);
			return queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2'])
				.should.be.rejectedWith(/No payloads were returned/);
		});

		it('throws if queryByChaincode throws', () => {
			mockChannel.queryByChaincode.rejects(new Error('queryByChaincode failed'));
			return queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2'])
				.should.be.rejectedWith(/No peers available.+queryByChaincode failed/);
		});

		it('passes transient data to queryByChaincode', async () => {
			const transientMap = {transientKey: Buffer.from('value')};
			await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2'], transientMap);

			sinon.assert.calledWith(mockChannel.queryByChaincode, {
				targets: [mockPeer1],
				chaincodeId: 'chaincodeId',
				txId: mockTransactionID,
				fcn: 'myfunc',
				args: ['arg1', 'arg2'],
				transientMap: transientMap
			});
		});

		it('returns empty string response', async () => {
			mockChannel.queryByChaincode.resolves([emptyResponse]);
			const result = await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			result.should.equal(emptyResponse);
		});
	});

	describe('Class level tests', () => {
		it('Should always work with the first peer in the list if no problems', async () => {
			const payloads1 = ['my payload'];
			const payloads2 = ['my payload 2'];
			const payloads3 = ['my payload 3'];

			const expectedParms = {
				targets: [mockPeer1],
				chaincodeId: 'ccid',
				txId: mockTransactionID,
				fcn: 'func',
				args: ['arg1', 'arg2']
			};

			// simulate peer responses
			mockChannel.queryByChaincode.withArgs(expectedParms).onCall(0).resolves(payloads1);
			mockChannel.queryByChaincode.withArgs(expectedParms).onCall(1).resolves(payloads2);
			mockChannel.queryByChaincode.withArgs(expectedParms).onCall(2).resolves(payloads3);

			let resp = await queryHandler.queryChaincode('ccid', mockTransactionID, 'func', ['arg1', 'arg2']);
			resp.should.equal(payloads1[0]);
			resp = await queryHandler.queryChaincode('ccid', mockTransactionID, 'func', ['arg1', 'arg2']);
			resp.should.equal(payloads2[0]);
			resp = await queryHandler.queryChaincode('ccid', mockTransactionID, 'func', ['arg1', 'arg2']);
			resp.should.equal(payloads3[0]);
		});

		it('Should find,use and continue to use the next peer if first attempt to a peer fails', async () => {
			const payloads1 = ['my payload'];
			const payloads2 = ['my payload 2'];
			const payloads3 = ['my payload 3'];

			const expectedParmsPeer1 = {
				targets: [mockPeer1],
				chaincodeId: 'ccid',
				txId: mockTransactionID,
				fcn: 'func',
				args: ['arg1', 'arg2']
			};
			const expectedParmsPeer3 = {
				targets: [mockPeer3],
				chaincodeId: 'ccid',
				txId: mockTransactionID,
				fcn: 'func',
				args: ['arg1', 'arg2']
			};


			// simulate peer responses
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer1).onCall(0).rejects(new Error('could not connect before deadline'));
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer3).onCall(0).resolves(payloads1);
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer3).onCall(1).resolves(payloads2);
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer3).onCall(2).resolves(payloads3);

			let resp = await queryHandler.queryChaincode('ccid', mockTransactionID, 'func', ['arg1', 'arg2']);
			resp.should.equal(payloads1[0]);
			resp = await queryHandler.queryChaincode('ccid', mockTransactionID, 'func', ['arg1', 'arg2']);
			resp.should.equal(payloads2[0]);
			resp = await queryHandler.queryChaincode('ccid', mockTransactionID, 'func', ['arg1', 'arg2']);
			resp.should.equal(payloads3[0]);
		});

		it('Should find, use and continue to use next peer if the good peer stops responding', async () => {
			const payloads1 = ['my payload'];
			const payloads2 = ['my payload 2'];
			const payloads3 = ['my payload 3'];

			const expectedParmsPeer1 = {
				targets: [mockPeer1],
				chaincodeId: 'ccid',
				txId: mockTransactionID,
				fcn: 'func',
				args: ['arg1', 'arg2']
			};
			const expectedParmsPeer3 = {
				targets: [mockPeer3],
				chaincodeId: 'ccid',
				txId: mockTransactionID,
				fcn: 'func',
				args: ['arg1', 'arg2']
			};

			// simulate peer responses
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer1).onCall(0).resolves(payloads1);
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer1).onCall(1).rejects(new Error('could not connect before deadline'));
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer3).onCall(0).resolves(payloads2);
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer3).onCall(1).resolves(payloads3);
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer3).onCall(2).resolves(payloads3);

			let resp = await queryHandler.queryChaincode('ccid', mockTransactionID, 'func', ['arg1', 'arg2']);
			resp.should.equal(payloads1[0]);
			resp = await queryHandler.queryChaincode('ccid', mockTransactionID, 'func', ['arg1', 'arg2']);
			resp.should.equal(payloads2[0]);
			resp = await queryHandler.queryChaincode('ccid', mockTransactionID, 'func', ['arg1', 'arg2']);
			resp.should.equal(payloads3[0]);
		});

		it('Should find and use first peer in the list again if other peers stop responding', async () => {
			const payloads1 = ['my payload'];
			const payloads2 = ['my payload 2'];
			const payloads3 = ['my payload 3'];

			const expectedParmsPeer1 = {
				targets: [mockPeer1],
				chaincodeId: 'ccid',
				txId: mockTransactionID,
				fcn: 'func',
				args: ['arg1', 'arg2']
			};
			const expectedParmsPeer3 = {
				targets: [mockPeer3],
				chaincodeId: 'ccid',
				txId: mockTransactionID,
				fcn: 'func',
				args: ['arg1', 'arg2']
			};

			const expectedParmsPeer4 = {
				targets: [mockPeer4],
				chaincodeId: 'ccid',
				txId: mockTransactionID,
				fcn: 'func',
				args: ['arg1', 'arg2']
			};


			// simulate peer responses peer1: good, then bad, peer3: good then bad, peer4: bad, peer1: good
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer1).onCall(0).resolves(payloads1);
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer1).onCall(1).rejects(new Error('could not connect before deadline'));
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer3).onCall(0).resolves(payloads2);
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer3).onCall(1).rejects(new Error('could not connect before deadline'));
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer4).onCall(0).rejects(new Error('could not connect before deadline'));
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer1).onCall(2).resolves(payloads3);

			let resp = await queryHandler.queryChaincode('ccid', mockTransactionID, 'func', ['arg1', 'arg2']);
			resp.should.equal(payloads1[0]);
			resp = await queryHandler.queryChaincode('ccid', mockTransactionID, 'func', ['arg1', 'arg2']);
			resp.should.equal(payloads2[0]);
			resp = await queryHandler.queryChaincode('ccid', mockTransactionID, 'func', ['arg1', 'arg2']);
			resp.should.equal(payloads3[0]);
		});

		it('Should find and use first peer in the list again if other peers stop responding if non chaincode errors are in payload', async () => {
			const payloads1 = ['my payload'];
			const errorPayload = [new Error('REQUEST_TIMEOUT')];
			const payloads2 = ['my payload 2'];
			const payloads3 = ['my payload 3'];

			const expectedParmsPeer1 = {
				targets: [mockPeer1],
				chaincodeId: 'ccid',
				txId: mockTransactionID,
				fcn: 'func',
				args: ['arg1', 'arg2']
			};
			const expectedParmsPeer3 = {
				targets: [mockPeer3],
				chaincodeId: 'ccid',
				txId: mockTransactionID,
				fcn: 'func',
				args: ['arg1', 'arg2']
			};

			const expectedParmsPeer4 = {
				targets: [mockPeer4],
				chaincodeId: 'ccid',
				txId: mockTransactionID,
				fcn: 'func',
				args: ['arg1', 'arg2']
			};


			// simulate peer responses peer1: good, then bad, peer3: good then bad, peer4: bad, peer1: good
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer1).onCall(0).resolves(payloads1);
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer1).onCall(1).resolves(errorPayload);
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer3).onCall(0).resolves(payloads2);
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer3).onCall(1).resolves(errorPayload);
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer4).onCall(0).resolves(errorPayload);
			mockChannel.queryByChaincode.withArgs(expectedParmsPeer1).onCall(2).resolves(payloads3);

			let resp = await queryHandler.queryChaincode('ccid', mockTransactionID, 'func', ['arg1', 'arg2']);
			resp.should.equal(payloads1[0]);
			resp = await queryHandler.queryChaincode('ccid', mockTransactionID, 'func', ['arg1', 'arg2']);
			resp.should.equal(payloads2[0]);
			resp = await queryHandler.queryChaincode('ccid', mockTransactionID, 'func', ['arg1', 'arg2']);
			resp.should.equal(payloads3[0]);
		});

	});
});
