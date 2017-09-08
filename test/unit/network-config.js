/**
 * Copyright 2016-2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

var utils = require('fabric-client/lib/utils.js');
var client_utils = require('fabric-client/lib/client-utils.js');
var logger = utils.getLogger('unit.client');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);
var path = require('path');
var fs = require('fs-extra');
var yaml = require('js-yaml');
var util = require('util');

var Client = require('fabric-client');
var utils = require('fabric-client/lib/utils.js');
var User = require('fabric-client/lib/User.js');
var Peer = require('fabric-client/lib/Peer.js');
var Orderer = require('fabric-client/lib/Orderer.js');
var Organization = require('fabric-client/lib/Organization.js');
var CertificateAuthority = require('fabric-client/lib/CertificateAuthority.js');
var NetworkConfig = require('fabric-client/lib/impl/NetworkConfig_1_0.js');
var testutil = require('./util.js');

var caImport;

var grpc = require('grpc');
var _configtxProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/common/configtx.proto').common;
var rewire = require('rewire');
var ClientRewired = rewire('fabric-client/lib/Client.js');

test('\n\n ** configuration testing **\n\n', function (t) {
	testutil.resetDefaults();

	t.throws(
		function() {
			var c = Client.loadFromConfig();
		},
		/Invalid network configuration/,
		'Should not be able to instantiate a new instance of "Client" without a valid path to the configuration');

	t.throws(
		function() {
			var c = Client.loadFromConfig('/');
		},
		/EISDIR: illegal operation on a directory/,
		'Should not be able to instantiate a new instance of "Client" without an actual configuration file');

	t.throws(
		function() {
			var c = Client.loadFromConfig('something');
		},
		/ENOENT: no such file or directory/,
		'Should not be able to instantiate a new instance of "Client" without an actual configuration file');

	t.doesNotThrow(
		() => {
			var c = Client.loadFromConfig('test/fixtures/network.json');
		},
		null,
		'Should be able to instantiate a new instance of "Client" with a valid path to the configuration'
	);

	t.doesNotThrow(
		() => {
			var client = Client.loadFromConfig('test/fixtures/network.json');
			var channel = client.newChannel('mychannel2');
			client.loadFromConfig('test/fixtures/network.json');
		},
		null,
		'1 Should be able to instantiate a new instance of "Channel" with the definition in the network configuration'
	);

	t.throws(
		() => {
			var client = Client.loadFromConfig('test/fixtures/network.json');
			var channel = client.getChannel('dummy');
		},
		/Channel not found for name/,
		'Should not be able to instantiate a new instance of "Channel" with a bad channel'
	);

	t.doesNotThrow(
		() => {
			var client = Client.loadFromConfig('test/fixtures/network.yaml');
			client.loadFromConfig({ version:'1.0.0', client : {organization : 'Org1'}});
			t.equals('Org1', client._network_config._network_config.client.organization, ' org should be Org1');
			client.loadFromConfig({ version:'1.0.0', client : {organization : 'Org2'}});
			t.equals('Org2', client._network_config._network_config.client.organization, ' org should be Org2');
			var channel = client.getChannel('mychannel2');
		},
		null,
		'2 Should be able to instantiate a new instance of "Channel" with the definition in the network configuration'
	);

	t.doesNotThrow(
		() => {
			var config_loc = path.resolve('test/fixtures/network.yaml');
			var file_data = fs.readFileSync(config_loc);
			var network_data = yaml.safeLoad(file_data);
			var client = Client.loadFromConfig(network_data);
			var channel = client.newChannel('mychannel2');
			client.loadFromConfig(network_data);
		},
		null,
		'3 Should be able to instantiate a new instance of "Channel" with the definition in the network configuration'
	);

	var network_config = {};

	t.doesNotThrow(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig(network_config, client);
			var channel = client.newChannel('mychannel');
		},
		null,
		'Should be able to instantiate a new instance of "Channel" with blank definition in the network configuration'
	);

	network_config.version = '1.0.0';
	network_config.channels = {
		'mychannel' : {
		}
	};

	t.doesNotThrow(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig(network_config, client);
			var channel = client.newChannel('mychannel');
			t.equals('mychannel',channel.getName(),'Channel should be named');
		},
		null,
		'Should be able to instantiate a new instance of "Channel" with an empty channel definition in the network configuration'
	);

	network_config.channels = {
		'mychannel' : {
			orderers : ['orderer0']
		}
	};

	network_config.orderers = {
		'orderer0' : {
			url : 'grpcs://localhost:7050',
			'tlsCACerts' : {
				path : 'test/fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'
			}
		}
	};

	t.doesNotThrow(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig(network_config, client);
			var channel = client.getChannel('mychannel');
			t.equals('mychannel',channel.getName(),'Channel should be named');
			var orderer = channel.getOrderers()[0];
			if(orderer instanceof Orderer) t.pass('Successfully got an orderer');
			else t.fail('Failed to get an orderer');
		},
		null,
		'Should be able to instantiate a new instance of "Channel" with only orderer definition in the network configuration'
	);

	network_config.channels = {
		'mychannel' : {
			peers : {
				peer1 : {},
				peer2 : {},
				peer3 : {},
				peer4 : {}
			},
			orderers : ['orderer0']
		}
	};
	network_config.orgainizations = { 'org1' : {} };

	t.doesNotThrow(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig(network_config, client);
			var channel = client.getChannel('mychannel');
			t.equals('mychannel',channel.getName(),'Channel should be named');
			t.equals(channel.getPeers().length, 0, 'Peers should be empty');
			var orderer = channel.getOrderers()[0];
			if(orderer instanceof Orderer) t.pass('Successfully got an orderer');
			else t.fail('Failed to get an orderer');
		},
		null,
		'Should be able to instantiate a new instance of "Channel" with org that does not exist in the network configuration'
	);

	network_config.organizations = {
		'org1' : {
			mspid : 'mspid1',
			peers : ['peer1','peer2'],
			certificateAuthorities : ['ca1']
		},
		'org2' : {
			mspid : 'mspid2',
			peers : ['peer3','peer4'],
			certificateAuthorities : ['ca2']
		}
	};

	t.doesNotThrow(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig(network_config, client);
			var channel = client.getChannel('mychannel');
			t.equals('mychannel',channel.getName(),'Channel should be named');
			t.equals(channel.getPeers().length, 0, 'Peers should be empty');
			var orderer = channel.getOrderers()[0];
			if(orderer instanceof Orderer) t.pass('Successfully got an orderer');
			else t.fail('Failed to get an orderer');
		},
		null,
		'Should be able to instantiate a new instance of "Channel" with a peer in the org that does not exist in the network configuration'
	);

	network_config.peers = {
		'peer1' : {
			url : 'grpcs://localhost:7051',
			'tlsCACerts' : {
				pem : '-----BEGIN CERTIFICATE-----MIIB8TCC5l-----END CERTIFICATE-----'
			}
		},
		'peer2' : {
			url : 'grpcs://localhost:7052',
			'tlsCACerts' : {
				path : 'test/fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'
			}
		},
		'peer3' : {
			url : 'grpcs://localhost:7053',
			'tlsCACerts' : {
				path : 'test/fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'
			}
		},
		'peer4' : {
			url : 'grpcs://localhost:7054',
			'tlsCACerts' : {
				path : 'test/fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'
			}
		},
	};

	network_config.certificateAuthorities = {
		'ca1' : {
			url : 'https://localhost:7051',
			'tlsCACerts' : {
				pem : '-----BEGIN CERTIFICATE-----MIIB8TCC5l-----END CERTIFICATE-----'
			},
			grpcOptions : { verify : true},
			registrar : { enrollId: 'admin1', enrollSecret: 'adminpw1'}
		},
		'ca2' : {
			url : 'https://localhost:7052',
			'tlsCACerts' : {
				path : 'test/fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'
			},
			grpcOptions : { verify : true},
			registrar : { enrollId: 'admin2', enrollSecret: 'adminpw2' }
		}
	};
	t.doesNotThrow(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig(network_config, client);
			var channel = client.getChannel('mychannel');
			t.equals('mychannel',channel.getName(),'Channel should be named');
			t.equals(channel.getPeers().length, 4, 'Peers should be four');
			var peer =  channel.getPeers()[0];
			if(peer instanceof Peer) t.pass('Successfully got a peer');
			else t.fail('Failed to get a peer');
		},
		null,
		'Should be able to instantiate a new instance of "Channel" with orderer, org and peer defined in the network configuration'
	);

	var peer1 = new Peer('grpcs://localhost:9999', {pem : '-----BEGIN CERTIFICATE-----MIIB8TCC5l-----END CERTIFICATE-----'});

	t.doesNotThrow(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig(network_config, client);

			var targets = client.getTargetPeers('peer1', client);
			if(Array.isArray(targets)) t.pass('targets is an array');
			else t.fail('targets is not an array');
			if(targets[0] instanceof Peer) t.pass('targets has a peer ');
			else t.fail('targets does not have a peer');

			var targets = client.getTargetPeers(['peer1'], client);
			if(Array.isArray(targets)) t.pass('targets is an array');
			else t.fail('targets is not an array');
			if(targets[0] instanceof Peer) t.pass('targets has a peer ');
			else t.fail('targets does not have a peer');

			var targets = client.getTargetPeers(peer1, client);
			if(Array.isArray(targets)) t.pass('targets is an array');
			else t.fail('targets is not an array');
			if(targets[0] instanceof Peer) t.pass('targets has a peer ');
			else t.fail('targets does not have a peer');

			var targets = client.getTargetPeers([peer1], client);
			if(Array.isArray(targets)) t.pass('targets is an array');
			else t.fail('targets is not an array');
			if(targets[0] instanceof Peer) t.pass('targets has a peer ');
			else t.fail('targets does not have a peer');

		},
		null,
		'Should be able to get targets for peer'
	);

	t.doesNotThrow(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig({}, client);
			var targets = client.getTargetPeers(null, client);
			t.equals(null, targets, 'targets should be null when request targets is null');
		},
		null,
		'Should return null targets when checking a null request target'
	);

	t.throws(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig({}, client);
			var targets = client.getTargetPeers({}, client);
		},
		/Target peer is not a valid peer object instance/,
		'Should not be able to get targets when targets is not a peer object'
	);

	t.throws(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig({}, client);
			var targets = client.getTargetPeers('somepeer', client);
		},
		/Target peer name was not found/,
		'Should not be able to get targets when targets is not a peer object'
	);

	t.doesNotThrow(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig({}, client);
			var targets = client.getTargetPeers([], client);
			t.equals(null, targets, 'targets should be null when list is empty');
		},
		null,
		'Should get a null when the target list is empty'
	);

	t.doesNotThrow(
			() => {
				var client = new Client();
				var network_config = new NetworkConfig(network_config, client);
				var client_config = network_config.getClientConfig();
				if(typeof client_config.credentialStore === 'undefined') {
					t.pass('client config should be empty');
				} else {
					t.fail('client config is not correct');
				}
				network_config.client = {};
				network_config.client.credentialStore = {path : '/tmp/something', cryptoStore : { path : 'relative/something'}};
				var network_config_impl = new NetworkConfig(network_config, client);
				client_config = network_config_impl.getClientConfig();
				t.equals(client_config.credentialStore.path, '/tmp/something','client config store path should be something');
				if(client_config.credentialStore.cryptoStore.path.indexOf('relative/something') > 1) {
					t.pass('client config cryptoStore store path should be something relative');
				} else {
					t.fail('client config cryptoStore store path should be something relative');
				}
				network_config.client.credentialStore = {dbsetting : '/tmp/something', cryptoStore : { dbsetting : 'relative/something'}};
				network_config_impl = new NetworkConfig(network_config, client);
				client_config = network_config_impl.getClientConfig();
				t.equals(client_config.credentialStore.dbsetting, '/tmp/something','client config store path should be something');
				t.equals(client_config.credentialStore.cryptoStore.dbsetting, 'relative/something','client config cryptoStore store path should be something');

			},
			null,
			'Should not get an error when working with credentialStore settings'
		);

	t.doesNotThrow(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig(network_config, client);
			var organizations = client._network_config.getOrganizations();
			if(Array.isArray(organizations)) t.pass('organizations is an array');
			else t.fail('organizations is not an array');
			if(organizations[0] instanceof Organization) t.pass('organizations has a organization ');
			else t.fail('organizations does not have a organization');
			var organization = client._network_config.getOrganization(organizations[0].getName());
			var ca = organization.getCertificateAuthorities()[0];
			t.equals('ca1',ca.getName(),'check the ca name');
			organization = client._network_config.getOrganization(organizations[1].getName());
			ca = organization.getCertificateAuthorities()[0];
			t.equals('ca2',ca.getName(),'check the ca name');
		},
		null,
		'Should be able to get organizations'
	);

	t.doesNotThrow(
		() => {
			var client = Client.loadFromConfig(network_config);
			var channel = client.getChannel('mychannel');
			var targets = channel._getTargetsFromConfig(); //all roles
			if(Array.isArray(targets)) t.pass('targets is an array');
			else t.fail('targets is not an array');
			if(targets[0] instanceof Peer) t.pass('targets has a peer ');
			else t.fail('targets does not have a peer');
			t.equals(2,targets.length,'Should have two targets in the list');

		},
		null,
		'Should be able to get targets for channel'
	);

	t.throws(
		() => {
			var client = new Client();
			var channel = client.newChannel('test');
			var targets = channel._getTargetsFromConfig('bad');
		},
		/Target role is unknown/,
		'Should get an error when the role is bad'
	);

	network_config.channels = {
		'mychannel' : {
			peers : {
				peer1: {endorsingPeer:false, chaincodeQuery:false, ledgerQuery:false},
				peer2 : {endorsingPeer:false, chaincodeQuery:false, ledgerQuery:false},
				peer3 : {ledgerQuery:true},
				peer4 : {ledgerQuery:false}
			},
			orderers : ['orderer0']
		}
	};

	t.doesNotThrow(
		() => {
			var client = Client.loadFromConfig(network_config);
			var channel = client.getChannel('mychannel');
			var targets = channel._getTargetsFromConfig('chaincodeQuery');
			t.equals(1,targets.length,'Should have one target in the list');

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
			checkTarget(channel._getTargets(), '9999', 'finding a default targets without networkconfig', t);
		},
		null,
		'Should be able to run channel target methods'
	);

	t.throws(
		() => {
			var client = new Client();
			var channel = client.newChannel('mychannel');
			channel._getTargetForQuery();
		},
		/"target" parameter not specified and no peers are set on this Channel instance or specfied for this channel in the network/,
		'Should get an error back when no targets are available'
	);

	t.throws(
		() => {
			var client = Client.loadFromConfig(network_config);
			var channel = client.getChannel('mychannel');
			channel._getTargetForQuery(['peer1']);
		},
		/array/,
		'Should get an error back when passing an array'
	);

	t.throws(
			() => {
				var client = Client.loadFromConfig(network_config);
				var channel = client.getChannel('mychannel');
				channel._getTargets('bad');
			},
			/found/,
			'Should get an error back when passing a bad name'
		);

	t.throws(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig({}, client);
			client.getTargetOrderer('someorderer');
		},
		/Orderer name was not found in the network configuration/,
		'Should get an error when the request orderer name is not found'
	);

	t.throws(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig({}, client);
			client.getTargetOrderer({});
		},
		/"orderer" request parameter is not valid. Must be an orderer name or "Orderer" object./,
		'Should get an error when the request orderer is not a valid object'
	);

	t.throws(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig({ channels : {somechannel : {}}}, client);
			client.getTargetOrderer(null, null, 'somechannel');
		},
		/"orderer" request parameter is missing and there are no orderers defined on this channel in the network configuration/,
		'Should get an error when the request orderer is not defined and the channel does not have any orderers'
	);

	t.doesNotThrow(
		() => {
			var client = new Client();
			client._network_config = new NetworkConfig(network_config, client);

			var orderer = client.getTargetOrderer('orderer0');
			if(orderer instanceof Orderer) t.pass('orderer has a orderer ');
			else t.fail('orderer does not have a orderer');

			var orderer1 = new Orderer('grpcs://localhost:9999', {pem : '-----BEGIN CERTIFICATE-----MIIB8TCC5l-----END CERTIFICATE-----'});

			orderer = client.getTargetOrderer(orderer1);
			if(orderer instanceof Orderer) t.pass('orderer has a orderer ');
			else t.fail('orderer does not have a orderer');

			orderer = client.getTargetOrderer(null, null, 'mychannel');
			if(orderer instanceof Orderer) t.pass('orderer has a orderer ');
			else t.fail('orderer does not have a orderer');

			orderer = client.getTargetOrderer(null, [orderer1]);
			if(orderer instanceof Orderer) t.pass('orderer has a orderer ');
			else t.fail('orderer does not have a orderer');
		},
		null,
		'Should be able to get orderer'
	);

	t.doesNotThrow(
		() => {
			var client = Client.loadFromConfig(network_config);
			let channel = client.getChannel('mychannel');
			client.loadFromConfig({ version: '1.0.0',
				channels : {
					'otherchannel' : {
						orderers : ['orderer0']
					}
				}
			});
			let otherchannel = client.getChannel('otherchannel');
		},
		null,
		'Should be able to load additional configurations'
	);

	t.doesNotThrow(
		() => {
			var organization = new Organization('name', 'mspid');
			t.equals('name',organization.getName(), 'check name');
			t.equals('mspid',organization.getMspid(), 'check mspid');
			organization.addPeer('peer');
			t.equals('peer',organization.getPeers()[0], 'check getPeers');
			organization.addCertificateAuthority('ca');
			t.equals('ca',organization.getCertificateAuthorities()[0], 'check getPeers');
			t.comment(organization.toString());
		},
		null,
		'Should be able to run all methods of Organization'
	);

	t.doesNotThrow(
		() => {
			var certificateAuthority = new CertificateAuthority('name', 'url', 'connection', 'tlscert', 'registrar');
			t.equals('name',certificateAuthority.getName(), 'check name');
			t.equals('url',certificateAuthority.getUrl(), 'check url');
			t.equals('connection',certificateAuthority.getConnectionOptions(), 'check connection options');
			t.equals('tlscert',certificateAuthority.getTlsCACerts(), 'check tlscert');
			t.equals('registrar',certificateAuthority.getRegistrar(), 'check registrar');
			t.comment(certificateAuthority.toString());
		},
		null,
		'Should be able to run all methods of CertificateAuthority'
	);

	var clientpr1 = new Client();
	var pr1 = clientpr1.initCredentialStores().then(function () {
		t.fail('pr1 Should not have been able to resolve the promise');
	}).catch(function (err) {
		if (err.message.indexOf('No network configuration settings found') >= 0) {
			t.pass('pr1 Successfully caught error');
		} else {
			t.fail('pr1 Failed to catch error. Error: ' + err.stack ? err.stack : err);
		}
	});
	Promise.all([pr1])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Channel query calls, Promise.all: ');
			logger.error(err.stack ? err.stack : err);
			t.end();
		}
	);

	t.throws(
		() => {
			var client = new Client();
			client._setAdminFromConfig();
		},
		/No network configuration has been loaded/,
		'Should get an error No network configuration has been loaded'
	);

	t.throws(
		() => {
			var client = new Client();
			client.setAdminSigningIdentity();
		},
		/Invalid parameter. Must have a valid private key./,
		'Should get an error Invalid parameter. Must have a valid private key.'
	);

	t.throws(
		() => {
			var client = new Client();
			client.setAdminSigningIdentity('privateKey');
		},
		/Invalid parameter. Must have a valid certificate./,
		'Should get an error Invalid parameter. Must have a valid certificate.'
	);

	t.throws(
		() => {
			var client = new Client();
			client.setAdminSigningIdentity('privateKey','cert');
		},
		/Invalid parameter. Must have a valid mspid./,
		'Should get an error Invalid parameter. Must have a valid mspid.'
	);

	t.throws(
		() => {
			var client = new Client();
			client._getSigningIdentity();
		},
		/No identity has been assigned to this client/,
		'Should get an error No identity has been assigned to this client'
	);

	try {
		var client = Client.loadFromConfig('test/fixtures/network.yaml');
		t.pass('Successfully loaded a network configuration');
		t.pass('Should be able to try to load an admin from the config');

		client.loadFromConfig('test/fixtures/org1.yaml');
		t.pass('Should be able to load an additional config ...this one has the client section');
		t.pass('Should be able to try to load an admin from the config');
	} catch(err) {
		t.fail('Fail - caught an error while trying to load a config and run the set admin');
	}

	var clientp1 = Client.loadFromConfig('test/fixtures/network.yaml');
	t.pass('Successfully loaded a network configuration');
	clientp1.loadFromConfig('test/fixtures/org1.yaml');
	t.pass('Should be able to load an additional config ...this one has the client section');

	var p1 = clientp1.initCredentialStores().then(()=> {
		t.pass('Should be able to load the stores from the config');
		clientp1._setAdminFromConfig();
		t.pass('Should be able to load an admin from the config');
		clientp1._getSigningIdentity(true);
		t.pass('Should be able to get the loaded admin identity');
	}).catch(function (err) {
		t.fail('Should not get an error when doing get signer ');
		logger.error(err.stack ? err.stack : err);
	});

	var clientp2 = Client.loadFromConfig('test/fixtures/network.yaml');
	t.pass('Successfully loaded a network configuration');
	clientp2.loadFromConfig('test/fixtures/org1.yaml');
	t.pass('Should be able to load an additional config ...this one has the client section');
	var p2 = clientp2.initCredentialStores().then(()=> {
		t.pass('Should be able to load the stores from the config');
		clientp2._network_config._network_config.client = {};
		return clientp2._setUserFromConfig();
	}).then((user)=>{
		t.fail('Should not be able to load an user based on the config');
	}).catch(function (err) {
		if (err.message.indexOf('Missing parameter. Must have a username.') >= 0) {
			t.pass('Successfully caught Missing parameter. Must have a username.');
		} else {
			t.fail('Failed to catch Missing parameter. Must have a username.');
			logger.error(err.stack ? err.stack : err);
		}
	});

	var clientp3 = Client.loadFromConfig('test/fixtures/network.yaml');
	t.pass('Successfully loaded a network configuration');
	clientp3.loadFromConfig('test/fixtures/org1.yaml');
	t.pass('Should be able to load an additional config ...this one has the client section');
	var p3 = clientp3.initCredentialStores().then(()=> {
		t.pass('Should be able to load the stores from the config');
		clientp4._network_config._network_config.client = {};
		return clientp3._setUserFromConfig({username:'username'});
	}).then((user)=>{
		t.fail('Should not be able to load an user based on the config');
	}).catch(function (err) {
		if (err.message.indexOf('Missing parameter. Must have a password.') >= 0) {
			t.pass('Successfully caught Missing parameter. Must have a password.');
		} else {
			t.fail('Failed to catch Missing parameter. Must have a password.');
			logger.error(err.stack ? err.stack : err);
		}
	});

	var clientp4 = Client.loadFromConfig('test/fixtures/network.yaml');
	t.pass('Successfully loaded a network configuration');
	var p4 = clientp4._setUserFromConfig({username:'username', password:'password'}).then(()=> {
		t.fail('Should not be able to load an user based on the config');
	}).catch(function (err) {
		if (err.message.indexOf('Client requires a network configuration loaded, stores attached, and crypto suite.') >= 0) {
			t.pass('Successfully caught Client requires a network configuration loaded, stores attached, and crypto suite.');
		} else {
			t.fail('Failed to catch Client requires a network configuration loaded, stores attached, and crypto suite.');
			logger.error(err.stack ? err.stack : err);
		}
	});

	Promise.all([p1,p2, p3, p4])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Client network config calls failed during the Promise.all');
			logger.error(err.stack ? err.stack : err);
			t.end();
		}
	);

	t.end();
});

function checkTarget(target, check, msg, t) {
	if(Array.isArray(target)) {
		target = target[0];
	}
	if(target.toString().indexOf(check) > -1) {
		t.pass('Successfully got the correct target result for '+ msg);
	} else {
		t.equals(check, target.toString(), 'Failed to get correct target result for '+ msg);
	}
}
