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
const utils = rewire('fabric-client/lib/utils.js');
const testutil = require('./util.js');
const MSP = require('fabric-client/lib/msp/msp.js');
const MSPM = require('fabric-client/lib/msp/msp-manager.js');
const {Identity} = require('fabric-common');

const mspProto = require('fabric-protos').msp;

const FABRIC = 0;
const TEST_CERT_PEM = require('./constants').TEST_CERT_PEM;

test('\n\n** MSP Tests **\n\n', async (t) => {
	testutil.resetDefaults();

	// construct MSP config objects for org0 and org1
	const configs = [];
	const mspm = new MSPM();

	let config = loadMSPConfig('peerOrg0', 'org0');
	t.pass('Successfully loaded msp config for org0');

	configs.push(config);

	config = loadMSPConfig('peerOrg1', 'org1');
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
		id: 'peerOrg0',
		cryptoSuite: cryptoUtils
	});

	const pubKey = cryptoUtils.importKey(TEST_CERT_PEM);
	let identity = new Identity(TEST_CERT_PEM, pubKey, mspImpl.getId(), cryptoUtils);

	const serializedID = identity.serialize();
	identity = await mspm.deserializeIdentity(serializedID);
	t.equal(identity.getMSPId(), 'peerOrg0', 'Deserialized identity using MSP manager');

	t.equal(mspm.getMSP('peerOrg0').getId(), 'peerOrg0', 'Checking MSPManager getMSP() method');
	t.end();

});

const loadMSPConfig = (name, org) => {
	const mspConfig = new mspProto.MSPConfig();
	mspConfig.setType(FABRIC); // type: FABRIC

	const fConfig = new mspProto.FabricMSPConfig();
	fConfig.setName(name);

	let data = fs.readFileSync(path.resolve(__dirname, '../fixtures/msp', org, 'cacerts/org_ca.pem'));
	fConfig.setRootCerts([data]);
	data = fs.readFileSync(path.resolve(__dirname, '../fixtures/msp', org, 'admincerts/admin.pem'));
	fConfig.setAdmins([data]);
	mspConfig.setConfig(fConfig.toBuffer());
	return mspConfig;
};
