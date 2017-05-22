/*
 Copyright 2017 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the 'License');
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

	  http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an 'AS IS' BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict';

var grpc = require('grpc');
var util = require('util');

var _mspPrProto = grpc.load(__dirname + '/protos/msp/msp_principal.proto').common;
var _policiesProto = grpc.load(__dirname + '/protos/common/policies.proto').common;

var IDENTITY_TYPE = {
	Role: 'role',
	OrganizationUnit: 'organization-unit',
	Identity: 'identity'
};

/**
 * @typedef {Object} Policy Defines the endorsement policies
 * @property {Identity[]} identities List of identities to be referenced in the "policy" section
 * @property {PolicySpec[]} policy The specification of the policy using a combination of "signed-by" and
 * "n-of" structures. The design allows recursion
 */

/**
 * @typedef {Object} Identity
 * @property {Role} role Any identity of a particular role
 * @property OrganizationUnit Any identities belonging to an organization unit per certificate chain of trust
 * @property Identity A specific identity
 */

/**
 * @typedef {Object} Role
 * @property {string} name Name of the role. Value can be "member" or "admin"
 * @property {string} mspId The member service provider Id used to process the identity
 */

/**
 * @typedef {Object} PolicySpec
 * @property {Object} type The type of policy can be "signed-by" for a single identity signature or "n-of"
 * where "n" is a numeric value. If the type property is "signed-by", the value is the numeric index into the
 * array of identities specified in the policy. If the type property is "n-of", the value is an array of
 * {@link PolicySpec} objects. As you can see, this structure allows recursive definitions of complex policies.
 */

/**
 * Governs the constructions of endorsement policies to be passed into the calls to instantiate chaincodes
 * @class
 */
var EndorsementPolicy = class {
	/**
	 * Constructs an endorsement policy envelope. If the optional "policy" object is not present, a default
	 * policy of "a signature by any member from any of the organizations corresponding to the array of member
	 * service providers" is returned.
	 *
	 * @param {MSP[]} msps Array of Member Service Provider objects representing the participants of the
	 * endorsement policy to be constructed
	 * @param {Policy} policy The policy specification. It has two high-level properties: identities and policy.
	 * see the type definition of {@link Policy} for details.
	 */
	static buildPolicy(msps, policy) {
		if (typeof policy === 'undefined' || policy === null) {
			// no policy was passed in, construct a 'Signed By any member of an organization by mspid' policy
			// construct a list of msp principals to select from using the 'n out of' operator
			var principals = [], signedBys = [];
			var index = 0;
			for (let name in msps) {
				if (msps.hasOwnProperty(name)) {
					let onePrn = new _mspPrProto.MSPPrincipal();
					onePrn.setPrincipalClassification(_mspPrProto.MSPPrincipal.Classification.ROLE);

					let memberRole = new _mspPrProto.MSPRole();
					memberRole.setRole(_mspPrProto.MSPRole.MSPRoleType.MEMBER);
					memberRole.setMspIdentifier(name);

					onePrn.setPrincipal(memberRole.toBuffer());

					principals.push(onePrn);

					var signedBy = new _policiesProto.SignaturePolicy();
					signedBy.set('signed_by', index++);
					signedBys.push(signedBy);
				}
			}

			if (principals.length === 0) {
				throw new Error('Verifying MSPs not found in the channel object, make sure "intialize()" is called first.');
			}

			// construct 'one of any' policy
			var oneOfAny = new _policiesProto.SignaturePolicy.NOutOf();
			oneOfAny.setN(1);
			oneOfAny.setPolicies(signedBys);

			var noutof = new _policiesProto.SignaturePolicy();
			noutof.set('n_out_of', oneOfAny);

			var envelope = new _policiesProto.SignaturePolicyEnvelope();
			envelope.setVersion(0);
			envelope.setPolicy(noutof);
			envelope.setIdentities(principals);

			return envelope.toBuffer();
		} else {
			// check the structure of the policy object is legit
			if (typeof policy.identities === 'undefined' || policy.identities === null || policy.identities === '' || policy.identities === {}) {
				throw new Error('Invalid policy, missing the "identities" property');
			} else if (!Array.isArray(policy.identities)) {
				throw new Error('Invalid policy, the "identities" property must be an array');
			}

			if (typeof policy.policy === 'undefined' || policy.policy === null || policy.policy === '' || policy.policy === {}) {
				throw new Error('Invalid policy, missing the "policy" property');
			}

			var principals = [];
			policy.identities.forEach((identity) => {
				let newPrincipal = buildPrincipal(identity);
				principals.push(newPrincipal);
			});

			var thePolicy = new parsePolicy(policy.policy);

			var envelope = new _policiesProto.SignaturePolicyEnvelope();
			envelope.setVersion(0);
			envelope.setPolicy(thePolicy);
			envelope.setIdentities(principals);

			return envelope.toBuffer();
		}
	}
};

