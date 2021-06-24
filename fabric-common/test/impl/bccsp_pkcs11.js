/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const rewire = require('rewire');
const PKCS11_Rewire = rewire('../../lib/impl/bccsp_pkcs11');
const pkcs11jsStub = require('./pkcs11jsStub');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('CryptoSuite_PKCS11', () => {

	const sandbox = sinon.createSandbox();
	let utilsStub;
	let configStub;
	let savedpkcs11OpenSessionFunction;

	beforeEach(() => {
		configStub = sandbox.stub();
		configStub.withArgs('crypto-pkcs11-lib').returns('/temp');
		configStub.withArgs('crypto-pkcs11-slot').returns(2);
		configStub.withArgs('crypto-pkcs11-usertype').returns(2);
		configStub.withArgs('crypto-pkcs11-readwrite').returns('true');
		configStub.withArgs('crypto-pkcs11-pin').returns('pin');
		configStub.withArgs('crypto-hash-algo').returns('sha2');

		utilsStub = {
			getConfigSetting: configStub
		};
		savedpkcs11OpenSessionFunction = PKCS11_Rewire.prototype._pkcs11OpenSession;

	});

	afterEach(() => {
		sandbox.restore();
		PKCS11_Rewire.prototype._pkcs11OpenSession = savedpkcs11OpenSessionFunction;
	});

	describe('#constructor', () => {
		it('should throw when no params are given', () => {
			(() => {
				new PKCS11_Rewire();
			}).should.throw(/keySize must be specified/);
		});

		it('should throw when unsupported bits key sizes are given', () => {
			(() => {
				new PKCS11_Rewire(222);
			}).should.throw(/only 256 or 384 bits key sizes are supported/);
		});

		it('should throw when no library path is given', () => {
			(() => {
				new PKCS11_Rewire(256);
			}).should.throw(/PKCS11 library path must be specified/);
		});

		it('should throw if pkcs11 slot or label not given', () => {
			(() => {
				new PKCS11_Rewire(256, 'sha2', {lib: '/temp'});
			}).should.throw(/PKCS11 slot or label must be specified/);
		});

		it('should throw if invalid [string] pkcs11 slot given', () => {
			(() => {
				new PKCS11_Rewire(256, 'sha2', {lib: '/temp', slot: 'a'});
			}).should.throw(/PKCS11 slot number invalid/);
		});

		it('should throw if invalid [double] pkcs11 slot given', () => {
			(() => {
				new PKCS11_Rewire(256, 'sha2', {lib: '/temp', slot: 2.2});
			}).should.throw(/PKCS11 slot number invalid/);
		});

		it('should throw if pkcs11 slot PIN not given', () => {
			(() => {
				new PKCS11_Rewire(256, 'sha2', {lib: '/temp', slot: 2});
			}).should.throw(/PKCS11 PIN must be set/);
		});

		it('should throw if pkcs11 slot PIN is not a string', () => {
			(() => {
				new PKCS11_Rewire(256, 'sha2', {lib: '/temp', slot: 2, pin: 7});
			}).should.throw(/PKCS11 PIN must be set/);
		});

		it('should throw if invalid usertype', () => {
			(() => {
				new PKCS11_Rewire(256, 'sha2', {lib: '/temp', slot: 2, pin: 'pin', usertype: 'invalid'});
			}).should.throw(/usertype number invalid/);
		});

		it('should throw if invalid readwrite', () => {
			(() => {
				new PKCS11_Rewire(256, 'sha2', {lib: '/temp', slot: 2, pin: 'pin', usertype: 2, readwrite: 'not'});
			}).should.throw(/readwrite setting must be "true" or "false"/);
		});

		it('should retrieve crypto-pkcs11-lib from config setting if no opts specified', () => {
			PKCS11_Rewire.__set__('utils', utilsStub);
			PKCS11_Rewire.prototype._pkcs11OpenSession = sandbox.stub();
			new PKCS11_Rewire(256, 'sha2');
			sinon.assert.calledWith(configStub, 'crypto-pkcs11-lib');
		});

		it('should retrieve crypto-pkcs11-slot from config setting if no opts specified', () => {
			PKCS11_Rewire.__set__('utils', utilsStub);
			PKCS11_Rewire.prototype._pkcs11OpenSession = sandbox.stub();
			new PKCS11_Rewire(256, 'sha2');
			sinon.assert.calledWith(configStub, 'crypto-pkcs11-slot');
		});

		it('should retrieve crypto-pkcs11-label from config setting if no opts specified', () => {
			PKCS11_Rewire.__set__('utils', utilsStub);
			PKCS11_Rewire.prototype._pkcs11OpenSession = sandbox.stub();
			new PKCS11_Rewire(256, 'sha2');
			sinon.assert.calledWith(configStub, 'crypto-pkcs11-label');
		});

		it('should retrieve crypto-pkcs11-usertype from config setting if no opts specified', () => {
			PKCS11_Rewire.__set__('utils', utilsStub);
			PKCS11_Rewire.prototype._pkcs11OpenSession = sandbox.stub();
			new PKCS11_Rewire(256, 'sha2');
			sinon.assert.calledWith(configStub, 'crypto-pkcs11-usertype');
		});

		it('should retrieve crypto-pkcs11-readwrite from config setting if no opts specified', () => {
			PKCS11_Rewire.__set__('utils', utilsStub);
			PKCS11_Rewire.prototype._pkcs11OpenSession = sandbox.stub();
			new PKCS11_Rewire(256, 'sha2');
			sinon.assert.calledWith(configStub, 'crypto-pkcs11-readwrite');
		});

		it('should retrieve crypto-hash-algo from config setting if not provided', () => {
			PKCS11_Rewire.__set__('utils', utilsStub);
			PKCS11_Rewire.prototype._pkcs11OpenSession = sandbox.stub();
			new PKCS11_Rewire(256);
			sinon.assert.calledWith(configStub, 'crypto-hash-algo');
		});

		describe('when determining whether to use slot or label', () => {
			const slot1 = Buffer.from('1234');
			const slot2 = Buffer.from('5678');
			const tokenInfo = sandbox.stub();
			tokenInfo.withArgs(slot1).returns({label: 'ForFabric'});
			tokenInfo.withArgs(slot2).returns({label: 'someLabel'});

			PKCS11_Rewire.__set__('pkcs11js', pkcs11jsStub);

			beforeEach(() => {
				pkcs11jsStub.reset();
				pkcs11jsStub.pkcs11Stub.C_GetTokenInfo = tokenInfo;
			});

			it('should throw an error if no slots are returned', () => {
				pkcs11jsStub.pkcs11Stub.C_GetSlotList = () => [];

				(() => {
					new PKCS11_Rewire(256, 'sha2', {
						lib: 'lib',
						pin: '1234',
						label: 'someLabel'
					});
				}).should.throw(/PKCS11 no slots have been created/);

				pkcs11jsStub.pkcs11Stub.C_GetSlotList = () => null;

				(() => {
					new PKCS11_Rewire(256, 'sha2', {
						lib: 'lib',
						pin: '1234',
						label: 'someLabel'
					});
				}).should.throw(/PKCS11 no slots have been created/);
			});

			it('should throw an error if label cannot be found and there are slots', () => {
				pkcs11jsStub.pkcs11Stub.C_GetSlotList = () => [slot1, slot2];

				(() => {
					new PKCS11_Rewire(256, 'sha2', {
						lib: 'lib',
						pin: '1234',
						label: 'someLabel1'
					});
				}).should.throw(/PKCS11 label someLabel1 cannot be found in the slot list/);
			});

			it('should throw an error if the slot index provided is not within the slot list range', () => {
				pkcs11jsStub.pkcs11Stub.C_GetSlotList = () => [slot1, slot2];

				(() => {
					new PKCS11_Rewire(256, 'sha2', {
						lib: 'lib',
						pin: '1234',
						slot: 3,
					});
				}).should.throw(/PKCS11 slot number non-exist/);

				(() => {
					new PKCS11_Rewire(256, 'sha2', {
						lib: 'lib',
						pin: '1234',
						slot: -1,
					});
				}).should.throw(/PKCS11 slot number non-exist/);

			});

			it('should find the correct slot if the correct label is available', () => {
				pkcs11jsStub.pkcs11Stub.C_GetSlotList = () => [slot1, slot2];

				let openSessionStub = sandbox.stub();
				pkcs11jsStub.pkcs11Stub.C_OpenSession = openSessionStub;

				new PKCS11_Rewire(256, 'sha2', {
					lib: 'lib',
					pin: '1234',
					label: 'someLabel'
				});
				sinon.assert.calledOnceWithExactly(openSessionStub, slot2, sinon.match.any);

				pkcs11jsStub.pkcs11Stub.C_GetSlotList = () => [slot1];

				openSessionStub = sandbox.stub();
				pkcs11jsStub.pkcs11Stub.C_OpenSession = openSessionStub;

				new PKCS11_Rewire(256, 'sha2', {
					lib: 'lib',
					pin: '1234',
					label: 'ForFabric'
				});
				sinon.assert.calledOnceWithExactly(openSessionStub, slot1, sinon.match.any);

			});

			it('should use slot index if no label is provided', () => {
				pkcs11jsStub.pkcs11Stub.C_GetSlotList = () => [slot1, slot2];

				const openSessionStub = sandbox.stub();
				pkcs11jsStub.pkcs11Stub.C_OpenSession = openSessionStub;

				new PKCS11_Rewire(256, 'sha2', {
					lib: 'lib',
					pin: '1234',
					slot: 0,
				});
				sinon.assert.calledOnceWithExactly(openSessionStub, slot1, sinon.match.any);
			});

			it('should throw an error if label cannot be found even if a valid slot index is provided', () => {
				pkcs11jsStub.pkcs11Stub.C_GetSlotList = () => [slot1, slot2];

				(() => {
					new PKCS11_Rewire(256, 'sha2', {
						lib: 'lib',
						pin: '1234',
						slot: 0,
						label: 'someLabel1'
					});
				}).should.throw(/PKCS11 label someLabel1 cannot be found in the slot list/);
			});

			it('should find the correct slot by label even if a valid slot index is provided', () => {
				pkcs11jsStub.pkcs11Stub.C_GetSlotList = () => [slot1, slot2];

				const openSessionStub = sandbox.stub();
				pkcs11jsStub.pkcs11Stub.C_OpenSession = openSessionStub;

				new PKCS11_Rewire(256, 'sha2', {
					lib: 'lib',
					pin: '1234',
					slot: 0,
					label: 'someLabel'
				});
				sinon.assert.calledOnceWithExactly(openSessionStub, slot2, sinon.match.any);
			});
		});
	});

	describe('#getKeySize', () => {
		it('should run', () => {
			PKCS11_Rewire.__set__('utils', utilsStub);
			PKCS11_Rewire.prototype._pkcs11OpenSession = sandbox.stub();
			const key = new PKCS11_Rewire(256);
			key.getKeySize().should.be.equal(256);
		});
	});
});
