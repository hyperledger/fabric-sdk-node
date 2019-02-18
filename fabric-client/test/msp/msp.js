/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';


const MSP = require('../../lib/msp/msp');
const {Config, CryptoAlgorithms, Identity, SigningIdentity} = require('fabric-common');
const utils = require('../../lib/utils');
const path = require('path');
const fs = require('fs');

require('chai');
const sinon = require('sinon');

const rewire = require('rewire');
const MspRewire = rewire('../../lib/msp/msp');

const certificateAsPEM = fs.readFileSync(path.join(__dirname, '..', 'data', 'cert.pem')).toString('utf8');

describe('MSP', () => {

	describe('#constructor', () => {

		it('should throw if no config', () => {
			(() => {
				new MSP();
			}).should.throw(/Missing required parameter "config"/);
		});

		it('should throw if no [id] within the passed config', () => {
			(() => {
				new MSP({
					cryptoSuite: 'penguin'
				});
			}).should.throw(/Parameter "config" missing required field "id"/);
		});

		it('should throw if no [cryptoSuite] within the passed config', () => {
			(() => {
				new MSP({
					id: 'testMSP'
				});
			}).should.throw(/Parameter "config" missing required field "cryptoSuite"/);
		});

		it('should throw if passed "signer" is not an instance of SigningIdentity', () => {
			(() => {
				new MSP({
					id: 'testMSP',
					cryptoSuite: 'cryptoSuite',
					signer: 1
				});
			}).should.throw(/Parameter "signer" must be an instance of SigningIdentity/);
		});

		it('should not throw if passed "signer" is an instance of SigningIdentity', () => {
			(() => {
				const signer = new SigningIdentity('certificate', 'publicKey', 'mspId', 'cryptoSuite', 'signer');
				new MSP({
					id: 'testMSP',
					cryptoSuite: 'pecryptoSuitenguin',
					signer: signer
				});
			}).should.not.throw();
		});

		it('should set internal parameters from the passed config', () => {
			const signer = new SigningIdentity('certificate', 'publicKey', 'mspId', 'cryptoSuite', 'signer');
			const myMSP = new MSP({
				id: 'testMSP',
				cryptoSuite: 'cryptoSuite',
				signer: signer,
				rootCerts: 'rootCerts',
				intermediateCerts: 'intermediateCerts',
				admins: 'admins',
				orgs: 'orgs',
				tls_root_certs: 'tls_root_certs',
				tls_intermediate_certs: 'tls_intermediate_certs'
			});

			myMSP._rootCerts.should.equal('rootCerts');
			myMSP._intermediateCerts.should.equal('intermediateCerts');
			myMSP._signer.should.equal(signer);
			myMSP._admins.should.equal('admins');
			myMSP.cryptoSuite.should.equal('cryptoSuite');
			myMSP._id.should.equal('testMSP');
			myMSP._organization_units.should.equal('orgs');
			myMSP._tls_root_certs.should.equal('tls_root_certs');
			myMSP._tls_intermediate_certs.should.equal('tls_intermediate_certs');
		});
	});

	describe('#getId', () => {
		it('should return the id', () => {
			const signer = new SigningIdentity('certificate', 'publicKey', 'mspId', 'cryptoSuite', 'signer');
			const myMSP = new MSP({
				id: 'testMSP',
				cryptoSuite: 'pecryptoSuitenguin',
				signer: signer
			});

			myMSP.getId().should.equal('testMSP');
		});
	});

	describe('#getOrganizationUnits', () => {
		it('should return the organizational units', () => {
			const signer = new SigningIdentity('certificate', 'publicKey', 'mspId', 'cryptoSuite', 'signer');
			const myMSP = new MSP({
				id: 'testMSP',
				cryptoSuite: 'pecryptoSuitenguin',
				orgs: 'orgs',
				signer: signer
			});

			myMSP.getOrganizationUnits().should.equal('orgs');
		});
	});

	describe('#getPolicy', () => {
		it('should throw a "Not implemented yet" error', () => {
			(() => {
				const msp = new MSP({
					id: 'testMSP',
					cryptoSuite: 'cryptoSuite'
				});
				msp.getPolicy();
			}).should.throw(/Not implemented yet/);
		});
	});

	describe('#getSigningIdentity', () => {
		it('should throw a "Not implemented yet" error', () => {
			(() => {
				const msp = new MSP({
					id: 'testMSP',
					cryptoSuite: 'cryptoSuite'
				});
				msp.getSigningIdentity();
			}).should.throw(/Not implemented yet/);
		});
	});

	describe('#getDefaultSigningIdentity', () => {
		it('should return the signer', () => {
			const signer = new SigningIdentity('certificate', 'publicKey', 'mspId', 'cryptoSuite', 'signer');
			const msp = new MSP({
				id: 'testMSP',
				cryptoSuite: 'cryptoSuite',
				signer: signer,
				rootCerts: 'rootCerts'
			});
			msp.getDefaultSigningIdentity().should.equal(signer);
		});
	});

	describe('#toProtobuf', () => {

		// const setClientTlsCertHashStub = sinon.stub();
		// protosRewire.__set__('fabprotos.discovery.AuthInfo.prototype.setClientTlsCertHash', setClientTlsCertHashStub);

		it('should set all existing items in the config', () => {
			const setNameStub = sinon.stub();
			const setRootCertsStub = sinon.stub();
			const setIntermediateCertsStub = sinon.stub();
			const setAdminsStub = sinon.stub();
			const setOrganizationalUnitIdentifiersStub = sinon.stub();
			const setTlsRootCertsStub = sinon.stub();
			const getTlsIntermediateCertsStub = sinon.stub();
			const toBufferStub = sinon.stub().returns(new Buffer('test_buffer'));
			const protoStub = sinon.stub().returns({
				setName: setNameStub,
				setRootCerts: setRootCertsStub,
				setIntermediateCerts: setIntermediateCertsStub,
				setAdmins: setAdminsStub,
				setOrganizationalUnitIdentifiers: setOrganizationalUnitIdentifiersStub,
				setTlsRootCerts: setTlsRootCertsStub,
				getTlsIntermediateCerts: getTlsIntermediateCertsStub,
				toBuffer: toBufferStub
			});
			MspRewire.__set__('fabprotos.msp.FabricMSPConfig', protoStub);
			const signer = new SigningIdentity('certificate', 'publicKey', 'mspId', 'cryptoSuite', 'signer');
			const msp = new MspRewire({
				id: 'testMSP',
				cryptoSuite: 'cryptoSuite',
				signer: signer,
				rootCerts: 'rootCerts',
				intermediateCerts: 'intermediateCerts',
				admins: 'admins',
				orgs: 'orgs',
				tls_root_certs: 'tls_root_certs',
				tls_intermediate_certs: 'tls_intermediate_certs'
			});

			// Call function
			msp.toProtobuf();

			// Assert setters called
			sinon.assert.calledOnce(setNameStub);
			sinon.assert.calledWith(setNameStub, 'testMSP');

			sinon.assert.calledOnce(setRootCertsStub);
			sinon.assert.calledWith(setRootCertsStub, 'rootCerts');

			sinon.assert.calledOnce(setIntermediateCertsStub);
			sinon.assert.calledWith(setIntermediateCertsStub, 'intermediateCerts');

			sinon.assert.calledOnce(setAdminsStub);
			sinon.assert.calledWith(setAdminsStub, 'admins');

			sinon.assert.calledOnce(setOrganizationalUnitIdentifiersStub);
			sinon.assert.calledWith(setOrganizationalUnitIdentifiersStub, 'orgs');

			sinon.assert.calledOnce(setTlsRootCertsStub);
			sinon.assert.calledWith(setTlsRootCertsStub, 'tls_root_certs');
		});

		it('should set the type to 0 (Fabric)', () => {
			const setNameStub = sinon.stub();
			const setRootCertsStub = sinon.stub();
			const toBufferStub = sinon.stub().returns(new Buffer('test_buffer'));
			const protoStub = sinon.stub().returns({
				setName: setNameStub,
				setRootCerts: setRootCertsStub,
				toBuffer: toBufferStub
			});
			MspRewire.__set__('fabprotos.msp.FabricMSPConfig', protoStub);
			const signer = new SigningIdentity('certificate', 'publicKey', 'mspId', 'cryptoSuite', 'signer');
			const msp = new MspRewire({
				id: 'testMSP',
				cryptoSuite: 'cryptoSuite',
				signer: signer,
				rootCerts: 'ceert'
			});
			const pBuf = msp.toProtobuf();
			pBuf.getType().should.equal(0);
		});

		it('should set the config to the output of the FabricMSPConfig toBuffer call', () => {
			const setNameStub = sinon.stub();
			const setRootCertsStub = sinon.stub();
			const toBufferStub = sinon.stub().returns(new Buffer('test_buffer'));
			const protoStub = sinon.stub().returns({
				setName: setNameStub,
				setRootCerts: setRootCertsStub,
				toBuffer: toBufferStub
			});
			MspRewire.__set__('fabprotos.msp.FabricMSPConfig', protoStub);
			const signer = new SigningIdentity('certificate', 'publicKey', 'mspId', 'cryptoSuite', 'signer');
			const msp = new MspRewire({
				id: 'testMSP',
				cryptoSuite: 'cryptoSuite',
				signer: signer,
				rootCerts: 'cert'
			});

			// Call function
			const pBuf = msp.toProtobuf();

			// Should set the correct items
			sinon.assert.calledOnce(setNameStub);
			sinon.assert.calledWith(setNameStub, 'testMSP');

			sinon.assert.calledOnce(setRootCertsStub);
			sinon.assert.calledWith(setRootCertsStub, 'cert');

			// Config should exist
			pBuf.getConfig().toString('utf8').should.equal('test_buffer');
		});
	});

	describe('#deserializeIdentity', async () => {
		let revert;
		beforeEach(() => {
			revert = [];
		});

		afterEach(() => {
			if (revert.length) {
				revert.forEach(Function.prototype.call, Function.prototype.call);
			}
		});

		it('should call cryptoSuite.createKeyFromRaw if passed a false flag', () => {

			const importStub = sinon.stub();
			const cryptoStub = {
				createKeyFromRaw: importStub
			};

			const decoded = {
				getIdBytes: sinon.stub().returns(
					{
						toBinary: sinon.stub().returns('binary')
					}
				)
			};

			revert.push(MspRewire.__set__('fabprotos.msp.SerializedIdentity.decode', sinon.stub().returns(decoded)));

			const signer = new SigningIdentity('certificate', 'publicKey', 'mspId', cryptoStub, 'signer');
			const msp = new MspRewire({
				id: 'testMSP',
				cryptoSuite: cryptoStub,
				signer: signer,
				rootCerts: 'cert'
			});

			msp.deserializeIdentity('identity', false);

			sinon.assert.calledOnce(importStub);

			const args = importStub.getCall(0).args;
			args[0].should.equal('binary');
			args[1].algorithm.should.equal('X509Certificate');
		});

		it('should call cryptoSuite.importKey if not passed a false flag', async () => {
			const importStub = sinon.stub().resolves('key');
			const cryptoStub = {
				importKey: importStub
			};

			const decoded = {
				getIdBytes: sinon.stub().returns(
					{
						toBinary: sinon.stub().returns('binary')
					}
				)
			};

			revert.push(MspRewire.__set__('fabprotos.msp.SerializedIdentity.decode', sinon.stub().returns(decoded)));

			const signer = new SigningIdentity('certificate', 'publicKey', 'mspId', cryptoStub, 'signer');
			const msp = new MspRewire({
				id: 'testMSP',
				cryptoSuite: cryptoStub,
				signer: signer,
				rootCerts: 'cert'
			});

			await msp.deserializeIdentity('identity');

			sinon.assert.calledOnce(importStub);

			const args = importStub.getCall(0).args;
			args[0].should.equal('binary');
			args[1].algorithm.should.equal('X509Certificate');
		});

		it('should deserialise a serialized identity', async () => {

			// Set base/default config
			const config = new Config();
			const default_config = path.resolve(__dirname, '../../config/default.json');
			config.file(default_config);

			// Creat an Identity
			const cryptoUtils = utils.newCryptoSuite();
			cryptoUtils.setCryptoKeyStore(utils.newCryptoKeyStore());

			const msp = new MSP({
				rootCerts: [],
				admins: [],
				id: 'testMSP',
				cryptoSuite: cryptoUtils
			});

			const pubKey = cryptoUtils.importKey(certificateAsPEM, {algorithm: CryptoAlgorithms.X509Certificate, ephemeral: true});
			const identity = new Identity(certificateAsPEM, pubKey, msp.getId(), cryptoUtils);
			const serializedID = identity.serialize();

			// Verify non-promise based route
			let deserializedID = await msp.deserializeIdentity(serializedID, false);
			deserializedID.getMSPId().should.equal('testMSP');

			deserializedID = await msp.deserializeIdentity(serializedID);
			deserializedID.getMSPId().should.equal('testMSP');
			deserializedID._publicKey.isPrivate().should.equal(false);
			deserializedID._certificate.should.equal(certificateAsPEM);

		});
	});

	describe('#validate', () => {
		it('should return true, because it is not actually implemented', () => {
			const msp = new MSP({
				id: 'testMSP',
				cryptoSuite: 'cryptoSuite'
			});
			msp.validate().should.be.true;
		});
	});

});
