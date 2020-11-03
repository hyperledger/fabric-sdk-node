/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const rewire = require('rewire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const should = chai.should();
chai.use(chaiAsPromised);
const sinon = require('sinon');

const DiscoveryService = rewire('../lib/DiscoveryService');
const Client = require('../lib/Client');
const Discoverer = require('../lib/Discoverer');
const Endorser = require('../lib/Endorser');
const Committer = require('../lib/Committer');
const User = rewire('../lib/User');
const TestUtils = require('./TestUtils');

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('DiscoveryService', () => {
	const ccQueryRes = {result: 'cc_query_res',
		cc_query_res: {content: [{
			chaincode: 'mychaincode',
			endorsers_by_groups: {
				g0: {peers: [{
					identity: TestUtils.createSerializedIdentity(),
					membership_info: {payload: TestUtils.createMembership()},
					state_info: {payload: TestUtils.createStateInfo()}
				}]}
			},
			layouts: [
				{quantities_by_group: {g0: 1}}
			]
		}]}
	};
	const members = {result: 'members',
		members: {peers_by_org: {
			msp1: {
				peers: [{
					identity: TestUtils.createSerializedIdentity(),
					membership_info: {payload: TestUtils.createMembership()},
					state_info: {payload: TestUtils.createStateInfo()}
				}]
			}
		}}
	};
	const bad_members = {result: 'members',
		members: {peers_by_org: {
			msp2: {
				peers: [{
					identity: TestUtils.createSerializedIdentity(),
					membership_info: {payload: TestUtils.createMembership()},
					state_info: {payload: TestUtils.createStateInfo()}
				}]
			}
		}}
	};
	const configResult = {result: 'config_result',
		config_result: {
			msps: {
				msp1: TestUtils.createMsp('msp1'),
				msp2: TestUtils.createMsp('msp2')
			},
			orderers: {
				msp1: TestUtils.createEndpoints('hosta', 2),
				msp2: TestUtils.createEndpoints('hostb', 2)
			}
		}
	};
	const configResult2 = {result: 'configResult',
		config_result: {
			msps: {
				msp1: TestUtils.createMsp('msp1'),
				msp2: TestUtils.createMsp('msp2')
			}
		}
	};

	const orderers = {
		OrdererMSP: {endpoints: [{host: 'orderer.example.com', port: 7150, name: 'orderer.example.com'}]}
	};

	TestUtils.setCryptoConfigSettings();

	const client = new Client('myclient');
	client._tls_mutual.clientCertHash = Buffer.from('clientCertHash');
	const channel = client.newChannel('mychannel');

	const user = User.createUser('user', 'password', 'mspid', TestUtils.certificateAsPEM, TestUtils.keyAsPEM);
	const idx = client.newIdentityContext(user);

	let discoverer;
	let discovery;
	let endpoint;
	let sandbox;
	let revert;

	const endorser = sinon.createStubInstance(Endorser);
	endorser.type = 'Endorser';
	endorser.connected = true;
	endorser.isConnectable = sinon.stub().returns(true);

	const committer = sinon.createStubInstance(Committer);
	committer.type = 'Committer';
	committer.connected = true;
	committer.isConnectable = sinon.stub().returns(true);

	let FakeLogger;

	beforeEach(async () => {
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
		revert.push(DiscoveryService.__set__('logger', FakeLogger));

		discoverer = new Discoverer('mydiscoverer', client);
		endpoint = client.newEndpoint({url: 'grpc://somehost.com'});
		discoverer.endpoint = endpoint;
		discoverer.waitForReady = sinon.stub().resolves(true);
		discoverer.checkConnection = sinon.stub().resolves(true);
		discovery = new DiscoveryService('mydiscovery', channel);
		client.getEndorser = sinon.stub().returns(endorser);
		client.newEndorser = sinon.stub().returns(endorser);
		endorser.connect.resolves(true);
		endorser.connected = true;
		endorser.addChaincode = sinon.stub();
		client.newCommitter = sinon.stub().returns(committer);
		committer.connect.resolves(true);
		committer.name = 'mycommitter';
		committer.connect.resolves(true);
		committer.connected = true;
		channel.committers = new Map();

		sinon.addBehavior('setDiscoveryResults', async (fake, n) => {
			discovery.discoveryResults = n;
			await sleep(1000);
		});
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
	});

	describe('#constructor', () => {
		it('should require a name', () => {
			(() => {
				new DiscoveryService();
			}).should.throw('Missing name parameter');
		});
		it('should require a Channel', () => {
			(() => {
				new DiscoveryService('chaincode');
			}).should.throw('Missing channel parameter');
		});
		it('should create', () => {
			const discovery2 = new DiscoveryService('chaincode', channel);
			discovery2.type.should.equal('DiscoveryService');
		});
	});

	describe('#setTargets', () => {
		it('should require targets', () => {
			(() => {
				discovery.setTargets();
			}).should.throw('Missing targets parameter');
		});
		it('should require targets as an array', () => {
			(() => {
				discovery.setTargets(discoverer);
			}).should.throw('targets parameter is not an array');
		});
		it('should require targets when array is empty', () => {
			(() => {
				discovery.setTargets([]);
			}).should.throw('No targets provided');
		});
		it('should throw when target not connected', () => {
			(() => {
				discoverer.endpoint = undefined;
				discovery.setTargets([discoverer]);
			}).should.throw('Discoverer mydiscoverer is not connectable');
		});
		it('should handle connected target', () => {
			discoverer.connected = true;
			discovery.setTargets([discoverer]);
			should.equal(discovery.targets[0].type, 'Discoverer');
			should.equal(discovery.targets[0].name, 'mydiscoverer');
		});
		it('should handle connectable target', () => {
			discoverer.connected = false;
			discovery.setTargets([discoverer]);
			should.equal(discovery.targets[0].type, 'Discoverer');
			should.equal(discovery.targets[0].name, 'mydiscoverer');
		});
	});

	describe('#newHandler', () => {
		it('should return new handler', () => {
			const handler = discovery.newHandler();
			should.equal(handler.discoveryService.type, 'DiscoveryService');
			should.equal(handler.discoveryService.name, 'mydiscovery');
		});
	});

	describe('#build', () => {
		it('should require a idContext', () => {
			(() => {
				discovery.build();
			}).should.throw('Missing idContext parameter');
		});
		it('should require an interest endorsement', () => {
			(() => {
				discovery.build(idx, {config: false});
			}).should.throw('No discovery interest provided');
		});
		it('should build with default options', () => {
			discovery.build(idx);
			should.exist(discovery._action);
			should.exist(discovery._payload);
		});
		it('should build with a config option', () => {
			discovery.build(idx, {config: true});
			should.exist(discovery._action);
			should.exist(discovery._payload);
		});
		it('should build with a local option', () => {
			discovery.build(idx, {local: true});
			should.exist(discovery._action);
			should.exist(discovery._payload);
		});
		it('should build with an endorsement option', () => {
			const endorsement = channel.newEndorsement('mychaincode');
			discovery.build(idx, {local: true, endorsement: endorsement});
			should.exist(discovery._action);
			should.exist(discovery._payload);
		});
		it('should build with an interest option with user chaincode', () => {
			const interest = [{name: 'mychaincode'}];
			discovery.build(idx, {local: true, interest: interest});
			should.exist(discovery._action);
			should.exist(discovery._payload);
			sinon.assert.calledWith(FakeLogger.debug, '%s - adding chaincodes/collections query');
		});
		it('should build with an interest option with system chaincode qscc', () => {
			const interest = [{name: 'qscc'}];
			discovery.build(idx, {local: true, interest: interest});
			should.exist(discovery._action);
			should.exist(discovery._payload);
			sinon.assert.calledWith(FakeLogger.debug, '%s - not adding %s interest');
			sinon.assert.calledWith(FakeLogger.debug, '%s - NOT adding chaincodes/collections query');
		});
		it('should build with an interest option with system chaincode cscc', () => {
			const interest = [{name: 'cscc'}];
			discovery.build(idx, {local: true, interest: interest});
			should.exist(discovery._action);
			should.exist(discovery._payload);
			sinon.assert.calledWith(FakeLogger.debug, '%s - not adding %s interest');
			sinon.assert.calledWith(FakeLogger.debug, '%s - NOT adding chaincodes/collections query');
		});
		it('should build with an interest option with system chaincode lscc', () => {
			const interest = [{name: 'lscc'}];
			discovery.build(idx, {local: true, interest: interest});
			should.exist(discovery._action);
			should.exist(discovery._payload);
			sinon.assert.calledWith(FakeLogger.debug, '%s - not adding %s interest');
			sinon.assert.calledWith(FakeLogger.debug, '%s - NOT adding chaincodes/collections query');
		});
	});

	describe('#send', () => {
		it('throws if targets is missing', async () => {
			discovery.build(idx);
			discovery.sign(idx);
			await discovery.send().should.be.rejectedWith('Missing targets parameter');
		});
		it('throws if targets is not an array', async () => {
			discovery.build(idx);
			discovery.sign(idx);
			await discovery.send({targets: ''}).should.be.rejectedWith('Missing targets parameter');
		});
		it('throws if targets is an empty array', async () => {
			discovery.build(idx);
			discovery.sign(idx);
			await discovery.send({targets: []}).should.be.rejectedWith('Missing targets parameter');
		});
		it('throws no results if targets is not missing', async () => {
			discovery.build(idx);
			discovery.sign(idx);
			sinon.stub(discoverer, 'sendDiscovery').resolves({});
			await discovery.send({targets: [discoverer]}).should.be.rejectedWith('DiscoveryService has failed to return results');
		});
		it('should be able to handle result error', async () => {
			discovery.build(idx);
			discovery.sign(idx);
			sinon.stub(discoverer, 'sendDiscovery').resolves(new Error('forced error'));
			await discovery.send({targets: [discoverer]}).should.be.rejectedWith('forced error');
		});
		it('should be able to handle rejected error', async () => {
			discovery.build(idx);
			discovery.sign(idx);
			sinon.stub(discoverer, 'sendDiscovery').rejects(new Error('forced error'));
			await discovery.send({targets: [discoverer]}).should.be.rejectedWith('forced error');
		});
		it('throws no results if results includes and error', async () => {
			discovery.build(idx);
			discovery.sign(idx);
			sinon.stub(discoverer, 'sendDiscovery').resolves({results:[{result: 'error', error: {content: 'result error'}}]});
			await discovery.send({targets: [discoverer]}).should.be.rejectedWith('DiscoveryService: mydiscovery error: result error');
		});
		it('handle results from config with preexist target', async () => {
			discovery.build(idx);
			discovery.sign(idx);
			endorser.name = 'peer1';
			sinon.stub(discoverer, 'sendDiscovery').resolves({results: [configResult]});
			discovery.targets = [discoverer];
			const results = await discovery.send();
			should.exist(results.msps);
		});
		it('handle results from config', async () => {
			discovery.build(idx);
			discovery.sign(idx);
			endorser.name = 'peer1';
			sinon.stub(discoverer, 'sendDiscovery').resolves({results: [configResult]});
			const results = await discovery.send({targets: [discoverer]});
			should.exist(results.msps);
		});
		it('handle results from config with no orderers', async () => {
			discovery.build(idx);
			discovery.sign(idx);
			endorser.name = 'peer1';
			sinon.stub(discoverer, 'sendDiscovery').resolves({results: [configResult2]});
			const results = await discovery.send({targets: [discoverer]});
			should.exist(results.msps);
		});
		it('handle results from config if endorser exist', async () => {
			discovery.build(idx);
			discovery.sign(idx);
			endorser.name = 'host.com:1000';
			channel.addEndorser(endorser);
			sinon.stub(discoverer, 'sendDiscovery').resolves({results: [configResult]});
			const results = await discovery.send({targets: [discoverer]});
			should.exist(results.msps);
		});
		it('handle results with members', async () => {
			discovery.build(idx);
			discovery.sign(idx);
			endorser.name = 'peer2';
			sinon.stub(discoverer, 'sendDiscovery').resolves({results: [configResult, members]});
			const results = await discovery.send({targets: [discoverer]});
			should.exist(results.peers_by_org);
		});
		it('handle results with bad members', async () => {
			discovery.build(idx);
			discovery.sign(idx);
			endorser.name = 'peer3';
			sinon.stub(discoverer, 'sendDiscovery').resolves({results: [configResult, bad_members]});
			const results = await discovery.send({targets: [discoverer], asLocalhost: true});
			should.exist(results.peers_by_org);

		});
		it('handle results with chaincode query res', async () => {
			discovery.build(idx);
			discovery.sign(idx);
			endorser.name = 'peer4';
			endorser.connect = sinon.stub().throws(new Error('bad connect'));
			sinon.stub(discoverer, 'sendDiscovery').resolves({results: [configResult, ccQueryRes]});
			const results = await discovery.send({targets: [discoverer]});
			should.exist(results.endorsement_plan);
		});
	});

	describe('#getDiscoveryResults', async () => {
		it('should close no targets', async () => {
			await discovery.getDiscoveryResults().should.be.rejectedWith('No discovery results found');
		});
		it('should try to resend', async () => {
			discovery.discoveryResults = {};
			discovery.discoveryResults.timestamp = 0;
			discovery.send = sinon.stub().returns({});
			await discovery.getDiscoveryResults(true);
		});
		it('should not resend', async () => {
			discovery.discoveryResults = {not: true};
			discovery.send = sinon.stub().returns({});
			const results = await discovery.getDiscoveryResults();
			should.equal(results.not, true);
		});
		it('should return savedResults', async () => {
			discovery.discoveryResults = {count: 1};
			discovery.discoveryResults.timestamp = 0;
			discovery.send = sinon.stub().setDiscoveryResults({count: 2});

			const first = discovery.getDiscoveryResults(true);
			const second = discovery.getDiscoveryResults(true);
			const third = discovery.getDiscoveryResults(true);
			const results = await Promise.all([first, second, third]);
			should.equal(results[0].count, 2);
			should.equal(results[1].count, 2);
			should.equal(results[2].count, 2);
		});
	});

	describe('#hasDiscoveryResults', async () => {
		it('should return false', () => {
			discovery.discoveryResults = null;
			const results = discovery.hasDiscoveryResults();
			results.should.be.false;
		});
		it('should return true', () => {
			discovery.discoveryResults = {};
			const results = discovery.hasDiscoveryResults();
			results.should.be.true;
		});
	});

	describe('#close', () => {
		it('should close no targets', () => {
			discovery.close();
		});
		it('should close all targets', () => {
			discovery.targets = [discoverer];
			discovery.close();
		});
	});

	describe('#toString', () => {
		it('should return string', () => {
			const string = discovery.toString();
			should.equal(string, 'DiscoveryService: {name: mydiscovery, channel: mychannel}');
		});
	});

	describe('#_buildProtoChaincodeInterest', () => {
		it('should handle no interest', () => {
			const results = discovery._buildProtoChaincodeInterest();
			should.exist(results.chaincodes);
		});
		it('should handle one chaincode', () => {
			const interest = [{name: 'chaincode1'}];
			const results = discovery._buildProtoChaincodeInterest(interest);
			should.exist(results.chaincodes);
		});
		it('should handle one chaincode one collection', () => {
			const interest = [{name: 'chaincode1', collection_names: ['collection1']}];
			const results = discovery._buildProtoChaincodeInterest(interest);
			should.exist(results.chaincodes);
		});
		it('should handle two chaincodes', () => {
			const interest = [{name: 'chaincode1'}, {name: 'chaincode2'}];
			const results = discovery._buildProtoChaincodeInterest(interest);
			should.exist(results.chaincodes);
		});
		it('should handle two chaincode two collection', () => {
			const interest = [
				{name: 'chaincode1', collection_names: ['collection1']},
				{name: 'chaincode2', collection_names: ['collection2']}
			];
			const results = discovery._buildProtoChaincodeInterest(interest);
			should.exist(results.chaincodes);
		});
		it('should handle two chaincode four collection', () => {
			const interest = [
				{name: 'chaincode1', collection_names: ['collection1', 'collection3']},
				{name: 'chaincode2', collection_names: ['collection2', 'collection4']}
			];
			const results = discovery._buildProtoChaincodeInterest(interest);
			should.exist(results.chaincodes);
		});
		it('should handle two chaincode four collection in camel case', () => {
			const interest = [
				{name: 'chaincode1', collectionNames: ['collection1', 'collection3']},
				{name: 'chaincode2', collectionNames: ['collection2', 'collection4']}
			];
			const results = discovery._buildProtoChaincodeInterest(interest);
			should.exist(results.chaincodes);
		});
		it('should handle two chaincode four collection in camel case', () => {
			const interest = [
				{name: 'chaincode1', collectionNames: ['collection1', 'collection3'], noPrivateReads: true},
				{name: 'chaincode2', collectionNames: ['collection2', 'collection4']}
			];
			const results = discovery._buildProtoChaincodeInterest(interest);
			should.exist(results.chaincodes);
			results.chaincodes[0].no_private_reads.should.be.true;
		});
		it('should handle two chaincodes same name', () => {
			const interest = [{name: 'chaincode1'}, {name: 'chaincode1'}];
			const results = discovery._buildProtoChaincodeInterest(interest);
			should.exist(results.chaincodes);
		});
		it('should require a idContext', () => {
			(() => {
				const interest = [{name: {}}];
				discovery._buildProtoChaincodeInterest(interest);
			}).should.throw('Chaincode name must be a string');
		});
		it('should require a idContext', () => {
			(() => {
				const interest = [{name: 'chaincode1', collection_names: {}}];
				discovery._buildProtoChaincodeInterest(interest);
			}).should.throw('Collection names must be an array of strings');
		});
		it('should require a idContext', () => {
			(() => {
				const interest = [{name: 'chaincode1', collection_names: [{}]}];
				discovery._buildProtoChaincodeInterest(interest);
			}).should.throw('The collection name must be a string');
		});
	});

	describe('#_buildUrl', () => {
		it('should handle no parms', () => {
			(() => {
				discovery._buildUrl();
			}).should.throw('Missing hostname parameter');
		});
		it('should handle no parms', () => {
			(() => {
				discovery._buildUrl('hostname');
			}).should.throw('Missing port parameter');
		});
		it('should handle as localhost', () => {
			discovery.asLocalhost = true;
			const results = discovery._buildUrl('hostname', 1000);
			should.equal(results, 'grpcs://localhost:1000');
		});
		it('should handle not as localhost', () => {
			discovery.asLocalhost = false;
			const results = discovery._buildUrl('hostname', 1000);
			should.equal(results, 'grpcs://hostname:1000');
		});
		it('should handle current target as', () => {
			discovery._current_target = endorser;
			endorser.endpoint = endpoint;
			const results = discovery._buildUrl('hostname', 1000);
			should.equal(results, 'grpcs://hostname:1000');
		});
		it('should handle override setting', () => {
			Client.setConfigSetting('discovery-override-protocol', 'grpcs');
			discovery._current_target = endorser;
			endorser.endpoint = endpoint;
			const results = discovery._buildUrl('hostname', 1000);
			should.equal(results, 'grpcs://hostname:1000');
		});
	});

	describe('#_buildTlsRootCerts', () => {
		it('should handle no parms', () => {
			(() => {
				discovery._buildTlsRootCerts();
			}).should.throw('Missing msp_id parameter');
		});
		it('should handle missing mspid when no msps', () => {
			const results = discovery._buildTlsRootCerts('msp1');
			should.equal(results, '');
		});
		it('should handle missing mspid when not in msps', () => {
			discovery.discoveryResults = {};
			discovery.discoveryResults.msps = {msp1: {
				id: 'msp1',
				name: 'msp1',
				tlsRootCerts: 'root certs',
				tlsIntermediateCerts: 'intermediate certs'
			}};
			const results = discovery._buildTlsRootCerts('bad');
			should.equal(results, '');
		});
		it('should handle mspid when in msps', () => {
			discovery.discoveryResults = {};
			discovery.discoveryResults.msps = {msp1: {
				id: 'msp1',
				name: 'msp1',
				tlsRootCerts: 'rootcerts',
				tlsIntermediateCerts: 'intermediatecerts'
			}};
			const results = discovery._buildTlsRootCerts('msp1');
			should.equal(results, 'rootcertsintermediatecerts');
		});
		it('should handle mspid when in msps and no certs', () => {
			discovery.discoveryResults = {};
			discovery.discoveryResults.msps = {msp1: {
				id: 'msp1',
				name: 'msp1'
			}};
			const results = discovery._buildTlsRootCerts('msp1');
			should.equal(results, '');
		});
	});
	describe('#_buildOrderers', () => {
		it('should handle no parms', async () => {
			await discovery._buildOrderers();
			sinon.assert.calledWith(FakeLogger.debug, '%s - no orderers to build');
		});
		it('should run', async () => {
			await discovery._buildOrderers(orderers);
			sinon.assert.calledWith(FakeLogger.debug, '_buildOrderers[mydiscovery] - orderer msp:OrdererMSP');
		});
		it('should remove old orderers from channel', async () => {
			should.equal(channel.getCommitters().length, 0);
			await discovery._buildOrderers(orderers); // add one orderer
			sinon.assert.calledWith(FakeLogger.debug, '_buildOrderers[mydiscovery] - orderer msp:OrdererMSP');
			should.equal(channel.getCommitters().length, 1);
		});
	});

	describe('#_buildOrderer', () => {
		it('should run', async () => {
			committer.name = 'mycommitter:80';
			channel.getCommitter = sinon.stub().returns(committer);
			const results = await discovery._buildOrderer('mycommitter', '80', 'mspid');
			should.equal(results, 'mycommitter:80');
		});
		it('should throw connect error', async () => {
			channel.getCommitter = sinon.stub().returns();
			committer.connect.throws(new Error('failed to connect'));
			const results = await discovery._buildOrderer('mycommitter', '80', 'mspid');
			should.equal(results, 'mycommitter:80');
			sinon.assert.calledWith(FakeLogger.error, '_buildOrderer[mydiscovery] - Unable to connect to the discovered orderer mycommitter:80 due to Error: failed to connect');
		});
		it('should handle found same name committer on the channel', async () => {
			channel.addCommitter(committer);
			committer.endpoint = endpoint;
			discovery._buildUrl = sinon.stub().returns('grpc://somehost.com:7000');
			await discovery._buildOrderer('somehost.com', 7000, 'mspid');
			should.equal(channel.getCommitters().length, 1);
		});
	});

	describe('#_buildPeer', () => {
		it('should handle no parms', async () => {
			await discovery._buildPeer().should.be.rejectedWith('Missing discovery_peer parameter');
		});
		it('should handle found same name endorser on the channel', async () => {
			endorser.name = 'mypeer';
			channel.endorsers = new Map();
			channel.addEndorser(endorser);
			const results = await discovery._buildPeer({endpoint: 'mypeer:2000', mspid: 'msp1'});
			should.equal(results, endorser);
			should.equal(channel.getEndorsers().length, 1);
		});
		it('should run', async () => {
			discovery.discoveryResults = {};
			discovery.discoveryResults.msps = {msp1: {
				id: 'msp1',
				name: 'msp1',
				tlsRootCerts: 'rootcerts',
				tlsIntermediateCerts: 'intermediatecerts'
			}};
			endorser.name = 'host2.com:1000';
			const results = await discovery._buildPeer({endpoint: 'host2.com:1000', name: 'host2.com:1000', mspid: 'msp1'});
			should.equal(results.name, 'host2.com:1000');
		});
		it('should handle endorser not connect', async () => {
			discovery.discoveryResults = {};
			discovery.discoveryResults.msps = {msp1: {
				id: 'msp1',
				name: 'msp1',
				tlsRootCerts: 'rootcerts',
				tlsIntermediateCerts: 'intermediatecerts'
			}};
			endorser.name = 'host3.com:1000';
			endorser.connect.throws(new Error('failed to connect'));
			const results = await discovery._buildPeer({endpoint: 'host3.com:1000', name: 'host3.com:1000', mspid: 'msp1'});
			should.equal(results.name, 'host3.com:1000');
		});
		it('should handle found same name endorser on the channel', async () => {
			endorser.name = 'mypeer';
			channel.endorsers = new Map();
			channel.addEndorser(endorser);
			endorser.endpoint = endpoint;
			discovery._buildUrl = sinon.stub().returns('grpc://somehost.com');
			const results = await discovery._buildPeer({endpoint: 'somehost.com', mspid: 'mspid'});
			should.equal(results, endorser);
			should.equal(channel.getEndorsers().length, 1);
			sinon.assert.calledWith(FakeLogger.debug, '%s - url: %s - already added to this channel');
		});
		it('should handle found same name endorser on the channel and add chaincodes', async () => {
			endorser.name = 'mypeer';
			channel.endorsers = new Map();
			channel.addEndorser(endorser);
			endorser.endpoint = endpoint;
			discovery._buildUrl = sinon.stub().returns('grpc://somehost.com');
			const results = await discovery._buildPeer({endpoint: 'somehost.com', mspid: 'mspid', chaincodes: [{name: 'chaincode'}]});
			should.equal(results, endorser);
			should.equal(channel.getEndorsers().length, 1);
			sinon.assert.calledWith(endorser.addChaincode, 'chaincode');
			sinon.assert.calledWith(FakeLogger.debug, '%s - url: %s - already added to this channel');
		});
	});

	describe('#_processConfig', () => {
		it('should handle no parms', async () => {
			const results = await discovery._processConfig();
			should.exist(results);
		});
		it('should handle no msps', async () => {
			const config = {
				orderers: {
					msp1: TestUtils.createEndpoints('hosta', 2),
					msp2: TestUtils.createEndpoints('hostb', 2)
				}
			};
			const results = await discovery._processConfig(config);
			should.exist(results.orderers);
		});
		it('should handle no msps', async () => {
			const config = {
				msps: {
					msp1: TestUtils.createMsp('msp3'),
					msp2: TestUtils.createMsp('msp4')
				}
			};
			const results = await discovery._processConfig(config);
			should.exist(results.msps);
		});
	});

	describe('#_processChaincode', () => {
		it('should throw error if plans are bad', async () => {
			await discovery._processChaincode().should.be.rejectedWith('Plan layouts are invalid');
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
			await discovery._processPeers(q_peers);
		});
	});

	describe('#_processMembership', () => {
		it('should handle missing endorser by org', async () => {
			await discovery._processMembership({});
		});
	});
});
