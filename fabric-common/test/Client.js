/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const rewire = require('rewire');
const chai = require('chai');
const sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');
const should = chai.should();
chai.use(chaiAsPromised);

const Utils = require('../lib/Utils');
const Client = rewire('../lib/Client');
const User = require('../lib/User');

const fs = require('fs');
const path = require('path');

describe('Client', () => {
	let client;

	const certificateAsPEM = fs.readFileSync(path.join(__dirname, 'data', 'cert.pem'));
	const keyAsPEM = fs.readFileSync(path.join(__dirname, 'data', 'key.pem'));
	Utils.setConfigSetting('crypto-hsm', false);
	Utils.setConfigSetting('crypto-suite-software', {'EC': 'fabric-common/lib/impl/CryptoSuite_ECDSA_AES.js'});
	Utils.setConfigSetting('crypto-hash-algo', 'SHA2');
	Utils.setConfigSetting('crypto-keysize', 256);
	const user = User.createUser('user', 'password', 'mspid', certificateAsPEM, keyAsPEM);

	beforeEach(() => {
		client = new Client('myclient');
	});

	describe('#constructor', () => {
		it('should require a name', () => {
			(() => {
				new Client();
			}).should.throw('Missing name parameter');
		});
	});
	describe('#getConnectionOptions', () => {
		it('should add in an options and keep what is there', () => {
			const options = client.getConnectionOptions({'some': 'C'});
			options.some.should.equal('C');
		});
		it('should add in an options and add tls settings', () => {
			client.setTlsClientCertAndKey('client-cert', 'client-key');
			const options = client.getConnectionOptions({'some': 'C'});
			options.some.should.equal('C');
			options.clientCert.should.equal('client-cert');
		});
		it('should add in an options and override tls settings', () => {
			client.setTlsClientCertAndKey('client-cert', 'client-key');
			const options = client.getConnectionOptions({'some': 'C', 'clientCert': 'added-cert'});
			options.some.should.equal('C');
			options.clientCert.should.equal('added-cert');
		});
	});
	describe('#newEndpoint', () => {
		it('should require a url', () => {
			(() => {
				client.newEndpoint({'some': 'C'});
			}).should.throw('Missing url parameter');
		});
		it('should require a url', () => {
			(() => {
				client.newEndpoint();
			}).should.throw('Missing url parameter');
		});
		it('should require a valid url', () => {
			(() => {
				client.newEndpoint({'url': 'C'});
			}).should.throw('Invalid protocol: Protocol must be grpc or grpcs');
		});
		it('should add in an options and keep what is there', () => {
			const endpoint = client.newEndpoint({'url': 'grpc://somehost.com', 'some': 'C'});
			endpoint.options.url.should.equal('grpc://somehost.com');
			endpoint.options.some.should.equal('C');
			endpoint.type.should.equal('Endpoint');
		});
		it('should add in an options and keep what is there', () => {
			const endpoint = client.newEndpoint({'url': 'grpc://somehost.com', 'ssl-target-name-override': 'myhost.com'});
			endpoint.options.url.should.equal('grpc://somehost.com');
			endpoint.options['grpc.ssl_target_name_override'].should.equal('myhost.com');
			endpoint.type.should.equal('Endpoint');
		});
		it('should add in an options and add tls settings', () => {
			client.setTlsClientCertAndKey('client-cert', 'client-key');
			const endpoint = client.newEndpoint({'url': 'grpc://somehost.com', 'some': 'C'});
			endpoint.options.url.should.equal('grpc://somehost.com');
			endpoint.options.some.should.equal('C');
			endpoint.options.clientCert.should.equal('client-cert');
		});
		it('should add in an options and override tls settings', () => {
			client.setTlsClientCertAndKey('client-cert', 'client-key');
			const endpoint = client.newEndpoint({'url': 'grpc://somehost.com', 'some': 'C', 'clientCert': 'added-cert'});
			endpoint.options.url.should.equal('grpc://somehost.com');
			endpoint.options.some.should.equal('C');
			endpoint.options.clientCert.should.equal('added-cert');
		});
	});
	describe('#newIdentityContext', () => {
		it('should require a user', () => {
			(() => {
				client.newIdentityContext();
			}).should.throw('Missing user parameter');
		});
		it('should require a valid user', () => {
			(() => {
				client.newIdentityContext({});
			}).should.throw('Missing valid user parameter');
		});
		it('should require a valid user', () => {
			const idx = client.newIdentityContext(user);
			idx.type.should.equal('IdentityContext');
		});
	});
	describe('#newEndorser', () => {
		it('should require a name', () => {
			(() => {
				client.newEndorser();
			}).should.throw('Missing name parameter');
		});
		it('should return an instance', () => {
			const inst = client.newEndorser('name');
			inst.type.should.equal('Endorser');
			inst.name.should.equal('name');
		});
		it('should return an instance with mspid', () => {
			const inst = client.newEndorser('name', 'mspid');
			inst.type.should.equal('Endorser');
			inst.name.should.equal('name');
			inst.mspid.should.equal('mspid');
		});
	});
	describe('#getEndorser', () => {
		it('should require a name', () => {
			(() => {
				client.getEndorser();
			}).should.throw('Missing name parameter');
		});
		it('should return an instance', () => {
			const inst = client.getEndorser('name');
			inst.type.should.equal('Endorser');
			inst.name.should.equal('name');
		});
		it('should return an instance with mspid', () => {
			const inst = client.getEndorser('name', 'mspid');
			inst.type.should.equal('Endorser');
			inst.name.should.equal('name');
			inst.mspid.should.equal('mspid');
			inst.something = 'something';
			const inst2 = client.getEndorser('name');
			inst2.something.should.equal('something');
		});
	});
	describe('#newCommitter', () => {
		it('should require a name', () => {
			(() => {
				client.newCommitter();
			}).should.throw('Missing name parameter');
		});
		it('should return an instance', () => {
			const inst = client.newCommitter('name');
			inst.type.should.equal('Committer');
			inst.name.should.equal('name');
		});
		it('should return an instance with mspid', () => {
			const inst = client.newCommitter('name', 'mspid');
			inst.type.should.equal('Committer');
			inst.name.should.equal('name');
			inst.mspid.should.equal('mspid');
		});
	});
	describe('#getCommitter', () => {
		it('should require a name', () => {
			(() => {
				client.getCommitter();
			}).should.throw('Missing name parameter');
		});
		it('should return an instance', () => {
			const inst = client.getCommitter('name');
			inst.type.should.equal('Committer');
			inst.name.should.equal('name');
		});
		it('should return an instance with mspid', () => {
			const inst = client.getCommitter('name', 'mspid');
			inst.type.should.equal('Committer');
			inst.name.should.equal('name');
			inst.mspid.should.equal('mspid');
			inst.something = 'something';
			const inst2 = client.getCommitter('name');
			inst2.something.should.equal('something');
		});
	});
	describe('#newEventer', () => {
		it('should require a name', () => {
			(() => {
				client.newEventer();
			}).should.throw('Missing name parameter');
		});
		it('should return an instance', () => {
			const inst = client.newEventer('name');
			inst.type.should.equal('Eventer');
			inst.name.should.equal('name');
		});
		it('should return an instance with mspid', () => {
			const inst = client.newEventer('name', 'mspid');
			inst.type.should.equal('Eventer');
			inst.name.should.equal('name');
			inst.mspid.should.equal('mspid');
		});
	});
	describe('#newDiscoverer', () => {
		it('should require a name', () => {
			(() => {
				client.newDiscoverer();
			}).should.throw('Missing name parameter');
		});
		it('should return an instance', () => {
			const inst = client.newDiscoverer('name');
			inst.type.should.equal('Discoverer');
			inst.name.should.equal('name');
		});
		it('should return an instance with mspid', () => {
			const inst = client.newDiscoverer('name', 'mspid');
			inst.type.should.equal('Discoverer');
			inst.name.should.equal('name');
			inst.mspid.should.equal('mspid');
		});
	});
	describe('#newChannel', () => {
		it('should require a name', () => {
			(() => {
				client.newChannel();
			}).should.throw('Missing name parameter');
		});
		it('should return an instance', () => {
			const inst = client.newChannel('name');
			inst.type.should.equal('Channel');
			inst.name.should.equal('name');
		});
	});
	describe('#getChannel', () => {
		it('should require a name', () => {
			(() => {
				client.getChannel();
			}).should.throw('Missing name parameter');
		});
		it('should return an instance', () => {
			const inst = client.getChannel('name');
			inst.type.should.equal('Channel');
			inst.name.should.equal('name');
		});
		it('should return an instance with mspid', () => {
			const inst = client.getChannel('name');
			inst.type.should.equal('Channel');
			inst.name.should.equal('name');
			inst.something = 'something';
			const inst2 = client.getChannel('name');
			inst2.something.should.equal('something');
		});
	});
	describe('#setTlsClientCertAndKey', () => {
		it('should set selfsigned clientCert, cleintKey', () => {
			const generateX509CertificateStub = sinon.stub().returns('client-cert');
			const toBytesStub = sinon.stub().returns('client-key');
			const generateEphemeralKeyStub = sinon.stub().returns({
				toBytes: toBytesStub,
				generateX509Certificate: generateX509CertificateStub
			});
			const newCryptoSuiteStub = sinon.stub().returns({generateEphemeralKey: generateEphemeralKeyStub});
			Client.__set__('BaseClient.newCryptoSuite', newCryptoSuiteStub);
			const myClient = new Client('client');

			myClient.setTlsClientCertAndKey();
			myClient._tls_mutual.clientCert.should.equal('client-cert');
			myClient._tls_mutual.clientKey.should.equal('client-key');
			myClient._tls_mutual.selfGenerated.should.equal(true);
		});
		it('should set clientCert, cleintKey', () => {
			client.setTlsClientCertAndKey('client-cert', 'client-key');
			client._tls_mutual.clientCert.should.equal('client-cert');
			client._tls_mutual.clientKey.should.equal('client-key');
			client._tls_mutual.selfGenerated.should.equal(false);
			should.equal(client._tls_mutual.clientCertHash, undefined);
		});
	});
	describe('#addTlsClientCertAndKey', () => {
		it('should add the current _tls_mutual values to the options object', () => {
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
	});
	describe('#getClientCertHash', () => {
		it('should return undefined', () => {
			const hash = client.getClientCertHash();
			should.equal(hash, undefined);
		});
		it('should require a valid pem', () => {
			(() => {
				client.setTlsClientCertAndKey('client-cert', 'client-key');
				client.getClientCertHash();
			}).should.throw('Input parameter does not appear to be PEM-encoded');
		});
		it('should return a hash', () => {
			client.setTlsClientCertAndKey(certificateAsPEM, 'client-key');
			const hash = client.getClientCertHash();
			should.equal(hash.toString('hex'), '87feacdd22ce778be5e639b1302439ac1bb58e2df2a99c78c8880ec9ee588c45');
		});
		it('should return same hash', () => {
			client.setTlsClientCertAndKey(certificateAsPEM, 'client-key');
			const hash = client.getClientCertHash();
			should.equal(hash.toString('hex'), '87feacdd22ce778be5e639b1302439ac1bb58e2df2a99c78c8880ec9ee588c45');
			const hash2 = client.getClientCertHash();
			should.equal(hash.toString('hex'), hash2.toString('hex'));
		});
	});
	describe('#toString', () => {
		it('should return string', () => {
			const string = client.toString();
			should.equal(string, 'Client: {name:myclient}');
		});
	});
});
