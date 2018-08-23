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

	const sandbox = sinon.createSandbox();
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
		sandbox.restore();
	});

	describe('#constructor', () => {
		it('should create a list of all queryable peers', () => {
			const queryHandler = new DefaultQueryHandler(mockChannel, 'mspid', mockPeerMap);
			queryHandler.allQueryablePeers.length.should.equal(3);
			queryHandler.allQueryablePeers.should.deep.equal([mockPeer1, mockPeer3, mockPeer4]);
		});

		it('should handle no peers gracefully', () => {
			const queryHandler = new DefaultQueryHandler(mockChannel, 'mspid2', mockPeerMap);
			queryHandler.allQueryablePeers.length.should.equal(0);
		});

	});

	describe('#queryChaincode', () => {
		it('should not switch to another peer if peer returns a payload which is an error', async () => {
			const response = new Error('my chaincode error');
			response.status = 500;
			response.isProposalResponse = true;
			mockChannel.queryByChaincode.resolves([response]);
			const qspSpy = sinon.spy(queryHandler, '_querySinglePeer');
			try {
				await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
				should.fail('expected error to be thrown');
			} catch(error) {
				error.message.should.equal('my chaincode error');
				sinon.assert.calledOnce(qspSpy);
				sinon.assert.calledWith(qspSpy, mockPeer1, 'chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
				queryHandler.queryPeerIndex.should.equal(0);
			}

		});

		it('should choose a valid peer', async () => {
			const response = Buffer.from('hello world');
			sandbox.stub(queryHandler, '_querySinglePeer').resolves(response);

			const result = await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			sinon.assert.calledOnce(queryHandler._querySinglePeer);
			sinon.assert.calledWith(queryHandler._querySinglePeer, mockPeer1, 'chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			queryHandler.queryPeerIndex.should.equal(0);
			result.equals(response).should.be.true;
		});

		it('should cache a valid peer and reuse', async () => {
			const response = Buffer.from('hello world');
			sandbox.stub(queryHandler, '_querySinglePeer').resolves(response);

			await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			const result = await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			sinon.assert.calledTwice(queryHandler._querySinglePeer);
			sinon.assert.alwaysCalledWith(queryHandler._querySinglePeer, mockPeer1, 'chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			queryHandler.queryPeerIndex.should.equal(0);
			result.equals(response).should.be.true;
		});

		it('should choose a valid peer if any respond with an error', async () => {
			const response = Buffer.from('hello world');
			const qsp = sandbox.stub(queryHandler, '_querySinglePeer');

			/* this didn't work as the mockPeers look the same
            qsp.withArgs(mockPeer2, 'aTxID', 'myfunc', ['arg1', 'arg2']).rejects(new Error('I failed'));
            qsp.withArgs(mockPeer1, 'aTxID', 'myfunc', ['arg1', 'arg2']).rejects(new Error('I failed'));
            qsp.withArgs(mockPeer3, 'aTxID', 'myfunc', ['arg1', 'arg2']).resolves(response);
            */
			qsp.onFirstCall().rejects(new Error('I failed'));
			qsp.onSecondCall().rejects(new Error('I failed'));
			qsp.onThirdCall().resolves(response);

			const result = await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			sinon.assert.calledThrice(qsp);
			sinon.assert.calledWith(qsp.thirdCall, mockPeer4, 'chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			queryHandler.queryPeerIndex.should.equal(2);
			result.equals(response).should.be.true;
		});

		it('should handle when the last successful peer fails', async () => {
			const response = Buffer.from('hello world');
			const qsp = sandbox.stub(queryHandler, '_querySinglePeer');
			qsp.onFirstCall().resolves(response);
			qsp.onSecondCall().rejects(new Error('I failed'));
			qsp.onThirdCall().resolves(response);

			let result = await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			result.equals(response).should.be.true;
			result = await queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			result.equals(response).should.be.true;
			sinon.assert.calledThrice(queryHandler._querySinglePeer);
			sinon.assert.calledWith(qsp.firstCall, mockPeer1, 'chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			sinon.assert.calledWith(qsp.secondCall, mockPeer1, 'chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			sinon.assert.calledWith(qsp.thirdCall, mockPeer3, 'chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			queryHandler.queryPeerIndex.should.equal(1);
			result.equals(response).should.be.true;

		});

		it('should throw if all peers respond with errors', () => {
			const qsp = sandbox.stub(queryHandler, '_querySinglePeer');
			qsp.onFirstCall().rejects(new Error('I failed 1'));
			qsp.onSecondCall().rejects(new Error('I failed 2'));
			qsp.onThirdCall().rejects(new Error('I failed 3'));

			return queryHandler.queryChaincode('chaincodeId', mockTransactionID, 'myfunc', ['arg1', 'arg2'])
				.should.be.rejectedWith(/No peers available.+failed 3/);
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

	});

	describe('#_querySinglePeer', () => {

		it('should query a single peer', async () => {
			const response = Buffer.from('hello world');
			mockChannel.queryByChaincode.resolves([response]);
			const result = await queryHandler._querySinglePeer(mockPeer2, 'org-acme-biznet', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			sinon.assert.calledOnce(mockChannel.queryByChaincode);
			sinon.assert.calledWith(mockChannel.queryByChaincode, {
				chaincodeId: 'org-acme-biznet',
				txId: mockTransactionID,
				fcn: 'myfunc',
				args: ['arg1', 'arg2'],
				targets: [mockPeer2]
			});
			result.equals(response).should.be.true;

		});

		it('should throw if no responses are returned', () => {
			mockChannel.queryByChaincode.resolves([]);
			return queryHandler._querySinglePeer(mockPeer2, 'org-acme-biznet', 'txid', 'myfunc', ['arg1', 'arg2'])
				.should.be.rejectedWith(/No payloads were returned from request:myfunc/);
		});

		it('should return any responses that are chaincode errors', async () => {
			const response = new Error('such error');
			response.status = 500;
			response.isProposalResponse = true;
			mockChannel.queryByChaincode.resolves([response]);
			const result = await queryHandler._querySinglePeer(mockPeer2, 'org-acme-biznet', mockTransactionID, 'myfunc', ['arg1', 'arg2']);
			sinon.assert.calledOnce(mockChannel.queryByChaincode);
			sinon.assert.calledWith(mockChannel.queryByChaincode, {
				chaincodeId: 'org-acme-biznet',
				txId: mockTransactionID,
				fcn: 'myfunc',
				args: ['arg1', 'arg2'],
				targets: [mockPeer2]
			});
			result.should.be.instanceOf(Error);
			result.message.should.equal('such error');
		});

		it('should throw any responses that are errors and code 14 being unavailable.', () => {
			const response = new Error('14 UNAVAILABLE: Connect Failed');
			response.code = 14;
			mockChannel.queryByChaincode.resolves([response]);
			return queryHandler._querySinglePeer(mockPeer2, 'org-acme-biznet', 'txid', 'myfunc', ['arg1', 'arg2'])
				.should.be.rejectedWith(/Connect Failed/);
		});

		it('should throw if query request fails', () => {
			mockChannel.queryByChaincode.rejects(new Error('Query Failed'));
			return queryHandler._querySinglePeer(mockPeer2, 'org-acme-biznet', 'txid', 'myfunc', ['arg1', 'arg2'])
				.should.be.rejectedWith(/Query Failed/);
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
