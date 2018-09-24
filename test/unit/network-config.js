/**
 * Copyright 2016-2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('unit.client');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const util = require('util');

const Client = require('fabric-client');
const User = require('fabric-client/lib/User.js');
const Peer = require('fabric-client/lib/Peer.js');
const Orderer = require('fabric-client/lib/Orderer.js');
const Organization = require('fabric-client/lib/Organization.js');
const CertificateAuthority = require('fabric-client/lib/CertificateAuthority.js');
const NetworkConfig = require('fabric-client/lib/impl/NetworkConfig_1_0.js');
const testutil = require('./util.js');


test('\n\n ** configuration testing **\n\n', (t) => {
	testutil.resetDefaults();

	t.doesNotThrow(
		() => {
			let client = new Client();
			client.setTlsClientCertAndKey('client cert', 'client key');
			t.equals(client._tls_mutual.clientCert, 'client cert', 'Checking that client cert was set');
			t.equals(client._tls_mutual.clientKey, 'client key', 'Checking that client key was set');
			let myOpts = {};
			client.addTlsClientCertAndKey(myOpts);
			t.equals(myOpts.clientCert, 'client cert', 'Checking that client cert was added');
			t.equals(myOpts.clientKey, 'client key', 'Checking that client key was added');
		},
		'Checking that able to call xxxTlsClientCertAndKey methods without error'
	);

	t.throws(
		() => {
			Client.loadFromConfig();
		},
		/Invalid network configuration/,
		'Should not be able to instantiate a new instance of "Client" without a valid path to the configuration');

	t.throws(
		() => {
			Client.loadFromConfig('/');
		},
		/EISDIR: illegal operation on a directory/,
		'Should not be able to instantiate a new instance of "Client" without an actual configuration file');

	t.throws(
		() => {
			Client.loadFromConfig('something');
		},
		/ENOENT: no such file or directory/,
		'Should not be able to instantiate a new instance of "Client" without an actual configuration file');

	t.doesNotThrow(
		() => {
			Client.loadFromConfig('test/fixtures/network.json');
		},
		'Should be able to instantiate a new instance of "Client" with a valid path to the configuration'
	);

	t.doesNotThrow(
		() => {
			const client = Client.loadFromConfig('test/fixtures/network.json');
			client.newChannel('mychannel2');
			client.loadFromConfig('test/fixtures/network.json');
		},
		'1 Should be able to instantiate a new instance of "Channel" with the definition in the network configuration'
	);

	t.throws(
		() => {
			const client = Client.loadFromConfig('test/fixtures/network.json');
			client.getChannel('dummy');
		},
		/Channel not found for name/,
		'Should not be able to instantiate a new instance of "Channel" with a bad channel'
	);

	t.throws(
		() => {
			const client = Client.loadFromConfig('test/fixtures/network.json');
			client.getCertificateAuthority();
		},
		/A crypto suite has not been assigned to this client/,
		'Should not be able to instantiate a new instance of a certificate authority until a crypto suite is assigned'
	);

	t.doesNotThrow(
		() => {
			const client = Client.loadFromConfig('test/fixtures/network.yaml');
			client.loadFromConfig('test/fixtures/org1.yaml');
			t.equals('Org1', client._network_config._network_config.client.organization, ' org should be Org1');
			client.loadFromConfig('test/fixtures/org2.yaml');
			t.equals('Org2', client._network_config._network_config.client.organization, ' org should be Org2');
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			const channel = client.getChannel('mychannel2');
			let peers = client.getPeersForOrg();
			t.equals('grpcs://localhost:8051', peers[0].getUrl(), ' Check to see if we got the right peer for org2 by default');
			peers = client.getPeersForOrg('Org1MSP');
			t.equals('grpcs://localhost:7051', peers[0].getUrl(), ' Check to see if we got the right peer for org1 by specifically asking for mspid of org1');
			const orderers = channel.getOrderers();
			t.equals('grpcs://localhost:7050', orderers[0].getUrl(), ' Check to see if we got the right orderer for mychannel2');
			const client_config = client.getClientConfig();
			t.equals('wallet-name', client_config.credentialStore.wallet, ' check to see if we can get the wallet name from the client config');
			t.equals('Org2MSP', client.getMspid(), ' check to see if we can get the mspid of the current clients organization');

			const client2 = Client.loadFromConfig('test/fixtures/network2.yaml');
			client2.setCryptoSuite(Client.newCryptoSuite());
			client2.setUserContext(new User('testUser'), true);
			client2.loadFromConfig('test/fixtures/org1.yaml');
			t.equals(client2.getPeersForOrg().length, 3, ' Check to see that we got 3 peers for Org1');
			client2.getChannel('mychannel3');
			client2.loadFromConfig('test/fixtures/org2.yaml');
			t.equals(client2.getPeersForOrg().length, 1, ' Check to see that we got 1 peer for Org2');

			let opts = { somesetting: 4 };
			client._network_config.addTimeout(opts, 1);
			t.equals(opts['somesetting'], 4, 'check that existing settings are still there');
			t.equals(opts['request-timeout'], 120000, 'check that endorser timeout was added');
			opts = {};
			client._network_config.addTimeout(opts, 2);
			t.equals(opts['request-timeout'], 30000, 'check that orderer timeout was added');
			opts = {};
			client._network_config.addTimeout(opts, 3);
			t.equals(opts['request-timeout'], 60000, 'check that eventHub timeout was added');
			opts = {};
			client._network_config.addTimeout(opts, 4);
			t.equals(opts['request-timeout'], 3000, 'check that eventReg timeout was added');
			opts = {};
			opts['request-timeout'] = 5000;
			client._network_config.addTimeout(opts, 4);
			t.equals(opts['request-timeout'], 5000, 'check that timeout did not change');
			client._network_config._network_config.client.connection.timeout.peer.eventHub = '2s';
			opts = {};
			client._network_config.addTimeout(opts, 3);
			t.equals(opts['request-timeout'], undefined, 'check that timeout did not change');

			let peer = client._network_config.getPeer('peer0.org1.example.com');
			t.equals(peer._options['request-timeout'], 120001, ' check that we get this peer endorser timeout set');
			peer = client._network_config.getPeer('peer0.org2.example.com');
			t.equals(peer._options['request-timeout'], 120000, ' check that we get this peer endorser timeout set');
			const orderer = client._network_config.getOrderer('orderer.example.com');
			t.equals(orderer._options['request-timeout'], 30000, ' check that we get this orderer timeout set');

			delete client._network_config._network_config.certificateAuthorities['ca-org1'].tlsCACerts;
			delete client._network_config._network_config.certificateAuthorities['ca-org1'].httpOptions;
			client.setCryptoSuite({ cryptoSuite: 'cryptoSuite' });
			const certificate_authority = client.getCertificateAuthority();
			if (certificate_authority && certificate_authority.fabricCAServices._cryptoSuite && certificate_authority.fabricCAServices._cryptoSuite.cryptoSuite === 'cryptoSuite') {
				t.pass('Successfully got the certificate_authority');
			} else {
				t.fail('Failed to get the certificate_authority');
			}
		},
		'2 Should be able to run a number of test without error'
	);

	t.throws(
		() => {
			const client = new Client();
			client.getChannel();
		},
		/Channel not found for name undefined./,
		'Check for Channel not found for name undefined.'
	);

	t.doesNotThrow(
		() => {
			const config_loc = path.resolve('test/fixtures/network.yaml');
			const file_data = fs.readFileSync(config_loc);
			const network_data = yaml.safeLoad(file_data);
			const client = Client.loadFromConfig(network_data);
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client.loadFromConfig(network_data);
			const channel = client.getChannel('mychannel2');
			t.equals(channel.getPeers()[0].getUrl(), 'grpcs://localhost:7051', ' check to see that the peer has been added to the channel');
			t.equals(channel.getPeers()[1].getUrl(), 'grpcs://localhost:8051', ' check to see that the peer has been added to the channel');
		},
		'3 Should be able to instantiate a new instance of "Channel" with the definition in the network configuration'
	);

	const network_config = {};

	t.doesNotThrow(
		() => {
			const client = new Client();
			client._network_config = new NetworkConfig(network_config, client);
			client.newChannel('mychannel');
		},
		'Should be able to instantiate a new instance of "Channel" with blank definition in the network configuration'
	);

	t.throws(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig({}, client);
			client.setCryptoSuite({ cryptoSuite: 'cryptoSuite' });
			client.getCertificateAuthority();
		},
		/Network configuration is missing this client's organization and certificate authority/,
		'Check for Network configuration is missing this client\'s organization and certificate authority'
	);

	network_config.version = '1.0.0';
	network_config.channels = {
		'mychannel': {
		}
	};

	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);
			const channel = client.newChannel('mychannel');
			t.equals('mychannel', channel.getName(), 'Channel should be named');
		},
		'Should be able to instantiate a new instance of "Channel" with an empty channel definition in the network configuration'
	);

	network_config.channels = {
		'mychannel': {
			orderers: ['orderer0']
		}
	};

	network_config.orderers = {
		'orderer0': {
			url: 'grpcs://localhost:7050',
			'tlsCACerts': {
				path: 'test/fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'
			}
		}
	};

	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);
			const channel = client.getChannel('mychannel');
			t.equals('mychannel', channel.getName(), 'Channel should be named');
			const orderer = channel.getOrderers()[0];
			if (orderer instanceof Orderer) t.pass('Successfully got an orderer');
			else t.fail('Failed to get an orderer');
			t.equals('orderer0', orderer.getName(), 'Orderer should be named');
		},
		'Should be able to instantiate a new instance of "Channel" with only orderer definition in the network configuration'
	);

	network_config.channels = {
		'mychannel': {
			peers: {
				peer1: {},
				peer2: {},
				peer3: {},
				peer4: {}
			},
			orderers: ['orderer0']
		}
	};
	network_config.orgainizations = { 'org1': {} };

	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);
			const channel = client.getChannel('mychannel');
			t.equals('mychannel', channel.getName(), 'Channel should be named');
			t.equals(channel.getPeers().length, 0, 'Peers should be empty');
			const orderer = channel.getOrderers()[0];
			if (orderer instanceof Orderer) t.pass('Successfully got an orderer');
			else t.fail('Failed to get an orderer');
		},
		'Should be able to instantiate a new instance of "Channel" with org that does not exist in the network configuration'
	);

	network_config.organizations = {
		'org1': {
			mspid: 'mspid1',
			peers: ['peer1', 'peer2'],
			certificateAuthorities: ['ca1']
		},
		'org2': {
			mspid: 'mspid2',
			peers: ['peer3', 'peer4'],
			certificateAuthorities: ['ca2']
		}
	};

	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);
			const channel = client.getChannel('mychannel');
			t.equals('mychannel', channel.getName(), 'Channel should be named');
			t.equals(channel.getPeers().length, 0, 'Peers should be empty');
			const orderer = channel.getOrderers()[0];
			if (orderer instanceof Orderer) t.pass('Successfully got an orderer');
			else t.fail('Failed to get an orderer');
		},
		'Should be able to instantiate a new instance of "Channel" with a peer in the org that does not exist in the network configuration'
	);

	network_config.peers = {
		'peer1': {
			url: 'grpcs://localhost:7051',
			'tlsCACerts': {
				pem: '-----BEGIN CERTIFICATE-----MIIB8TCC5l-----END CERTIFICATE-----'
			}
		},
		'peer2': {
			url: 'grpcs://localhost:7052',
			'tlsCACerts': {
				path: 'test/fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'
			}
		},
		'peer3': {
			url: 'grpcs://localhost:7053',
			'tlsCACerts': {
				path: 'test/fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'
			}
		},
		'peer4': {
			url: 'grpcs://localhost:7054',
			'tlsCACerts': {
				path: 'test/fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'
			}
		},
	};

	network_config.certificateAuthorities = {
		'ca1': {
			url: 'https://localhost:7051',
			'tlsCACerts': {
				pem: '-----BEGIN CERTIFICATE-----MIIB8TCC5l-----END CERTIFICATE-----'
			},
			grpcOptions: { verify: true },
			registrar: { enrollId: 'admin1', enrollSecret: 'adminpw1' }
		},
		'ca2': {
			url: 'https://localhost:7052',
			'tlsCACerts': {
				path: 'test/fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'
			},
			grpcOptions: { verify: true },
			registrar: { enrollId: 'admin2', enrollSecret: 'adminpw2' }
		}
	};
	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);
			const channel = client.getChannel('mychannel');
			t.equals('mychannel', channel.getName(), 'Channel should be named');
			t.equals(channel.getPeers().length, 4, 'Peers should be four');
			const peer = channel.getPeers()[0];
			if (peer && peer.constructor && peer.constructor.name === 'ChannelPeer') t.pass('Successfully got a channel peer');
			else t.fail('Failed to get a channel peer');
		},
		'Should be able to instantiate a new instance of "Channel" with orderer, org and peer defined in the network configuration'
	);

	const peer1 = new Peer('grpcs://localhost:9999', { pem: '-----BEGIN CERTIFICATE-----MIIB8TCC5l-----END CERTIFICATE-----' });

	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);

			let targets = client.getTargetPeers('peer1', client);
			if (Array.isArray(targets)) t.pass('targets is an array');
			else t.fail('targets is not an array');
			if (targets[0] instanceof Peer) t.pass('targets has a peer ');
			else t.fail('targets does not have a peer');

			targets = client.getTargetPeers(['peer1'], client);
			if (Array.isArray(targets)) t.pass('targets is an array');
			else t.fail('targets is not an array');
			if (targets[0] instanceof Peer) t.pass('targets has a peer ');
			else t.fail('targets does not have a peer');

			targets = client.getTargetPeers(peer1, client);
			if (Array.isArray(targets)) t.pass('targets is an array');
			else t.fail('targets is not an array');
			if (targets[0] instanceof Peer) t.pass('targets has a peer ');
			else t.fail('targets does not have a peer');

			targets = client.getTargetPeers([peer1], client);
			if (Array.isArray(targets)) t.pass('targets is an array');
			else t.fail('targets is not an array');
			if (targets[0] instanceof Peer) t.pass('targets has a peer ');
			else t.fail('targets does not have a peer');

		},
		'Should be able to get targets for peer'
	);

	t.doesNotThrow(
		() => {
			const client = new Client();
			client._network_config = new NetworkConfig({}, client);
			const targets = client.getTargetPeers(null, client);
			t.equals(null, targets, 'targets should be null when request targets is null');
		},
		'Should return null targets when checking a null request target'
	);

	t.throws(
		() => {
			const client = new Client();
			client._network_config = new NetworkConfig({}, client);
			client.getTargetPeers({}, client);
		},
		/Target peer is not a valid peer object instance/,
		'Should not be able to get targets when targets is not a peer object'
	);

	t.throws(
		() => {
			const client = new Client();
			client._network_config = new NetworkConfig({}, client);
			client.getTargetPeers('somepeer', client);
		},
		/not found/,
		'Should not be able to get targets when targets is not a peer object'
	);

	t.doesNotThrow(
		() => {
			const client = new Client();
			client._network_config = new NetworkConfig({}, client);
			const targets = client.getTargetPeers([], client);
			t.equals(null, targets, 'targets should be null when list is empty');
		},
		'Should get a null when the target list is empty'
	);

	t.doesNotThrow(
		() => {
			const client = new Client();
			let network_config_impl = new NetworkConfig(network_config, client);
			let client_config = network_config_impl.getClientConfig();
			if (typeof client_config.credentialStore === 'undefined') {
				t.pass('client config should be empty');
			} else {
				t.fail('client config is not correct');
			}
			network_config.client = {};
			network_config.client.credentialStore = { path: '/tmp/something', cryptoStore: { path: 'relative/something' } };
			network_config_impl = new NetworkConfig(network_config, client);
			client_config = network_config_impl.getClientConfig();
			t.equals(client_config.credentialStore.path, '/tmp/something', 'client config store path should be something');
			if (client_config.credentialStore.cryptoStore.path.indexOf('relative/something') > 1) {
				t.pass('client config cryptoStore store path should be something relative');
			} else {
				t.fail('client config cryptoStore store path should be something relative');
			}
			network_config.client.credentialStore = { dbsetting: '/tmp/something', cryptoStore: { dbsetting: 'relative/something' } };
			network_config_impl = new NetworkConfig(network_config, client);
			client_config = network_config_impl.getClientConfig();
			t.equals(client_config.credentialStore.dbsetting, '/tmp/something', 'client config store path should be something');
			t.equals(client_config.credentialStore.cryptoStore.dbsetting, 'relative/something', 'client config cryptoStore store path should be something');

		},
		'Should not get an error when working with credentialStore settings'
	);

	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);
			const organizations = client._network_config.getOrganizations();
			if (Array.isArray(organizations)) t.pass('organizations is an array');
			else t.fail('organizations is not an array');
			if (organizations[0] instanceof Organization) t.pass('organizations has a organization ');
			else t.fail('organizations does not have a organization');

			let organization = client._network_config.getOrganization(organizations[0].getName());
			let ca = organization.getCertificateAuthorities()[0];
			t.equals('ca1', ca.getName(), 'check the ca name');

			organization = client._network_config.getOrganization(organizations[1].getName());
			ca = organization.getCertificateAuthorities()[0];
			t.equals('ca2', ca.getName(), 'check the ca name');

			organization = client._network_config.getOrganizationByMspId(organizations[0].getMspid());
			ca = organization.getCertificateAuthorities()[0];
			t.equals('ca1', ca.getName(), 'check the ca name');
		},
		'Should be able to get organizations'
	);

	network_config.channels = {
		'mychannel': {
			peers: {
				peer1: { endorsingPeer: false, chaincodeQuery: false, ledgerQuery: false },
				peer2: { endorsingPeer: false, chaincodeQuery: false, ledgerQuery: false },
				peer3: { ledgerQuery: true },
				peer4: { ledgerQuery: false }
			},
			orderers: ['orderer0']
		}
	};

	t.doesNotThrow(
		() => {
			let client = Client.loadFromConfig(network_config);
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			let channel = client.getChannel('mychannel');

			checkTarget(channel._getTargetForQuery(), '7053', 'finding a default ledger query', t);
			checkTarget(channel._getTargets(null, 'ledgerQuery'), '7053', 'finding a default ledger query', t);
			checkTarget(channel._getTargetForQuery('peer1'), '7051', 'finding a string target for ledger query', t);
			checkTarget(channel._getTargets('peer1'), '7051', 'finding a string target', t);
			checkTarget(channel._getTargetForQuery(peer1), '9999', 'should get back the same target if a good peer', t);
			checkTarget(channel._getTargets(peer1), '9999', 'should get back the same target if a good peer', t);
			client = new Client();
			channel = client.newChannel('mychannel');
			channel.addPeer(peer1);
			checkTarget(channel._getTargetForQuery(), '9999', 'finding a default ledger query without networkconfig', t);
			checkTarget(channel._getTargets(undefined, 'ANY'), '9999', 'finding a default targets without networkconfig', t);
		},
		'Should be able to run channel target methods'
	);

	t.throws(
		() => {
			const client = new Client();
			const channel = client.newChannel('mychannel');
			channel._getTargetForQuery();
		},
		/"target" parameter not specified and no peers are set on this Channel instance or specfied for this channel in the network/,
		'Should get an error back when no targets are available'
	);

	t.throws(
		() => {
			const client = Client.loadFromConfig(network_config);
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			const channel = client.getChannel('mychannel');
			channel._getTargetForQuery(['peer1']);
		},
		/array/,
		'Should get an error back when passing an array'
	);

	t.throws(
		() => {
			const client = Client.loadFromConfig(network_config);
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			const channel = client.getChannel('mychannel');
			channel._getTargets('bad');
		},
		/not assigned/,
		'Should get an error back when passing a bad name'
	);

	t.throws(
		() => {
			const client = new Client();
			client._network_config = new NetworkConfig({}, client);
			client.getTargetOrderer('someorderer');
		},
		/not found/,
		'Should get an error when the request orderer name is not found'
	);

	t.throws(
		() => {
			const client = new Client();
			client._network_config = new NetworkConfig({}, client);
			client.getTargetOrderer({});
		},
		/"orderer" request parameter is not valid. Must be an orderer name or "Orderer" object./,
		'Should get an error when the request orderer is not a valid object'
	);

	t.throws(
		() => {
			const client = new Client();
			client._network_config = new NetworkConfig({ channels: { somechannel: {} } }, client);
			client.getTargetOrderer(null, null, 'somechannel');
		},
		/"orderer" request parameter is missing and there are no orderers defined on this channel in the network configuration/,
		'Should get an error when the request orderer is not defined and the channel does not have any orderers'
	);

	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);

			let orderer = client.getTargetOrderer('orderer0');
			if (orderer instanceof Orderer) t.pass('orderer has a orderer ');
			else t.fail('orderer does not have a orderer');

			const orderer1 = new Orderer('grpcs://localhost:9999', { pem: '-----BEGIN CERTIFICATE-----MIIB8TCC5l-----END CERTIFICATE-----' });

			orderer = client.getTargetOrderer(orderer1);
			if (orderer instanceof Orderer) t.pass('orderer has a orderer ');
			else t.fail('orderer does not have a orderer');

			orderer = client.getTargetOrderer(null, null, 'mychannel');
			if (orderer instanceof Orderer) t.pass('orderer has a orderer ');
			else t.fail('orderer does not have a orderer');

			orderer = client.getTargetOrderer(null, [orderer1]);
			if (orderer instanceof Orderer) t.pass('orderer has a orderer ');
			else t.fail('orderer does not have a orderer');
		},
		'Should be able to get orderer'
	);

	t.doesNotThrow(
		() => {
			const client = Client.loadFromConfig(network_config);
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client.getChannel('mychannel');
			client.loadFromConfig({
				version: '1.0.0',
				channels: {
					'otherchannel': {
						orderers: ['orderer0']
					}
				}
			});
			client.getChannel('otherchannel');
		},
		'Should be able to load additional configurations'
	);

	t.doesNotThrow(
		() => {
			const organization = new Organization('name', 'mspid');
			t.equals('name', organization.getName(), 'check name');
			t.equals('mspid', organization.getMspid(), 'check mspid');
			organization.addPeer('peer');
			t.equals('peer', organization.getPeers()[0], 'check getPeers');
			organization.addCertificateAuthority('ca');
			t.equals('ca', organization.getCertificateAuthorities()[0], 'check getPeers');
			t.comment(organization.toString());
		},
		'Should be able to run all methods of Organization'
	);

	t.doesNotThrow(
		() => {
			const certificateAuthority = new CertificateAuthority('name', 'caname', 'url', 'connection', 'tlscert', 'registrar');
			t.equals('name', certificateAuthority.getName(), 'check name');
			t.equals('caname', certificateAuthority.getCaName(), 'check caname');
			t.equals('url', certificateAuthority.getUrl(), 'check url');
			t.equals('connection', certificateAuthority.getConnectionOptions(), 'check connection options');
			t.equals('tlscert', certificateAuthority.getTlsCACerts(), 'check tlscert');
			t.equals('registrar', certificateAuthority.getRegistrar(), 'check registrar');
			t.comment(certificateAuthority.toString());
		},
		'Should be able to run all methods of CertificateAuthority'
	);

	const clientpr1 = new Client();
	const pr1 = clientpr1.initCredentialStores().then(() => {
		t.fail('pr1 Should not have been able to resolve the promise');
	}).catch((err) => {
		if (err.message.indexOf('No network configuration settings found') >= 0) {
			t.pass('pr1 Successfully caught error');
		} else {
			t.fail('pr1 Failed to catch error. Error: ' + err.stack ? err.stack : err);
		}
	});
	Promise.all([pr1])
		.then(
			() => {
				t.end();
			}
		).catch(
			(err) => {
				t.fail('Channel query calls, Promise.all: ');
				logger.error(err.stack ? err.stack : err);
				t.end();
			}
		);

	t.throws(
		() => {
			const client = new Client();
			client._setAdminFromConfig();
		},
		/No network configuration has been loaded/,
		'Should get an error No network configuration has been loaded'
	);

	t.throws(
		() => {
			const client = new Client();
			client.setAdminSigningIdentity();
		},
		/Invalid parameter. Must have a valid private key./,
		'Should get an error Invalid parameter. Must have a valid private key.'
	);

	t.throws(
		() => {
			const client = new Client();
			client.setAdminSigningIdentity('privateKey');
		},
		/Invalid parameter. Must have a valid certificate./,
		'Should get an error Invalid parameter. Must have a valid certificate.'
	);

	t.throws(
		() => {
			const client = new Client();
			client.setAdminSigningIdentity('privateKey', 'cert');
		},
		/Invalid parameter. Must have a valid mspid./,
		'Should get an error Invalid parameter. Must have a valid mspid.'
	);

	t.throws(
		() => {
			const client = new Client();
			client._getSigningIdentity();
		},
		/No identity has been assigned to this client/,
		'Should get an error No identity has been assigned to this client'
	);

	try {
		const client = Client.loadFromConfig('test/fixtures/network.yaml');
		t.pass('Successfully loaded a network configuration');
		t.pass('Should be able to try to load an admin from the config');

		client.loadFromConfig('test/fixtures/org1.yaml');
		t.pass('Should be able to load an additional config ...this one has the client section');
		t.pass('Should be able to try to load an admin from the config');
	} catch (err) {
		t.fail('Fail - caught an error while trying to load a config and run the set admin');
	}

	const clientp1 = Client.loadFromConfig('test/fixtures/network.yaml');
	t.pass('Successfully loaded a network configuration');
	clientp1.loadFromConfig('test/fixtures/org1.yaml');
	t.pass('Should be able to load an additional config ...this one has the client section');

	const p1 = clientp1.initCredentialStores().then(() => {
		t.pass('Should be able to load the stores from the config');
		clientp1._setAdminFromConfig();
		t.pass('Should be able to load an admin from the config');
		clientp1._getSigningIdentity(true);
		t.pass('Should be able to get the loaded admin identity');
	}).catch((err) => {
		t.fail(util.format('Should not get an error when doing get signer: %O', err));
	});

	const clientp2 = Client.loadFromConfig('test/fixtures/network.yaml');
	t.pass('Successfully loaded a network configuration');
	clientp2.loadFromConfig('test/fixtures/org1.yaml');
	t.pass('Should be able to load an additional config ...this one has the client section');
	const p2 = clientp2.initCredentialStores().then(() => {
		t.pass('Should be able to load the stores from the config');
		clientp2._network_config._network_config.client = {};
		return clientp2._setUserFromConfig();
	}).then(() => {
		t.fail('Should not be able to load an user based on the config');
	}).catch((err) => {
		if (err.message.includes('Missing parameter. Must have a username.')) {
			t.pass('Successfully caught Missing parameter. Must have a username.');
		} else {
			t.fail('Failed to catch Missing parameter. Must have a username.');
			logger.error(err.stack ? err.stack : err);
		}
	});

	const clientp3 = Client.loadFromConfig('test/fixtures/network.yaml');
	t.pass('Successfully loaded a network configuration');
	clientp3.loadFromConfig('test/fixtures/org1.yaml');
	t.pass('Should be able to load an additional config ...this one has the client section');
	const p3 = clientp3.initCredentialStores().then(() => {
		t.pass('Should be able to load the stores from the config');
		clientp4._network_config._network_config.client = {};
		return clientp3._setUserFromConfig({ username: 'username' });
	}).then(() => {
		t.fail('Should not be able to load an user based on the config');
	}).catch((err) => {
		if (err.message.indexOf('Missing parameter. Must have a password.') >= 0) {
			t.pass('Successfully caught Missing parameter. Must have a password.');
		} else {
			t.fail('Failed to catch Missing parameter. Must have a password.');
			logger.error(err.stack ? err.stack : err);
		}
	});

	const clientp4 = Client.loadFromConfig('test/fixtures/network.yaml');
	t.pass('Successfully loaded a network configuration');
	const p4 = clientp4._setUserFromConfig({ username: 'username', password: 'password' }).then(() => {
		t.fail('Should not be able to load an user based on the config');
	}).catch((err) => {
		if (err.message.includes('Client requires a network configuration loaded, stores attached, and crypto suite.')) {
			t.pass('Successfully caught Client requires a network configuration loaded, stores attached, and crypto suite.');
		} else {
			t.fail('Failed to catch Client requires a network configuration loaded, stores attached, and crypto suite.');
			logger.error(err.stack ? err.stack : err);
		}
	});

	Promise.all([p1, p2, p3, p4])
		.then(
			() => {
				t.end();
			}
		).catch(
			(err) => {
				t.fail('Client network config calls failed during the Promise.all');
				logger.error(err.stack ? err.stack : err);
				t.end();
			}
		);

	t.end();
});

test('\n\n ** channel testing **\n\n', (t) => {
	const client = new Client();
	client.setCryptoSuite(Client.newCryptoSuite());
	client.setUserContext(new User('testUser'), true);
	client.loadFromConfig('test/fixtures/network.yaml');

	const channel = client.getChannel('mychannel2');
	let channelEventHubs = channel.getChannelEventHubsForOrg('bad');
	t.equals(channelEventHubs.length, 0, 'Checking that we got the correct number of peers in the list');
	channelEventHubs = channel.getChannelEventHubsForOrg('Org2MSP');
	t.equals(channelEventHubs[0].getName(), 'peer0.org2.example.com', 'Checking that we got the correct peer in the list');
	client.loadFromConfig('test/fixtures/org1.yaml');
	channelEventHubs = channel.getChannelEventHubsForOrg();
	t.equals(channelEventHubs[0].getName(), 'peer0.org1.example.com', 'Checking that we got the correct peer in the list');

	t.end();
});

function checkTarget(target, check, msg, t) {
	if (Array.isArray(target)) {
		target = target[0];
	}
	if (target.toString().indexOf(check) > -1) {
		t.pass('Successfully got the correct target result for ' + msg);
	} else {
		t.equals(check, target.toString(), 'Failed to get correct target result for ' + msg);
	}
}
