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
const OrganizationRewire = rewire('../lib/Organization');
const Organization = require('../lib/Organization');
const Peer = require('../lib/Peer');
const CertificateAuthority = require('../lib/CertificateAuthority');

const chai = require('chai');
const should = chai.should();
const sinon = require('sinon');

describe('Organization', () => {

	describe('#constructor', () => {

		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should throw if name parameter is missing', () => {
			(() => {
				new Organization();
			}).should.throw(/Missing name parameter/);
		});

		it('should throw if name parameter is null', () => {
			(() => {
				new Organization(null);
			}).should.throw(/Missing name parameter/);
		});

		it('should throw if mspid parameter is missing', () => {
			(() => {
				new Organization('bob');
			}).should.throw(/Missing mspid parameter/);
		});

		it('should throw if mspid parameter is null', () => {
			(() => {
				new Organization('bob', null);
			}).should.throw(/Missing mspid parameter/);
		});

		it('should log entry', () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			OrganizationRewire.__set__('logger', FakeLogger);

			new OrganizationRewire('bob', 'mspid_for_bob');

			sinon.assert.calledOnce(debugStub);
			debugStub.getCall(0).args.should.deep.equal(['Organization.const']);
		});

		it('should initialise parameters', () => {

			const myOrg = new Organization('my_org_name', 'my_org_mspid');
			myOrg._name.should.equal('my_org_name');
			myOrg._mspid.should.equal('my_org_mspid');
			myOrg._peers.should.be.an('array').of.length(0);
			myOrg._certificateAuthorities.should.be.an('array').of.length(0);
			should.not.exist(myOrg._adminPrivateKeyPEM);
			should.not.exist(myOrg._adminCertPEM);
		});
	});

	describe('#getName', () => {
		it('should get the organization name', () => {
			const myOrg = new Organization('my_org_name', 'my_org_mspid');
			myOrg.getName().should.equal('my_org_name');
		});
	});

	describe('#getMspid', () => {
		it('should get the mspid', () => {
			const myOrg = new Organization('my_org_name', 'my_org_mspid');
			myOrg.getMspid().should.equal('my_org_mspid');
		});
	});

	describe('#addPeer', () => {
		it('should add a peer to the internal array', () => {
			const myOrg = new Organization('my_org_name', 'my_org_mspid');
			myOrg._peers.should.be.an('array').of.length(0);
			myOrg.addPeer({peer: 'this is a fake peer'});
			myOrg._peers.should.be.an('array').of.length(1);
		});
	});

	describe('#getPeers', () => {
		it('should get the peers array', () => {
			const myOrg = new Organization('my_org_name', 'my_org_mspid');
			myOrg._peers.should.be.an('array').of.length(0);

			const fake1 = {peer: 'this is a fake peer'};
			const fake2 = {peer: 'this is also a fake peer'};
			myOrg.addPeer(fake1);
			myOrg.addPeer(fake2);

			const peers = myOrg.getPeers();
			peers.should.be.an('array').of.length(2);
			peers.should.include(fake1);
			peers.should.include(fake2);
		});
	});

	describe('#addCertificateAuthority', () => {
		it('should add a certificate authority to the internal array', () => {
			const myOrg = new Organization('my_org_name', 'my_org_mspid');
			myOrg._certificateAuthorities.should.be.an('array').of.length(0);
			myOrg.addCertificateAuthority({certAuth: 'this is a fake certAuth'});
			myOrg._certificateAuthorities.should.be.an('array').of.length(1);
		});
	});

	describe('#getCertificateAuthorities', () => {
		it('should get the certificate authority array', () => {
			const myOrg = new Organization('my_org_name', 'my_org_mspid');
			myOrg._certificateAuthorities.should.be.an('array').of.length(0);

			const fake1 = {certAuth: 'this is a fake certAuth'};
			const fake2 = {certAuth: 'this is also a fake certAuth'};
			myOrg.addCertificateAuthority(fake1);
			myOrg.addCertificateAuthority(fake2);

			const peers = myOrg.getCertificateAuthorities();
			peers.should.be.an('array').of.length(2);
			peers.should.include(fake1);
			peers.should.include(fake2);
		});
	});

	describe('#setAdminPrivateKey', () => {
		it('should set the admin private key', () => {
			const myOrg = new Organization('my_org_name', 'my_org_mspid');
			should.not.exist(myOrg._adminPrivateKeyPEM);

			const myKey = 'this_is_my_key_there_are_many_like_it_but_this_one_is_mine';
			myOrg.setAdminPrivateKey(myKey);
			should.exist(myOrg._adminPrivateKeyPEM);
			myOrg._adminPrivateKeyPEM.should.equal(myKey);
		});
	});

	describe('#getAdminPrivateKey', () => {
		it('should return the admin private key', () => {
			const myOrg = new Organization('my_org_name', 'my_org_mspid');
			should.not.exist(myOrg._adminPrivateKeyPEM);

			const myKey = 'this_is_my_key_there_are_many_like_it_but_this_one_is_mine';
			myOrg._adminPrivateKeyPEM = myKey;
			myOrg.getAdminPrivateKey().should.equal(myKey);
		});
	});

	describe('#setAdminCert', () => {
		it('should set the admin certificate', () => {
			const myOrg = new Organization('my_org_name', 'my_org_mspid');
			should.not.exist(myOrg._adminCertPEM);

			const myCert = 'this_is_a_fake_cert';
			myOrg.setAdminCert(myCert);
			should.exist(myOrg._adminCertPEM);
			myOrg._adminCertPEM.should.equal(myCert);
		});
	});

	describe('#getAdminCert', () => {
		it('should return the admin certificate', () => {
			const myOrg = new Organization('my_org_name', 'my_org_mspid');
			should.not.exist(myOrg._adminCertPEM);

			const myCert = 'this_is_a_fake_cert';
			myOrg._adminCertPEM = myCert;
			myOrg.getAdminCert().should.equal(myCert);
		});
	});

	describe('#toString', () => {
		it('should return a string representation of the Organization object', () => {
			const myOrg = new Organization('my_org_name', 'my_org_mspid');

			// Add peers
			const P1 = new Peer('grpc://this.domain.one');
			const P2 = new Peer('grpc://this.domain.two');
			myOrg.addPeer(P1);
			myOrg.addPeer(P2);

			// Add cert auths
			const CA1 = new CertificateAuthority('ca1', 'caname1', 'grpc://this.domain.one');
			const CA2 = new CertificateAuthority('ca2', 'caname2', 'grpc://this.domain.two');
			myOrg.addCertificateAuthority(CA1);
			myOrg.addCertificateAuthority(CA2);

			const result = myOrg.toString();
			result.should.equal('Organization : {name : my_org_name, mspid : my_org_mspid, peers : [Peer:{url:grpc://this.domain.one},Peer:{url:grpc://this.domain.two}], certificateAuthorities : [CertificateAuthority : {name : ca1, url : grpc://this.domain.one},CertificateAuthority : {name : ca2, url : grpc://this.domain.two}]}');
		});
	});
});
