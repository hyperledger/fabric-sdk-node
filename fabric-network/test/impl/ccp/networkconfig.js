/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const chai = require('chai');
chai.should();
const expect = chai.expect;
const sinon = require('sinon');
const rewire = require('rewire');
const Client = require('fabric-common/lib/Client');
const Committer = require('fabric-common/lib/Committer');
const Endorser = require('fabric-common/lib/Endorser');
const Endpoint = require('fabric-common/lib/Endpoint');

const NetworkConfig = rewire('fabric-network/lib/impl/ccp/networkconfig.js');



describe('NetworkConfig', () => {
	let sandbox;
	let buildChannel;
	let buildPeer;
	let buildOrderer;
	let findPeerMspid;
	let buildOptions;
	let getPEMfromConfig;
	let client;
	let endorser;
	let committer;
	let endpoint;
	let FakeLogger;
	let FakeFS;
	let revert;

	const PEM = '-----BEGIN CERTIFICATE-----\n' +
	'HSiaITVCUB0ecS/2d4DyIBf/His2WR5+rEbctl8INrdFaM4=\n' +
	'-----END CERTIFICATE-----\n';

	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();
		endorser = sandbox.createStubInstance(Endorser);
		committer = sandbox.createStubInstance(Committer);
		endorser.connect = sandbox.stub().rejects(Error('BAD'));
		committer.connect = sandbox.stub().rejects(Error('BAD'));
		endpoint = sandbox.createStubInstance(Endpoint);
		client = new Client('myclient');
		client.getCommitter = sinon.stub().returns(committer);
		client.getEndorser = sinon.stub().returns(endorser);
		client.newEndpoint = sinon.stub().returns(endpoint);

		buildChannel = NetworkConfig.__get__('buildChannel');
		buildPeer = NetworkConfig.__get__('buildPeer');
		buildOrderer = NetworkConfig.__get__('buildOrderer');
		findPeerMspid = NetworkConfig.__get__('findPeerMspid');
		buildOptions = NetworkConfig.__get__('buildOptions');
		getPEMfromConfig = NetworkConfig.__get__('getPEMfromConfig');

		FakeLogger = {
			debug: () => {
			},
			error: () => {
			},
			warn: () => {
			}
		};
		sandbox.stub(FakeLogger);
		revert.push(NetworkConfig.__set__('logger', FakeLogger));

		FakeFS = {
			readFileSync: () => {}
		};
		sandbox.stub(FakeFS);
		FakeFS.readFileSync.returns(PEM);
		revert.push(NetworkConfig.__set__('fs', FakeFS));
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.reset();
	});

	const config = {
		channels: {
			mychannel: {
				orderers: [
					'orderer.example.com'
				],
				peers: {
					'peer0.org1.example.com': {},
					'peer0.org2.example.com': {}
				}
			}
		},
		organizations: {
			Org1: {
				mspid: 'Org1MSP',
				peers: ['peer0.org1.example.com']
			},
			Org2: {
				mspid: 'Org2MSP',
				peers: ['peer0.org2.example.com']
			}
		},
		orderers: {
			'orderer.example.com': {
				url: 'grpcs://localhost:7050',
				mspid: 'OrdererMSP',
				grpcOptions: {
					'ssl-target-name-override': 'orderer.example.com',
					requestTimeout: 2000
				},
				tlsCACerts: {
					pem: 'inlinecert'
				}
			}
		},
		peers: {
			'peer0.org1.example.com': {
				url: 'grpcs://localhost:7051',
				grpcOptions: {
					'ssl-target-name-override': 'peer0.org1.example.com',
					requestTimeout: 2000
				},
				tlsCACerts: {
					pem: 'inlinecert'
				}
			},
			'peer0.org2.example.com': {
				url: 'grpcs://localhost:8051',
				grpcOptions: {
					'ssl-target-name-override': 'peer0.org2.example.com',
					requestTimeout: 2000
				},
				tlsCACerts: {
					pem: 'inlinecert'
				}
			}
		}
	};

	describe('#loadFromConfig', () => {
		it('should run with no config', async () => {
			await NetworkConfig.loadFromConfig();
		});
		it('should run with a config', async () => {
			revert.push(NetworkConfig.__set__('buildPeer', sinon.stub()));
			revert.push(NetworkConfig.__set__('buildOrderer', sinon.stub()));
			revert.push(NetworkConfig.__set__('buildChannel', sinon.stub()));
			await NetworkConfig.loadFromConfig(client, config);
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
		});
	});

	describe('#buildChannel', () => {
		it('should run with params', async () => {
			const channel = sinon.stub();
			client.getChannel = sinon.stub().returns(channel);
			client.getEndorser = sinon.stub().returns('peer');
			client.getCommitter = sinon.stub().returns('orderer');
			channel.addEndorser = sinon.stub();
			channel.addCommitter = sinon.stub();
			buildChannel(client, 'name', config.channels.mychannel);
			sinon.assert.calledWith(client.getEndorser, 'peer0.org1.example.com');
			sinon.assert.calledWith(client.getEndorser, 'peer0.org2.example.com');
			sinon.assert.calledWith(client.getCommitter, 'orderer.example.com');
			sinon.assert.calledWith(client.getChannel, 'name');
			sinon.assert.calledWith(channel.addEndorser, 'peer');
			sinon.assert.calledWith(channel.addCommitter, 'orderer');
		});
	});

	describe('#buildOrderer', () => {
		it('should run buildOrderer with params and bad connect', async () => {
			revert.push(NetworkConfig.__set__('buildOptions', sinon.stub().returns({url: 'url'})));
			await buildOrderer(client, 'name', {url: 'url'});
			sinon.assert.calledWith(FakeLogger.error, '%s - Unable to connect to the committer %s due to %s');
		});
		it('should run buildOrderer with params and good connect', async () => {
			revert.push(NetworkConfig.__set__('buildOptions', sinon.stub().returns({url: 'url'})));
			committer.connect = sandbox.stub().resolves('GOOD');
			await buildOrderer(client, 'name', {url: 'url'}, {});
			sinon.assert.calledWith(FakeLogger.debug, '%s - connected to committer %s url:%s');
		});
	});

	describe('#buildPeer', () => {
		it('should run buildPeer with params and bad connect', async () => {
			revert.push(NetworkConfig.__set__('findPeerMspid', sinon.stub().returns('mspid')));
			revert.push(NetworkConfig.__set__('buildOptions', sinon.stub().returns({url: 'url'})));
			await buildPeer(client, 'name', {url: 'url'}, {});
			sinon.assert.calledWith(FakeLogger.error, '%s - Unable to connect to the endorser %s due to %s');
		});
		it('should run buildPeer with params and good connect', async () => {
			revert.push(NetworkConfig.__set__('findPeerMspid', sinon.stub().returns('mspid')));
			revert.push(NetworkConfig.__set__('buildOptions', sinon.stub().returns({url: 'url'})));
			endorser.connect = sandbox.stub().resolves('GOOD');
			await buildPeer(client, 'name', {url: 'url'}, {});
			sinon.assert.calledWith(FakeLogger.debug, '%s - connected to endorser %s url:%s');
		});
	});

	describe('#findPeerMspid', () => {
		it('should run findPeerMspid with params', async () => {
			const mspid = findPeerMspid('peer0.org2.example.com', config);
			mspid.should.equal('Org2MSP');
		});
	});

	describe('#buildOptions', () => {
		it('should run buildOptions with params', async () => {
			const test = {url: 'url', pem: 'pem', one: 'one', two: 'two'};
			const options = buildOptions({url: 'url', tlsCACerts: {pem: 'pem'}, grpcOptions: {one: 'one', two: 'two'}});
			options.should.deep.equal(test);
		});
		it('should run buildOptions with only request-timeout', async () => {
			const options = buildOptions({grpcOptions: {'request-timeout': 2000}});
			options.requestTimeout.should.be.equal(2000);
		});
		it('should run buildOptions with both request-timeout and requestTimeout', async () => {
			const options = buildOptions({grpcOptions: {'request-timeout': 2000, requestTimeout: 5000}});
			options.requestTimeout.should.be.equal(5000);
		});
	});

	describe('#getPEMfromConfig', () => {
		it('should run getPEMfromConfig with pem param', async () => {
			const result = getPEMfromConfig({pem: PEM});
			result.should.equal(PEM);
		});
		it('should run getPEMfromConfig with path param', async () => {
			const result = getPEMfromConfig({path: 'path'});
			result.should.equal(PEM);
		});
		it('should run getPEMfromConfig with no pem config', async () => {
			const result = getPEMfromConfig({});
			expect(result).to.be.equal(null);
		});
		it('should run getPEMfromConfig with no pem config', async () => {
			const result = getPEMfromConfig();
			expect(result).to.be.equal(null);
		});
	});
});
