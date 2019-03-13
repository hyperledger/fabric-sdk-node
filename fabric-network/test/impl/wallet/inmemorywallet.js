/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const sinon = require('sinon');
const chai = require('chai');
chai.use(require('chai-as-promised'));
const should = chai.should();

const InMemoryWallet = require('../../../lib/impl/wallet/inmemorywallet');
const X509WalletMixin = require('../../../lib/impl/wallet/x509walletmixin');
const Client = require('fabric-client');
const api = require('fabric-client/lib/api.js');


describe('InMemoryWallet', () => {
	describe('#constructor', () => {
		it('should default to X509 wallet mixin', () => {
			const wallet = new InMemoryWallet();
			wallet.walletMixin.should.be.an.instanceof(X509WalletMixin);
		});

		it('should accept a mixin parameter', () => {
			const wallet = new InMemoryWallet('my_mixin');
			wallet.walletMixin.should.equal('my_mixin');
		});
	});

	describe('#getStateStore', () => {
		const wallet = new InMemoryWallet();

		it('should create a KV store', async () => {
			const store = await wallet.getStateStore('test');
			store.should.be.an.instanceof(api.KeyValueStore);
		});
	});

	describe('#getCryptoSuite', () => {
		const wallet = new InMemoryWallet();

		it('should create a KV store', async () => {
			const suite = await wallet.getCryptoSuite('test');
			suite.should.be.an.instanceof(api.CryptoSuite);
		});
	});

	describe('#setUserContext', () => {
		const sandbox = sinon.createSandbox();
		let wallet;
		let mockClient;

		beforeEach(() => {
			wallet = new InMemoryWallet();
			mockClient = sinon.createStubInstance(Client);
		});

		afterEach(() => {
			sandbox.restore();
		});


		it('should throw setting the user context for an unregistered id', async () => {
			return wallet.setUserContext(new Client(), 'test').should.be.rejectedWith('identity \'test\' isn\'t enrolled, or loaded');
		});

		it('should return loaded identity', async () => {
			const mockId = {
				isEnrolled: () => true
			};
			mockClient.getUserContext.withArgs('test', true).returns(mockId);
			const id = await wallet.setUserContext(mockClient, 'test');
			should.equal(id, mockId);
		});

		describe('#configureClientStores', () => {
			it('should set the crypto suite', async () => {
				wallet.walletMixin.getCryptoSuite = (label) => {
					return wallet.getCryptoSuite(label);
				};
				const client = await wallet.configureClientStores(mockClient, 'test');
				mockClient.should.equal(client);
			});
		});

		describe('#getIdentityInfo', () => {
			it('should not return null', async () => {
				wallet.getAllLabels = () => Promise.resolve(['user3']);
				const info = await wallet.list();
				info.should.deep.equal([{label: 'user3', mspId: 'not provided', identifier: 'not provided'}]);
			});
		});
	});

	describe('label storage', () => {
		let wallet;
		const cert = `-----BEGIN CERTIFICATE-----
MIICfzCCAiWgAwIBAgIUNAqZVk9s5/HR7k30feNp8DrYbK4wCgYIKoZIzj0EAwIw
cDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNh
biBGcmFuY2lzY28xGTAXBgNVBAoTEG9yZzEuZXhhbXBsZS5jb20xGTAXBgNVBAMT
EG9yZzEuZXhhbXBsZS5jb20wHhcNMTgwMjI2MjAwOTAwWhcNMTkwMjI2MjAxNDAw
WjBdMQswCQYDVQQGEwJVUzEXMBUGA1UECBMOTm9ydGggQ2Fyb2xpbmExFDASBgNV
BAoTC0h5cGVybGVkZ2VyMQ8wDQYDVQQLEwZjbGllbnQxDjAMBgNVBAMTBWFkbWlu
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEz05miTKv6Vz+qhc5362WIZ44fs/H
X5m9zDOifle5HIjt4Usj+TiUgT1hpbI8UI9pueWhbrZpZXlX6+mImi52HaOBrzCB
rDAOBgNVHQ8BAf8EBAMCA6gwHQYDVR0lBBYwFAYIKwYBBQUHAwEGCCsGAQUFBwMC
MAwGA1UdEwEB/wQCMAAwHQYDVR0OBBYEFPnxMtT6jgYsMAgI38ponGs8sgbqMCsG
A1UdIwQkMCKAIKItrzVrKqtXkupT419m/M7x1/GqKzorktv7+WpEjqJqMCEGA1Ud
EQQaMBiCFnBlZXIwLm9yZzEuZXhhbXBsZS5jb20wCgYIKoZIzj0EAwIDSAAwRQIh
AM1JowZMshCRs6dnOfRmUHV7399KnNvs5QoNw93cuQuAAiBtBEGh1Xt50tZjDcYN
j+yx4IraL4JvMrCHbR5/R+Xo1Q==
-----END CERTIFICATE-----`;
		const key = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgbTXpl4NGXuPtSC/V
PTVNGVBgVv8pZ6kGktVcnQD0KiKhRANCAATPTmaJMq/pXP6qFznfrZYhnjh+z8df
mb3MM6J+V7kciO3hSyP5OJSBPWGlsjxQj2m55aFutmlleVfr6YiaLnYd
-----END PRIVATE KEY-----
`;
		const identity1 = {
			certificate: cert,
			privateKey: key,
			mspId: 'mspOrg1'
		};
		const identity2 = {
			certificate: cert,
			privateKey: key,
			mspId: 'mspOrg2'
		};


		beforeEach(async () => {
			wallet = new InMemoryWallet();
			await wallet.import('user1', identity1);
			await wallet.import('user2', identity2);
		});

		describe('#import', () => {
			it('should throw if there is no wallet mixin', () => {
				wallet = new InMemoryWallet(null);
				return wallet.import(null, null).should.be.rejectedWith('no import method exists');
			});
		});

		describe('#export', () => {
			it('should export the wallet', async () => {
				const id = await wallet.export('user1');
				identity1.mspId.should.equal(id.mspId);
				identity1.certificate.should.equal(id.certificate);
			});

			it('should return null if export an identity that\'s not in the wallet', async () => {
				const id = await wallet.export('user3');
				should.equal(id, null);
			});

			it('should throw if there is no wallet mixin', () => {
				wallet = new InMemoryWallet(null);
				return wallet.export(null, null).should.be.rejectedWith('no export method exists');
			});
		});

		describe('#exists', () => {
			it('should test the existence of an identity from the wallet', async () => {
				let exists = await wallet.exists('user1');
				exists.should.equal(true);
				exists = await wallet.exists('user2');
				exists.should.equal(true);
			});

			it('should test the non-existence of an identity from the wallet', async () => {
				const exists = await wallet.exists('user3');
				exists.should.equal(false);
			});
		});

		describe('#delete', () => {
			it('should delete an identity from the wallet', async () => {
				let exists = await wallet.exists('user1');
				exists.should.equal(true);
				let deleted = await wallet.delete('user1');
				deleted.should.be.true;
				exists = await wallet.exists('user1');
				exists.should.equal(false);
				deleted = await wallet.delete('user1');
				deleted.should.be.false;
			});
		});

		describe('#getAllLabels', () => {
			it('should list all identities in the wallet', async () => {
				const labels = await wallet.getAllLabels();
				// labels.length.should.equal(2);
				labels.includes('user1').should.equal(true);
				labels.includes('user2').should.equal(true);
			});
		});

		describe('#list', () => {
			it('should list all identities in the wallet', async () => {
				const list = await wallet.list();
				const labels = list.map(item => item.label);
				labels.includes('user1').should.equal(true);
				labels.includes('user2').should.equal(true);
			});
		});

		describe('#list', () => {
			it('should return an empty list for no identities in the wallet', async () => {
				const labels = await wallet.getAllLabels();
				labels.forEach(async label => await wallet.delete(label));
				const list = await wallet.list();
				list.length.should.equal(0);
			});

			it('should return a list containing not provided', async () => {
				wallet.walletMixin.getIdentityInfo = () => null;
				const list = await wallet.list();
				list.length.should.equal(2);
				list[0].mspId.should.equal('not provided');
				list[1].mspId.should.equal('not provided');
			});
		});
	});

	describe('InMemoryKVS', () => {
		let store;
		beforeEach(async () => {
			const wallet = new InMemoryWallet();
			store = await wallet.getStateStore('test');
		});

		it('#getValue', async () => {
			await store.setValue('user1', 'val1');
			await store.getValue('user1');
			await store.getValue('user3');
		});
	});
});
