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

const Chaincode = rewire('../lib/Chaincode');
const Client = require('../lib/Client');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const should = chai.should();
chai.use(chaiAsPromised);

function propertiesToBeEqual(obj, properties, value) {
	properties.forEach((prop) => {
		if (obj.hasOwnProperty(prop)) {
			should.equal(obj[prop], value);
		} else {
			should.fail();
		}
	});
}

function propertiesToBeNull(obj, properties) {
	return propertiesToBeEqual(obj, properties, null);
}

function propertiesToBeInstanceOf(obj, properties, clazz) {
	properties.forEach((prop) => {
		if (obj.hasOwnProperty(prop)) {
			obj[prop].should.be.instanceof(clazz);
		} else {
			should.fail();
		}
	});
}

describe('Chaincode', () => {
	let sandbox;
	let revert;
	let FakeLogger;

	const ENDORSEMENT_POLICY = {
		identities: [
			{role: {name: 'member', mspId: 'org1'}},
			{role: {name: 'member', mspId: 'org2'}}
		],
		policy: {
			'1-of': [{'signed-by': 0}, {'signed-by': 1}]
		}
	};

	const COLLECTION_CONFIG =
		[{
			name: 'detailCol',
			policy: {
				identities: [
					{role: {name: 'member', mspId: 'Org1MSP'}},
					{role: {name: 'member', mspId: 'Org2MSP'}}
				],
				policy: {
					'1-of': [
						{'signed-by': 0},
						{'signed-by': 1}
					]
				}
			},
			requiredPeerCount: 1,
			maxPeerCount: 1,
			blockToLive: 100
		}];

	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();

		FakeLogger = {
			debug: () => { },
			error: () => { }
		};
		sandbox.stub(FakeLogger);
		revert.push(Chaincode.__set__('logger', FakeLogger));
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
	});

	describe('#constructor', () => {
		it('should create an instance and define the correct properties', () => {
			const client = new Client();
			const chaincode = new Chaincode('mychaincode', 'v1', client);
			propertiesToBeNull(chaincode, ['_package', '_hash', '_endorsement_policy_proto', '_endorsement_policy_json', '_collection_config_proto', '_collection_config_json']);
			propertiesToBeInstanceOf(chaincode, ['_client'], Client);
			chaincode._name.should.equal('mychaincode');
			chaincode._version.should.equal('v1');
		});
	});

	describe('#toString', () => {
		it('should get the object contents in string form', () => {
			const client = new Client();
			const chaincode = new Chaincode('mychaincode', 'v1', client);
			const value = chaincode.toString();
			should.equal(value, 'Chaincode : {name : mychaincode, version : v1, sequence : null, hash : null}');
		});
	});


	describe('#...Getters and Setters and Has-ers', () => {
		const client = new Client();
		let chaincode;

		beforeEach(() => {
			chaincode = new Chaincode('mychaincode', 'v1', client);
		});

		it('should get the name', () => {
			const value = chaincode.getName();
			should.equal(value, 'mychaincode');
		});

		it('should get the version', () => {
			const value = chaincode.getVersion();
			should.equal(value, 'v1');
		});

		it('should get the sequence', () => {
			const value = chaincode.getSequence();
			should.equal(value, null);
		});

		it('should set the sequence', () => {
			chaincode.setSequence(9);
			chaincode._sequence.should.equal(9);
		});

		it('should get error on empty sequence', () => {
			(() => {
				chaincode.setSequence();
			}).should.throw('Sequence value must be an integer greater than zero');
		});

		it('should get error on null sequence', () => {
			(() => {
				chaincode.setSequence(null);
			}).should.throw('Sequence value must be an integer greater than zero');
		});

		it('should get error on character sequence', () => {
			(() => {
				chaincode.setSequence('aa');
			}).should.throw('Sequence value must be an integer greater than zero');
		});

		it('should get error on zero sequence', () => {
			(() => {
				chaincode.setSequence(0);
			}).should.throw('Sequence value must be an integer greater than zero');
		});

		it('should get error on negative sequence', () => {
			(() => {
				chaincode.setSequence(-1);
			}).should.throw('Sequence value must be an integer greater than zero');
		});

		it('should get error on floating point sequence', () => {
			(() => {
				chaincode.setSequence(2.2);
			}).should.throw('Sequence value must be an integer greater than zero');
		});

		it('should get error on character numbers sequence', () => {
			(() => {
				chaincode.setSequence('1');
			}).should.throw('Sequence value must be an integer greater than zero');
		});

		it('should get the package', () => {
			const value = chaincode.getPackage();
			should.equal(value, null);
		});

		it('should set the package', () => {
			chaincode.setPackage('DUMMY');
			chaincode._package.should.equal('DUMMY');
		});

		it('check the hasPackage true', () => {
			chaincode._package = {};
			const check = chaincode.hasPackage();
			should.equal(check, true);
		});

		it('check the hasPackage false', () => {
			const check = chaincode.hasPackage();
			should.equal(check, false);
		});
	});

	describe('#setEndorsementPolicy', () => {
		const client = new Client();
		let chaincode;

		beforeEach(() => {
			chaincode = new Chaincode('mychaincode', 'v1', client);
		});

		it('should require a policy', () => {
			(() => {
				chaincode.setEndorsementPolicy();
			}).should.throw('A JSON policy parameter is required');
		});

		it('should require a valid policy', () => {
			(() => {
				chaincode.setEndorsementPolicy({});
			}).should.throw('Invalid policy, missing the "identities" property');
		});

		it('should set the endorsement policy using an object', () => {
			chaincode.setEndorsementPolicy(ENDORSEMENT_POLICY);
			chaincode._endorsement_policy_json.should.equal(ENDORSEMENT_POLICY);
		});
	});

	describe('#setCollectionConfig', () => {
		const client = new Client();
		let chaincode;

		beforeEach(() => {
			chaincode = new Chaincode('mychaincode', 'v1', client);
		});

		it('should require a config', () => {
			(() => {
				chaincode.setCollectionConfig();
			}).should.throw('A JSON config parameter is required');
		});

		it('should require a valid config', () => {
			(() => {
				chaincode.setCollectionConfig({});
			}).should.throw('Expect collections config of type Array');
		});

		it('should set the collection config using an object', () => {
			chaincode.setCollectionConfig(COLLECTION_CONFIG);
			chaincode._collection_config_json.should.equal(COLLECTION_CONFIG);
		});
	});

	describe('#install', () => {
		const client = new Client();
		let chaincode;

		beforeEach(() => {
			chaincode = new Chaincode('mychaincode', 'v1', client);
		});

		it('should require a package', async () => {
			try {
				await chaincode.install();
				should.fail();
			} catch (err) {
				err.message.should.equal('Install operation requires a ChaincodeInstallRequest object parameter');
			}
		});

		it('should require a package', async () => {
			try {
				await chaincode.install({});
				should.fail();
			} catch (err) {
				err.message.should.equal('Install operation requires a chaincode package be assigned to this chaincode');
			}
		});
	});

	describe('#package', () => {
		const client = new Client();
		let chaincode;

		beforeEach(() => {
			chaincode = new Chaincode('mychaincode', 'v1', client);
		});

		it('should require a package request object parameter', async () => {
			try {
				await chaincode.package();
				should.fail();
			} catch (err) {
				err.message.should.equal('ChaincodeInstallRequest object parameter is required');
			}
		});

		it('should require a package request chaincodeType parameter', async () => {
			try {
				await chaincode.package({});
				should.fail();
			} catch (err) {
				err.message.should.equal('Chaincode package "chaincodeType" parameter is required');
			}
		});

		it('should require a package request chaincodeType parameter', async () => {
			try {
				await chaincode.package({chaincodeType: 'bad'});
				should.fail();
			} catch (err) {
				err.message.should.equal('Chaincode package "chaincodeType" parameter is not a known type bad');
			}
		});
	});
});
