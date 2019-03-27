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

const Network = require('../lib/network');
const Gateway = require('../lib/gateway');
const Wallet = require('../lib/api/wallet');
const QueryStrategies = require('../lib/impl/query/defaultqueryhandlerstrategies');

describe('Gateway', () => {
	let mockClient;

	beforeEach(() => {
		mockClient = sinon.createStubInstance(Client);
	});

	afterEach(() => {
		sinon.restore();
	});


	describe('#_mergeOptions', () => {
		let defaultOptions;

		beforeEach(() => {
			defaultOptions = {
				aTimeout: 300 * 1000,
			};
		});

		it('should return the default options when there are no overrides', () => {
			const overrideOptions = {};
			const expectedOptions = {
				aTimeout: 300 * 1000
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should change a default option', () => {
			const overrideOptions = {
				aTimeout: 1234
			};
			const expectedOptions = {
				aTimeout: 1234
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should add a new option', () => {
			const overrideOptions = {
				useDiscovery: true
			};
			const expectedOptions = {
				aTimeout: 300 * 1000,
				useDiscovery: true
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
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
				aTimeout: 300 * 1000,
				identity: 'admin',
				useDiscovery: true,
				discoveryOptions: {
					discoveryProtocol: 'grpc',
					asLocalhost: true
				}
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should merge option structures', () => {
			defaultOptions = {
				aTimeout: 300 * 1000,
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
				aTimeout: 300 * 1000,
				identity: 'admin',
				useDiscovery: true,
				discoveryOptions: {
					discoveryProtocol: 'grpc',
					asLocalhost: true
				}
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should merge option structures - even ones that don\t end in Option', () => {
			const strategy = () => {
				return null;
			};
			defaultOptions = {
				commitTimeout: 300 * 1000,
				identity: 'user',
				eventHandlerOptions: {
					commitTimeout: 300, // 5 minutes
					strategy: strategy
				},
				discovery: {
					enabled: true,
					asLocalhost: true
				}
			};
			const overrideOptions = {
				identity: 'admin',
				discovery: {
					asLocalhost: false
				}
			};
			const expectedOptions = {
				commitTimeout: 300 * 1000,
				identity: 'admin',
				eventHandlerOptions: {
					commitTimeout: 300, // 5 minutes
					strategy: strategy
				},
				discovery: {
					enabled: true,
					asLocalhost: false
				}
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should merge null option structures', () => {
			const strategy = () => {
				return null;
			};
			defaultOptions = {
				commitTimeout: 300 * 1000,
				identity: 'user',
				eventHandlerOptions: {
					commitTimeout: 300, // 5 minutes
					strategy: strategy
				},
				discovery: {
					enabled: true,
					asLocalhost: true
				}
			};
			const overrideOptions = {
				identity: 'admin',
				discovery: null
			};
			const expectedOptions = {
				commitTimeout: 300 * 1000,
				identity: 'admin',
				eventHandlerOptions: {
					commitTimeout: 300, // 5 minutes
					strategy: strategy
				},
				discovery: null
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

	});

	describe('#constructor', () => {
		it('should instantiate a Gateway object', () => {
			const gateway = new Gateway();
			gateway.networks.should.be.instanceof(Map);
		});
	});

	describe('#connect', () => {
		let gateway;
		let mockWallet;

		beforeEach(() => {
			gateway = new Gateway();
			mockWallet = sinon.createStubInstance(Wallet);
			sinon.stub(Client, 'loadFromConfig').withArgs('ccp').returns(mockClient);
			mockWallet.setUserContext.withArgs(mockClient, 'admin').returns('foo');
		});

		it('should fail without options supplied', () => {
			return gateway.connect()
				.should.be.rejectedWith(/A wallet must be assigned to a Gateway instance/);
		});

		it('should fail without wallet option supplied', () => {
			const options = {
				identity: 'admin'
			};
			return gateway.connect('ccp', options)
				.should.be.rejectedWith(/A wallet must be assigned to a Gateway instance/);
		});

		it('should connect to the gateway with default plugins', async () => {
			const options = {
				wallet: mockWallet,
			};
			await gateway.connect('ccp', options);
			gateway.client.should.equal(mockClient);
			should.not.exist(gateway.currentIdentity);
		});

		it('should connect to the gateway with identity', async () => {
			const options = {
				wallet: mockWallet,
				identity: 'admin'
			};
			await gateway.connect('ccp', options);
			gateway.client.should.equal(mockClient);
			gateway.currentIdentity.should.equal('foo');
		});

		it('should connect to the gateway with identity and set client tls crypto material', async () => {
			mockWallet.export.withArgs('tlsId').resolves({certificate: 'acert', privateKey: 'akey'});

			const options = {
				wallet: mockWallet,
				identity: 'admin',
				clientTlsIdentity: 'tlsId'
			};
			await gateway.connect('ccp', options);
			gateway.client.should.equal(mockClient);
			gateway.currentIdentity.should.equal('foo');
			sinon.assert.calledOnce(mockClient.setTlsClientCertAndKey);
			sinon.assert.calledWith(mockClient.setTlsClientCertAndKey, 'acert', 'akey');
		});

		it('should connect to the gateway with identity and set client tls crypto material using tlsInfo', async () => {
			const options = {
				wallet: mockWallet,
				identity: 'admin',
				tlsInfo: {certificate: 'acert', key: 'akey'}
			};
			await gateway.connect('ccp', options);
			gateway.client.should.equal(mockClient);
			gateway.currentIdentity.should.equal('foo');
			sinon.assert.calledOnce(mockClient.setTlsClientCertAndKey);
			sinon.assert.calledWith(mockClient.setTlsClientCertAndKey, 'acert', 'akey');
		});


		it('should connect from an existing client object', async () => {
			const options = {
				wallet: mockWallet,
				identity: 'admin'
			};
			await gateway.connect(mockClient, options);
			gateway.client.should.equal(mockClient);
			gateway.currentIdentity.should.equal('foo');
		});

		it('has default transaction event handling strategy if none specified', async () => {
			const options = {
				wallet: mockWallet
			};
			await gateway.connect('ccp', options);
			gateway.options.eventHandlerOptions.strategy.should.be.a('Function');
		});

		it('allows transaction event handling strategy to be specified', async () => {
			const stubStrategyFn = function stubStrategyFn() { };
			const options = {
				wallet: mockWallet,
				eventStrategy: stubStrategyFn
			};
			await gateway.connect('ccp', options);
			gateway.options.eventStrategy.should.equal(stubStrategyFn);
		});

		it('allows null transaction event handling strategy to be set', async () => {
			const options = {
				wallet: mockWallet,
				eventStrategy: null
			};
			await gateway.connect('ccp', options);
			should.equal(gateway.options.eventStrategy, null);
		});
	});

	describe('getters', () => {
		let gateway;
		let mockWallet;

		beforeEach(async () => {
			gateway = new Gateway();
			mockWallet = sinon.createStubInstance(Wallet);
			sinon.stub(Client, 'loadFromConfig').withArgs('ccp').returns(mockClient);
			mockWallet.setUserContext.withArgs(mockClient, 'admin').returns('foo');
			const options = {
				wallet: mockWallet,
				identity: 'admin'
			};
			await gateway.connect('ccp', options);

		});

		describe('#getCurrentIdentity', () => {
			it('should return the initialized identity', () => {
				gateway.getCurrentIdentity().should.equal('foo');
			});
		});

		describe('#getClient', () => {
			it('should return the underlying client object', () => {
				gateway.getClient().should.equal(mockClient);
			});
		});

		describe('#getOptions', () => {
			it('should return the initialized options', () => {
				const expectedOptions = {
					wallet: mockWallet,
					identity: 'admin',
					queryHandlerOptions: {
						strategy: QueryStrategies.MSPID_SCOPE_SINGLE
					}
				};
				gateway.getOptions().should.deep.include(expectedOptions);
				gateway.getOptions().eventHandlerOptions.should.include({
					commitTimeout: 300
				});

			});
		});
	});

	describe('network interactions', () => {
		let gateway;
		let mockNetwork;
		let mockInternalChannel;

		beforeEach(() => {
			gateway = new Gateway();
			mockNetwork = sinon.createStubInstance(Network);
			gateway.networks.set('foo', mockNetwork);
			gateway.client = mockClient;
			gateway.options.discovery.enabled = false;

			mockInternalChannel = sinon.createStubInstance(InternalChannel);
			const mockPeer1 = sinon.createStubInstance(Peer);
			mockPeer1.index = 1; // add these so that the mockPeers can be distiguished when used in WithArgs().
			mockPeer1.getName.returns('Peer1');
			mockPeer1.getMspid.returns('MSP01');
			mockPeer1.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(true);
			const peerArray = [mockPeer1];
			mockInternalChannel.getPeers.returns(peerArray);
			mockInternalChannel.getChannelEventHub.returns({isconnected: () => true, getName: () => 'myeventhub'});
		});

		describe('#getNetwork', () => {
			it('should return a cached network object', () => {
				gateway.getNetwork('foo').should.eventually.equal(mockNetwork);
			});

			it('should create a non-existent network object', async () => {
				mockClient.getChannel.withArgs('bar').returns(mockInternalChannel);
				gateway.getCurrentIdentity = sinon.stub().returns({_mspId: 'MSP01'});
				gateway.getOptions().queryHandlerOptions.strategy = () => {};
				gateway.getOptions().eventHubSelectionOptions.strategy = () => {};

				const network2 = await gateway.getNetwork('bar');
				network2.should.be.instanceof(Network);
				network2.gateway.should.equal(gateway);
				network2.channel.should.equal(mockInternalChannel);
				gateway.networks.size.should.equal(2);
			});

			it('should create a channel object if not defined in the ccp', async () => {
				mockClient.getChannel.withArgs('bar').returns(null);
				mockClient.newChannel.withArgs('bar').returns(mockInternalChannel);
				gateway.getCurrentIdentity = sinon.stub().returns({_mspId: 'MSP01'});
				gateway.getOptions().queryHandlerOptions.strategy = () => {};
				gateway.getOptions().eventHubSelectionOptions.strategy = () => {};

				const network2 = await gateway.getNetwork('bar');
				network2.should.be.instanceof(Network);
				network2.gateway.should.equal(gateway);
				network2.channel.should.equal(mockInternalChannel);
				gateway.networks.size.should.equal(2);
			});
		});

		describe('#disconnect', () => {
			it('should cleanup the gateway and its networks', () => {
				gateway.networks.size.should.equal(1);
				gateway.disconnect();
				gateway.networks.size.should.equal(0);
			});
		});
	});

});
