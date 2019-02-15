/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const rewire = require('rewire');

const Client = rewire('../lib/Client');
const NetworkConfig = require('../lib/impl/NetworkConfig_1_0');
const fs = require('fs');
const {Identity} = require('../lib/msp/identity');
const Package = require('../lib/Package');
const path = require('path');
const User = require('../lib/User');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const should = chai.should();
chai.use(chaiAsPromised);

describe('Client', () => {
	let revert;
	let FakeLogger;
	let connectionProfile;
	const userMspId = 'UserMspId';
	let fakeUser;

	beforeEach(() => {
	});


	beforeEach(() => {
		revert = [];

		FakeLogger = {
			debug: () => { },
			error: () => { }
		};
		sinon.stub(FakeLogger);
		revert.push(Client.__set__('logger', FakeLogger));

		const certificate = 'FAKE_CERTIFICATE';
		const publicKey = 'FAKE_PUBLIC_KEY';
		const cryptoSuite = {_name: 'FAKE_CRYPTO_SUITE'};
		const identity = new Identity(certificate, publicKey, userMspId, cryptoSuite);
		fakeUser = new User({name:'user'});

		const fakeGetIdentity = sinon.fake(() => identity);
		sinon.replace(fakeUser, 'getIdentity', fakeGetIdentity);

		connectionProfile = {
			name: 'global-trade-network',
			description: 'The network to be in if you want to stay in the global trade business',
			version: '1.0',
			client: {
				organization: 'ClientOrg'
			},
			organizations: {
				ClientOrg: {
					mspid: 'ClientMspId',
					peers: [
						'peer0.clientorg.example.com'
					]
				},
				UserOrg: {
					mspid: userMspId,
					peers: [
						'peer0.userorg.example.com'
					]
				}
			},
			peers: {
				'peer0.clientorg.example.com': {
					url: 'grpcs://localhost:7051',
					tlsCACerts: {
						pem: 'FAKE_CLIENT_ORG_CERTIFICATE'
					}
				},
				'peer0.userorg.example.com': {
					url: 'grpcs://localhost:7052',
					tlsCACerts: {
						pem: 'FAKE_USER_ORG_CERTIFICATE'
					}
				}
			}
		};
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sinon.restore();
	});

	describe('loadFromConfig', () => {
		it('should create a Client instance and call loadFromConfig', () => {
			const loadConfigStub = sinon.stub();
			revert.push(Client.__set__('Client.prototype.loadFromConfig', loadConfigStub));
			const client = Client.loadFromConfig('config');
			sinon.assert.calledWith(loadConfigStub, 'config');
			client.should.be.an.instanceof(Client);
		});
	});

	describe('#loadFromConfig', () => {
		let _getNetworkConfigStub;
		let mock_network_config;
		let _setAdminFromConfigStub;
		let _setMspidFromConfigStub;
		let _addConnectionOptionsFromConfig;
		let client;

		beforeEach(() => {
			mock_network_config = sinon.createStubInstance(NetworkConfig);

			_getNetworkConfigStub = sinon.stub().returns(mock_network_config);
			revert.push(Client.__set__('_getNetworkConfig', _getNetworkConfigStub));

			client = new Client();

			_setAdminFromConfigStub = sinon.stub(client, '_setAdminFromConfig');
			_setMspidFromConfigStub = sinon.stub(client, '_setMspidFromConfig');
			_addConnectionOptionsFromConfig = sinon.stub(client, '_addConnectionOptionsFromConfig');
		});

		it('should get additional network config and set _network_config to it', () => {
			mock_network_config.hasClient.returns(false);
			client._network_config = null;
			client.loadFromConfig('config');
			sinon.assert.calledWith(_getNetworkConfigStub, 'config', client);
			sinon.assert.called(mock_network_config.hasClient);
		});

		it('should get additional network config and merge it with the existing config', () => {
			mock_network_config.hasClient.returns(false);
			client._network_config = mock_network_config;
			client.loadFromConfig('config');
			sinon.assert.calledWith(_getNetworkConfigStub, 'config', client);
			sinon.assert.calledWith(mock_network_config.mergeSettings, mock_network_config);
			sinon.assert.called(mock_network_config.hasClient);
		});

		it('should get additional network config and set adming and set mspid', () => {
			mock_network_config.hasClient.returns(true);
			client._network_config = null;
			client.loadFromConfig('config');
			sinon.assert.calledWith(_getNetworkConfigStub, 'config', client);
			sinon.assert.called(mock_network_config.hasClient);
			sinon.assert.called(_setAdminFromConfigStub);
			sinon.assert.called(_setMspidFromConfigStub);
			sinon.assert.called(_addConnectionOptionsFromConfig);
		});
	});

	describe('#setTlsClientCertAndKey', () => {
		let newCryptoSuiteStub;
		let generateEphemeralKeyStub;
		let toBytesStub;
		let generateX509CertificateStub;
		let getNameStub;
		let client;

		beforeEach(() => {
			toBytesStub = sinon.stub();
			generateX509CertificateStub = sinon.stub();
			generateEphemeralKeyStub = sinon.stub().returns({toBytes: toBytesStub, generateX509Certificate: generateX509CertificateStub});
			newCryptoSuiteStub = sinon.stub().returns({generateEphemeralKey: generateEphemeralKeyStub});
			revert.push(Client.__set__('Client.newCryptoSuite', newCryptoSuiteStub));
			getNameStub = sinon.stub();

			client = new Client();
		});

		it('should set clientCert, cleintKey, clientCerthash and call logger.debug', () => {
			client.setTlsClientCertAndKey('client-cert', 'client-key');
			client._tls_mutual.clientCert.should.equal('client-cert');
			client._tls_mutual.clientKey.should.equal('client-key');
			client._tls_mutual.selfGenerated.should.equal(false);
			should.equal(client._tls_mutual.clientCertHash, null);
		});

		it('should generate a new ephemeral key and set _tls_mutual', () => {
			client._userContext = {getName: getNameStub.returns('name')};
			toBytesStub.returns('client-key');
			generateX509CertificateStub.returns('client-cert');
			client.setTlsClientCertAndKey();
			sinon.assert.calledWith(FakeLogger.debug, 'setTlsClientCertAndKey - generating self-signed TLS client certificate');
			sinon.assert.calledWith(newCryptoSuiteStub, {software: true});
			sinon.assert.called(generateEphemeralKeyStub);
			sinon.assert.called(toBytesStub);
			sinon.assert.calledWith(generateX509CertificateStub, 'name');
			client._tls_mutual.clientCert.should.equal('client-cert');
			client._tls_mutual.clientKey.should.equal('client-key');
			client._tls_mutual.selfGenerated.should.equal(true);
		});

		it('should generate a new ephemeral key and set _tls_mutual when only clientKey is missing', () => {
			client._userContext = {getName: getNameStub.returns('name')};
			toBytesStub.returns('client-key');
			generateX509CertificateStub.returns('client-cert');
			client.setTlsClientCertAndKey('client-cert');
			sinon.assert.calledWith(FakeLogger.debug, 'setTlsClientCertAndKey - generating self-signed TLS client certificate');
			sinon.assert.calledWith(newCryptoSuiteStub, {software: true});
			sinon.assert.called(generateEphemeralKeyStub);
			sinon.assert.called(toBytesStub);
			sinon.assert.calledWith(generateX509CertificateStub, 'name');
			client._tls_mutual.clientCert.should.equal('client-cert');
			client._tls_mutual.clientKey.should.equal('client-key');
		});
	});

	describe('#addTlsClientCertAndKey', () => {
		let newCryptoSuiteStub;
		let generateEphemeralKeyStub;
		let toBytesStub;
		let generateX509CertificateStub;
		let getNameStub;

		let client;
		beforeEach(() => {
			toBytesStub = sinon.stub();
			generateX509CertificateStub = sinon.stub();
			generateEphemeralKeyStub = sinon.stub().returns({toBytes: toBytesStub, generateX509Certificate: generateX509CertificateStub});
			newCryptoSuiteStub = sinon.stub().returns({generateEphemeralKey: generateEphemeralKeyStub});
			revert.push(Client.__set__('Client.newCryptoSuite', newCryptoSuiteStub));
			getNameStub = sinon.stub();

			client = new Client();
		});

		it('should add the current _tls_mutual values to the options object', () => {
			client._userContext = {getName: getNameStub.returns('name')};
			client._tls_mutual = {clientCert: 'client-cert', clientKey: 'client-key'};
			const opts = {};
			client.addTlsClientCertAndKey(opts);
			client._tls_mutual.clientCert.should.equal('client-cert');
			client._tls_mutual.clientKey.should.equal('client-key');
			opts.clientCert.should.equal('client-cert');
			opts.clientKey.should.equal('client-key');
		});

		it('should add the current _tls_mutual values to the options object', () => {
			client._tls_mutual = {};
			const opts = {};
			client.addTlsClientCertAndKey(opts);
			should.equal(client._tls_mutual.clientCert, undefined);
			should.equal(client._tls_mutual.clientKey, undefined);
			should.equal(opts.clientCert, undefined);
			should.equal(opts.clientKey, undefined);
		});

		it('should not add the current _tls_mutual values to the options object when auto generated', () => {
			client._userContext = {getName: getNameStub.returns('name')};
			// first set in the auto generated client cert and key
			toBytesStub.returns('client-key');
			generateX509CertificateStub.returns('client-cert');
			client.setTlsClientCertAndKey('client-cert');
			sinon.assert.calledWith(FakeLogger.debug, 'setTlsClientCertAndKey - generating self-signed TLS client certificate');
			sinon.assert.calledWith(newCryptoSuiteStub, {software: true});
			sinon.assert.called(generateEphemeralKeyStub);
			sinon.assert.called(toBytesStub);
			sinon.assert.calledWith(generateX509CertificateStub, 'name');
			client._tls_mutual.clientCert.should.equal('client-cert');
			client._tls_mutual.clientKey.should.equal('client-key');
			// now the actual add
			const opts = {};
			client.addTlsClientCertAndKey(opts);
			should.equal(opts.clientCert, undefined);
			should.equal(opts.clientKey, undefined);
		});
	});

	describe('#addConnectionOptions', () => {
		const client = new Client();

		it('should add in an options and keep what is there', () => {
			client._connection_options = {'other': 'B'};
			client.addConnectionOptions({'some': 'C'});
			client._connection_options.some.should.equal('C');
			client._connection_options.other.should.equal('B');
		});

		it('should add in no options', () => {
			client._connection_options = 'A';
			client.addConnectionOptions();
			client._connection_options.should.equal('A');
		});
	});

	describe('#isDevMode', () => {
		it('should return _devMode', () => {
			const client = new Client();
			client._devMode = 'test-mode';
			client.isDevMode().should.equal('test-mode');
		});
	});

	describe('#setDevMove', () => {
		it('should set the value of _devMode', () => {
			const client = new Client();
			client.setDevMode('test-mode');
			client._devMode.should.equal('test-mode');
		});
	});

	describe('#newChannel', () => {
		let getStub;
		let setStub;
		let channelStub;

		let client;
		beforeEach(() => {
			getStub = sinon.stub();
			setStub = sinon.stub();
			channelStub = sinon.stub();
			client = new Client();
			client._channels = {get: getStub, set: setStub};

			revert.push(Client.__set__('Channel', channelStub));
		});

		it('should throw if _channels.get returns true', () => {
			getStub.returns(true);
			(() => {
				client.newChannel('test-channel');
			}).should.throw('Channel test-channel already exists');
		});

		it('should create, add and return a new channel', () => {
			getStub.returns(false);
			const channel = client.newChannel('test-channel');
			sinon.assert.calledWith(channelStub, 'test-channel', client);
			sinon.assert.calledWith(setStub, 'test-channel', new channelStub());
			channel.should.deep.equal(new channelStub());
		});
	});

	describe('#getChannel', () => {
		let getStub;
		let setStub;
		let valuesStub;
		let nextStub;

		let client;
		beforeEach(() => {
			getStub = sinon.stub();
			setStub = sinon.stub();
			valuesStub = sinon.stub();
			nextStub = sinon.stub();
			client = new Client();
			client._channels = {get: getStub, set: setStub, values: valuesStub.returns({next: nextStub}), size: 1};
		});

		it('should get the channel with its name and return it', () => {
			getStub.returns('channel');
			const channel = client.getChannel('test-channel', false);
			sinon.assert.calledWith(getStub, 'test-channel');
			channel.should.equal('channel');
		});

		it('should get a channel without its name and return it', () => {
			nextStub.returns({value: 'channel'});
			const channel = client.getChannel(null, false);
			sinon.assert.called(valuesStub);
			sinon.assert.called(nextStub);
			channel.should.equal('channel');
		});

		it('should check the _network_config if no channel is returned and return the discovered channel', () => {
			client._channels.size = 0;
			const getChannelStub = sinon.stub().returns('channel');
			client._network_config = {_network_config: {channels: {'channel1': {}}}, getChannel: getChannelStub};
			const channel = client.getChannel(null, false);
			sinon.assert.calledWith(getChannelStub, 'channel1');
			channel.should.equal('channel');
		});

		it('should return null as channel does not exist', () => {
			client._channels.size = 0;
			const getChannelStub = sinon.stub();
			client._network_config = {_network_config: {channels: {}}, getChannel: getChannelStub};
			const channel = client.getChannel('channel1', false);
			sinon.assert.calledWith(getChannelStub, 'channel1');
			should.equal(channel, null);
		});

		it('should return null since no channels are defined in _network_config', () => {
			client._channels.size = 0;
			client._network_config = {_network_config: {channels: {}}};
			const channel = client.getChannel(null, false);
			should.equal(channel, null);
		});

		it('should return null since _network_config does not exist', () => {
			client._channels.size = 0;
			const channel = client.getChannel(null, false);
			should.equal(channel, null);
		});

		it('should call logger.debug and return null if errors are turned off', () => {
			client._channels.size = 0;
			const channel = client.getChannel('channel1', false);
			sinon.assert.calledWith(FakeLogger.debug, 'Channel not found for name channel1');
			should.equal(channel, null);
		});

		it('should call logger.error and throw an error if errors are turned on', () => {
			client._channels.size = 0;
			(() => {
				client.getChannel('channel1');
			}).should.throw('Channel not found for name channel1');
			sinon.assert.calledWith(FakeLogger.error, 'Channel not found for name channel1');
		});
	});

	describe('#newPeer', () => {
		it('should create and return a new peer instance', () => {
			const peerStub = sinon.stub();
			revert.push(Client.__set__('Peer', peerStub));
			const client = new Client();
			client._buildConnectionOptions = (value) => value;
			const peer = client.newPeer('url', 'opts');
			sinon.assert.calledWith(peerStub, 'url', 'opts');
			peer.should.deep.equal(new peerStub());
		});
	});

	describe('#getPeer', () => {
		let getPeerStub;

		let client;
		beforeEach(() => {
			getPeerStub = sinon.stub();
			client = new Client();
		});

		it('should return a peer', () => {
			getPeerStub.returns('peer');
			client._network_config = {getPeer: getPeerStub};
			const peer = client.getPeer('peer-name');
			peer.should.equal('peer');
		});

		it('should throw an error if _network_config not defined', () => {
			(() => {
				client.getPeer('peer-name');
			}).should.throw('Peer with name:peer-name not found');
		});
	});

	describe('#getPeersForOrg', () => {
		it('returns peers for specified org', () => {
			const clientOrg = connectionProfile.client.organization;
			const mspId = connectionProfile.organizations[clientOrg].mspid;
			const orgPeerNames = connectionProfile.organizations[clientOrg].peers;
			const client = Client.loadFromConfig(connectionProfile);

			const peers = client.getPeersForOrg(mspId);

			const peerNames = peers.map((peer) => peer.getName());
			peerNames.should.deep.equal(orgPeerNames);
		});

		it('returns peers for client org in connection profile if no org specified', () => {
			const clientOrg = connectionProfile.client.organization;
			const orgPeerNames = connectionProfile.organizations[clientOrg].peers;
			const client = Client.loadFromConfig(connectionProfile);

			const peers = client.getPeersForOrg();

			const peerNames = peers.map((peer) => peer.getName());
			peerNames.should.deep.equal(orgPeerNames);
		});

		it('returns empty list if no org specified and no mspid present', () => {
			const client = new Client();
			const peers = client.getPeersForOrg();
			peers.should.be.empty;
		});

		it('returns empty list if organisation not in config', () => {
			const client = Client.loadFromConfig(connectionProfile);
			const peers = client.getPeersForOrg('NON_EXISTENT_MSP_ID');
			peers.should.be.empty;
		});

		it('returns peers for user context MSP ID if no org specified and no client org in connection profile', () => {
			delete connectionProfile.client;
			const userOrg = Object.values(connectionProfile.organizations).find((org) => org.mspid === userMspId);
			const userPeerNames = userOrg.peers;
			const client = Client.loadFromConfig(connectionProfile);
			client.setUserContext(fakeUser, true);

			const peers = client.getPeersForOrg();

			const peerNames = peers.map((peer) => peer.getName());
			peerNames.should.deep.equal(userPeerNames);
		});
	});

	describe('#newOrderer', () => {
		it('should create and return a new peer instance', () => {
			const ordererStub = sinon.stub();
			revert.push(Client.__set__('Orderer', ordererStub));
			const client = new Client();
			client._buildConnectionOptions = (value) => value;
			const peer = client.newOrderer('url', 'opts');
			sinon.assert.calledWith(ordererStub, 'url', 'opts');
			peer.should.deep.equal(new ordererStub());
		});
	});

	describe('#getOrderer', () => {
		let getOrdererStub;

		let client;
		beforeEach(() => {
			getOrdererStub = sinon.stub();
			client = new Client();
		});

		it('should return an orderer', () => {
			client._network_config = {getOrderer: getOrdererStub};
			getOrdererStub.returns('orderer');
			const orderer = client.getOrderer('orderer');
			orderer.should.equal('orderer');
		});

		it('should throw an error when an orderer is not found', () => {
			(() => {
				client.getOrderer('orderer');
			}).should.throw('Orderer with name:orderer not found');
		});
	});

	describe('#getPeersForOrgOnChannel', () => {
		let getChannelStub;
		let getPeersForOrgStub;
		let getNameStub;

		let client;
		beforeEach(() => {
			getChannelStub = sinon.stub();
			getPeersForOrgStub = sinon.stub().returns([]);
			getNameStub = sinon.stub();
			client = new Client();
			client._mspid = 1;
			client.getChannel = getChannelStub;
			client.getPeersForOrg = getPeersForOrgStub;
		});

		it('should return an array of peers in an org available on the channel', () => {
			getNameStub.returns('peer-name');
			getChannelStub.returns({getPeersForOrg: getPeersForOrgStub});
			getPeersForOrgStub.returns([{getName: getNameStub}]);
			const orgPeers = client.getPeersForOrgOnChannel(['channel1']);
			sinon.assert.calledWith(getChannelStub, 'channel1');
			sinon.assert.calledOnce(getNameStub);
			orgPeers.should.deep.equal([{getName: getNameStub}]);
		});

		it('should return an array of peers in an org available on the channel when given a single channel name', () => {
			getNameStub.returns('peer-name');
			getChannelStub.returns({getPeersForOrg: getPeersForOrgStub});
			getPeersForOrgStub.returns([{getName: getNameStub}]);
			const orgPeers = client.getPeersForOrgOnChannel('channel1');
			sinon.assert.calledWith(getChannelStub, 'channel1');
			sinon.assert.calledOnce(getNameStub);
			orgPeers.should.deep.equal([{getName: getNameStub}]);
		});
	});

	describe('#getCertificateAuthority', () => {
		let getCertificateAuthorityStub;
		let getClientConfigStub;
		let getOrganizationStub;
		let getCertificateAuthoritiesStub;
		let _buildCAfromConfigStub;
		let setFabricCAServicesStub;

		let client;
		beforeEach(() => {
			getCertificateAuthorityStub = sinon.stub();
			getClientConfigStub = sinon.stub();
			getOrganizationStub = sinon.stub();
			getCertificateAuthoritiesStub = sinon.stub();
			_buildCAfromConfigStub = sinon.stub();
			setFabricCAServicesStub = sinon.stub();
			revert.push(Client.__set__('Client.prototype._buildCAfromConfig', _buildCAfromConfigStub));
			client = new Client();
		});

		it('should throw an error if _network_config is not given', () => {
			(() => {
				client.getCertificateAuthority('name');
			}).should.throw('No common connection profile has been loaded');
		});

		it('should throw an error if _cryptoSuite is not given', () => {
			client._network_config = {};
			(() => {
				client.getCertificateAuthority('name');
			}).should.throw('A crypto suite has not been assigned to this client');
		});

		it('should throw an error if ca info is not found', () => {
			client._network_config = {getCertificateAuthority: getCertificateAuthorityStub};
			client._cryptoSuite = {};
			(() => {
				client.getCertificateAuthority('name');
			}).should.throw('Common connection profile is missing this client\'s organization and certificate authority');
		});

		it('should throw an error if the client config is not found', () => {
			client._network_config = {getClientConfig: getClientConfigStub};
			client._cryptoSuite = {};
			(() => {
				client.getCertificateAuthority();
			}).should.throw('Common connection profile is missing this client\'s organization and certificate authority');
			sinon.assert.called(getClientConfigStub);
		});

		it('should throw an error if the organization config is not found', () => {
			client._network_config = {getClientConfig: getClientConfigStub, getOrganization: getOrganizationStub};
			client._cryptoSuite = {};
			getClientConfigStub.returns({organization: 'organization'});
			(() => {
				client.getCertificateAuthority();
			}).should.throw('Common connection profile is missing this client\'s organization and certificate authority');
			sinon.assert.called(getClientConfigStub);
			sinon.assert.calledWith(getOrganizationStub, 'organization');
		});

		it('should throw an error if no ca\'s are found', () => {
			client._network_config = {getClientConfig: getClientConfigStub, getOrganization: getOrganizationStub};
			client._cryptoSuite = {};
			getClientConfigStub.returns({organization: 'organization'});
			getOrganizationStub.returns({getCertificateAuthorities: getCertificateAuthoritiesStub});
			getCertificateAuthoritiesStub.returns([]);
			(() => {
				client.getCertificateAuthority();
			}).should.throw('Common connection profile is missing this client\'s organization and certificate authority');
			sinon.assert.called(getClientConfigStub);
			sinon.assert.calledWith(getOrganizationStub, 'organization');
			sinon.assert.called(getCertificateAuthoritiesStub);
		});

		it('should discover certificate authorities and return the first it finds', () => {
			_buildCAfromConfigStub.returns('ca-service');
			getClientConfigStub.returns({organization: 'organization'});
			getOrganizationStub.returns({getCertificateAuthorities: getCertificateAuthoritiesStub});
			getCertificateAuthoritiesStub.returns([{setFabricCAServices: setFabricCAServicesStub}, 'ca2']);
			client._network_config = {getClientConfig: getClientConfigStub, getOrganization: getOrganizationStub};
			client._cryptoSuite = {};
			const caInfo = client.getCertificateAuthority();
			sinon.assert.called(getClientConfigStub);
			sinon.assert.calledWith(getOrganizationStub, 'organization');
			sinon.assert.called(getCertificateAuthoritiesStub);
			sinon.assert.calledWith(_buildCAfromConfigStub, {setFabricCAServices: setFabricCAServicesStub});
			sinon.assert.calledWith(setFabricCAServicesStub, 'ca-service');
			caInfo.should.deep.equal({setFabricCAServices: setFabricCAServicesStub});
		});
	});

	describe('#_buildCAfromConfig', () => {
		let getTlsCACertsStub;
		let getConnectionOptionsStub;
		let getUrlStub;
		let getCaNameStub;
		let getConfigSettingStub;
		let requireStub;
		let caServiceStub;

		let client;
		let caInfo;
		beforeEach(() => {
			getTlsCACertsStub = sinon.stub();
			getConnectionOptionsStub = sinon.stub();
			getUrlStub = sinon.stub();
			getCaNameStub = sinon.stub();
			getConfigSettingStub = sinon.stub();
			revert.push(Client.__set__('Client.getConfigSetting', getConfigSettingStub));
			requireStub = sinon.stub();
			caServiceStub = sinon.stub();
			revert.push(Client.__set__('require', requireStub.returns(caServiceStub)));
			caInfo = {
				getTlsCACerts: getTlsCACertsStub,
				getConnectionOptions: getConnectionOptionsStub,
				getUrl: getUrlStub,
				getCaName: getCaNameStub
			};
			client = new Client();
		});

		it('should return the ca service', () => {
			getTlsCACertsStub.returns('cert');
			getConnectionOptionsStub.returns({verify: true});
			getUrlStub.returns('url');
			getCaNameStub.returns('name');
			getConfigSettingStub.returns('class-path');
			client._buildCAfromConfig(caInfo);
			sinon.assert.calledWith(getConfigSettingStub, 'certificate-authority-client');
			sinon.assert.calledWith(requireStub, 'class-path');
			sinon.assert.calledWith(caServiceStub, {tlsOptions: {trustedRoots: ['cert'], verify: true}, caName: 'name', cryptoSuite: null, url: 'url'});
		});

		it('should return the ca service if no certs are returned', () => {
			getUrlStub.returns('url');
			getCaNameStub.returns('name');
			getConfigSettingStub.returns('class-path');
			client._buildCAfromConfig(caInfo);
			sinon.assert.calledWith(getConfigSettingStub, 'certificate-authority-client');
			sinon.assert.calledWith(requireStub, 'class-path');
			sinon.assert.calledWith(caServiceStub, {tlsOptions: {trustedRoots: [], verify: true}, caName: 'name', cryptoSuite: null, url: 'url'});
		});
	});

	describe('#getClientConfig', () => {
		let hasClientStub;
		let getClientConfigStub;

		let client;
		beforeEach(() => {
			hasClientStub = sinon.stub();
			getClientConfigStub = sinon.stub();

			client = new Client();
		});

		it('should return the client config', () => {
			hasClientStub.returns(true);
			getClientConfigStub.returns('client-config');
			client._network_config = {hasClient: hasClientStub, getClientConfig: getClientConfigStub};
			const clientConfig = client.getClientConfig();
			clientConfig.should.equal('client-config');
		});

		it('should return null', () => {
			hasClientStub.returns(false);
			client._network_config = {hasClient: hasClientStub, getClientConfig: getClientConfigStub};
			const clientConfig = client.getClientConfig();
			should.equal(clientConfig, null);
		});
	});

	describe('#getMspid', () => {
		it('MSP ID initially unset', () => {
			const client = new Client();
			const actual = client.getMspid();
			should.not.exist(actual);
		});

		it('MSP ID of the org in the client section of the connection profile if loaded from config', () => {
			const clientOrg = connectionProfile.client.organization;
			const expected = connectionProfile.organizations[clientOrg].mspid;

			const client = Client.loadFromConfig(connectionProfile);
			const actual = client.getMspid();

			actual.should.equal(expected);
		});

		it('MSP ID of the user context if set', () => {
			const client = new Client();
			client.setUserContext(fakeUser, true);
			const actual = client.getMspid();

			actual.should.equal(userMspId);
		});

		it('MSP ID of the user context in preference to value from connection profile', () => {
			const client = Client.loadFromConfig(connectionProfile);
			client.setUserContext(fakeUser, true);
			const actual = client.getMspid();

			actual.should.equal(userMspId);
		});
	});

	describe('#newTransactionID', () => {
		let _getSigningIdentityStub;
		let TransactionIDStub;

		let client;
		beforeEach(() => {
			_getSigningIdentityStub = sinon.stub().returns('signing-identity');
			TransactionIDStub = sinon.stub();
			revert.push(Client.__set__('TransactionID', TransactionIDStub));
			client = new Client();
			client._getSigningIdentity = _getSigningIdentityStub;
		});

		it('should throw if typeof admin is not boolean', () => {
			(() => {
				client.newTransactionID('string');
			}).should.throw('"admin" parameter must be of type boolean');
		});

		it('should call logger.debug and create a new transactionID instance if admin is not set', () => {
			const transactionId = client.newTransactionID();
			sinon.assert.calledWith(FakeLogger.debug, 'newTransactionID - no admin parameter, returning non admin TransactionID');
			sinon.assert.calledWith(_getSigningIdentityStub, false);
			sinon.assert.calledWith(TransactionIDStub, 'signing-identity', false);
			transactionId.should.deep.equal(new TransactionIDStub());
		});

		it('should call logger.debug and create a new transactionID instance if admin is true', () => {
			const transactionId = client.newTransactionID(true);
			sinon.assert.calledWith(FakeLogger.debug, 'newTransactionID - getting an admin TransactionID');
			sinon.assert.calledWith(_getSigningIdentityStub, true);
			sinon.assert.calledWith(TransactionIDStub, 'signing-identity', true);
			transactionId.should.deep.equal(new TransactionIDStub());
		});

		it('should call logger.debug and create a new transactionID instance if admin is false', () => {
			const transactionId = client.newTransactionID(false);
			sinon.assert.calledWith(FakeLogger.debug, 'newTransactionID - getting non admin TransactionID');
			sinon.assert.calledWith(_getSigningIdentityStub, false);
			sinon.assert.calledWith(TransactionIDStub, 'signing-identity', false);
			transactionId.should.deep.equal(new TransactionIDStub());
		});
	});

	describe('#extractChannelConfig', () => {
		let envelopeDecodeStub;
		let payloadDecodeStub;
		let configUpdateEnvelopeDecodeStub;
		let getPayloadStub;
		let toBufferStub;
		let getDataStub;
		let getConfigUpdateStub;

		let client;
		beforeEach(() => {
			envelopeDecodeStub = sinon.stub();
			payloadDecodeStub = sinon.stub();
			configUpdateEnvelopeDecodeStub = sinon.stub();
			getPayloadStub = sinon.stub();
			toBufferStub = sinon.stub();
			getDataStub = sinon.stub();
			getConfigUpdateStub = sinon.stub();

			envelopeDecodeStub.returns({getPayload: getPayloadStub});
			getPayloadStub.returns({toBuffer: toBufferStub});
			getDataStub.returns({toBuffer: toBufferStub});
			payloadDecodeStub.returns({getData: getDataStub});
			getConfigUpdateStub.returns({toBuffer: toBufferStub});
			configUpdateEnvelopeDecodeStub.returns({getConfigUpdate: getConfigUpdateStub});

			revert.push(Client.__set__('_commonProto.Envelope.decode', envelopeDecodeStub));
			revert.push(Client.__set__('_commonProto.Payload.decode', payloadDecodeStub));
			revert.push(Client.__set__('_configtxProto.ConfigUpdateEnvelope.decode', configUpdateEnvelopeDecodeStub));
			client = new Client();
		});

		it('should return the config update as a buffer', () => {
			const configEnvelope = 'config-envelope';
			toBufferStub.onCall(0).returns('payload');
			toBufferStub.onCall(1).returns('data');
			toBufferStub.onCall(2).returns('config-update');
			const configUpdate = client.extractChannelConfig(configEnvelope);
			sinon.assert.calledWith(envelopeDecodeStub, 'config-envelope');
			sinon.assert.calledWith(payloadDecodeStub, 'payload');
			sinon.assert.calledWith(configUpdateEnvelopeDecodeStub, 'data');
			configUpdate.should.equal('config-update');
		});
	});

	describe('#signChannelConfig', () => {
		let _getSigningIdentityStub;
		let SignatureHeaderStub;
		let setCreatorStub;
		let serializeStub;
		let setNonceStub;
		let getNonceStub;
		let toBufferStub;
		let bufferConcatStub;
		let bufferFromStub;
		let bufferIsBufferStub;
		let signStub;
		let ConfigSignatureStub;
		let setSignatureHeaderStub;
		let setSignatureStub;

		let client;
		beforeEach(() => {
			_getSigningIdentityStub = sinon.stub();
			SignatureHeaderStub = sinon.stub();
			revert.push(Client.__set__('_commonProto.SignatureHeader', SignatureHeaderStub));
			setCreatorStub = sinon.stub();
			serializeStub = sinon.stub();
			setNonceStub = sinon.stub();
			getNonceStub = sinon.stub();
			revert.push(Client.__set__('sdkUtils.getNonce', getNonceStub));
			toBufferStub = sinon.stub();
			bufferConcatStub = sinon.stub();
			bufferFromStub = sinon.stub();
			bufferIsBufferStub = sinon.stub();
			signStub = sinon.stub();
			revert.push(Client.__set__('Buffer', {concat: bufferConcatStub, from: bufferFromStub, isBuffer: bufferIsBufferStub}));
			ConfigSignatureStub = sinon.stub();
			revert.push(Client.__set__('_configtxProto.ConfigSignature', ConfigSignatureStub));
			setSignatureHeaderStub = sinon.stub();
			setSignatureStub = sinon.stub();

			serializeStub.returns('creator');
			getNonceStub.returns('nonce');
			toBufferStub.returns('signature-header-bytes');
			signStub.returns('sign');
			_getSigningIdentityStub.returns({serialize: serializeStub, sign: signStub});
			SignatureHeaderStub.returns({setCreator: setCreatorStub, setNonce: setNonceStub, toBuffer: toBufferStub});
			bufferConcatStub.returns('signing-bytes');
			bufferFromStub.returns('signature-bytes');
			ConfigSignatureStub.returns({setSignatureHeader: setSignatureHeaderStub, setSignature: setSignatureStub});

			client = new Client();
			client._getSigningIdentity = _getSigningIdentityStub;
		});

		it('should throw an error if no config is given', () => {
			(() => {
				client.signChannelConfig();
			}).should.throw('Channel configuration update parameter is required.');
			sinon.assert.calledWith(FakeLogger.debug, 'signChannelConfigUpdate - start');
		});

		it('should throw an error if config is not a buffer', () => {
			bufferIsBufferStub.returns(false);
			(() => {
				client.signChannelConfig({});
			}).should.throw('Channel configuration update parameter is not in the correct form.');
			sinon.assert.calledWith(FakeLogger.debug, 'signChannelConfigUpdate - start');
		});

		it('should return a proto config signature', () => {
			bufferIsBufferStub.returns(true);
			const signature = client.signChannelConfig('config');
			sinon.assert.calledWith(FakeLogger.debug, 'signChannelConfigUpdate - start');
			sinon.assert.calledWith(_getSigningIdentityStub, true);
			sinon.assert.called(SignatureHeaderStub);
			sinon.assert.called(serializeStub);
			sinon.assert.calledWith(setCreatorStub, 'creator');
			sinon.assert.called(getNonceStub);
			sinon.assert.calledWith(setNonceStub, 'nonce');
			sinon.assert.called(toBufferStub);
			sinon.assert.calledWith(bufferConcatStub, ['signature-header-bytes', 'config']);
			sinon.assert.calledWith(signStub, 'signing-bytes');
			sinon.assert.calledWith(bufferFromStub, 'sign');
			sinon.assert.called(ConfigSignatureStub);
			sinon.assert.calledWith(setSignatureHeaderStub, 'signature-header-bytes');
			sinon.assert.calledWith(setSignatureStub, 'signature-bytes');
			signature.should.equal(new ConfigSignatureStub());
		});
	});

	describe('#createChannel', () => {
		it('should create a new channel', () => {
			const _createOrUpdateChannelStub = sinon.stub().returns('channel');
			const client = new Client();
			client._createOrUpdateChannel = _createOrUpdateChannelStub;

			const request = {envelope: true};
			const channel = client.createChannel(request);
			sinon.assert.calledWith(_createOrUpdateChannelStub, request, true);
			channel.should.equal('channel');
		});
	});

	describe('#updateChannel', () => {
		it('should update an existing channel', () => {
			const _createOrUpdateChannelStub = sinon.stub().returns('channel');
			const client = new Client();
			client._createOrUpdateChannel = _createOrUpdateChannelStub;

			const request = {envelope: true};
			const channel = client.updateChannel(request);
			sinon.assert.calledWith(_createOrUpdateChannelStub, request, true);
			channel.should.equal('channel');
		});
	});

	describe('#_createOrUpdateChannel', () => {
		let _getSigningIdentityStub;
		let getTargetOrdererStub;
		let sendBroadcastStub;
		let envelopeDecodeStub;

		let ConfigUpdateEnvelopeStub;
		let setConfigUpdateStub;
		let _stringToSignatureStub;
		let setSignaturesStub;
		let txIdStub;
		let isAdminStub;
		let getNonceStub;
		let getTransactionIDStub;
		let buildChannelHeaderStub;
		let buildHeaderStub;
		let payloadStub;
		let setHeaderStub;
		let setDataStub;
		let toBufferStub;
		let signStub;

		let client;
		const orderer = {};
		beforeEach(() => {
			signStub = sinon.stub().returns('signature');
			_getSigningIdentityStub = sinon.stub().returns({sign: signStub});
			getTargetOrdererStub = sinon.stub();
			sendBroadcastStub = sinon.stub();
			envelopeDecodeStub = sinon.stub();
			setHeaderStub = sinon.stub();
			setDataStub = sinon.stub();
			payloadStub = sinon.stub();
			toBufferStub = sinon.stub();
			payloadStub.returns({setHeader: setHeaderStub, setData: setDataStub, toBuffer: toBufferStub});
			isAdminStub = sinon.stub().returns(true);
			getTransactionIDStub = sinon.stub();
			getNonceStub = sinon.stub().returns('nonce');
			txIdStub = {getTransactionID: getTransactionIDStub, isAdmin: isAdminStub, getNonce: getNonceStub};
			buildChannelHeaderStub = sinon.stub();
			buildHeaderStub = sinon.stub().returns('header');
			ConfigUpdateEnvelopeStub = sinon.stub();
			setConfigUpdateStub = sinon.stub();
			_stringToSignatureStub = sinon.stub().returns('signatures');
			setSignaturesStub = sinon.stub();
			ConfigUpdateEnvelopeStub.returns({setConfigUpdate: setConfigUpdateStub, setSignatures: setSignaturesStub, toBuffer: toBufferStub});

			revert.push(Client.__set__('_stringToSignature', _stringToSignatureStub));
			revert.push(Client.__set__('_commonProto.Envelope.decode', envelopeDecodeStub));
			revert.push(Client.__set__('clientUtils.buildChannelHeader', buildChannelHeaderStub.returns('payload-header')));
			revert.push(Client.__set__('clientUtils.buildHeader', buildHeaderStub));
			revert.push(Client.__set__('_commonProto.HeaderType.CONFIG_UPDATE', 'config_update'));
			revert.push(Client.__set__('_commonProto.Payload', payloadStub));
			revert.push(Client.__set__('_configtxProto.ConfigUpdateEnvelope', ConfigUpdateEnvelopeStub));

			client = new Client();
			client.getTargetOrderer = getTargetOrdererStub.returns(orderer);
			client._getSigningIdentity = _getSigningIdentityStub;
			orderer.sendBroadcast = sendBroadcastStub.returns(Promise.resolve('broadcast'));
		});

		it('should throw an error if request is not given', async () => {
			try {
				await client._createOrUpdateChannel();
				should.fail();
			} catch (err) {
				sinon.assert.calledWith(FakeLogger.debug, '_createOrUpdateChannel - start');
				err.message.should.equal('Missing all required input request parameters for initialize channel');
			}
		});

		it('should throw an error if request.name is not given', async () => {
			try {
				await client._createOrUpdateChannel({});
				should.fail();
			} catch (err) {
				sinon.assert.calledWith(FakeLogger.debug, '_createOrUpdateChannel - start');
				err.message.should.equal('Missing name request parameter');
			}
		});

		it('should throw an error if request.txId is not given', async () => {
			try {
				await client._createOrUpdateChannel({name: 'name'});
				should.fail();
			} catch (err) {
				sinon.assert.calledWith(FakeLogger.debug, '_createOrUpdateChannel - start');
				err.message.should.equal('Missing txId request parameter');
			}
		});

		it('should throw an error if request.config is not given', async () => {
			try {
				await client._createOrUpdateChannel({name: 'name', txId: 'txId'}, false);
			} catch (err) {
				err.message.should.equal('Missing config request parameter containing the configuration of the channel');
			}
		});

		it('should throw an error if request.signatures is not given', async () => {
			try {
				await client._createOrUpdateChannel({name: 'name', txId: 'txId', config: {}}, false);
			} catch (err) {
				err.message.should.equal('Missing signatures request parameter for the new channel');
			}
		});

		it('should throw an error if request.signatures is not an array', async () => {
			try {
				await client._createOrUpdateChannel({name: 'name', txId: 'txId', config: {}, signatures: 'signatures'}, false);
			} catch (err) {
				err.message.should.equal('Signatures request parameter must be an array of signatures');
			}
		});

		it('should return the results of the broadcast when have_envelope is true', async () => {
			const envelope = {signature: 'signature', payload: 'payload'};
			envelopeDecodeStub.returns(envelope);
			const results = await client._createOrUpdateChannel({name: 'name', txId: 'txId', orderer: 'orderer', envelope: 'envelope'}, true);
			sinon.assert.calledWith(getTargetOrdererStub, 'orderer', null, 'name');
			sinon.assert.calledWith(FakeLogger.debug, '_createOrUpdateChannel - have envelope');
			sinon.assert.calledWith(envelopeDecodeStub, 'envelope');
			results.should.equal('broadcast');
		});

		it('should return the results of the boradcase when have_envelope is false', async () => {
			getTransactionIDStub.returns('transactionId');
			buildChannelHeaderStub.returns('proto_channel_header');
			toBufferStub.onCall(0).returns('data');
			toBufferStub.onCall(1).returns('payload-bytes');
			const results = await client._createOrUpdateChannel({name: 'name', txId: txIdStub, orderer: 'orderer', config: 'config', signatures: ['signature']});
			sinon.assert.calledWith(FakeLogger.debug, '_createOrUpdateChannel - have config_update');
			sinon.assert.calledWith(setConfigUpdateStub, 'config');
			sinon.assert.calledWith(_stringToSignatureStub, ['signature']);
			sinon.assert.calledWith(setSignaturesStub, 'signatures');
			sinon.assert.calledWith(buildChannelHeaderStub, 'config_update', 'name', 'transactionId');
			sinon.assert.called(getTransactionIDStub);
			sinon.assert.calledWith(setHeaderStub, 'header');
			sinon.assert.calledWith(setDataStub, 'data');
			sinon.assert.called(toBufferStub);
			sinon.assert.calledWith(sendBroadcastStub, {signature: Buffer.from('signature'), payload: 'payload-bytes'});
			results.should.deep.equal('broadcast');
		});
	});

	describe('#queryPeers', () => {
		let getTargetPeersStub;
		let ChannelStub;
		let _discoverStub;

		let client;
		beforeEach(() => {
			getTargetPeersStub = sinon.stub();
			ChannelStub = sinon.stub();
			revert.push(Client.__set__('Channel', ChannelStub));
			_discoverStub = sinon.stub();
			revert.push(Client.__set__('Client.prototype._discover', _discoverStub));

			client = new Client();
			client.getTargetPeers = getTargetPeersStub;
		});

		it('should throw an error if no request is given', async() => {
			try {
				await client.queryPeers();
				should.fail();
			} catch (e) {
				e.message.should.equal('Target Peer is required');
				sinon.assert.calledWith(FakeLogger.debug, '%s - start', 'queryPeers');
			}
		});

		it('should throw an error if no request.target is given', async() => {
			try {
				await client.queryPeers({});
				should.fail();
			} catch (e) {
				e.message.should.equal('Target Peer is required');
			}
		});

		it('should throw an error if undefined target peers are found', async() => {
			try {
				await client.queryPeers({target: 'peers'});
			} catch (e) {
				e.message.should.equal('Target Peer not found');
				sinon.assert.calledWith(getTargetPeersStub, 'peers');
			}
		});

		it('should throw an error if no target peers are found', async() => {
			getTargetPeersStub.returns([]);
			try {
				await client.queryPeers({target: 'peers'});
			} catch (e) {
				e.message.should.equal('Target Peer not found');
				sinon.assert.calledWith(getTargetPeersStub, 'peers');
			}
		});

		it('should throw if creating a channel object throws', async() => {
			ChannelStub.throws(Error, 'test-error');
			getTargetPeersStub.returns(['peer1']);
			try {
				await client.queryPeers({target: 'peer1'});
			} catch (e) {
				e.message.should.equal('Failed to discover local peers ::Error');
				sinon.assert.calledWith(ChannelStub, 'discover-peers', client);
			}
		});

		it('should call discover with the generated discover_request and return the discovered peers', async() => {
			getTargetPeersStub.returns(['peer1']);
			_discoverStub.returns(Promise.resolve('peer-results'));
			ChannelStub.returns({_discover: _discoverStub});
			const peers = await client.queryPeers({target: 'peer1'});
			peers.should.equal('peer-results');
		});
	});

	describe('#queryChannels', () => {
		let _getSigningIdentityStub;
		let getTargetPeersStub;
		let transactionIDStub;
		let sendTransactionProposalStub;
		let ChannelQueryResponseDecodeStub;

		let client;
		beforeEach(() => {
			_getSigningIdentityStub = sinon.stub();
			getTargetPeersStub = sinon.stub();
			getTargetPeersStub.returns(['peer']);
			transactionIDStub = sinon.stub();
			sendTransactionProposalStub = sinon.stub();
			ChannelQueryResponseDecodeStub = sinon.stub();
			ChannelQueryResponseDecodeStub.returns({channels: [{channel_id: 1}]});

			revert.push(Client.__set__('_queryProto.ChannelQueryResponse.decode', ChannelQueryResponseDecodeStub));
			revert.push(Client.__set__('Channel.sendTransactionProposal', sendTransactionProposalStub));
			revert.push(Client.__set__('TransactionID', transactionIDStub));
			client = new Client();
			client.getTargetPeers = getTargetPeersStub;
			client._getSigningIdentity = _getSigningIdentityStub;
		});

		it('should throw an error if peer is not given', async () => {
			try {
				await client.queryChannels();
				should.fail();
			} catch (err) {
				err.message.should.equal('Peer is required');
				sinon.assert.calledWith(FakeLogger.debug, 'queryChannels - start');
			}
		});

		it('should throw an error if the response is an instance of error', async () => {
			_getSigningIdentityStub.returns('signer');
			sendTransactionProposalStub.returns(Promise.resolve([[new Error('an error')]]));
			try {
				await client.queryChannels({});
				should.fail();
			} catch (err) {
				const request = {
					targets: ['peer'],
					chaincodeId: 'cscc',
					txId: new transactionIDStub(),
					signer: 'signer',
					fcn: 'GetChannels',
					args: []
				};

				err.message.should.equal('an error');
				sinon.assert.calledWith(FakeLogger.debug, 'queryChannels - start');
				sinon.assert.calledWith(getTargetPeersStub, {});
				sinon.assert.calledWith(transactionIDStub, 'signer', undefined);
				sinon.assert.calledWith(sendTransactionProposalStub, request, '', client);
			}
		});

		it('should throw an error if the transaction proposal is not found', async () => {
			_getSigningIdentityStub.returns('signer');
			sendTransactionProposalStub.returns(Promise.resolve([[{}, {}]]));
			try {
				await client.queryChannels({});
				should.fail();
			} catch (err) {
				const request = {
					targets: ['peer'],
					chaincodeId: 'cscc',
					txId: new transactionIDStub(),
					signer: 'signer',
					fcn: 'GetChannels',
					args: []
				};

				err.message.should.equal('Too many results returned');
				sinon.assert.calledWith(FakeLogger.debug, 'queryChannels - start');
				sinon.assert.calledWith(getTargetPeersStub, {});
				sinon.assert.calledWith(transactionIDStub, 'signer', undefined);
				sinon.assert.calledWith(sendTransactionProposalStub, request, '', client);
			}
		});

		it('should throw an error if we are unsure what is happening', async () => {
			_getSigningIdentityStub.returns('signer');
			sendTransactionProposalStub.returns(Promise.resolve([['unknown error']]));
			try {
				await client.queryChannels({});
				should.fail();
			} catch (err) {
				const request = {
					targets: ['peer'],
					chaincodeId: 'cscc',
					txId: new transactionIDStub(),
					signer: 'signer',
					fcn: 'GetChannels',
					args: []
				};

				err.message.should.equal('unknown error');
				sinon.assert.calledWith(FakeLogger.debug, 'queryChannels - start');
				sinon.assert.calledWith(getTargetPeersStub, {});
				sinon.assert.calledWith(transactionIDStub, 'signer', undefined);
				sinon.assert.calledWith(sendTransactionProposalStub, request, '', client);
			}
		});

		it('should throw an error if transaction proposal results are not arrays', async () => {
			_getSigningIdentityStub.returns('signer');
			sendTransactionProposalStub.returns(Promise.resolve(['test']));
			try {
				await client.queryChannels({});
				should.fail();
			} catch (err) {
				const request = {
					targets: ['peer'],
					chaincodeId: 'cscc',
					txId: new transactionIDStub(),
					signer: 'signer',
					fcn: 'GetChannels',
					args: []
				};

				err.message.should.equal('Payload results are missing from the query');
				sinon.assert.calledWith(FakeLogger.debug, 'queryChannels - start');
				sinon.assert.calledWith(getTargetPeersStub, {});
				sinon.assert.calledWith(transactionIDStub, 'signer', undefined);
				sinon.assert.calledWith(sendTransactionProposalStub, request, '', client);
			}
		});

		it('should return the query trans for a channel', async () => {
			_getSigningIdentityStub.returns('signer');
			sendTransactionProposalStub.returns(Promise.resolve([[{response: {status: 'status', payload: 'payload'}}]]));
			const queryTrans = await client.queryChannels('peer');
			sinon.assert.calledWith(FakeLogger.debug, 'queryChannels - start');
			sinon.assert.calledWith(getTargetPeersStub, 'peer');
			sinon.assert.calledWith(_getSigningIdentityStub, undefined);
			sinon.assert.calledWith(transactionIDStub, 'signer', undefined);
			const request = {
				targets: ['peer'],
				chaincodeId: 'cscc',
				txId: new transactionIDStub(),
				signer: 'signer',
				fcn: 'GetChannels',
				args: []
			};
			sinon.assert.calledWith(sendTransactionProposalStub, request, '', client);
			sinon.assert.calledWith(FakeLogger.debug, 'queryChannels - got response');
			sinon.assert.calledWith(FakeLogger.debug, 'queryChannels - response status :: %d', 'status');
			sinon.assert.calledWith(ChannelQueryResponseDecodeStub, 'payload');
			sinon.assert.calledWith(FakeLogger.debug, 'queryChannels - ProcessedTransaction.channelInfo.length :: %s', 1);
			sinon.assert.calledWith(FakeLogger.debug, '>>> channel id %s ', 1);
			queryTrans.should.deep.equal({channels: [{channel_id: 1}]});
		});
	});

	describe('#queryInstalledChaincodes', () => {
		let _getSigningIdentityStub;
		let getTargetPeersStub;
		let transactionIDStub;
		let sendTransactionProposalStub;
		let ChaincodeQueryResponseDecodeStub;

		let client;
		beforeEach(() => {
			_getSigningIdentityStub = sinon.stub();
			getTargetPeersStub = sinon.stub();
			getTargetPeersStub.returns(['peer']);
			transactionIDStub = sinon.stub();
			sendTransactionProposalStub = sinon.stub();
			ChaincodeQueryResponseDecodeStub = sinon.stub();
			ChaincodeQueryResponseDecodeStub.returns({chaincodes: [{name: 'chaincode1', version: 1, path: 'path'}]});

			revert.push(Client.__set__('_queryProto.ChaincodeQueryResponse.decode', ChaincodeQueryResponseDecodeStub));
			revert.push(Client.__set__('Channel.sendTransactionProposal', sendTransactionProposalStub));
			revert.push(Client.__set__('TransactionID', transactionIDStub));
			client = new Client();
			client.getTargetPeers = getTargetPeersStub;
			client._getSigningIdentity = _getSigningIdentityStub;
		});

		it('should throw an error if peer is not given', async () => {
			try {
				await client.queryInstalledChaincodes();
				should.fail();
			} catch (err) {
				err.message.should.equal('Peer is required');
				sinon.assert.calledWith(FakeLogger.debug, 'queryInstalledChaincodes - start peer %s', undefined);
			}
		});



		it('should throw an error if we are unsure what is happening', async () => {
			_getSigningIdentityStub.returns('signer');
			sendTransactionProposalStub.returns(Promise.resolve([[new Error('unknown error')]]));
			try {
				await client.queryInstalledChaincodes({});
				should.fail();
			} catch (err) {
				const request = {
					targets: ['peer'],
					chaincodeId: 'lscc',
					txId: new transactionIDStub(),
					signer: 'signer',
					fcn: 'getinstalledchaincodes',
					args: []
				};

				err.message.should.equal('unknown error');
				sinon.assert.calledWith(getTargetPeersStub, {});
				sinon.assert.calledWith(transactionIDStub, 'signer', undefined);
				sinon.assert.calledWith(sendTransactionProposalStub, request, '', client);
			}
		});

		it('should throw an error if the response is not an array', async () => {
			_getSigningIdentityStub.returns('signer');
			sendTransactionProposalStub.returns(Promise.resolve(['response']));
			try {
				await client.queryInstalledChaincodes({});
				should.fail();
			} catch (err) {
				const request = {
					targets: ['peer'],
					chaincodeId: 'lscc',
					txId: new transactionIDStub(),
					signer: 'signer',
					fcn: 'getinstalledchaincodes',
					args: []
				};

				err.message.should.equal('Payload results are missing from the query');
				sinon.assert.calledWith(FakeLogger.debug, 'queryInstalledChaincodes - start peer %s', {});
				sinon.assert.calledWith(getTargetPeersStub, {});
				sinon.assert.calledWith(transactionIDStub, 'signer', undefined);
				sinon.assert.calledWith(sendTransactionProposalStub, request, '', client);
			}
		});

		it('should throw an error if the response has no response property', async () => {
			_getSigningIdentityStub.returns('signer');
			sendTransactionProposalStub.returns(Promise.resolve([[{}]]));
			try {
				await client.queryInstalledChaincodes({});
				should.fail();
			} catch (err) {
				const request = {
					targets: ['peer'],
					chaincodeId: 'lscc',
					txId: new transactionIDStub(),
					signer: 'signer',
					fcn: 'getinstalledchaincodes',
					args: []
				};

				err.should.deep.equal({});
				sinon.assert.calledWith(FakeLogger.debug, 'queryInstalledChaincodes - start peer %s', {});
				sinon.assert.calledWith(getTargetPeersStub, {});
				sinon.assert.calledWith(transactionIDStub, 'signer', undefined);
				sinon.assert.calledWith(sendTransactionProposalStub, request, '', client);
			}
		});

		it('should throw an error if the transaction proposal is not found', async () => {
			_getSigningIdentityStub.returns('signer');
			sendTransactionProposalStub.returns(Promise.resolve([[{}, {}]]));
			try {
				await client.queryInstalledChaincodes({});
				should.fail();
			} catch (err) {
				const request = {
					targets: ['peer'],
					chaincodeId: 'lscc',
					txId: new transactionIDStub(),
					signer: 'signer',
					fcn: 'getinstalledchaincodes',
					args: []
				};

				err.message.should.equal('Too many results returned');
				sinon.assert.calledWith(FakeLogger.debug, 'queryInstalledChaincodes - start peer %s', {});
				sinon.assert.calledWith(getTargetPeersStub, {});
				sinon.assert.calledWith(transactionIDStub, 'signer', undefined);
				sinon.assert.calledWith(sendTransactionProposalStub, request, '', client);
			}
		});

		it('should return the query trans for a channel', async () => {
			_getSigningIdentityStub.returns('signer');
			sendTransactionProposalStub.returns(Promise.resolve([[{response: {status: 'status', payload: 'payload'}}]]));
			const queryTrans = await client.queryInstalledChaincodes('peer');
			sinon.assert.calledWith(FakeLogger.debug, 'queryInstalledChaincodes - start peer %s', 'peer');
			sinon.assert.calledWith(getTargetPeersStub, 'peer');
			sinon.assert.calledWith(_getSigningIdentityStub, undefined);
			sinon.assert.calledWith(transactionIDStub, 'signer', undefined);
			const request = {
				targets: ['peer'],
				chaincodeId: 'lscc',
				txId: new transactionIDStub(),
				signer: 'signer',
				fcn: 'getinstalledchaincodes',
				args: []
			};
			sinon.assert.calledWith(sendTransactionProposalStub, request, '', client);
			sinon.assert.calledWith(FakeLogger.debug, 'queryInstalledChaincodes - got response');
			sinon.assert.calledWith(FakeLogger.debug, 'queryInstalledChaincodes - response status :: %d', 'status');
			sinon.assert.calledWith(ChaincodeQueryResponseDecodeStub, 'payload');
			sinon.assert.calledWith(FakeLogger.debug, 'queryInstalledChaincodes - ProcessedTransaction.chaincodeInfo.length :: %s', 1);
			sinon.assert.calledWith(FakeLogger.debug, '>>> name %s, version %s, path %s', 'chaincode1', 1, 'path');
			queryTrans.should.deep.equal({chaincodes: [{name: 'chaincode1', version: 1, path: 'path'}]});
		});
	});

	describe('#installChaincode', () => {

		const smartContractPackageBytes = fs.readFileSync(path.resolve(__dirname, 'data', 'golang-contract.cds'));
		let smartContractPackage;

		let getTargetPeersStub;
		let getPeersForOrgOnChannelStub;
		let _getSigningIdentityStub;
		let TransactionIDStub;
		let isAdminStub;
		let getTransactionIDStub;
		let buildChannelHeaderStub;
		let buildHeaderStub;
		let getNonceStub;
		let buildProposalStub;
		let signProposalStub;
		let sendPeersProposalStub;
		let translateCCTypeStub;

		let client;
		beforeEach(async () => {
			smartContractPackage = await Package.fromBuffer(smartContractPackageBytes);
			getPeersForOrgOnChannelStub = sinon.stub();
			getTargetPeersStub = sinon.stub();
			_getSigningIdentityStub = sinon.stub().returns('signer');
			getNonceStub = sinon.stub().returns('nonce');
			isAdminStub = sinon.stub().returns(true);
			getTransactionIDStub = sinon.stub().returns('txId');
			TransactionIDStub = sinon.stub().returns({isAdmin: isAdminStub, getTransactionID: getTransactionIDStub, getNonce: getNonceStub});
			revert.push(Client.__set__('TransactionID', TransactionIDStub));
			buildChannelHeaderStub = sinon.stub().returns('channel-header');
			revert.push(Client.__set__('clientUtils.buildChannelHeader', buildChannelHeaderStub));
			buildHeaderStub = sinon.stub().returns('header');
			revert.push(Client.__set__('clientUtils.buildHeader', buildHeaderStub));
			buildProposalStub = sinon.stub().returns('proposal');
			revert.push(Client.__set__('clientUtils.buildProposal', buildProposalStub));
			signProposalStub = sinon.stub().returns('signed-proposal');
			revert.push(Client.__set__('clientUtils.signProposal', signProposalStub));
			sendPeersProposalStub = sinon.stub().returns(Promise.resolve(['response']));
			revert.push(Client.__set__('clientUtils.sendPeersProposal', sendPeersProposalStub));
			translateCCTypeStub = sinon.stub().returns('go');
			revert.push(Client.__set__('clientUtils.translateCCType', translateCCTypeStub));
			revert.push(Client.__set__('_commonProto.HeaderType.ENDORSER_TRANSACTION', 'ENDORSER_TRANSACITON'));

			client = new Client();
			client.getTargetPeers = getTargetPeersStub;
			client.getPeersForOrgOnChannel = getPeersForOrgOnChannelStub;
			client._getSigningIdentity = _getSigningIdentityStub;
		});

		it('should throw error if not request given', async () => {
			await client.installChaincode()
				.should.be.rejectedWith(/Missing input request object on install chaincode request/);
			sinon.assert.calledWith(FakeLogger.error, 'installChaincode error Missing input request object on install chaincode request');
		});

		it('should throw error if chaincodeId not specified', async () => {
			await client.installChaincode({chaincodeVersion: '0.0.1', chaincodePath: 'mycc'})
				.should.be.rejectedWith(/Missing "chaincodeId" parameter in the proposal request/);
		});

		it('should throw error if chaincodeVersion not specified', async () => {
			await client.installChaincode({chaincodeId: 'mycc', chaincodePath: 'mycc'})
				.should.be.rejectedWith(/Missing "chaincodeVersion" parameter in the proposal request/);
		});

		it('should throw error if chaincodePath not specified', async () => {
			await client.installChaincode({chaincodeId: 'mycc', chaincodeVersion: '0.0.1'})
				.should.be.rejectedWith(/Missing "chaincodePath" parameter in the proposal request/);
		});

		it('should throw error if no peers found', async () => {
			await client.installChaincode({chaincodeId: 'mycc', chaincodeVersion: '0.0.1', chaincodePath: 'mycc'})
				.should.be.rejectedWith(/Missing peer objects in install chaincode request/);
		});

		it('should install using chaincode ID, chaincode version, and chaincode path', async () => {
			const fromDirectoryStub = sinon.stub(Package, 'fromDirectory').withArgs({
				name: 'mycc',
				version: '0.0.1',
				path: 'mycc',
				type: undefined,
				metadataPath: undefined
			}).resolves(smartContractPackage);
			getTargetPeersStub.withArgs(['peer']).returns(['peer']);
			const request = {chaincodeId: 'mycc', chaincodeVersion: '0.0.1', chaincodePath: 'mycc', targets: ['peer']};
			const response = await client.installChaincode(request);
			sinon.assert.calledWith(getTargetPeersStub, ['peer']);
			sinon.assert.calledOnce(fromDirectoryStub);
			sinon.assert.calledWith(translateCCTypeStub, undefined);
			sinon.assert.calledWith(_getSigningIdentityStub, true);
			sinon.assert.calledWith(buildChannelHeaderStub, 'ENDORSER_TRANSACITON', '', 'txId', null, 'lscc');
			sinon.assert.calledWith(buildHeaderStub, 'signer', 'channel-header', 'nonce');
			sinon.assert.calledWith(buildProposalStub, {
				chaincode_id: {name: 'lscc'},
				input: {args: [Buffer.from('install', 'utf8'), smartContractPackageBytes]},
				type: 'go'
			}, 'header');
			sinon.assert.calledWith(signProposalStub, 'signer', 'proposal');
			sinon.assert.calledWith(sendPeersProposalStub, ['peer'], 'signed-proposal', undefined);
			response.should.deep.equal([['response'], 'proposal']);
		});

		it('should install using chaincode ID, chaincode version, chaincode path, and chaincode type', async () => {
			const fromDirectoryStub = sinon.stub(Package, 'fromDirectory').withArgs({
				name: 'mycc',
				version: '0.0.1',
				path: 'mycc',
				type: 'java',
				metadataPath: undefined
			}).resolves(smartContractPackage);
			getTargetPeersStub.withArgs(['peer']).returns(['peer']);
			const request = {chaincodeId: 'mycc', chaincodeVersion: '0.0.1', chaincodePath: 'mycc', chaincodeType: 'java', targets: ['peer']};
			const response = await client.installChaincode(request);
			sinon.assert.calledWith(getTargetPeersStub, ['peer']);
			sinon.assert.calledOnce(fromDirectoryStub);
			sinon.assert.calledWith(translateCCTypeStub, 'java');
			sinon.assert.calledWith(_getSigningIdentityStub, true);
			sinon.assert.calledWith(buildChannelHeaderStub, 'ENDORSER_TRANSACITON', '', 'txId', null, 'lscc');
			sinon.assert.calledWith(buildHeaderStub, 'signer', 'channel-header', 'nonce');
			sinon.assert.calledWith(buildProposalStub, {
				chaincode_id: {name: 'lscc'},
				input: {args: [Buffer.from('install', 'utf8'), smartContractPackageBytes]},
				type: 'go'
			}, 'header');
			sinon.assert.calledWith(signProposalStub, 'signer', 'proposal');
			sinon.assert.calledWith(sendPeersProposalStub, ['peer'], 'signed-proposal', undefined);
			response.should.deep.equal([['response'], 'proposal']);
		});

		it('should install using chaincode ID, chaincode version, chaincode path, chaincode type, and metadata path', async () => {
			const fromDirectoryStub = sinon.stub(Package, 'fromDirectory').withArgs({
				name: 'mycc',
				version: '0.0.1',
				path: 'mycc',
				type: 'java',
				metadataPath: 'mycc/META-INF'
			}).resolves(smartContractPackage);
			getTargetPeersStub.withArgs(['peer']).returns(['peer']);
			const request = {chaincodeId: 'mycc', chaincodeVersion: '0.0.1', chaincodePath: 'mycc', chaincodeType: 'java', metadataPath: 'mycc/META-INF', targets: ['peer']};
			const response = await client.installChaincode(request);
			sinon.assert.calledWith(getTargetPeersStub, ['peer']);
			sinon.assert.calledOnce(fromDirectoryStub);
			sinon.assert.calledWith(translateCCTypeStub, 'java');
			sinon.assert.calledWith(_getSigningIdentityStub, true);
			sinon.assert.calledWith(buildChannelHeaderStub, 'ENDORSER_TRANSACITON', '', 'txId', null, 'lscc');
			sinon.assert.calledWith(buildHeaderStub, 'signer', 'channel-header', 'nonce');
			sinon.assert.calledWith(buildProposalStub, {
				chaincode_id: {name: 'lscc'},
				input: {args: [Buffer.from('install', 'utf8'), smartContractPackageBytes]},
				type: 'go'
			}, 'header');
			sinon.assert.calledWith(signProposalStub, 'signer', 'proposal');
			sinon.assert.calledWith(sendPeersProposalStub, ['peer'], 'signed-proposal', undefined);
			response.should.deep.equal([['response'], 'proposal']);
		});

		it('should install, but not package, when dev mode is enabled', async () => {
			client.setDevMode(true);
			const fromDirectoryStub = sinon.stub(Package, 'fromDirectory').rejects(new Error('such error'));
			getTargetPeersStub.withArgs(['peer']).returns(['peer']);
			const request = {chaincodeId: 'mycc', chaincodeVersion: '0.0.1', chaincodePath: 'mycc', targets: ['peer']};
			const response = await client.installChaincode(request);
			sinon.assert.calledWith(getTargetPeersStub, ['peer']);
			sinon.assert.notCalled(fromDirectoryStub);
			sinon.assert.calledWith(translateCCTypeStub, undefined);
			sinon.assert.calledWith(_getSigningIdentityStub, true);
			sinon.assert.calledWith(buildChannelHeaderStub, 'ENDORSER_TRANSACITON', '', 'txId', null, 'lscc');
			sinon.assert.calledWith(buildHeaderStub, 'signer', 'channel-header', 'nonce');
			sinon.assert.calledWith(buildProposalStub, {
				chaincode_id: {name: 'lscc'},
				input: {args: [Buffer.from('install', 'utf8'), null]},
				type: 'go'
			}, 'header');
			sinon.assert.calledWith(signProposalStub, 'signer', 'proposal');
			sinon.assert.calledWith(sendPeersProposalStub, ['peer'], 'signed-proposal', undefined);
			response.should.deep.equal([['response'], 'proposal']);
		});

		it('should install using a chaincode package', async () => {
			const fromDirectoryStub = sinon.stub(Package, 'fromDirectory').rejects(new Error('such error'));
			getTargetPeersStub.withArgs(['peer']).returns(['peer']);
			const request = {chaincodePackage: smartContractPackageBytes, targets: ['peer']};
			const response = await client.installChaincode(request);
			sinon.assert.calledWith(getTargetPeersStub, ['peer']);
			sinon.assert.notCalled(fromDirectoryStub);
			sinon.assert.calledWith(translateCCTypeStub, undefined);
			sinon.assert.calledWith(_getSigningIdentityStub, true);
			sinon.assert.calledWith(buildChannelHeaderStub, 'ENDORSER_TRANSACITON', '', 'txId', null, 'lscc');
			sinon.assert.calledWith(buildHeaderStub, 'signer', 'channel-header', 'nonce');
			sinon.assert.calledWith(buildProposalStub, {
				chaincode_id: {name: 'lscc'},
				input: {args: [Buffer.from('install', 'utf8'), smartContractPackageBytes]},
				type: 'go'
			}, 'header');
			sinon.assert.calledWith(signProposalStub, 'signer', 'proposal');
			sinon.assert.calledWith(sendPeersProposalStub, ['peer'], 'signed-proposal', undefined);
			response.should.deep.equal([['response'], 'proposal']);
		});

		it('should install using an explicit transaction ID', async () => {
			const fromDirectoryStub = sinon.stub(Package, 'fromDirectory').withArgs({
				name: 'mycc',
				version: '0.0.1',
				path: 'mycc',
				type: undefined,
				metadataPath: undefined
			}).resolves(smartContractPackage);
			getTargetPeersStub.returns(['peer']);
			const request = {chaincodeId: 'mycc', chaincodeVersion: '0.0.1', chaincodePath: 'mycc', targets: [], channelNames: [], txId: {isAdmin: isAdminStub, getNonce: getNonceStub, getTransactionID: getTransactionIDStub}};
			const response = await client.installChaincode(request);
			sinon.assert.calledWith(getTargetPeersStub, []);
			sinon.assert.calledOnce(fromDirectoryStub);
			sinon.assert.calledWith(_getSigningIdentityStub, true);
			sinon.assert.calledWith(buildChannelHeaderStub, 'ENDORSER_TRANSACITON', '', 'txId', null, 'lscc');
			sinon.assert.calledWith(buildHeaderStub, 'signer', 'channel-header', 'nonce');
			sinon.assert.calledWith(buildProposalStub, {
				chaincode_id: {name: 'lscc'},
				input: {args: [Buffer.from('install', 'utf8'), smartContractPackageBytes]},
				type: 'go'
			}, 'header');
			sinon.assert.calledWith(signProposalStub, 'signer', 'proposal');
			sinon.assert.calledWith(sendPeersProposalStub, ['peer'], 'signed-proposal', undefined);
			response.should.deep.equal([['response'], 'proposal']);
		});

		it('should install using the specified target peers', async () => {
			const fromDirectoryStub = sinon.stub(Package, 'fromDirectory').withArgs({
				name: 'mycc',
				version: '0.0.1',
				path: 'mycc',
				type: undefined,
				metadataPath: undefined
			}).resolves(smartContractPackage);
			getTargetPeersStub.returns(['peer']);
			const request = {chaincodeId: 'mycc', chaincodeVersion: '0.0.1', chaincodePath: 'mycc', targets: [], channelNames: [], txId: {isAdmin: isAdminStub, getNonce: getNonceStub, getTransactionID: getTransactionIDStub}};
			const response = await client.installChaincode(request);
			sinon.assert.calledWith(getTargetPeersStub, []);
			sinon.assert.calledOnce(fromDirectoryStub);
			sinon.assert.calledWith(_getSigningIdentityStub, true);
			sinon.assert.calledWith(buildChannelHeaderStub, 'ENDORSER_TRANSACITON', '', 'txId', null, 'lscc');
			sinon.assert.calledWith(buildHeaderStub, 'signer', 'channel-header', 'nonce');
			sinon.assert.calledWith(buildProposalStub, {
				chaincode_id: {name: 'lscc'},
				input: {args: [Buffer.from('install', 'utf8'), smartContractPackageBytes]},
				type: 'go'
			}, 'header');
			sinon.assert.calledWith(signProposalStub, 'signer', 'proposal');
			sinon.assert.calledWith(sendPeersProposalStub, ['peer'], 'signed-proposal', undefined);
			response.should.deep.equal([['response'], 'proposal']);
		});

		it('should install using the peers discovered for the channel', async () => {
			const fromDirectoryStub = sinon.stub(Package, 'fromDirectory').withArgs({
				name: 'mycc',
				version: '0.0.1',
				path: 'mycc',
				type: undefined,
				metadataPath: undefined
			}).resolves(smartContractPackage);
			getTargetPeersStub.returns();
			getPeersForOrgOnChannelStub.withArgs(['mychannel']).returns(['peer']);
			const request = {chaincodeId: 'mycc', chaincodeVersion: '0.0.1', chaincodePath: 'mycc', channelNames: ['mychannel']};
			const response = await client.installChaincode(request);
			sinon.assert.calledWith(getTargetPeersStub, undefined);
			sinon.assert.calledOnce(fromDirectoryStub);
			sinon.assert.calledWith(translateCCTypeStub, undefined);
			sinon.assert.calledWith(_getSigningIdentityStub, true);
			sinon.assert.calledWith(buildChannelHeaderStub, 'ENDORSER_TRANSACITON', '', 'txId', null, 'lscc');
			sinon.assert.calledWith(buildHeaderStub, 'signer', 'channel-header', 'nonce');
			sinon.assert.calledWith(buildProposalStub, {
				chaincode_id: {name: 'lscc'},
				input: {args: [Buffer.from('install', 'utf8'), smartContractPackageBytes]},
				type: 'go'
			}, 'header');
			sinon.assert.calledWith(signProposalStub, 'signer', 'proposal');
			sinon.assert.calledWith(sendPeersProposalStub, ['peer'], 'signed-proposal', undefined);
			response.should.deep.equal([['response'], 'proposal']);
		});
	});

	describe('#initCredentialStores', () => {
		let getClientConfigStub;
		let newDefaultKeyValueStoreStub;
		let setStateStoreStub;
		let cryptoSuiteStub;
		let setCryptoKeyStoreStub;
		let newCryptoKeyStoreStub;
		let setCryptoSuiteStub;

		let client;
		beforeEach(() => {
			getClientConfigStub = sinon.stub();
			newDefaultKeyValueStoreStub = sinon.stub().returns(Promise.resolve('key-val-store'));
			revert.push(Client.__set__('BaseClient.newDefaultKeyValueStore', newDefaultKeyValueStoreStub));
			setStateStoreStub = sinon.stub();
			setCryptoKeyStoreStub = sinon.stub();
			cryptoSuiteStub = sinon.stub().returns({setCryptoKeyStore: setCryptoKeyStoreStub});
			revert.push(Client.__set__('BaseClient.newCryptoSuite', cryptoSuiteStub));
			newCryptoKeyStoreStub = sinon.stub();
			revert.push(Client.__set__('BaseClient.newCryptoKeyStore', newCryptoKeyStoreStub));
			setCryptoSuiteStub = sinon.stub();

			client = new Client();
			client.setStateStore = setStateStoreStub;
			client.setCryptoSuite = setCryptoSuiteStub;
		});

		it('should throw an error if no _network_config is present', async () => {
			client._network_config = null;
			try {
				await client.initCredentialStores();
				should.fail();
			} catch (err) {
				err.message.should.equal('No common connection profile settings found');
			}
		});

		it('should throw an error if no client config is returned', async () => {
			client._network_config = {getClientConfig: getClientConfigStub};
			try {
				await client.initCredentialStores();
				should.fail();
			} catch (err) {
				err.message.should.equal('No credentialStore settings found');
			}
		});

		it('should return true and set the cryptokeystore', async () => {
			getClientConfigStub.returns({credentialStore: {cryptoStore: 'store'}});
			client._network_config = {getClientConfig: getClientConfigStub};
			newCryptoKeyStoreStub.returns('new-crypto');
			const success = await client.initCredentialStores();
			success.should.be.true;
			sinon.assert.called(getClientConfigStub);
			sinon.assert.calledWith(newDefaultKeyValueStoreStub, {cryptoStore: 'store'});
			sinon.assert.calledWith(setStateStoreStub, 'key-val-store');
			sinon.assert.called(cryptoSuiteStub);
			sinon.assert.calledWith(setCryptoKeyStoreStub, 'new-crypto');
			sinon.assert.calledWith(newCryptoKeyStoreStub, 'store');
			sinon.assert.calledWith(setCryptoSuiteStub, {setCryptoKeyStore: setCryptoKeyStoreStub});

		});
	});

	describe('#setStateStore', () => {
		let getClassMethodsStub;

		let client;
		beforeEach(() => {
			getClassMethodsStub = ['method'];
			revert.push(Client.__set__('sdkUtils.getClassMethods', () => getClassMethodsStub));
			revert.push(Client.__set__('api.KeyValueStore', 'kvs'));

			client = new Client();
		});

		it('should thow an error if a class method in keyValueStore is not a function', () => {
			(() => {
				client.setStateStore({});
			}).should.throw('The "keyValueStore" parameter must be an object that implements the following methods, which are missing: method()');
		});

		it('should set _stateStore and _userContext properties', () => {
			const kvs = {method: () => { }};
			client.setStateStore(kvs);
			client._stateStore.should.equal(kvs);
			should.equal(client._userContext, null);
		});
	});

	describe('#_getSigningIdentity', () => {
		let getSigningIdentityStub;

		let client;
		beforeEach(() => {
			getSigningIdentityStub = sinon.stub();
			client = new Client();
		});

		it('should throw an error if not admin identity and no user context present', () => {
			(() => {
				client._getSigningIdentity();
			}).should.throw('No identity has been assigned to this client');
		});

		it('should reutrn the admin identity', () => {
			client._adminSigningIdentity = 'admin-identity';
			const signingIdentity = client._getSigningIdentity(true);
			signingIdentity.should.equal('admin-identity');
		});

		it('should return the users signing identify', () => {
			client._userContext = {getSigningIdentity: getSigningIdentityStub};
			getSigningIdentityStub.returns('admin-identity');
			const signingIdentity = client._getSigningIdentity(true);
			signingIdentity.should.equal('admin-identity');
			sinon.assert.called(getSigningIdentityStub);
		});
	});

	describe('#setAdminSigningIdentity', () => {
		let getCryptoSuiteStub;
		let newCryptoSuiteStub;
		let importKeyStub;
		let SigningIdentityStub;
		let SignerStub;

		let client;
		beforeEach(() => {
			getCryptoSuiteStub = sinon.stub();
			importKeyStub = sinon.stub();
			newCryptoSuiteStub = sinon.stub().returns({importKey: importKeyStub});
			revert.push(Client.__set__('BaseClient.newCryptoSuite', newCryptoSuiteStub));
			SigningIdentityStub = sinon.stub();
			revert.push(Client.__set__('SigningIdentity', SigningIdentityStub));
			SignerStub = sinon.stub();
			revert.push(Client.__set__('Signer', SignerStub));

			client = new Client();
			client.getCryptoSuite = getCryptoSuiteStub;
		});

		it('should throw if no private key is given', () => {
			(() => {
				client.setAdminSigningIdentity(undefined, 'certificate', 'mspid');
			}).should.throw('Invalid parameter. Must have a valid private key.');
		});

		it('should throw if private key is null', () => {
			(() => {
				client.setAdminSigningIdentity(null, 'certificate', 'mspid');
			}).should.throw('Invalid parameter. Must have a valid private key.');
		});

		it('should throw if private key is empty string', () => {
			(() => {
				client.setAdminSigningIdentity('', 'certificate', 'mspid');
			}).should.throw('Invalid parameter. Must have a valid private key.');
		});

		it('should throw if no certificate key is given', () => {
			(() => {
				client.setAdminSigningIdentity('private-key', undefined, 'mspid');
			}).should.throw('Invalid parameter. Must have a valid certificate.');
		});

		it('should throw if certificate is null', () => {
			(() => {
				client.setAdminSigningIdentity('private-key', null, 'mspid');
			}).should.throw('Invalid parameter. Must have a valid certificate.');
		});

		it('should throw if certificate is empty string', () => {
			(() => {
				client.setAdminSigningIdentity('private-key', '', 'mspid');
			}).should.throw('Invalid parameter. Must have a valid certificate.');
		});

		it('should throw if no mspid is given', () => {
			(() => {
				client.setAdminSigningIdentity('private-key', 'certificate', undefined);
			}).should.throw('Invalid parameter. Must have a valid mspid.');
		});

		it('should throw if certificate is null', () => {
			(() => {
				client.setAdminSigningIdentity('private-key', 'certificate', null);
			}).should.throw('Invalid parameter. Must have a valid mspid.');
		});

		it('should throw if certificate is empty string', () => {
			(() => {
				client.setAdminSigningIdentity('private-key', 'certificate', '');
			}).should.throw('Invalid parameter. Must have a valid mspid.');
		});

		it('should retrieve CryptoSuite and import the public and private keys before creating an identity', () => {
			getCryptoSuiteStub.returns({importKey: importKeyStub});
			importKeyStub.onCall(0).returns('private_key');
			importKeyStub.onCall(1).returns('public_key');
			client.setAdminSigningIdentity('private-key', 'certificate', 'mspid');
			sinon.assert.called(getCryptoSuiteStub);
			sinon.assert.calledWith(importKeyStub, 'private-key', {ephemeral: true});
			sinon.assert.calledWith(importKeyStub, 'certificate', {ephemeral: true});
			sinon.assert.calledWith(SigningIdentityStub, 'certificate', 'public_key', 'mspid', getCryptoSuiteStub(), new SignerStub());
			sinon.assert.calledWith(SignerStub, getCryptoSuiteStub(), 'private_key');
			client._adminSigningIdentity.should.deep.equal(new SigningIdentityStub());
		});

		it('should create a new CryptoSuite and import the public and private keys before creating an identity', () => {
			importKeyStub.onCall(0).returns('private_key');
			importKeyStub.onCall(1).returns('public_key');
			client.setAdminSigningIdentity('private-key', 'certificate', 'mspid');
			sinon.assert.calledWith(importKeyStub, 'private-key', {ephemeral: true});
			sinon.assert.calledWith(importKeyStub, 'certificate', {ephemeral: true});
			sinon.assert.calledWith(SigningIdentityStub, 'certificate', 'public_key', 'mspid', newCryptoSuiteStub(), new SignerStub());
			sinon.assert.calledWith(SignerStub, newCryptoSuiteStub(), 'private_key');
			client._adminSigningIdentity.should.deep.equal(new SigningIdentityStub());
		});
	});

	describe('#_setAdminFromConfig', () => {
		let getClientConfigStub;
		let getOrganizationStub;
		let getMspidStub;
		let getAdminPrivateKeyStub;
		let getAdminCertStub;
		let getAdminSigningIdentityStub;

		let client;
		beforeEach(() => {
			getClientConfigStub = sinon.stub();
			getMspidStub = sinon.stub().returns('mspid');
			getAdminPrivateKeyStub = sinon.stub().returns('admin-private-key');
			getAdminCertStub = sinon.stub().returns('admin-cert');
			getAdminSigningIdentityStub = sinon.stub();
			getOrganizationStub = sinon.stub().returns({
				getMspid: getMspidStub,
				getAdminPrivateKey: getAdminPrivateKeyStub,
				getAdminCert: getAdminCertStub
			});

			client = new Client();
			client.setAdminSigningIdentity = getAdminSigningIdentityStub;
		});

		it('should throw an error if no network config is present', () => {
			(() => {
				client._setAdminFromConfig();
			}).should.throw('No common connection profile has been loaded');
		});

		it('should not call anything if client config is null', () => {
			getClientConfigStub.returns(null);
			client._network_config = {getClientConfig: getClientConfigStub};
			client._setAdminFromConfig();
			sinon.assert.notCalled(getOrganizationStub);
			sinon.assert.notCalled(getMspidStub);
			sinon.assert.notCalled(getAdminPrivateKeyStub);
			sinon.assert.notCalled(getAdminCertStub);
			sinon.assert.notCalled(getAdminSigningIdentityStub);
		});

		it('should attempt to retrieve organization info', () => {
			getOrganizationStub.returns(null);
			getClientConfigStub.returns({organization: {}});
			client._network_config = {getClientConfig: getClientConfigStub, getOrganization: getOrganizationStub};
			client._setAdminFromConfig();
			sinon.assert.calledWith(getOrganizationStub, {});
			sinon.assert.notCalled(getMspidStub);
			sinon.assert.notCalled(getAdminPrivateKeyStub);
			sinon.assert.notCalled(getAdminCertStub);
			sinon.assert.notCalled(getAdminSigningIdentityStub);
		});

		it('should retrieve organization info and call setAdmnSigningIdentity with it', () => {
			getClientConfigStub.returns({organization: {}});
			client._network_config = {getClientConfig: getClientConfigStub, getOrganization: getOrganizationStub};
			client._setAdminFromConfig();
			sinon.assert.calledWith(getOrganizationStub, {});
			sinon.assert.called(getMspidStub);
			sinon.assert.called(getAdminPrivateKeyStub);
			sinon.assert.called(getAdminCertStub);
			sinon.assert.calledWith(getAdminSigningIdentityStub, 'admin-private-key', 'admin-cert', 'mspid');
		});
	});

	describe('#_setMspidFromConfig', () => {
		let getClientConfigStub;
		let getOrganizationStub;
		let getMspidStub;

		let client;
		beforeEach(() => {
			getClientConfigStub = sinon.stub();
			getOrganizationStub = sinon.stub();
			getMspidStub = sinon.stub();

			client = new Client();
		});

		it('should throw if network config is not found', () => {
			(() => {
				client._setMspidFromConfig();
			}).should.throw('No common connection profile has been loaded');
		});

		it('should call nothing if getClientConfig returns nothing', () => {
			client._network_config = {getClientConfig: getClientConfigStub};
			client._setMspidFromConfig();
			sinon.assert.called(getClientConfigStub);
			sinon.assert.notCalled(getOrganizationStub);
			sinon.assert.notCalled(getMspidStub);
			should.not.exist(client._mspid);
		});

		it('should call nothing if getOrganization returns nothing', () => {
			getClientConfigStub.returns({organization: {}});
			client._network_config = {getClientConfig: getClientConfigStub, getOrganization: getOrganizationStub};
			client._setMspidFromConfig();
			sinon.assert.called(getClientConfigStub);
			sinon.assert.calledWith(getOrganizationStub, {}, true);
			sinon.assert.notCalled(getMspidStub);
			should.not.exist(client._mspid);
		});

		it('should set _mspid', () => {
			getClientConfigStub.returns({organization: {}});
			getOrganizationStub.returns({getMspid: getMspidStub.returns(1)});
			client._network_config = {getClientConfig: getClientConfigStub, getOrganization: getOrganizationStub};
			client._setMspidFromConfig();
			sinon.assert.called(getClientConfigStub);
			sinon.assert.calledWith(getOrganizationStub, {}, true);
			sinon.assert.called(getMspidStub);
			client.getMspid().should.equal(1);
		});
	});

	describe('#_addConnectionOptionsFromConfig', () => {
		let getClientConfigStub;

		let client;
		beforeEach(() => {
			getClientConfigStub = sinon.stub();

			client = new Client();
		});

		it('should throw if network config is not found', () => {
			(() => {
				client._addConnectionOptionsFromConfig();
			}).should.throw('No common connection profile has been loaded');
		});

		it('should call nothing if getClientConfig returns nothing', () => {
			client._network_config = {getClientConfig: getClientConfigStub};
			client._addConnectionOptionsFromConfig();
			sinon.assert.called(getClientConfigStub);
			should.exist(client._connection_options);
		});

		it('should set _connection_options', () => {
			getClientConfigStub.returns({connection: {options: {'some': 1}}});
			client._network_config = {getClientConfig: getClientConfigStub};
			client._addConnectionOptionsFromConfig();
			sinon.assert.called(getClientConfigStub);
			client._connection_options.some.should.equal(1);
		});
	});

	describe('#_setUserFromConfig', () => {
		let getUserContextStub;
		let isEnrolledStub;
		let getClientConfigStub;
		let getOrganizationStub;
		let getMspidStub;
		let getCertificateAuthorityStub;
		let enrollStub;
		let createUserStub;

		let client;
		beforeEach(() => {
			getUserContextStub = sinon.stub();
			isEnrolledStub = sinon.stub();
			getClientConfigStub = sinon.stub();
			getOrganizationStub = sinon.stub();
			getMspidStub = sinon.stub();
			getCertificateAuthorityStub = sinon.stub();
			enrollStub = sinon.stub();
			createUserStub = sinon.stub();

			client = new Client();
			client.getUserContext = getUserContextStub;
			client.getCertificateAuthority = getCertificateAuthorityStub.returns({enroll: enrollStub});
			client.createUser = createUserStub;
		});

		it('should throw an error if no username option is given', async () => {
			return await client._setUserFromConfig()
				.should.eventually.be.rejectedWith('Missing parameter. Must have a username.');
		});

		it('should throw if _network_config not set', async () => {
			return await client._setUserFromConfig({username: 'test'})
				.should.be.rejectedWith('Client requires a common connection profile loaded, stores attached, and crypto suite.');
		});

		it('should throw if _stateStore not set', async () => {
			client._network_config = {};
			return await client._setUserFromConfig({username: 'test'})
				.should.be.rejectedWith('Client requires a common connection profile loaded, stores attached, and crypto suite.');
		});

		it('should throw if _cryptoSuite not set', async () => {
			client._network_config = {};
			client._stateStore = {};
			return await client._setUserFromConfig({username: 'test'})
				.should.be.rejectedWith('Client requires a common connection profile loaded, stores attached, and crypto suite.');
		});

		it('should return the user', async () => {
			getUserContextStub.returns({isEnrolled: isEnrolledStub.returns(true)});
			client._network_config = {};
			client._stateStore = {};
			client._cryptoSuite = {};
			const user = await client._setUserFromConfig({username: 'test'});
			user.should.deep.equal({isEnrolled: isEnrolledStub});
			sinon.assert.calledWith(getUserContextStub, 'test', true);
			sinon.assert.called(isEnrolledStub);
			sinon.assert.calledWith(FakeLogger.debug, 'Successfully loaded member from persistence');
		});

		it('should throw an error if user is not enrolled and no password is given', async () => {
			getUserContextStub.returns({isEnrolled: isEnrolledStub.returns(false)});
			client._network_config = {};
			client._stateStore = {};
			client._cryptoSuite = {};
			await client._setUserFromConfig({username: 'test'})
				.should.be.eventually.rejectedWith('Missing parameter. Must have a password.');
			sinon.assert.calledWith(getUserContextStub, 'test', true);
			sinon.assert.called(isEnrolledStub);
		});

		it('should throw an error if no client config is found', async () => {
			getUserContextStub.returns({isEnrolled: isEnrolledStub.returns(false)});
			client._network_config = {getClientConfig: getClientConfigStub};
			client._stateStore = {};
			client._cryptoSuite = {};
			await client._setUserFromConfig({username: 'test', password: 'password'})
				.should.be.eventually.rejectedWith('Common connection profile is missing this client\'s organization and mspid');
			sinon.assert.calledWith(getUserContextStub, 'test', true);
			sinon.assert.called(isEnrolledStub);
			sinon.assert.called(getClientConfigStub);
		});

		it('should throw an error if no organization config is found', async () => {
			getUserContextStub.returns({isEnrolled: isEnrolledStub.returns(false)});
			getClientConfigStub.returns({organization: true});
			client._network_config = {getClientConfig: getClientConfigStub, getOrganization: getOrganizationStub};
			client._stateStore = {};
			client._cryptoSuite = {};
			await client._setUserFromConfig({username: 'test', password: 'password'})
				.should.be.eventually.rejectedWith('Common connection profile is missing this client\'s organization and mspid');
			sinon.assert.calledWith(getUserContextStub, 'test', true);
			sinon.assert.called(isEnrolledStub);
			sinon.assert.called(getClientConfigStub);
			sinon.assert.called(getOrganizationStub);
		});

		it('should create a user when private key is accessible', async () => {
			getUserContextStub.returns({isEnrolled: isEnrolledStub.returns(false)});
			getClientConfigStub.returns({organization: true});
			createUserStub.returns('user');
			client._network_config = {
				getClientConfig: getClientConfigStub,
				getOrganization: getOrganizationStub.returns({getMspid: getMspidStub.returns(1)})
			};
			client._stateStore = {};
			client._cryptoSuite = {};
			enrollStub.returns({key: 'key', certificate: 'cert'});

			const user = await client._setUserFromConfig({username: 'test', password: 'password', caName: 'ca'});
			sinon.assert.calledWith(getUserContextStub, 'test', true);
			sinon.assert.called(isEnrolledStub);
			sinon.assert.called(getClientConfigStub);
			sinon.assert.called(getOrganizationStub);
			sinon.assert.called(getMspidStub);
			sinon.assert.calledWith(getCertificateAuthorityStub, 'ca');
			sinon.assert.calledWith(FakeLogger.debug, 'Successfully enrolled user "test"');
			sinon.assert.calledWith(createUserStub, {username: 'test', mspid: 1, cryptoContent: {privateKeyObj: 'key', signedCertPEM: 'cert'}});
			user.should.equal('user');
		});

		it('should create a user when private key is not accessible', async () => {
			getUserContextStub.returns({isEnrolled: isEnrolledStub.returns(false)});
			getClientConfigStub.returns({organization: true});
			createUserStub.returns('user');
			client._network_config = {
				getClientConfig: getClientConfigStub,
				getOrganization: getOrganizationStub.returns({getMspid: getMspidStub.returns(1)})
			};
			client._stateStore = {};
			client._cryptoSuite = {};
			enrollStub.returns({key: {toBytes: () => {
				throw new Error();
			}}, certificate: 'cert'});

			const user = await client._setUserFromConfig({username: 'test', password: 'password', caName: 'ca'});
			sinon.assert.calledWith(getUserContextStub, 'test', true);
			sinon.assert.called(isEnrolledStub);
			sinon.assert.called(getClientConfigStub);
			sinon.assert.called(getOrganizationStub);
			sinon.assert.called(getMspidStub);
			sinon.assert.calledWith(getCertificateAuthorityStub, 'ca');
			sinon.assert.calledWith(FakeLogger.debug, 'Successfully enrolled user "test"');
			sinon.assert.calledWith(FakeLogger.debug, 'Cannot access enrollment private key bytes');
			sinon.assert.calledWith(createUserStub, {username: 'test', mspid: 1, cryptoContent: {privateKeyObj: enrollStub().key, signedCertPEM: 'cert'}});
			user.should.equal('user');
		});

		it('should create a user when private key is not accessible and whos key is valid', async () => {
			getUserContextStub.returns({isEnrolled: isEnrolledStub.returns(false)});
			getClientConfigStub.returns({organization: true});
			createUserStub.returns('user');
			client._network_config = {
				getClientConfig: getClientConfigStub,
				getOrganization: getOrganizationStub.returns({getMspid: getMspidStub.returns(1)})
			};
			client._stateStore = {};
			client._cryptoSuite = {};
			enrollStub.returns({key: {toBytes: () => '-----BEGIN'}, certificate: 'cert'});

			const user = await client._setUserFromConfig({username: 'test', password: 'password', caName: 'ca'});
			sinon.assert.calledWith(getUserContextStub, 'test', true);
			sinon.assert.called(isEnrolledStub);
			sinon.assert.called(getClientConfigStub);
			sinon.assert.called(getOrganizationStub);
			sinon.assert.called(getMspidStub);
			sinon.assert.calledWith(getCertificateAuthorityStub, 'ca');
			sinon.assert.calledWith(FakeLogger.debug, 'Successfully enrolled user "test"');
			sinon.assert.calledWith(createUserStub, {username: 'test', mspid: 1, cryptoContent: {privateKeyPEM: '-----BEGIN', signedCertPEM: 'cert'}});
			user.should.equal('user');
		});
	});

	describe('#saveUserToStateStore', () => {
		let setValueStub;

		let client;
		beforeEach(() => {
			setValueStub = sinon.stub();

			client = new Client();
		});

		it('should throw if no _userContext found', async () => {
			await client.saveUserToStateStore()
				.should.eventually.be.rejectedWith('Cannot save user to state store when userContext is null');
			sinon.assert.calledWith(FakeLogger.debug, 'saveUserToStateStore, userContext: null');
			sinon.assert.calledWith(FakeLogger.debug, 'saveUserToStateStore Promise rejected, Cannot save user to state store when userContext is null.');
		});

		it('should throw if _userContext.name is not found', async () => {
			client._userContext = {};
			await client.saveUserToStateStore()
				.should.eventually.be.rejectedWith('Cannot save user to state store when userContext has no name.');
			sinon.assert.calledWith(FakeLogger.debug, 'saveUserToStateStore Promise rejected, Cannot save user to state store when userContext has no name.');
		});

		it('should throw if _stateStore is not found', async () => {
			client._userContext = {_name: 'name'};
			await client.saveUserToStateStore()
				.should.eventually.be.rejectedWith('Cannot save user to state store when stateStore is null.');
			sinon.assert.calledWith(FakeLogger.debug, 'saveUserToStateStore Promise rejected, Cannot save user to state store when stateStore is null.');
		});

		it('should return the user context', async () => {
			client._userContext = {_name: 'name'};
			client._stateStore = {setValue: setValueStub.returns(Promise.resolve('result'))};
			const userContext = await client.saveUserToStateStore();
			sinon.assert.calledWith(FakeLogger.debug, 'saveUserToStateStore, begin promise stateStore.setValue');
			sinon.assert.calledWith(FakeLogger.debug, 'saveUserToStateStore, store.setValue, result = result');
			userContext.should.equal(client._userContext);
		});
	});

	describe('#setUserContext', () => {
		let saveUserToStateStoreStub;
		let _setUserFromConfigStub;

		let client;
		beforeEach(() => {
			saveUserToStateStoreStub = sinon.stub();
			_setUserFromConfigStub = sinon.stub();

			client = new Client();
			client.saveUserToStateStore = saveUserToStateStoreStub;
			client._setUserFromConfig = _setUserFromConfigStub;
		});

		it('should throw an error if user is not set', async () => {
			await client.setUserContext()
				.should.eventually.be.rejectedWith('Cannot save null userContext.');

			sinon.assert.calledWith(FakeLogger.debug, 'setUserContext - user: undefined, skipPersistence: undefined');
			sinon.assert.calledWith(FakeLogger.debug, 'setUserContext, Cannot save null userContext.');
		});

		it('should save the user to the state store and return it', async () => {
			saveUserToStateStoreStub.returns('user');
			const user = await client.setUserContext(new User({name: 'user'}), false);
			sinon.assert.calledWithMatch(FakeLogger.debug, /setUserContext - user: .+, skipPersistence: false/);
			sinon.assert.calledWith(FakeLogger.debug, 'setUserContext - begin promise to saveUserToStateStore');
			sinon.assert.called(saveUserToStateStoreStub);
			user.should.equal('user');
		});

		it('should return the saved user', async () => {
			saveUserToStateStoreStub.returns('user');
			const newUser = new User({name: 'user'});
			const user = await client.setUserContext(newUser, true);
			sinon.assert.calledWithMatch(FakeLogger.debug, /setUserContext - user: .+, skipPersistence: true/);
			sinon.assert.calledWith(FakeLogger.debug, 'setUserContext - resolved user');
			user.should.equal(newUser);
		});

		it('should return the unsaved user', async () => {
			_setUserFromConfigStub.returns('user');
			const newUser = {username: 'test'};
			const user = await client.setUserContext(newUser, true);
			sinon.assert.calledWithMatch(FakeLogger.debug, /setUserContext - user: .+, skipPersistence: true/);
			sinon.assert.calledWith(FakeLogger.debug, 'setUserContext - will try to use common connection profile to set the user');
			sinon.assert.calledWith(_setUserFromConfigStub, newUser);
			user.should.equal('user');
		});
	});

	describe('#getUserContext', () => {
		let getNameStub;
		let loadUserFromStateStoreStub;
		let setUserContextStub;

		let client;
		beforeEach(() => {
			getNameStub = sinon.stub();
			loadUserFromStateStoreStub = sinon.stub();
			setUserContextStub = sinon.stub();
			client = new Client();
			client.loadUserFromStateStore = loadUserFromStateStoreStub;
			client.setUserContext = setUserContextStub;
		});

		it('should throw an error if name is undefined and checkPersistence is truthy', async () => {
			await client.getUserContext(true, undefined)
				.should.eventually.be.rejectedWith('Illegal arguments: "checkPersistence" is truthy but "name" is undefined');
		});

		it('should throw an error if checkPersistence truthy and name invalid', async () => {
			await client.getUserContext(true, true)
				.should.eventually.be.rejectedWith('Illegal arguments: "checkPersistence" is truthy but "name" is not a valid string value');
		});

		it('should throw an error if checkPersistence truthy and name invalid', async () => {
			await client.getUserContext(null, true)
				.should.eventually.be.rejectedWith('Illegal arguments: "checkPersistence" is truthy but "name" is not a valid string value');
		});

		it('should throw an error if checkPersistence truthy and name invalid', async () => {
			await client.getUserContext('', true)
				.should.eventually.be.rejectedWith('Illegal arguments: "checkPersistence" is truthy but "name" is not a valid string value');
		});

		it('should throw an error if checkPersistence truthy and name invalid', async () => {
			const userContext = await client.getUserContext(undefined, undefined);
			should.equal(userContext, null);
		});

		it('should return _userContext if _userContext.getName returns value', async () => {
			getNameStub.returns('name');
			client._userContext = {getName: getNameStub};
			const userContext = await client.getUserContext('name');
			sinon.assert.called(getNameStub);
			userContext.should.equal(client._userContext);
		});

		it('should return _userContext if _userContext and name given', async () => {
			client._userContext = {getName: getNameStub};
			const userContext = await client.getUserContext();
			userContext.should.equal(client._userContext);
		});

		it('should return null if name is not set', async () => {
			getNameStub.returns('name');
			client._userContext = {getName: getNameStub};
			const userContext = await client.getUserContext('name');
			sinon.assert.called(getNameStub);
			userContext.should.equal(client._userContext);
		});

		it('should return null if _stateStore is null', async () => {
			getNameStub.returns('name');
			const userContext = await client.getUserContext('name', true);
			should.equal(userContext, null);
		});

		it('should return the retrieved user context', async () => {
			loadUserFromStateStoreStub.returns(Promise.resolve({}));
			getNameStub.returns('name');
			setUserContextStub.returns('userContext');
			client._stateStore = {};
			const userContext = await client.getUserContext('name', true);
			sinon.assert.calledWith(loadUserFromStateStoreStub, 'name');
			sinon.assert.calledWith(setUserContextStub, {}, true);
			userContext.should.equal('userContext');
		});

		it('should return null when user context not found', async () => {
			loadUserFromStateStoreStub.returns(Promise.resolve(null));
			getNameStub.returns('name');
			setUserContextStub.returns('userContext');
			client._stateStore = {};
			const userContext = await client.getUserContext('name', true);
			sinon.assert.calledWith(loadUserFromStateStoreStub, 'name');
			should.equal(userContext, null);
		});


		it('should return null when checkPersistence is not a boolean', async () => {
			loadUserFromStateStoreStub.returns(Promise.resolve(null));
			getNameStub.returns('name');
			setUserContextStub.returns('userContext');
			client._stateStore = {};
			const userContext = await client.getUserContext('name', 'lol');
			should.equal(userContext, null);
		});
	});

	describe('#loadUserFromStateStore', () => {
		const FakeUser = class { };
		let getValueStub;
		let getCryptoSuiteStub;
		let setCryptoSuiteStub;
		let fromStringStub;

		let client;
		beforeEach(() => {
			revert.push(Client.__set__('User', FakeUser));
			getValueStub = sinon.stub();
			getCryptoSuiteStub = sinon.stub();
			setCryptoSuiteStub = sinon.stub();
			fromStringStub = sinon.stub();

			FakeUser.prototype.fromString = fromStringStub;
			FakeUser.prototype.setCryptoSuite = setCryptoSuiteStub;

			client = new Client();
			client.getCryptoSuite = getCryptoSuiteStub;
			client.setCryptoSuite = setCryptoSuiteStub;
		});

		it('should return null if no memberStr found', async () => {
			client._stateStore = {getValue: getValueStub};
			const member = await client.loadUserFromStateStore('name');
			sinon.assert.calledWith(FakeLogger.debug, 'Failed to find "name" in local key value store');
			should.equal(member, null);
		});

		it('should return null if newUser to data returns nothing', async () => {
			fromStringStub.returns(Promise.resolve(null));
			client._stateStore = {getValue: getValueStub.returns('memberStr')};
			const member = await client.loadUserFromStateStore('name');
			sinon.assert.called(getCryptoSuiteStub);
			sinon.assert.calledWith(FakeLogger.debug, 'loadUserFromStateStore, cryptoSuite is not set, will load using defaults');
			sinon.assert.calledWith(fromStringStub, 'memberStr', true);
			sinon.assert.calledWith(FakeLogger.debug, 'Failed to load user "name" from local key value store');
			should.equal(member, null);
		});

		it('should return the user', async () => {
			fromStringStub.returns(Promise.resolve('user'));
			getCryptoSuiteStub.returns(true);
			client._stateStore = {getValue: getValueStub.returns('memberStr')};
			const member = await client.loadUserFromStateStore('name');
			sinon.assert.called(getCryptoSuiteStub);
			sinon.assert.calledWith(fromStringStub, 'memberStr', true);
			sinon.assert.calledWith(FakeLogger.debug, 'Successfully load user "name" from local key value store');
			member.should.equal('user');
		});
	});

	describe('#getStateStore', () => {
		it('should return the _stateStore', () => {
			const client = new Client();
			client._stateStore = 'stateStore';
			client.getStateStore().should.equal(client._stateStore);
		});
	});

	describe('#createUser', () => {
		let FakeUser;
		let userConstructorStub;
		let readFileStub;
		let getCryptoSuiteStub;
		let importKeyStub;
		let setCryptoSuiteStub;
		let setEnrollmentStub;
		let setUserContextStub;
		let setCryptoKeyStoreStub;

		let client;
		beforeEach(() => {
			userConstructorStub = sinon.stub();
			FakeUser = class { };
			setCryptoSuiteStub = sinon.stub();
			setEnrollmentStub = sinon.stub().returns(Promise.resolve());
			FakeUser.prototype.constructor = userConstructorStub;
			FakeUser.prototype.setCryptoSuite = setCryptoSuiteStub;
			FakeUser.prototype.setEnrollment = setEnrollmentStub;
			readFileStub = sinon.stub().returns(Promise.resolve(1));
			getCryptoSuiteStub = sinon.stub();
			importKeyStub = sinon.stub();
			setUserContextStub = sinon.stub().returns(Promise.resolve());
			setCryptoKeyStoreStub = sinon.stub();

			revert.push(Client.__set__('readFile', readFileStub));
			revert.push(Client.__set__('User', FakeUser));

			client = new Client();
			client.getCryptoSuite = getCryptoSuiteStub.returns({importKey: importKeyStub.returns(Promise.resolve('imported-key'))});
			client.setUserContext = setUserContextStub;
		});

		it('should throw an error if no opts are given', async () => {
			await client.createUser()
				.should.eventually.be.rejectedWith('Client.createUser missing required \'opts\' parameter.');
			sinon.assert.calledWith(FakeLogger.debug, 'opts = %j', undefined);
		});

		it('should throw an error if opts.username is not given', async () => {
			await client.createUser({})
				.should.eventually.be.rejectedWith('Client.createUser parameter \'opts username\' is required.');
			sinon.assert.calledWith(FakeLogger.debug, 'opts = %j', {});
		});

		it('should throw an error if opts.username is less than 1 character long', async () => {
			await client.createUser({username: ''})
				.should.eventually.be.rejectedWith('Client.createUser parameter \'opts username\' is required.');
			sinon.assert.calledWith(FakeLogger.debug, 'opts = %j', {username: ''});
		});

		it('should throw an error if opts.mspid is less than 1 character long', async () => {
			await client.createUser({username: 'name'})
				.should.eventually.be.rejectedWith('Client.createUser parameter \'opts mspid\' is required.');
			sinon.assert.calledWith(FakeLogger.debug, 'opts = %j', {username: 'name'});
		});

		it('should throw an error if opts.cryptoContent is not given', async () => {
			await client.createUser({username: 'name', mspid: '1'})
				.should.eventually.be.rejectedWith('Client.createUser parameter \'opts cryptoContent\' is required.');
			sinon.assert.calledWith(FakeLogger.debug, 'opts = %j', {username: 'name', mspid: '1'});
		});

		it('should throw an error if opts.cryptoContent.privateKey and privateKeyPEM are not given', async () => {
			await client.createUser({username: 'name', mspid: '1', cryptoContent: {}})
				.should.eventually.be.rejectedWith('Client.createUser one of \'opts cryptoContent privateKey, privateKeyPEM or privateKeyObj\' is required.');
			sinon.assert.calledWith(FakeLogger.debug, 'opts = %j', {username: 'name', mspid: '1', cryptoContent: {}});
		});

		it('should throw an error if opts.cryptoContent.privateKey, privateKeyPEM and privateKeyObj are not given', async () => {
			await client.createUser({username: 'name', mspid: '1', cryptoContent: {}})
				.should.eventually.be.rejectedWith('Client.createUser one of \'opts cryptoContent privateKey, privateKeyPEM or privateKeyObj\' is required.');
			sinon.assert.calledWith(FakeLogger.debug, 'opts = %j', {username: 'name', mspid: '1', cryptoContent: {}});
		});

		it('should throw an error if opts.cryptoContent.signedCert and signedCertPEM are not given', async () => {
			await client.createUser({username: 'name', mspid: '1', cryptoContent: {privateKey: 'private-key'}})
				.should.eventually.be.rejectedWith('Client.createUser either \'opts cryptoContent signedCert or signedCertPEM\' is required.');
			sinon.assert.calledWith(FakeLogger.debug, 'opts = %j', {username: 'name', mspid: '1', cryptoContent: {privateKey: 'private-key'}});
		});

		it('should return a user', async () => {
			readFileStub.returns(Promise.resolve('privateKeyPEM'));
			const user = await client.createUser({username: 'name', mspid: '1', cryptoContent: {privateKey: 'private-key', signedCert: 'signed-cert', signedCertPEM: 'signed-cert-PEM'}, skipPersistence: true});
			sinon.assert.calledWith(readFileStub, 'private-key');
			sinon.assert.calledWith(FakeLogger.debug, 'then privateKeyPEM data');
			sinon.assert.calledWith(readFileStub, 'signed-cert');
			sinon.assert.calledWith(FakeLogger.debug, 'then signedCertPEM data');
			sinon.assert.calledWith(setCryptoSuiteStub, getCryptoSuiteStub());
			sinon.assert.called(getCryptoSuiteStub);
			sinon.assert.calledWith(setEnrollmentStub, 'imported-key', 'privateKeyPEM', '1', true);
			sinon.assert.calledWith(FakeLogger.debug, 'then setUserContext');
			sinon.assert.calledWith(setUserContextStub, new FakeUser(), true);
			sinon.assert.calledWith(FakeLogger.debug, 'then user');
			user.should.deep.equal(new FakeUser());
		});

		it('should return a user if getCryptoSuite returns null', async () => {
			getCryptoSuiteStub.onCall(0).returns(null);
			getCryptoSuiteStub.onCall(1).returns({setCryptoKeyStore: setCryptoKeyStoreStub});
			readFileStub.returns(Promise.resolve('privateKeyPEM'));
			const user = await client.createUser({username: 'name', mspid: '1', cryptoContent: {privateKey: 'private-key', signedCert: 'signed-cert', signedCertPEM: 'signed-cert-PEM'}, skipPersistence: true});
			sinon.assert.calledWith(readFileStub, 'private-key');
			sinon.assert.calledWith(FakeLogger.debug, 'then privateKeyPEM data');
			sinon.assert.calledWith(readFileStub, 'signed-cert');
			sinon.assert.calledWith(FakeLogger.debug, 'then signedCertPEM data');
			sinon.assert.calledWith(setCryptoSuiteStub, getCryptoSuiteStub());
			sinon.assert.called(getCryptoSuiteStub);
			sinon.assert.calledWith(setEnrollmentStub, 'imported-key', 'privateKeyPEM', '1', true);
			sinon.assert.calledWith(FakeLogger.debug, 'then setUserContext');
			sinon.assert.calledWith(setUserContextStub, new FakeUser(), true);
			sinon.assert.calledWith(FakeLogger.debug, 'then user');
			user.should.deep.equal(new FakeUser());
		});

		it('should return a user if getCryptoSuite does not return null', async () => {
			getCryptoSuiteStub.returns({setCryptoKeyStore: setCryptoKeyStoreStub, importKey: importKeyStub, _cryptoKeyStore: {}});
			readFileStub.returns(Promise.resolve('privateKeyPEM'));
			const user = await client.createUser({username: 'name', mspid: '1', cryptoContent: {privateKey: 'private-key', signedCert: 'signed-cert', signedCertPEM: 'signed-cert-PEM'}, skipPersistence: true});
			sinon.assert.calledWith(readFileStub, 'private-key');
			sinon.assert.calledWith(FakeLogger.debug, 'then privateKeyPEM data');
			sinon.assert.calledWith(readFileStub, 'signed-cert');
			sinon.assert.calledWith(FakeLogger.debug, 'then signedCertPEM data');
			sinon.assert.calledWith(setCryptoSuiteStub, getCryptoSuiteStub());
			sinon.assert.called(getCryptoSuiteStub);
			sinon.assert.calledWith(FakeLogger.debug, 'cryptoSuite has a cryptoKeyStore');
			sinon.assert.calledWith(setEnrollmentStub, 'imported-key', 'privateKeyPEM', '1', true);
			sinon.assert.calledWith(FakeLogger.debug, 'then setUserContext');
			sinon.assert.calledWith(setUserContextStub, new FakeUser(), true);
			sinon.assert.calledWith(FakeLogger.debug, 'then user');
			user.should.deep.equal(new FakeUser());
		});

		it('should return a user if getCryptoSuite does not return null', async () => {
			getCryptoSuiteStub.returns({setCryptoKeyStore: setCryptoKeyStoreStub, importKey: importKeyStub, _cryptoKeyStore: {}});
			const user = await client.createUser({username: 'name', mspid: '1', cryptoContent: {privateKeyPEM: 'privateKeyPem', signedCert: 'signed-cert', signedCertPEM: 'signed-cert-PEM'}, skipPersistence: false});
			sinon.assert.calledWith(FakeLogger.debug, 'then privateKeyPEM data');
			sinon.assert.calledWith(readFileStub, 'signed-cert');
			sinon.assert.calledWith(FakeLogger.debug, 'then signedCertPEM data');
			sinon.assert.calledWith(setCryptoSuiteStub, getCryptoSuiteStub());
			sinon.assert.called(getCryptoSuiteStub);
			sinon.assert.calledWith(FakeLogger.debug, 'cryptoSuite has a cryptoKeyStore');
			sinon.assert.calledWith(setEnrollmentStub, 'imported-key', '1', '1', false);
			sinon.assert.calledWith(FakeLogger.debug, 'then setUserContext');
			sinon.assert.calledWith(setUserContextStub, new FakeUser(), false);
			sinon.assert.calledWith(FakeLogger.debug, 'then user');
			user.should.deep.equal(new FakeUser());
		});

		it('should return a user if getCryptoSuite does not return null', async () => {
			getCryptoSuiteStub.returns({setCryptoKeyStore: setCryptoKeyStoreStub, importKey: importKeyStub, _cryptoKeyStore: {}});
			readFileStub.onCall(0).returns(null);
			readFileStub.onCall(1).returns(123);
			const user = await client.createUser({username: 'name', mspid: '1', cryptoContent: {privateKey: 'private-key', signedCert: 'signed-cert', signedCertPEM: 'signed-cert-PEM'}, skipPersistence: false});
			sinon.assert.calledWith(readFileStub, 'signed-cert');
			sinon.assert.calledWith(FakeLogger.debug, 'then signedCertPEM data');
			sinon.assert.calledWith(setCryptoSuiteStub, getCryptoSuiteStub());
			sinon.assert.called(getCryptoSuiteStub);
			sinon.assert.calledWith(FakeLogger.debug, 'cryptoSuite has a cryptoKeyStore');
			sinon.assert.calledWith(FakeLogger.debug, 'then setUserContext');
			sinon.assert.calledWith(setUserContextStub, new FakeUser(), false);
			sinon.assert.calledWith(FakeLogger.debug, 'then user');
			user.should.deep.equal(new FakeUser());
		});

		it('should return a user if getCryptoSuite does not return null', async () => {
			getCryptoSuiteStub.returns({setCryptoKeyStore: setCryptoKeyStoreStub, importKey: importKeyStub, _cryptoKeyStore: {}});
			readFileStub.onCall(0).returns(null);
			readFileStub.onCall(1).returns(123);
			const user = await client.createUser({username: 'name', mspid: '1', cryptoContent: {privateKey: 'private-key', signedCertPEM: 'signed-cert-PEM'}, skipPersistence: false});
			sinon.assert.calledWith(readFileStub, 'private-key');
			sinon.assert.calledWith(FakeLogger.debug, 'then signedCertPEM data');
			sinon.assert.calledWith(setCryptoSuiteStub, getCryptoSuiteStub());
			sinon.assert.called(getCryptoSuiteStub);
			sinon.assert.calledWith(FakeLogger.debug, 'cryptoSuite has a cryptoKeyStore');
			sinon.assert.calledWith(FakeLogger.debug, 'then setUserContext');
			sinon.assert.calledWith(setUserContextStub, new FakeUser(), false);
			sinon.assert.calledWith(FakeLogger.debug, 'then user');
			user.should.deep.equal(new FakeUser());
		});
	});

	describe('#getTargetPeers', () => {
		let getPeerStub;
		const Peer = class { };

		let client;
		beforeEach(() => {
			getPeerStub = sinon.stub();
			client = new Client();
			client.getPeer = getPeerStub;
		});

		it('should throw an error if the target peer is empty object', () => {
			(() => {
				client.getTargetPeers({});
			}).should.throw('Target peer is not a valid peer object instance');
			sinon.assert.calledWith(FakeLogger.debug, '%s - start', 'getTargetPeers');
		});

		it('should return null if no targets are provided', () => {
			const peers = client.getTargetPeers();
			sinon.assert.calledWith(FakeLogger.debug, '%s - start', 'getTargetPeers');
			should.equal(peers, null);
		});

		it('should get the peer if peer names are given', () => {
			getPeerStub.onCall(0).returns('peer1-obj');
			getPeerStub.onCall(1).returns('peer2-obj');
			const peers = client.getTargetPeers(['peer1', 'peer2']);
			peers.should.deep.equal(['peer1-obj', 'peer2-obj']);
			sinon.assert.calledWith(FakeLogger.debug, '%s - start', 'getTargetPeers');
		});

		it('should return the peer if list of peer objects passed in', () => {
			const mockPeer = new Peer();
			const peers = client.getTargetPeers([mockPeer]);
			peers.should.deep.equal([mockPeer]);
			sinon.assert.calledWith(FakeLogger.debug, '%s - start', 'getTargetPeers');
		});
	});

	describe('#getTargetOrderer', () => {
		let getOrdererStub;
		let getChannelStub;
		let getOrderersStub;
		const Orderer = class { };

		let client;
		beforeEach(() => {
			getOrdererStub = sinon.stub();
			getChannelStub = sinon.stub();
			getOrderersStub = sinon.stub();

			client = new Client();
			client.getOrderer = getOrdererStub;
			client.getChannel = getChannelStub;
		});

		it('should throw an error if request_orderer is not given', () => {
			(() => {
				client.getTargetOrderer();
			}).should.throw('Missing "orderer" request parameter');
			sinon.assert.calledWith(FakeLogger.debug, '%s - start', 'getTargetOrderer');
		});

		it('should throw an error if request_orderer is not a string or instance of Orderer', () => {
			(() => {
				client.getTargetOrderer({});
			}).should.throw('"orderer" request parameter is not valid. Must be an orderer name or "Orderer" object.');
			sinon.assert.calledWith(FakeLogger.debug, '%s - start', 'getTargetOrderer');
		});

		it('should throw an error if no channel config is found', () => {
			client._network_config = {};
			getOrdererStub.returns('orderer1');
			(() => {
				client.getTargetOrderer(null, null, 'channel1');
			}).should.throw('Channel name channel1 was not found in the common connection profile');
			sinon.assert.calledWith(FakeLogger.debug, '%s - start', 'getTargetOrderer');
			sinon.assert.called(getChannelStub);
		});

		it('should throw an error if orderers arent found', () => {
			client._network_config = {};
			getChannelStub.returns({getOrderers: getOrderersStub});
			getOrdererStub.returns('orderer1');
			(() => {
				client.getTargetOrderer(null, null, 'channel1');
			}).should.throw('"orderer" request parameter is missing and there are no orderers defined on this channel in the common connection profile');
			sinon.assert.calledWith(FakeLogger.debug, '%s - start', 'getTargetOrderer');
			sinon.assert.called(getChannelStub);
			sinon.assert.called(getOrderersStub);
		});

		it('should return the orderer if orderer given as string', () => {
			getOrdererStub.returns('orderer1Obj');
			const orderers = client.getTargetOrderer('orderer1');
			sinon.assert.calledWith(getOrdererStub);
			orderers.should.equal('orderer1Obj');
		});

		it('should return the orderer if orderer is instance of Orderer', () => {
			const mockOrderer = new Orderer();
			const orderers = client.getTargetOrderer(mockOrderer);
			orderers.should.equal(mockOrderer);
		});

		it('should return channel orderer if request_orderers not given', () => {
			const orderers = client.getTargetOrderer(null, ['channel-orderer']);
			orderers.should.equal('channel-orderer');
		});

		it('should get a channel and return an orderer', () => {
			client._network_config = {};
			getOrderersStub.returns(['channel-orderer']);
			getChannelStub.returns({getOrderers: getOrderersStub});
			const orderers = client.getTargetOrderer(null, null, 'channel1');
			orderers.should.equal('channel-orderer');
		});
	});

	describe('#getClientCertHash', () => {
		let setTlsClientCertAndKeyStub;

		let client;
		beforeEach(() => {
			setTlsClientCertAndKeyStub = sinon.stub();
			client = new Client();
			client.setTlsClientCertAndKey = setTlsClientCertAndKeyStub;
		});

		it('should return the clientCertHash in client._tls_mutual', () => {
			client._tls_mutual = {clientCertHash: 'cert-hash'};
			client.getClientCertHash().should.equal('cert-hash');
			sinon.assert.calledWith(FakeLogger.debug, '%s - start', 'getClientCertHash');
		});

		it('should create a cert and key and return null', () => {
			const certHash = client.getClientCertHash(true);
			should.equal(certHash, undefined);
			sinon.assert.called(setTlsClientCertAndKeyStub);
			sinon.assert.calledWith(FakeLogger.debug, '%s - start', 'getClientCertHash');
			sinon.assert.calledWith(FakeLogger.debug, '%s - no tls client cert', 'getClientCertHash');
		});

		it('should create and return the cert hash', () => {
			const pemToDERStub = sinon.stub().returns('DER');
			const computeHashStub = sinon.stub().returns('cert-hash');
			revert.push(Client.__set__('sdkUtils.pemToDER', pemToDERStub));
			revert.push(Client.__set__('computeHash', computeHashStub));

			client._tls_mutual = {clientCert: 'client-cert'};
			const certHash = client.getClientCertHash();
			should.equal(certHash, 'cert-hash');
			sinon.assert.calledWith(FakeLogger.debug, '%s - start', 'getClientCertHash');
			sinon.assert.calledWith(FakeLogger.debug, '%s - using clientCert %s', 'getClientCertHash', 'client-cert');
		});
	});

	describe('#_buildConnectionOptions', () => {
		it('should contain option from original option', () => {
			const opts = {'clientCert': 'thing'};
			const client = new Client();
			client.setTlsClientCertAndKey('cert', 'key');
			const newOpts = client._buildConnectionOptions(opts);
			newOpts.clientCert.should.equal('thing');
		});

		it('should contain cert from tls', () => {
			const opts = {'some': 'thing'};
			const client = new Client();
			client.setTlsClientCertAndKey('cert', 'key');
			const newOpts = client._buildConnectionOptions(opts);
			newOpts.some.should.equal('thing');
			newOpts.clientCert.should.equal('cert');
		});

		it('should not override original option', () => {
			const opts = {'safe': 'thing'};
			const client = new Client();
			client.addConnectionOptions({'safe': 'other', 'hope': 'found'});
			const newOpts = client._buildConnectionOptions(opts);
			newOpts.safe.should.equal('thing');
			newOpts.hope.should.equal('found');
		});

		it('should call _buildConnectionOptions and return opts', () => {
			const client = new Client();
			const opts = client.getConfigSetting('connection-options');
			const newOpts = client._buildConnectionOptions(opts);
			newOpts.should.deep.equal(opts);
		});
	});

	describe('computeHash', () => {
		let computehash;
		before(() => {
			computehash = Client.__get__('computeHash');
		});

		it('should return then hash', () => {
			const digestStub = sinon.stub().returns('hash');
			const updateStub = sinon.stub().returns({digest: digestStub});
			const createHashStub = sinon.stub().returns({update: updateStub});
			const cryptoStub = {createHash: createHashStub};
			revert.push(Client.__set__('crypto', cryptoStub));
			const hash = computehash('data');
			sinon.assert.calledWith(createHashStub, 'sha256');
			sinon.assert.calledWith(updateStub, 'data');
			sinon.assert.called(digestStub);
			hash.should.equal('hash');
		});
	});

	describe('readFile', () => {
		let readFileStub;
		let readFile;
		before(() => {
			readFile = Client.__get__('readFile');
		});

		it('should reject with error', async () => {
			readFileStub = (path_, encoding, cb) => {
				cb({code: 'Error'});
			};
			revert.push(Client.__set__('fs', {readFile: readFileStub}));
			try {
				await readFile('file');
				should.fail();
			} catch (err) {
				err.should.deep.equal({code: 'Error'});
			}
		});

		it('should resolve with null', async () => {
			readFileStub = (path_, encoding, cb) => {
				cb({code: 'ENOENT'});
			};
			revert.push(Client.__set__('fs', {readFile: readFileStub}));
			const file = await readFile('file');
			should.equal(file, null);
		});

		it('should resolve with the data', async () => {
			readFileStub = (path_, encoding, cb) => {
				cb(null, 'data');
			};
			revert.push(Client.__set__('fs', {readFile: readFileStub}));
			const data = await readFile('file');
			data.should.equal('data');
		});
	});

	describe('_stringToSignature', () => {
		let bufferFromStub;
		let configSignatureDecodeStub;

		let _stringToSignature;
		before(() => {
			_stringToSignature = Client.__get__('_stringToSignature');
		});

		beforeEach(() => {
			bufferFromStub = sinon.stub();
			revert.push(Client.__set__('Buffer.from', bufferFromStub));
			configSignatureDecodeStub = sinon.stub();
			revert.push(Client.__set__('_configtxProto.ConfigSignature.decode', configSignatureDecodeStub));
		});

		it('should return an empty aray if no signatures are given', () => {
			const signatures = _stringToSignature([]);
			signatures.should.deep.equal([]);
		});

		it('should return a list of signatures if signature contains correct properties', () => {
			const mockSignature = {signature_header: 'header', signature: 'body'};
			const signatures = _stringToSignature([mockSignature]);
			sinon.assert.calledWith(FakeLogger.debug, '_stringToSignature - signature is protobuf');
			signatures.should.deep.equal([mockSignature]);
		});

		it('should return a list of signatures that have been decoded', () => {
			const mockSignature = 'signature';
			bufferFromStub.returns(mockSignature);
			configSignatureDecodeStub.returns(mockSignature);
			const signatures = _stringToSignature([mockSignature]);
			sinon.assert.calledWith(FakeLogger.debug, '_stringToSignature - signature is string');
			sinon.assert.calledWith(bufferFromStub, mockSignature, 'hex');
			sinon.assert.calledWith(configSignatureDecodeStub, mockSignature);
			signatures.should.deep.equal([mockSignature]);
		});
	});

	describe('_getNetworkConfig', () => {
		let requireStub;
		let getConfigSettingStub;
		let MockNetworkConfig;
		let readFileSyncStub;
		let safeLoadStub;

		let _getNetworkConfig;
		before(() => {
			_getNetworkConfig = Client.__get__('_getNetworkConfig');
		});

		beforeEach(() => {
			getConfigSettingStub = sinon.stub();
			revert.push(Client.__set__('Client.getConfigSetting', getConfigSettingStub));

			requireStub = sinon.stub();
			revert.push(Client.__set__('require', requireStub));
			MockNetworkConfig = sinon.stub();
			readFileSyncStub = sinon.stub();
			revert.push(Client.__set__('fs.readFileSync', readFileSyncStub));
			revert.push(Client.__set__('path.resolve', (v) => v));
			safeLoadStub = sinon.stub();
			revert.push(Client.__set__('yaml.safeLoad', safeLoadStub));
		});

		it('should throw an error if there is no configuration given', () => {
			(() => {
				_getNetworkConfig();
			}).should.throw(/missing configuration data/);
		});

		it('should throw if config.version is missing', () => {
			(() => {
				_getNetworkConfig({});
			}).should.throw(/"version" is missing/);
		});

		it('should throw if schema config is missing', () => {
			(() => {
				_getNetworkConfig({version: '1.0'});
			}).should.throw(/missing "network-config-schema" configuration setting/);
			sinon.assert.calledWith(getConfigSettingStub, 'network-config-schema');
		});

		it('should throw if schema config is missing', () => {
			getConfigSettingStub.returns({'2.0': 'network-config-file'});
			requireStub.returns(MockNetworkConfig);
			(() => {
				_getNetworkConfig({version: '1.0'});
			}).should.throw(/common connection profile has an unknown "version"/);
			sinon.assert.calledWith(getConfigSettingStub, 'network-config-schema');
		});

		it('should return the new network config when config is an object', () => {
			readFileSyncStub.returns('file-data');
			getConfigSettingStub.returns({'1.0': 'network-config-file'});
			requireStub.returns(MockNetworkConfig);
			MockNetworkConfig.returns('network-config');
			const networkConfig = _getNetworkConfig({version: '1.0'}, 'client');
			sinon.assert.calledWith(getConfigSettingStub, 'network-config-schema');
			sinon.assert.calledWith(requireStub, 'network-config-file');
			sinon.assert.calledWith(MockNetworkConfig, {version: '1.0'}, 'client');
			networkConfig.should.deep.equal(new MockNetworkConfig());
		});

		it('should return the new network config when config is a yaml file path', () => {
			readFileSyncStub.returns('file-data');
			safeLoadStub.returns({version: '1.0'});
			getConfigSettingStub.returns({'1.0': 'network-config-file'});
			requireStub.returns(MockNetworkConfig);
			MockNetworkConfig.returns('network-config');
			const networkConfig = _getNetworkConfig('config.yaml', 'client');
			sinon.assert.calledWith(getConfigSettingStub, 'network-config-schema');
			sinon.assert.calledWith(requireStub, 'network-config-file');
			sinon.assert.calledWith(MockNetworkConfig, {version: '1.0'}, 'client');
			sinon.assert.calledWith(readFileSyncStub, 'config.yaml');
			sinon.assert.calledWith(safeLoadStub, 'file-data');
			networkConfig.should.deep.equal(new MockNetworkConfig());
		});

		it('should return the new network config when config is a yml file path', () => {
			readFileSyncStub.returns('file-data');
			safeLoadStub.returns({version: '1.0'});
			getConfigSettingStub.returns({'1.0': 'network-config-file'});
			requireStub.returns(MockNetworkConfig);
			MockNetworkConfig.returns('network-config');
			const networkConfig = _getNetworkConfig('config.yml', 'client');
			sinon.assert.calledWith(getConfigSettingStub, 'network-config-schema');
			sinon.assert.calledWith(requireStub, 'network-config-file');
			sinon.assert.calledWith(MockNetworkConfig, {version: '1.0'}, 'client');
			sinon.assert.calledWith(readFileSyncStub, 'config.yml');
			sinon.assert.calledWith(safeLoadStub, 'file-data');
			networkConfig.should.deep.equal(new MockNetworkConfig());
		});

		it('should return the new network config when config is a yaml file path', () => {
			readFileSyncStub.returns('{"version":  "1.0"}');
			safeLoadStub.returns({version: '1.0'});
			getConfigSettingStub.returns({'1.0': 'network-config-file'});
			requireStub.returns(MockNetworkConfig);
			MockNetworkConfig.returns('network-config');
			const networkConfig = _getNetworkConfig('config.json', 'client');
			sinon.assert.calledWith(getConfigSettingStub, 'network-config-schema');
			sinon.assert.calledWith(requireStub, 'network-config-file');
			sinon.assert.calledWith(MockNetworkConfig, {version: '1.0'}, 'client');
			sinon.assert.calledWith(readFileSyncStub, 'config.json');
			networkConfig.should.deep.equal(new MockNetworkConfig());
		});

		it('should return the new network config when config is a yaml file path', () => {
			readFileSyncStub.returns('{"version": 1.1}');
			safeLoadStub.returns({version: 1.1});
			getConfigSettingStub.returns({'1.1': 'network-config-file'});
			requireStub.returns(MockNetworkConfig);
			MockNetworkConfig.returns('network-config');
			const networkConfig = _getNetworkConfig('config.json', 'client');
			sinon.assert.calledWith(getConfigSettingStub, 'network-config-schema');
			sinon.assert.calledWith(requireStub, 'network-config-file');
			sinon.assert.calledWith(MockNetworkConfig, {version: 1.1}, 'client');
			sinon.assert.calledWith(readFileSyncStub, 'config.json');
			networkConfig.should.deep.equal(new MockNetworkConfig());
		});
	});
});
