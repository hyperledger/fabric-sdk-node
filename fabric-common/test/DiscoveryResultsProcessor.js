/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const should = chai.should();
chai.use(chaiAsPromised);
const sinon = require('sinon');

const Client = require('../lib/Client');
const Discoverer = require('../lib/Discoverer');
const Endorser = require('../lib/Endorser');
const Committer = require('../lib/Committer');
const TestUtils = require('./TestUtils');
const DiscoveryResultsProcessor = require('../lib/DiscoveryResultsProcessor');
const DiscoveryService = require('../lib/DiscoveryService');

describe('DiscoveryResultsProcessor', () => {
	TestUtils.setCryptoConfigSettings();

	const client = new Client('myclient');
	client._tls_mutual.clientCertHash = Buffer.from('clientCertHash');
	const channel = client.newChannel('mychannel');

	const orderers = {
		OrdererMSP: {endpoints: [{host: 'orderer.example.com', port: 7150, name: 'orderer.example.com'}]}
	};

	let discoverer;
	let discovery;
	let endpoint;
	let endorser;
	let committer;
	let processor;

	beforeEach(async () => {
		discoverer = new Discoverer('mydiscoverer', client);
		endpoint = client.newEndpoint({url: 'grpc://somehost.com'});
		discoverer.endpoint = endpoint;
		sinon.stub(discoverer, 'waitForReady').resolves(true);
		sinon.stub(discoverer, 'checkConnection').resolves(true);

		endorser = sinon.createStubInstance(Endorser);
		endorser.type = 'Endorser';
		endorser.connected = true;
		endorser.isConnectable.returns(true);
		endorser.connect.resolves(true);

		discovery = new DiscoveryService('mydiscovery', channel);
		sinon.stub(client, 'getEndorser').returns(endorser);
		sinon.stub(client, 'newEndorser').returns(endorser);

		committer = sinon.createStubInstance(Committer);
		committer.type = 'Committer';
		committer.connected = true;
		committer.isConnectable.returns(true);
		committer.connect.resolves(true);
		committer.name = 'mycommitter';
		sinon.stub(client, 'newCommitter').returns(committer);

		channel.committers = new Map();

		processor = new DiscoveryResultsProcessor(discovery, {});
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('#_buildTlsRootCerts', () => {
		it('should handle no parms', () => {
			(() => {
				processor._buildTlsRootCerts();
			}).should.throw('Missing msp_id parameter');
		});
		it('should handle missing mspid when no msps', () => {
			const results = processor._buildTlsRootCerts('msp1');
			should.equal(results, '');
		});
		it('should handle missing mspid when not in msps', () => {
			processor.parsedResults.msps = {msp1: {
				id: 'msp1',
				name: 'msp1',
				tlsRootCerts: 'root certs',
				tlsIntermediateCerts: 'intermediate certs'
			}};
			const results = processor._buildTlsRootCerts('bad');
			should.equal(results, '');
		});
		it('should handle mspid when in msps', () => {
			processor.parsedResults.msps = {msp1: {
				id: 'msp1',
				name: 'msp1',
				tlsRootCerts: 'rootcerts',
				tlsIntermediateCerts: 'intermediatecerts'
			}};
			const results = processor._buildTlsRootCerts('msp1');
			should.equal(results, 'rootcertsintermediatecerts');
		});
		it('should handle mspid when in msps and no certs', () => {
			processor.parsedResults.msps = {msp1: {
				id: 'msp1',
				name: 'msp1'
			}};
			const results = processor._buildTlsRootCerts('msp1');
			should.equal(results, '');
		});
	});

	describe('#_buildOrderers', () => {
		it('should add new orderers to the channel', async () => {
			should.equal(channel.getCommitters().length, 0);
			await processor._buildOrderers(orderers); // add one orderer
			should.equal(channel.getCommitters().length, 1);
		});
	});

	describe('#_buildOrderer', () => {
		it('should run', async () => {
			committer.name = 'mycommitter:80';
			sinon.stub(channel, 'getCommitter').returns(committer);
			const results = await processor._buildOrderer('mycommitter', '80', 'mspid');
			should.equal(results, 'mycommitter:80');
		});
		it('should throw connect error', async () => {
			sinon.stub(channel, 'getCommitter').returns();
			committer.connect.throws(new Error('failed to connect'));
			const results = await processor._buildOrderer('mycommitter', '80', 'mspid');
			should.equal(results, 'mycommitter:80');
		});
		it('should handle found same name committer on the channel', async () => {
			channel.addCommitter(committer);
			committer.endpoint = endpoint;
			sinon.stub(discovery, '_buildUrl').returns('grpc://somehost.com:7000');
			await processor._buildOrderer('somehost.com', 7000, 'mspid');
			should.equal(channel.getCommitters().length, 1);
		});
	});

	describe('#_buildPeer', () => {
		it('should handle no parms', async () => {
			await processor._buildPeer().should.be.rejectedWith('Missing discovery_peer parameter');
		});
		it('should handle found same name endorser on the channel', async () => {
			endorser.name = 'mypeer';
			channel.endorsers = new Map();
			channel.addEndorser(endorser);
			const results = await processor._buildPeer({endpoint: 'mypeer:2000', mspid: 'msp1'});
			should.equal(results, endorser);
			should.equal(channel.getEndorsers().length, 1);
		});
		it('should run', async () => {
			processor.parsedResults.msps = {msp1: {
				id: 'msp1',
				name: 'msp1',
				tlsRootCerts: 'rootcerts',
				tlsIntermediateCerts: 'intermediatecerts'
			}};
			endorser.name = 'host2.com:1000';
			const results = await processor._buildPeer({endpoint: 'host2.com:1000', name: 'host2.com:1000', mspid: 'msp1'});
			should.equal(results.name, 'host2.com:1000');
		});
		it('should handle endorser not connect', async () => {
			processor.parsedResults.msps = {msp1: {
				id: 'msp1',
				name: 'msp1',
				tlsRootCerts: 'rootcerts',
				tlsIntermediateCerts: 'intermediatecerts'
			}};
			endorser.name = 'host3.com:1000';
			endorser.connect.throws(new Error('failed to connect'));
			const results = await processor._buildPeer({endpoint: 'host3.com:1000', name: 'host3.com:1000', mspid: 'msp1'});
			should.equal(results.name, 'host3.com:1000');
		});
		it('should handle found same name endorser on the channel', async () => {
			endorser.name = 'mypeer';
			channel.endorsers = new Map();
			channel.addEndorser(endorser);
			endorser.endpoint = endpoint;
			sinon.stub(discovery, '_buildUrl').returns('grpc://somehost.com');
			const results = await processor._buildPeer({endpoint: 'somehost.com', mspid: 'mspid'});
			should.equal(results, endorser);
			should.equal(channel.getEndorsers().length, 1);
		});
		it('should handle found same name endorser on the channel and add chaincodes', async () => {
			endorser.name = 'mypeer';
			channel.endorsers = new Map();
			channel.addEndorser(endorser);
			endorser.endpoint = endpoint;
			sinon.stub(discovery, '_buildUrl').returns('grpc://somehost.com');
			const results = await processor._buildPeer({endpoint: 'somehost.com', mspid: 'mspid', chaincodes: [{name: 'chaincode'}]});
			should.equal(results, endorser);
			should.equal(channel.getEndorsers().length, 1);
			sinon.assert.calledWith(endorser.addChaincode, 'chaincode');
		});
	});

	describe('#_processConfig', () => {
		it('should handle no parms', async () => {
			const results = await processor._processConfig();
			should.exist(results);
		});
		it('should handle no msps', async () => {
			const config = {
				orderers: {
					msp1: TestUtils.createEndpoints('hosta', 2),
					msp2: TestUtils.createEndpoints('hostb', 2)
				}
			};
			const results = await processor._processConfig(config);
			should.exist(results.orderers);
		});
		it('should handle no msps', async () => {
			const config = {
				msps: {
					msp1: TestUtils.createMsp('msp3'),
					msp2: TestUtils.createMsp('msp4')
				}
			};
			const results = await processor._processConfig(config);
			should.exist(results.msps);
		});
	});

	describe('#_processChaincode', () => {
		it('should throw error if plans are bad', async () => {
			await processor._processChaincode().should.be.rejectedWith('Plan layouts are invalid');
		});
	});

	describe('#_processPeers', () => {
		it('should handle missing endorser state info', async () => {
			channel.endorsers = new Map();
			const q_peers = [
				{
					identity: TestUtils.createSerializedIdentity(),
					membership_info: {payload: TestUtils.createMembership()}
				}
			];
			await processor._processPeers(q_peers);
		});
	});

	describe('#_processMembership', () => {
		it('should handle missing endorser by org', async () => {
			await processor._processMembership({});
		});
	});
});
