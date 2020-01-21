/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint require-atomic-updates: off */

'use strict';
const sinon = require('sinon');
const rewire = require('rewire');

const {IdentityContext} = require('fabric-common');

const chai = require('chai');
const should = chai.should();
chai.use(require('chai-as-promised'));

const Gateway = rewire('../lib/gateway');
const Client = rewire('fabric-common/lib/Client');
const QueryStrategies = require('../lib/impl/query/queryhandlerstrategies');

describe('Gateway', () => {
	let client;
	let identityContext;
	let sandbox;
	let revert;
	let FakeLogger;
	let clientHelper;

	let gateway;

	beforeEach(() => {
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
		revert.push(Gateway.__set__('logger', FakeLogger));
		clientHelper = sinon.stub();
		clientHelper.loadFromConfig = sinon.stub().resolves('ccp');
		Gateway.__set__('NetworkConfig', clientHelper);
		client = sinon.createStubInstance(Client);
		client.type = 'Client';
		identityContext = sinon.createStubInstance(IdentityContext);
		client.newIdentityContext.returns(identityContext);

		gateway = new Gateway();
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
	});

	describe('#_mergeOptions', () => {
		let defaultOptions;

		beforeEach(() => {
			defaultOptions = {
				top1: {
					inner11: 10,
					inner12: 'ten'
				},
				top2: {
					inner21: 20,
					inner22: 'twenty'
				}
			};
		});

		it('should return the default options when there are no overrides', () => {
			const overrideOptions = {};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(defaultOptions);
		});

		it('should change all top option', () => {
			const overrideOptions = {
				top1: {
					inner11: 20,
					inner12: 'twenty'
				},
			};
			const expectedOptions = {
				top1: {
					inner11: 20,
					inner12: 'twenty'
				},
				top2: {
					inner21: 20,
					inner22: 'twenty'
				}
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should change a one inner option', () => {
			const overrideOptions = {
				top1: {
					inner11: 20
				},
			};
			const expectedOptions = {
				top1: {
					inner11: 20,
					inner12: 'ten'
				},
				top2: {
					inner21: 20,
					inner22: 'twenty'
				}
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should null out one inner option', () => {
			const overrideOptions = {
				top1: {
					inner11: null
				},
			};
			const expectedOptions = {
				top1: {
					inner11: null,
					inner12: 'ten'
				},
				top2: {
					inner21: 20,
					inner22: 'twenty'
				}
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should null out one inner option using reference null', () => {
			const myNull = null;
			const overrideOptions = {
				top1: {
					inner11: myNull
				},
			};
			const expectedOptions = {
				top1: {
					inner11: null,
					inner12: 'ten'
				},
				top2: {
					inner21: 20,
					inner22: 'twenty'
				}
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should add a non structure top option', () => {
			const overrideOptions = {
				single: true
			};
			const expectedOptions = {
				top1: {
					inner11: 10,
					inner12: 'ten'
				},
				top2: {
					inner21: 20,
					inner22: 'twenty'
				},
				single: true
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should add a null non structure top option', () => {
			const overrideOptions = {
				single: null
			};
			const expectedOptions = {
				top1: {
					inner11: 10,
					inner12: 'ten'
				},
				top2: {
					inner21: 20,
					inner22: 'twenty'
				},
				single: null
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should null a structure top option', () => {
			const overrideOptions = {
				top1: null
			};
			const expectedOptions = {
				top1: null,
				top2: {
					inner21: 20,
					inner22: 'twenty'
				}
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should add an option structure', () => {
			const overrideOptions = {
				top3: {
					inner31: 30,
					inner32: 'thirty'
				}
			};
			const expectedOptions = {
				top1: {
					inner11: 10,
					inner12: 'ten'
				},
				top2: {
					inner21: 20,
					inner22: 'twenty'
				},
				top3: {
					inner31: 30,
					inner32: 'thirty'
				}
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});

		it('should add inner-inner structure to top option', () => {
			const overrideOptions = {
				top1: {
					top13: {
						inner131: 131
					}
				}
			};
			const expectedOptions = {
				top1: {
					inner11: 10,
					inner12: 'ten',
					top13: {
						inner131: 131
					}
				},
				top2: {
					inner21: 20,
					inner22: 'twenty'
				}
			};
			Gateway._mergeOptions(defaultOptions, overrideOptions);
			defaultOptions.should.deep.equal(expectedOptions);
		});
	});

	describe('#constructor', () => {
		it('should instantiate a Gateway object', () => {
			const gy = new Gateway();
			gy.networks.should.be.instanceof(Map);
		});
	});

	describe('#connect', () => {
		let wallet;
		let provider;
		const identity = {
			credentials: {
				certificate: 'certificate',
				privateKey: 'privateKey'
			}
		};
		let user;

		beforeEach(() => {
			user = sinon.stub();
			user.getName = sinon.stub().returns('user');
			user.getMspid = sinon.stub().returns('mspid');
			provider = sinon.stub();
			provider.getUserContext = sinon.stub().resolves(user);
			const providerRegistry = sinon.stub();
			providerRegistry.getProvider = sinon.stub().returns(provider);
			wallet = sinon.stub();
			wallet.getProviderRegistry = sinon.stub().returns(providerRegistry);
			wallet.get = sinon.stub().resolves(identity);
		});

		it('should fail without options supplied', () => {
			return gateway.connect()
				.should.be.rejectedWith(/A wallet must be assigned to a Gateway instance/);
		});

		it('should fail without wallet option supplied', () => {
			const options = {
				identity: 'identity'
			};
			return gateway.connect('ccp', options)
				.should.be.rejectedWith(/A wallet must be assigned to a Gateway instance/);
		});

		it('should connect to the gateway with default plugins', async () => {
			const options = {
				wallet,
			};
			await gateway.connect('ccp', options);
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
		});

		it('should connect to the gateway with identity', async () => {
			const options = {
				wallet,
				identity: 'identity'
			};
			await gateway.connect('ccp', options);
			gateway.client.name.should.equal('gateway client');
			gateway.identityContext.mspid.should.equal('mspid');
		});

		it('should connect to the gateway with identity and set client tls crypto material', async () => {
			const options = {
				wallet,
				identity: 'identity',
				clientTlsIdentity: 'tls'
			};
			await gateway.connect(client, options);
			sinon.assert.calledOnce(client.setTlsClientCertAndKey);
			sinon.assert.calledWith(client.setTlsClientCertAndKey,
				identity.credentials.certificate, identity.credentials.privateKey);
		});

		it('should connect to the gateway with identity and set client tls crypto material using tlsInfo', async () => {
			const options = {
				wallet,
				identity: 'identity',
				tlsInfo: {certificate: 'acert', key: 'akey'}
			};
			await gateway.connect(client, options);
			sinon.assert.calledOnce(client.setTlsClientCertAndKey);
			sinon.assert.calledWith(client.setTlsClientCertAndKey, 'acert', 'akey');
		});

		it('should connect from an existing client object', async () => {
			const options = {
				wallet
			};
			await gateway.connect(client, options);
			gateway.client.should.equal(client);
		});

		it('has default transaction event handling strategy if none specified', async () => {
			const options = {
				wallet
			};
			await gateway.connect('ccp', options);
			gateway.options.transaction.strategy.should.be.a('Function');
		});

		it('allows transaction event handling strategy to be specified', async () => {
			const stubStrategyFn = function stubStrategyFn() { };
			const options = {
				wallet,
				eventStrategy: stubStrategyFn
			};
			await gateway.connect('ccp', options);
			gateway.options.eventStrategy.should.equal(stubStrategyFn);
		});

		it('allows null transaction event handling strategy to be set', async () => {
			const options = {
				wallet,
				transaction: {
					strategy: null
				}
			};
			await gateway.connect('ccp', options);
			should.equal(gateway.options.transaction.strategy, null);
		});

		it('should assign connection options to the client', async () => {
			const options = {
				wallet,
				'connection-options': {
					option1: 'option1',
					option2: 'option2'
				}
			};
			await gateway.connect(client, options);
			client.centralized_options.option1.should.equal('option1');
		});
		it('throws if the identity does not exist', () => {
			const options = {
				wallet,
				identity: 'INVALID_IDENTITY_LABEL'
			};
			wallet.get = sinon.stub().resolves(null);
			return gateway.connect('ccp', options)
				.should.be.rejectedWith('Identity not found in wallet: INVALID_IDENTITY_LABEL');
		});

		it('throws if the TLS identity does not exist', () => {
			const options = {
				wallet,
				clientTlsIdentity: 'INVALID_IDENTITY_LABEL'
			};
			wallet.get = sinon.stub().resolves(null);
			return gateway.connect('ccp', options)
				.should.be.rejectedWith('Identity not found in wallet: INVALID_IDENTITY_LABEL');
		});
	});

	describe('getters', () => {
		beforeEach(async () => {
			gateway.identityContext = identityContext;
			const options = {
				wallet: 'something'
			};
			await gateway.connect(client, options);
		});

		describe('#getOptions', () => {
			it('should return the options', () => {
				const expectedOptions = {
					wallet: 'something',
					query: {
						timeout: 30,
						strategy: QueryStrategies.MSPID_SCOPE_SINGLE
					}
				};
				gateway.getOptions().should.deep.include(expectedOptions);
				gateway.getOptions().transaction.should.include({
					commitTimeout: 300
				});
			});
		});
	});


	describe('#getNetwork/#disconnect', () => {
		beforeEach(async () => {
			gateway = new Gateway();
			const options = {
				wallet: 'something',
				discovery: {
					enabled: false
				},
				query: {
					strategy: () => {}
				}
			};
			await gateway.connect('ccp', options);
			gateway.identityContext = identityContext;
		});

		it('should get a new network with new name', async () => {
			const network1 = await gateway.getNetwork('network1');
			const network2 = await gateway.getNetwork('network2');
			gateway.networks.size.should.equal(2);
			network1.should.not.equal(network2);
		});

		it('should return a cached network object', async () => {
			const network1 = await gateway.getNetwork('network1');
			const network2 = await gateway.getNetwork('network1');
			network1.should.equal(network2);
		});

		it('should cleanup the gateway and its networks', async () => {
			await gateway.getNetwork('network1');
			gateway.networks.size.should.equal(1);
			gateway.disconnect();
			gateway.networks.size.should.equal(0);
		});
	});
});
