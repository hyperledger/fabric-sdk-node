/*
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

const NetworkConfig = rewire('fabric-network/lib/impl/ccp/networkconfig');

describe('NetworkConfig', () => {
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
	let revert;

	const PEM = '-----BEGIN CERTIFICATE-----\n' +
	'HSiaITVCUB0ecS/2d4DyIBf/His2WR5+rEbctl8INrdFaM4=\n' +
	'-----END CERTIFICATE-----\n';

	beforeEach(() => {
		revert = [];
		endorser = sinon.createStubInstance(Endorser);
		committer = sinon.createStubInstance(Committer);
		endorser.connect = sinon.stub().rejects(Error('BAD'));
		committer.connect = sinon.stub().rejects(Error('BAD'));
		endpoint = sinon.createStubInstance(Endpoint);
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
			debug: sinon.fake(),
			error: sinon.fake(),
			warn: sinon.fake(),
			info: sinon.fake()
		};
		revert.push(NetworkConfig.__set__('logger', FakeLogger));

		const fakeFS = {
			promises: {
				readFile: async () => PEM
			}
		};
		revert.push(NetworkConfig.__set__('fs', fakeFS));
	});

	afterEach(() => {
		revert.forEach((f) => f());
		sinon.restore();
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
			},
			mychannel2: {
				orderers: [
					'orderer.example.com'
				],
				peers: [
					'peer0.org1.example.com',
					'peer0.org2.example.com'
				]
			},
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

	describe('#buildChannel - peer as object', () => {
		it('should run with params', async () => {
			const channel = sinon.stub();
			client.getChannel = sinon.stub().returns(channel);
			client.getEndorser = sinon.stub().returns('peer');
			client.getCommitter = sinon.stub().returns('orderer');
			channel.addEndorser = sinon.stub();
			channel.addCommitter = sinon.stub();
			await buildChannel(client, 'name', config.channels.mychannel);
			sinon.assert.calledWith(client.getEndorser, 'peer0.org1.example.com');
			sinon.assert.calledWith(client.getEndorser, 'peer0.org2.example.com');
			sinon.assert.calledWith(client.getCommitter, 'orderer.example.com');
			sinon.assert.calledWith(client.getChannel, 'name');
			sinon.assert.calledWith(channel.addEndorser, 'peer');
			sinon.assert.calledWith(channel.addCommitter, 'orderer');
		});
		it('should run with only channel defined', async () => {
			const channel = sinon.stub();
			client.getChannel = sinon.stub().returns(channel);
			await buildChannel(client, 'name', {mychannel: {}});
		});
		it('should run with only chaincodes defined', async () => {
			const channel = sinon.stub();
			client.getChannel = sinon.stub().returns(channel);
			await buildChannel(client, 'name', {mychannel: {chaincodes: []}});
		});
	});

	describe('#buildChannel - peer as array', () => {
		it('should run with params', async () => {
			const channel = sinon.stub();
			client.getChannel = sinon.stub().returns(channel);
			client.getEndorser = sinon.stub().returns('peer');
			client.getCommitter = sinon.stub().returns('orderer');
			channel.addEndorser = sinon.stub();
			channel.addCommitter = sinon.stub();
			await buildChannel(client, 'name', config.channels.mychannel2);
			sinon.assert.calledWith(client.getEndorser, 'peer0.org1.example.com');
			sinon.assert.calledWith(client.getEndorser, 'peer0.org2.example.com');
			sinon.assert.calledWith(client.getCommitter, 'orderer.example.com');
			sinon.assert.calledWith(client.getChannel, 'name');
			sinon.assert.calledWith(channel.addEndorser, 'peer');
			sinon.assert.calledWith(channel.addCommitter, 'orderer');
		});
		it('should run with only channel defined', async () => {
			const channel = sinon.stub();
			client.getChannel = sinon.stub().returns(channel);
			await buildChannel(client, 'name', {mychannel2: {}});
		});
		it('should run with only chaincodes defined', async () => {
			const channel = sinon.stub();
			client.getChannel = sinon.stub().returns(channel);
			await buildChannel(client, 'name', {mychannel2: {chaincodes: []}});
		});
	});

	describe('#buildOrderer', () => {
		it('should run buildOrderer with params and bad connect', async () => {
			revert.push(NetworkConfig.__set__('buildOptions', sinon.stub().returns({url: 'url'})));
			await buildOrderer(client, 'name', {url: 'url'});
			sinon.assert.calledWith(FakeLogger.info, '%s - Unable to connect to the committer %s due to %s');
		});
		it('should run buildOrderer with params and good connect', async () => {
			revert.push(NetworkConfig.__set__('buildOptions', sinon.stub().returns({url: 'url'})));
			committer.connect = sinon.stub().resolves('GOOD');
			await buildOrderer(client, 'name', {url: 'url'}, {});
			sinon.assert.calledWith(FakeLogger.debug, '%s - connected to committer %s url:%s');
		});
	});

	describe('#buildPeer', () => {
		it('should run buildPeer with params and bad connect', async () => {
			revert.push(NetworkConfig.__set__('findPeerMspid', sinon.stub().returns('mspid')));
			revert.push(NetworkConfig.__set__('buildOptions', sinon.stub().returns({url: 'url'})));
			await buildPeer(client, 'name', {url: 'url'}, {});
			sinon.assert.calledWith(FakeLogger.info, '%s - Unable to connect to the endorser %s due to %s');
		});
		it('should run buildPeer with params and good connect', async () => {
			revert.push(NetworkConfig.__set__('findPeerMspid', sinon.stub().returns('mspid')));
			revert.push(NetworkConfig.__set__('buildOptions', sinon.stub().returns({url: 'url'})));
			endorser.connect = sinon.stub().resolves('GOOD');
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
			const options = await buildOptions({url: 'url', tlsCACerts: {pem: 'pem'}, grpcOptions: {one: 'one', two: 'two'}});
			options.should.deep.equal(test);
		});
		it('should run buildOptions with only request-timeout', async () => {
			const options = await buildOptions({grpcOptions: {'request-timeout': 2000}});
			options.requestTimeout.should.be.equal(2000);
		});
		it('should run buildOptions with both request-timeout and requestTimeout', async () => {
			const options = await buildOptions({grpcOptions: {'request-timeout': 2000, requestTimeout: 5000}});
			options.requestTimeout.should.be.equal(5000);
		});
	});

	describe('#getPEMfromConfig', () => {
		it('should run getPEMfromConfig with pem param', async () => {
			const result = await getPEMfromConfig({pem: PEM});
			result.should.equal(PEM);
		});
		it('should run getPEMfromConfig with path param', async () => {
			const result = await getPEMfromConfig({path: 'path'});
			result.should.equal(PEM);
		});
		it('should run getPEMfromConfig with no pem config', async () => {
			const result = await getPEMfromConfig({});
			expect(result).to.be.undefined;
		});
		it('should run getPEMfromConfig with no pem config', async () => {
			const result = await getPEMfromConfig();
			expect(result).to.be.undefined;
		});
	});
});
