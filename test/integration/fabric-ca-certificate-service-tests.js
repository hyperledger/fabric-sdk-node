/**
 * Copyright 2018 Zhao Chaoyi All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const path = require('path');
const FabricCAServices = require('../../fabric-ca-client/lib/FabricCAServices');
const {User} = require('fabric-common');
const {HFCAIdentityAttributes, HFCAIdentityType} = require('../../fabric-ca-client/lib/IdentityService');

const userOrg1 = 'org1';
const userOrg2 = 'org2';
const tlsOptions = {
	trustedRoots: [],
	verify: false
};

test('\n\n ** FabricCAServices - CertificateService Test **\n\n', async (t) => {
	try {
		FabricCAServices.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
		const ORGS = FabricCAServices.getConfigSetting('test-network');

		const fabricCAEndpoint1 = ORGS[userOrg1].ca.url;
		const fabricCAEndpoint2 = ORGS[userOrg2].ca.url;
		FabricCAServices.getConfigSetting('crypto-keysize', '256'); // force for npm test
		FabricCAServices.setConfigSetting('crypto-hash-algo', 'SHA2'); // force for npm test

		const caService1 = new FabricCAServices(fabricCAEndpoint1, tlsOptions, ORGS[userOrg1].ca.name);
		const caService2 = new FabricCAServices(fabricCAEndpoint2, tlsOptions, ORGS[userOrg2].ca.name);

		const certificateService1 = caService1.newCertificateService();
		const certificateService2 = caService2.newCertificateService();

		// enroll admin1 and admin2
		const {admin1, admin2} = await enrollAdmin(caService1, caService2, t);
		// there should be certificates for each admin at the beginning
		let resp = await certificateService1.getCertificates(null, admin1);
		t.equal(resp.success, true, 'certificate service should response success');
		t.equal(resp.result.certs.length > 0, true, 'there should be certificates for the admin user');
		const certsNum1 = resp.result.certs.length;

		resp = await certificateService2.getCertificates(null, admin2);
		t.equal(resp.success, true, 'certificate service should response success');
		t.equal(resp.result.certs.length > 0, true, 'there should be certificates for the admin user');

		// admin1 create a new identity at ca-org1
		// after enroll the new created identity, there should be a new certificate
		const user1 = await createAndEnrollIdentity(caService1, admin1);
		resp = await certificateService1.getCertificates(null, admin1);
		t.equal(resp.success, true, 'certificate service should response success');
		t.equal(resp.result.certs.length, certsNum1 + 1, 'there should be a new certificate after a new identity was created');

		resp = await certificateService1.getCertificates(null, user1);
		t.equal(resp.success, true, 'certificate service should response success');
		// all certificates for this users affiliation will be returned; if we're the first
		// test to enroll a user for org2 then we could assert just one certificate, but if
		// another test runs first (as the CA is for all tests) it'll fail. just check we can
		// see at least one certificate!
		t.equal(resp.result.certs.length > 0, true, 'the new created user can also view certificates');

		// get certificate by enrollment id, user1._name = user1.enrollmentId
		resp = await certificateService1.getCertificates({id: user1.getName()}, user1);
		t.equal(resp.success, true, 'certificate service should response success');
	} catch (e) {
		t.fail(e);
		t.end();
	}
});

async function enrollAdmin(caService1, caService2, t) {
	const bootstrapUser = {
		enrollmentID: 'admin',
		enrollmentSecret: 'adminpw'
	};
	const enrollment1 = await caService1.enroll(bootstrapUser);
	t.pass('Successfully enrolled admin at ca_Org1');

	const enrollment2 = await caService2.enroll(bootstrapUser);
	t.pass('Successfully enrolled admin at ca_Org2');

	const admin1 = new User('admin1');
	await admin1.setEnrollment(enrollment1.key, enrollment1.certificate, 'Org1MSP');
	t.pass('Successfully set enrollment for user admin1');

	const admin2 = new User('admin2');
	await admin2.setEnrollment(enrollment2.key, enrollment2.certificate, 'Org2MSP');
	t.pass('Successfully set enrollment for user admin2');
	return {admin1, admin2};
}

async function createAndEnrollIdentity(ca, admin) {
	const affiliation = admin.getName() === 'admin1' ? 'org1' : 'org2';
	const mspId = admin._mspId;
	const identityService = ca.newIdentityService();

	const req = {
		enrollmentID: 'user_' + Math.floor(Math.random() * 1000),
		enrollmentSecret: 'userpw',
		affiliation,
		// set this identity can manage identities of the role user
		attrs: [{name: HFCAIdentityAttributes.HFREGISTRARROLES, value: HFCAIdentityType.USER}]
	};

	await identityService.create(req, admin);

	const enrollment = await ca.enroll({
		enrollmentID: req.enrollmentID,
		enrollmentSecret: req.enrollmentSecret
	});
	const user = new User(req.enrollmentID);
	await user.setEnrollment(enrollment.key, enrollment.certificate, mspId);
	return user;
}
