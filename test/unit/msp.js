/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const rewire = require('rewire');

const fs = require('fs-extra');
const path = require('path');
const ProtoLoader = require('fabric-client/lib/ProtoLoader');
const utils = rewire('fabric-client/lib/utils.js');
const testutil = require('./util.js');
const MSP = require('fabric-client/lib/msp/msp.js');
const MSPM = require('fabric-client/lib/msp/msp-manager.js');
const idModule = require('fabric-client/lib/msp/identity.js');
const Identity = idModule.Identity;

const mspProto = ProtoLoader.load(path.join(__dirname, '../../fabric-client/lib/protos/msp/msp_config.proto')).msp;

const FABRIC = 0;
const TEST_CERT_PEM = 	fs.readFileSync(path.resolve(__dirname, '../fixtures/crypto-material/crypto-config/peerOrganizations/org1.example.com/msp/cacerts/ca.org1.example.com-cert.pem'));

test('\n\n** MSP Tests **\n\n', async (t) => {
	testutil.resetDefaults();

	// construct MSP config objects for org0 and org1
	const configs = [];
	const mspm = new MSPM();

	t.throws(
		() => {
			mspm.loadMSPs({});
		},
		/"mspConfigs" argument must be an array/,
		'Check MSPManager.loadMSPs() arguments: must be an array'
	);

	t.throws(
		() => {
			mspm.loadMSPs([{
				getType: () => 'bad value'
			}]);
		},
		/MSP Configuration object type not supported/,
		'Check MSPManager.loadMSPs() arguments: each config must have getType() returning a number representing types'
	);

	t.throws(
		() => {
			mspm.loadMSPs([{
				getType: () => 0
			}]);
		},
		/MSP Configuration object missing the payload in the "Config" property/,
		'Check MSPManager.loadMSPs() arguments: each config must have getConfig() returning a valid FabricMSPConfig'
	);

	t.throws(
		() => {
			mspm.loadMSPs([{
				getType: () => 0,
				getConfig: () => null
			}]);
		},
		/MSP Configuration object missing the payload in the "Config" property/,
		'Check MSPManager.loadMSPs() arguments: each config must have getConfig() returning a valid FabricMSPConfig'
	);

	let config = loadMSPConfig('peer0.org1.example.com');
	t.pass('Successfully loaded msp config for org0');

	configs.push(config);

	config = loadMSPConfig('peer1.org1.example.com');
	t.pass('Successfully loaded msp config for org1');

	configs.push(config);

	mspm.loadMSPs(configs);

	const msps = mspm.getMSPs();
	for (const mspid in msps) {
		if (msps.hasOwnProperty(mspid)) {
			const msp = msps[mspid];
			t.equal(msp.getId(), mspid, 'Check loaded MSP instance for id');
			t.notEqual(msp._rootCerts, null, 'Check loaded MSP instance of non-null root certs');
			t.notEqual(msp._admins, null, 'Check loaded MSP instance of non-null admin certs');
			t.notEqual(msp._cryptoSuite, null, 'Check loaded MSP instance of non-null crypto suite');
			t.equal(msp.getOrganizationUnits().length, 0, 'Check loaded MSP instance for orgs');
			t.notEqual(msp._intermediateCerts, null, 'Check loaded MSP instance for intermediateCerts');
		}
	}

	// test deserialization using the msp manager
	const cryptoUtils = utils.newCryptoSuite();
	cryptoUtils.setCryptoKeyStore(utils.newCryptoKeyStore());
	const mspImpl = new MSP({
		rootCerts: [],
		admins: [],
		id: 'peer0.org1.example.com',
		cryptoSuite: cryptoUtils
	});

	const pubKey = cryptoUtils.importKey(TEST_CERT_PEM);
	let identity = new Identity(TEST_CERT_PEM, pubKey, mspImpl.getId(), cryptoUtils);

	const serializedID = identity.serialize();
	identity = await mspm.deserializeIdentity(serializedID);
	t.equal(identity.getMSPId(), 'peer0.org1.example.com', 'Deserialized identity using MSP manager');

	t.equal(mspm.getMSP('peer0.org1.example.com').getId(), 'peer0.org1.example.com', 'Checking MSPManager getMSP() method');
	t.end();

});

const loadMSPConfig = (peerorg) => {
	const mspConfig = new mspProto.MSPConfig();
	mspConfig.setType(FABRIC); // type: FABRIC

	const fConfig = new mspProto.FabricMSPConfig();
	fConfig.setName(peerorg);

	let data = fs.readFileSync(path.resolve(__dirname, '../fixtures/crypto-material/crypto-config/peerOrganizations/org1.example.com/peers', peerorg, 'msp/cacerts/ca.org1.example.com-cert.pem'));
	fConfig.setRootCerts([data]);
	data = fs.readFileSync(path.resolve(__dirname, '../fixtures/crypto-material/crypto-config/peerOrganizations/org1.example.com/peers', peerorg, 'msp/admincerts/Admin@org1.example.com-cert.pem'));
	fConfig.setAdmins([data]);
	mspConfig.setConfig(fConfig.toBuffer());
	return mspConfig;
};
