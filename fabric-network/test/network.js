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
const FABRIC_CONSTANTS = require('fabric-client/lib/Constants');

const Client = require('fabric-client');

const chai = require('chai');
const should = chai.should();
chai.use(require('chai-as-promised'));

const Channel = require('../lib/channel');
const Network = require('../lib/network');
const Wallet = require('../lib/api/wallet');
const Mockery = require('mockery');


describe('Network', () => {
	const sandbox = sinon.createSandbox();

	let mockClient;
	let mockDefaultQueryHandler;

	before(() => {
		Mockery.enable();
		mockDefaultQueryHandler = {query: 'mock'};
		Mockery.registerMock('./impl/query/defaultqueryhandler', mockDefaultQueryHandler);
	});

	after(() => {
		Mockery.disable();
	});

	beforeEach(() => {
		mockClient = sinon.createStubInstance(Client);
	});

	afterEach(() => {
		sandbox.restore();
	});


	describe('#_mergeOptions', () => {
		let defaultOptions;

		beforeEach(() => {
			defaultOptions = {
				commitTimeout: 300 * 1000,
			};
		});

		it('should return the default options when there are no overrides', () => {
			const overrideOptions = {};
			const expectedOptions = {
				commitTimeout: 300 * 1000
			};
			Network._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should change a default option', () => {
			const overrideOptions = {
				commitTimeout: 1234
			};
			const expectedOptions = {
				commitTimeout: 1234
			};
			Network._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should add a new option', () => {
			const overrideOptions = {
				useDiscovery: true
			};
			const expectedOptions = {
				commitTimeout: 300 * 1000,
				useDiscovery: true
			};
			Network._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should add option structures', () => {
			const overrideOptions = {
				identity: 'admin',
				useDiscovery: true,
				discoveryOptions: {
					discoveryProtocol: 'grpc',
					asLocalhost: true
				}
			};
			const expectedOptions = {
				commitTimeout: 300 * 1000,
				identity: 'admin',
				useDiscovery: true,
				discoveryOptions: {
					discoveryProtocol: 'grpc',
					asLocalhost: true
				}
			};
			Network._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should merge option structures', () => {
			defaultOptions = {
				commitTimeout: 300 * 1000,
				identity: 'user',
				useDiscovery: true,
				discoveryOptions: {
					discoveryProtocol: 'grpc',
					asLocalhost: false
				}
			};
			const overrideOptions = {
				identity: 'admin',
				useDiscovery: true,
				discoveryOptions: {
					asLocalhost: true
				}
			};
			const expectedOptions = {
				commitTimeout: 300 * 1000,
				identity: 'admin',
				useDiscovery: true,
				discoveryOptions: {
					discoveryProtocol: 'grpc',
					asLocalhost: true
				}
			};
			Network._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

	});

	describe('#constructor', () => {
		it('should instantiate a Network object', () => {
			const network = new Network();
			network.channels.should.be.instanceof(Map);
			network.options.should.include({
				commitTimeout: 300,
				queryHandler: './impl/query/defaultqueryhandler'
			});
		});
	});

	describe('#initialize', () => {
		let network;
		let mockWallet;

		beforeEach(() => {
			network = new Network();
			mockWallet = sinon.createStubInstance(Wallet);
			sandbox.stub(Client, 'loadFromConfig').withArgs('ccp').returns(mockClient);
			mockWallet.setUserContext.withArgs(mockClient, 'admin').returns('foo');
		});

		it('should fail without options supplied', () => {
			return network.initialize()
				.should.be.rejectedWith(/A wallet must be assigned to a Network instance/);
		});

		it('should fail without wallet option supplied', () => {
			const options = {
				identity: 'admin'
			};
			return network.initialize('ccp', options)
				.should.be.rejectedWith(/A wallet must be assigned to a Network instance/);
		});

		it('should initialize the network with default plugins', async () => {
			const options = {
				wallet: mockWallet,
			};
			await network.initialize('ccp', options);
			network.client.should.equal(mockClient);
			should.not.exist(network.currentIdentity);
			network.queryHandlerClass.should.equal(mockDefaultQueryHandler);
		});

		it('should initialize the network with identity', async () => {
			const options = {
				wallet: mockWallet,
				identity: 'admin'
			};
			await network.initialize('ccp', options);
			network.client.should.equal(mockClient);
			network.currentIdentity.should.equal('foo');
		});

		it('should initialize the network with identity and set client tls crypto material', async () => {
			mockWallet.export.withArgs('tlsId').resolves({certificate: 'acert', privateKey: 'akey'});

			const options = {
				wallet: mockWallet,
				identity: 'admin',
				clientTlsIdentity: 'tlsId'
			};
			await network.initialize('ccp', options);
			network.client.should.equal(mockClient);
			network.currentIdentity.should.equal('foo');
			sinon.assert.calledOnce(mockClient.setTlsClientCertAndKey);
			sinon.assert.calledWith(mockClient.setTlsClientCertAndKey, 'acert', 'akey');
		});


		it('should initialize from an existing client object', async () => {
			const options = {
				wallet: mockWallet,
				identity: 'admin'
			};
			await network.initialize(mockClient, options);
			network.client.should.equal(mockClient);
			network.currentIdentity.should.equal('foo');
		});

		it ('should delete any default query handler options if the plugin doesn\'t match the default plugin', async () => {
			network.options = {
				commitTimeout: 300 * 1000,
				queryHandler: './impl/query/defaultqueryhandler',
				queryHandlerOptions: {
					'default1': 1,
					'default2': 2
				}
			};

			const otherQueryHandler = {query: 'other'};
			Mockery.registerMock('./impl/query/otherqueryhandler', otherQueryHandler);


			const options = {
				wallet: mockWallet,
				identity: 'admin',
				queryHandler: './impl/query/otherqueryhandler',
				queryHandlerOptions: {
					'other1': 99
				}
			};

			await network.initialize('ccp', options);
			network.options.should.deep.equal(
				{
					wallet: mockWallet,
					identity: 'admin',
					commitTimeout: 300 * 1000,
					queryHandler: './impl/query/otherqueryhandler',
					queryHandlerOptions: {
						'other1': 99
					}
				}
			);
			network.currentIdentity.should.equal('foo');
			network.queryHandlerClass.should.equal(otherQueryHandler);
		});

		it('should throw an error if it cannot load a query plugin', () => {
			const options = {
				wallet: mockWallet,
				identity: 'admin',
				queryHandler: './impl/query/noqueryhandler'
			};
			return network.initialize('ccp', options)
				.should.be.rejectedWith(/unable to load provided query handler: .\/impl\/query\/noqueryhandler/);
		});

		it('should not create a query handler if explicitly set to null', async () => {
			const options = {
				wallet: mockWallet,
				queryHandler: null
			};
			await network.initialize('ccp', options);
			network.client.should.equal(mockClient);
			should.equal(undefined, network.queryHandlerClass);
		});

		it('has default transaction event handling strategy if none specified', async () => {
			const options = {
				wallet: mockWallet
			};
			await network.initialize('ccp', options);
			network.options.eventStrategy.should.be.a('Function');
		});

		it('allows transaction event handling strategy to be specified', async () => {
			const stubStrategyFn = function stubStrategyFn() { };
			const options = {
				wallet: mockWallet,
				eventStrategy: stubStrategyFn
			};
			await network.initialize('ccp', options);
			network.options.eventStrategy.should.equal(stubStrategyFn);
		});

		it('allows null transaction event handling strategy to be set', async () => {
			const options = {
				wallet: mockWallet,
				eventStrategy: null
			};
			await network.initialize('ccp', options);
			should.equal(network.options.eventStrategy, null);
		});
	});

	describe('#_createQueryHandler', () => {
		let network;
		beforeEach(() => {
			network = new Network();
		});

		it('should create a query handler if class defined', async () => {
			const initStub = sinon.stub();
			const constructStub = sinon.stub();
			const mockClass = class MockClass {
				constructor(...args) {
					constructStub(...args);
					this.initialize = initStub;
				}
			};

			network.queryHandlerClass = mockClass;

			network.options.queryHandlerOptions = 'options';
			network.getCurrentIdentity = sinon.stub();
			network.getCurrentIdentity.returns({_mspId: 'anmsp'});
			const queryHandler = await network._createQueryHandler('channel', 'peerMap');
			queryHandler.should.be.instanceof(mockClass);
			sinon.assert.calledOnce(constructStub);
			sinon.assert.calledWith(constructStub, 'channel', 'anmsp', 'peerMap', 'options');
			sinon.assert.calledOnce(initStub);

		});

		it('should do nothing if no class defined', async () => {
			const queryHandler = await network._createQueryHandler('channel', 'peerMap');
			should.equal(null, queryHandler);
		});
	});

	describe('getters', () => {
		let network;
		let mockWallet;

		beforeEach(async () => {
			network = new Network();
			mockWallet = sinon.createStubInstance(Wallet);
			sandbox.stub(Client, 'loadFromConfig').withArgs('ccp').returns(mockClient);
			mockWallet.setUserContext.withArgs(mockClient, 'admin').returns('foo');
			const options = {
				wallet: mockWallet,
				identity: 'admin'
			};
			await network.initialize('ccp', options);

		});

		describe('#getCurrentIdentity', () => {
			it('should return the initialized identity', () => {
				network.getCurrentIdentity().should.equal('foo');
			});
		});

		describe('#getClient', () => {
			it('should return the underlying client object', () => {
				network.getClient().should.equal(mockClient);
			});
		});

		describe('#getOptions', () => {
			it('should return the initialized options', () => {
				const expectedOptions = {
					commitTimeout: 300,
					wallet: mockWallet,
					identity: 'admin',
					queryHandler: './impl/query/defaultqueryhandler'
				};
				network.getOptions().should.include(expectedOptions);
			});
		});
	});

	describe('channel interactions', () => {
		let network;
		let mockChannel;
		let mockInternalChannel;

		beforeEach(() => {
			network = new Network();
			mockChannel = sinon.createStubInstance(Channel);
			network.channels.set('foo', mockChannel);
			network.client = mockClient;

			mockInternalChannel = sinon.createStubInstance(InternalChannel);
			const mockPeer1 = sinon.createStubInstance(Peer);
			mockPeer1.index = 1; // add these so that the mockPeers can be distiguished when used in WithArgs().
			mockPeer1.getName.returns('Peer1');
			mockPeer1.getMspid.returns('MSP01');
			mockPeer1.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(true);
			const peerArray = [mockPeer1];
			mockInternalChannel.getPeers.returns(peerArray);
		});

		describe('#getChannel', () => {
			it('should return a cached channel object', () => {
				network.getChannel('foo').should.eventually.equal(mockChannel);
			});

			it('should create a non-existent channel object', async () => {
				mockClient.getChannel.withArgs('bar').returns(mockInternalChannel);
				network.getCurrentIdentity = sinon.stub().returns({ _mspId: 'MSP_ID' });

				const channel2 = await network.getChannel('bar');
				channel2.should.be.instanceof(Channel);
				channel2.network.should.equal(network);
				channel2.channel.should.equal(mockInternalChannel);
				network.channels.size.should.equal(2);
			});
		});

		describe('#dispose', () => {
			it('should cleanup the network and its channels', () => {
				network.channels.size.should.equal(1);
				network.dispose();
				network.channels.size.should.equal(0);
			});
		});
	});

});
