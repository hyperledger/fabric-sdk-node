let utils = require('fabric-client/lib/utils.js');
let logger = utils.getLogger('integration.client');

let tape = require('tape');
let _test = require('tape-promise');
let test = _test(tape);
const path = require('path');
let FabricCAServices = require('../../fabric-ca-client');
const User = require('../../fabric-ca-client/lib/User');

let userOrg = 'org1';
let tlsOptions = {
	trustedRoots: [],
	verify: false
};

let ORGS;

test('\n\n ** FabricCAServices - IdentityService Test **\n\n', (t) => {

	FabricCAServices.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
	ORGS = FabricCAServices.getConfigSetting('test-network');

	let fabricCAEndpoint = ORGS[userOrg].ca.url;

	FabricCAServices.getConfigSetting('crypto-keysize', '256'); //force for gulp test
	FabricCAServices.setConfigSetting('crypto-hash-algo', 'SHA2'); //force for gulp test

	let caService = new FabricCAServices(fabricCAEndpoint, tlsOptions, ORGS[userOrg].ca.name);

	let bootstrapUser = {
		enrollmentID: 'admin',
		enrollmentSecret: 'adminpw'
	};

	let admin;
	let testIdentity = {
		enrollmentID: 'user_' + Math.random().toFixed(2).toString(),
		enrollmentSecret: 'userpw',
		affiliation: 'org1'
	};
	let update = {
		affiliation: 'org2',
		enrollmentSecret: 'mysecret'
	};
	let hfcaIdentityService;

	caService.enroll(bootstrapUser)
		.then((enrollment) => {
			t.pass('Successfully enrolled \'' + bootstrapUser.enrollmentID + '\'.');
			admin = new User('admin');
			return admin.setEnrollment(enrollment.key, enrollment.certificate, 'Org1MSP');
		}).then(() => {
			t.pass('Successfully set enrollment for user admin');
			hfcaIdentityService = caService.newIdentityService();

			// create a new Identity with admin
			return hfcaIdentityService.create(testIdentity, admin);
		}).then((resp) => {
			t.equal(resp, testIdentity.enrollmentSecret);
			t.pass('Successfully created new Identity ' + testIdentity.enrollmentID);

			// get this Identity
			return hfcaIdentityService.getOne(testIdentity.enrollmentID, admin);
		}).then((resp) => {
			t.pass('Successfully get indentity ' + testIdentity.enrollmentID);
			t.equal(resp.success, true);
			t.equal(resp.result.id, testIdentity.enrollmentID);
			t.equal(resp.result.affiliation, testIdentity.affiliation);

			return hfcaIdentityService.update(testIdentity.enrollmentID, update, admin);
		}).then((resp) => {
			t.equal(resp.result.secret, update.enrollmentSecret);
			t.equal(resp.result.affiliation, update.affiliation);
			t.pass('Successfully updated indentity ' + testIdentity.enrollmentID);

			return hfcaIdentityService.getAll(admin);
		}).then((resp)=>{
			t.equal(resp.success, true);
			// should be two identities, 'admin' and the new created user
			t.equal(resp.result.identities.length, 2);

			return hfcaIdentityService.delete(testIdentity.enrollmentID, admin);
		}).then((resp)=>{
			t.pass('Successfully deleted identity ' + testIdentity.enrollmentID);
			t.end();
		}).catch((e) => {
			t.fail(e.message);
			t.end();
		});
});