function buildPrincipal(identity) {
	let principalType = getIdentityType(identity);
	let newPrincipal = new _mspPrProto.MSPPrincipal();

	switch (principalType) {
	case IDENTITY_TYPE.Role:
		newPrincipal.setPrincipalClassification(_mspPrProto.MSPPrincipal.Classification.ROLE);

		let roleName = identity[principalType].name;
		if ('member' !== roleName && 'admin' !== roleName) {
			throw new Error(util.format('Invalid role name found: must be one of "member" or "admin", but found "%s"', roleName));
		}

		let mspid = identity[principalType].mspId;
		if (typeof mspid !== 'string' || mspid === null || mspid === '') {
			throw new Error(util.format('Invalid mspid found: must be a non-empty string, but found "%s"', mspid));
		}

		let newRole = new _mspPrProto.MSPRole();
		newRole.setRole((roleName === 'member') ? _mspPrProto.MSPRole.MSPRoleType.MEMBER : _mspPrProto.MSPRole.MSPRoleType.ADMIN);
		newRole.setMspIdentifier(identity[principalType].mspId);

		newPrincipal.setPrincipal(newRole.toBuffer());
		break;
	case IDENTITY_TYPE.OrganizationUnit:
	case IDENTITY_TYPE.Identity:
		throw new Error('NOT IMPLEMENTED');
	}

	return newPrincipal;
}

function getIdentityType(obj) {
	var invalidTypes = [];
	for (let key in obj) {
		if (obj.hasOwnProperty(key)) {
			if (key === IDENTITY_TYPE.Role || key === IDENTITY_TYPE.OrganizationUnit || key === IDENTITY_TYPE.Identity) {
				return key;
			} else {
				invalidTypes.push(key);
			}
		}
	}

	throw new Error(util.format(
		'Invalid identity type found: must be one of %s, %s or %s, but found %s',
		IDENTITY_TYPE.Role,
		IDENTITY_TYPE.OrganizationUnit,
		IDENTITY_TYPE.Identity,
		invalidTypes)
	);
}

function getPolicyType(spec) {
	var invalidTypes = [];
	for (var key in spec) {
		if (spec.hasOwnProperty(key)) {
			// each policy spec has exactly one property of one of these two forms: 'n-of' or 'signed-by'
			if (key === 'signed-by' || key.match(/^\d+\-of$/)) {
				return key;
			} else {
				invalidTypes.push(key);
			}
		}
	}

	throw new Error(util.format('Invalid policy type found: must be one of "n-of" or "signed-by" but found "%s"', invalidTypes));
}

function parsePolicy(spec) {
	var type = getPolicyType(spec);
	if (type === 'signed-by') {
		let signedBy = new _policiesProto.SignaturePolicy();
		signedBy.set('signed_by', spec[type]);
		return signedBy;
	} else {
		let n = type.match(/^(\d+)\-of$/)[1];
		let array = spec[type];

		let nOutOf = new _policiesProto.SignaturePolicy.NOutOf();
		nOutOf.setN(parseInt(n));

		let subs = [];
		array.forEach((sub) => {
			var subPolicy = parsePolicy(sub);
			subs.push(subPolicy);
		});

		nOutOf.setPolicies(subs);

		let nOf = new _policiesProto.SignaturePolicy();
		nOf.set('n_out_of', nOutOf);

		return nOf;
	}
}

module.exports = EndorsementPolicy;
module.exports.IDENTITY_TYPE = IDENTITY_TYPE;
