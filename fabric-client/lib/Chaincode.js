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
const {format} = require('util');

const {Utils: utils} = require('fabric-common');
const logger = utils.getLogger('Chaincode.js');
const Policy = require('./Policy.js');
const CollectionConfig = require('./SideDB.js');
const fabprotos = require('fabric-protos').protos;


/**
 * @classdesc
 * The Chaincode class represents an Chaincode definition in the target
 * blockchain network.
 * <br><br>
 * see the tutorial {@tutorial chaincode-lifecycle}
 * <br><br>
 * This class allows an application to contain all chaincode attributes and
 * artifacts in one place during runtime. This will assist the administration
 * of the chaincode's lifecycle.
 *
 * From your {@link Client} instance use the {@link Client#newChaincode} method.
 * This will return a Chaincode object instance that has been associated with
 * that client. This will provide access to user credentials used for signing
 * requests, access to peer, orderer, and channel information.
 *
 *
 * From the new chaincode object you will be able to use it to help you create
 * a chaincode package. This is a local client operation and does not make an
 * outbound request. The package may be sent to other organizations to be
 * installed on their peers.
 * This package may then be installed on your organization's peers.
 * The peer will return a hash value representing the package that it
 * has installed. This unique value will identify your chaincode across
 * the fabric network and must match all other peers that have installed
 * the chaincode.
 * <br>
 * <br>
 * Now that we have a hash value we can define a chaincode that our organization
 * would like to run. The definition will include the hash, the name, the version,
 * an endorsement policy, the channel and your organization.
 * The definition must be endorsed by a peer
 * in your organization and sent to be orderer to be committed to the ledger.
 * You may want to think of this definition as a vote that your organization
 * has agreed to run this particular chaincode on this channel.
 * Once enough organization have also voted by endorsing a chaincode organization
 * definition and committing that transaction the Chaincode channel definition
 * may now be processed.
 * <br>
 * <br>
 * When enough organizations have agreed to run this unique chaincode definition,
 * it may be defined to run on the channel. This is an endorsement sent by a
 * single client to enough organization's peers to satisfy the chaincode life-cycle
 * policy.
 * Once the client gets enough endorsements it will send the transaction to the
 * orderer to be committed to the ledger.
 * The chaincode may now be used for endorsements.
 *
 *
 * @example
 * // create chaincode object
 *   const mychaincode = client.newChaincode('mychaincode', 'version1');
 *
 * // package the source code
 *   //          - or -
 *   //         use an existing package
 *   const packge_request = {
 *      chaincodeType: 'golang',
 *      goPath: '/gopath',
 *      chaincodePath: '/path/to/code',
 *      metadataPath: '/path/to/metadat'
 *   }
 *   await mychaincode.package(package_request);
 *
 *   // send the package to the other organizations to install
 *   const package = mychaincode.getPackage();
 *   ... < code to send >
 *   // The other organizations will make the package call, they
 *   // will use the setPackage() method to apply an existing chaincode
 *   // package to the chaincode instance object.
 *   mychaincode.setPackage(package);
 *
 * // install on my peers
 *   //   This step is only required for peers that will execute the
 *   //   the chaincode during an endorsement or chaincode query operation.
 *   const install_request = {
 *      targets: [peer1, peer2],
 *      request_timeout: 20000 // give the peers some extra time
 *   }
 *   // The hash value of the package is returned by the peer
 *   // The chaincode instance object will also contain this value.
 *   const hash = await mychaincode.install(install_request);
 *
 * // set the endorsement policy and collection config
 *   // The endorsement policy - required.
 *   mychaincode.setEndorsementPolicy(policy_def);
 *   // The collection configuration - optional.
 *   mychaincode.setCollectionConfig(config_def));
 *
 * // set the sequence of the definition
 *   mychaincode.setSequence(1);
 *
 * // define for my organization
 *   //   Each organization will define the chaincode. Think of
 *   //   of this step as both defining a chaincode for the organization
 *   //   to use and the organization casting a vote for this definition
 *   //   the chaincode to be allowed to be executed on the channel.
 *   //   Note that an organization that is just voting to allow the chaincode
 *   //   on the channel and not planning on actually executing the  chaincode
 *   //   will only have to an chaincode instance object with
 *   //   the name, the version, the hash value, and the sequence number
 *   //   attributes set. The package and installing the package will not be
 *   //   required.
 *   const tx_id = client.newTransactionID();
 *   const request = {
 *      target: peer1,
 *      chaincode: mychaincode,
 *      txId: tx_id
 *   }
 *   const {proposalResponses, proposal} = await mychannel.defineChaincodeForOrg(request);
 *   const orderer_request = {
 *      proposalResponses: proposalResponses,
 *      proposal, proposal
 *   }
 *   const results = await mychannel.sendTransaction(orderer_request);
 *
 *
 * // define the chaincode for the channel
 *   //  One organization will create a transaction that will define this
 *   //  chaincode for the channel. The transaction must be endorsed by enough
 *   //  organizations on the channel to satisfy the chaincode lifecycle policy.
 *   //  This action will not succeed until enough organizations have voted
 *   //  (define for organization) for this chaincode definition to run on this
 *   //  channel to satisfy the chaincode lifecycle endorsement policy.
 *   const tx_id = client.newTransactionID();
 *   const request = {
 *      targets: [peer1, peer3],
 *      chaincode: mychaincode,
 *      txId: tx_id
 *   }
 *   const {proposalResponses, proposal} = await mychannel.defineChaincode(request);
 *   const orderer_request = {
 *      proposalResponses: proposalResponses,
 *      proposal, proposal
 *   }
 *   const results = await mychannel.sendTransaction(orderer_request);
 *
 * // initialize the chaincode
 *   // This action will start the chaincode container and run the 'init' method
 *   // of the chaincode with the provided arguments.
 *   // This action will only be required when the code package is new or
 *   // has changed and a new chaincode container must be initialized.
 *   const tx_id = client.newTransactionID();
 *   const request = {
 *      chaincodeId : chaincodeId,
 *      fcn: 'init',
 *      args: args,
 *      txId: tx_id
 *   }
 *   const init_results = await mychannel.sendTransaction(request);
 *   const orderer_request = {
 *      proposalResponses: init_results[0],
 *      proposal: init_results[1]
 *   }
 *   const results = await mychannel.sendTransaction(orderer_request);
 *
 * @class
 */
const Chaincode = class {

	/**
	 * Construct a Chaincode object.
	 *
	 * @param {string} name - The name of this chaincode
	 * @param {string} version - The version of this chaincode
	 * @param {Client} client - The Client instance.
	 * @returns {Chaincode} The Chaincode instance.
	 */
	constructor(name, version, client) {
		logger.debug('Chaincode.const');
		if (!name) {
			throw new Error('Missing name parameter');
		}
		if (!version) {
			throw new Error('Missing version parameter');
		}
		if (!client) {
			throw new Error('Missing client parameter');
		}
		this._name = name;
		this._version = version;
		this._client = client;

		this._sequence = null;
		this._package = null;
		this._hash = null;
		this._endorsement_policy_proto = null;
		this._endorsement_policy_json = null;
		this._collection_config_proto = null;
		this._collection_config_json = null;
	}

	/**
	 * Gets the name of this chaincode.
	 *
	 * @returns {string} The name of this chaincode
	 */
	getName() {
		return this._name;
	}

	/**
	 * Gets the version of this chaincode.
	 *
	 * @returns {string} The version of this chaincode
	 */
	getVersion() {
		return this._version;
	}

	/**
	 * Gets the modification sequence of the chaincode definition.
	 *
	 * @returns {number} The sequence of this chaincode
	 */
	getSequence() {
		return this._sequence;
	}

	/**
	 * Sets the modification sequence of the chaincode definition.
	 * The sequence value gives a unique number to a set of attributes for the
	 * the chaincode. When a attribute changes for a chaincode, the sequence
	 * value must be incremented and all organizations must again run
	 * the defineChaincodeForOrg() method to agree to the new definition.
	 * The default is 1, new chaincode.
	 *
	 * @param {number} sequence - sequence of this chaincode
	 */
	setSequence(sequence) {
		if (!Number.isInteger(sequence) || sequence < 1) {
			throw new Error('Sequence value must be an integer greater than zero');
		}
		this._sequence = sequence;

		return this;
	}

	/**
	 * Gets the source code package
	 *
	 * @returns {number} The package of this chaincode
	 */
	getPackage() {

		return this._package;
	}

	/**
	 * Sets the chaincode package
	 *
	 * @param {byte[]} package The source package
	 */
	setPackage(packaged_chaincode) {
		this._package = packaged_chaincode;

		return this;
	}

	/**
	 * @typedef {Object} ChaincodeInstallRequest
	 * @property {string} chaincodeType - Required. Type of chaincode. One of
	 *        'golang', 'car', 'node' or 'java'.
	 * @property {string} chaincodePath - Required. The path to the location of
	 *        the source code of the chaincode. If the chaincode type is golang,
	 *        then this path is the fully qualified package name, such as
	 *        'mycompany.com/myproject/mypackage/mychaincode'
	 * @property {string} metadataPath - Optional. The path to the top-level
	 *        directory containing metadata descriptors.
	 * @property {string} goPath - Optional. The path to be used with the golang
	 *        chaincode.
	 */

	/**
	 *  Package the files at the locations provided.
	 *  This method will both return the package and set the
	 *  package on this instance.
	 *
	 * @async
	 * @param {ChaincodePackageRequest} request - Required. The parameters to build the
	 *        chaincode package.
	 */


	async package(request) {
		const method = 'package';
		logger.debug('%s - start', method);

		this._package = null;
		this._hash = null;

		if (!request) {
			throw new Error('ChaincodeInstallRequest object parameter is required');
		}

		if (!request.chaincodeType) {
			throw new Error('Chaincode package "chaincodeType" parameter is required');
		}

		const _type = Chaincode.translateCCType(request.chaincodeType);
		if (!_type) {
			throw new Error(format('Chaincode package "chaincodeType" parameter is not a known type %s', request.chaincodeType));
		}


		return this._package;
	}

	/**
	 * Method to check if this chaincode instance has a chaincode package assigned.
	 * @returns {boolean} indicates if this chaincode instance has a package
	 */
	hasPackage() {
		const method = 'hasPackage';
		if (this._package) {
			logger.debug('%s - contains a package', method);
			return true;
		} else {
			logger.debug('%s - does not contains a package', method);
			return false;
		}
	}

	/**
	 * Gets the package hash value
	 *
	 * @returns {string} The hash value as generated by the peer when the
	 *  package was installed
	 */
	getHash() {

		return this._hash;
	}

	/**
	 * Sets the chaincode package hash
	 *
	 * @param {string} hash The source package hash value
	 */
	setHash(hash) {
		this._hash = hash;

		return this;
	}

	/**
	 * Method to check if this chaincode package hash has been assigned.
	 * The hash value is the unique identifer of this chaincode source package
	 * returned by the peer that installed the chaincode package.
	 * When this chaincode instance has a hash value assigned it will mean
	 * this chaincode has been installed. It also could mean that another
	 * organization did the install and this organization only wants to define
	 * (allow) this chaincode and will not install the package at this time.
	 *
	 * @returns {boolean} indicates if this chaincode instance has the hash value
	 *  and this chaincode instance may be used for the chaincode define actions.
	 */
	hasHash() {
		const method = 'hasHash';
		if (this._hash) {
			logger.debug('%s - contains a package hash', method);
			return true;
		} else {
			logger.debug('%s - does not contains a package hash', method);
			return false;
		}
	}

	// TODO ispackageinstalled
	// will query the peer to see if this chaincode is installed
	//  should be able to check the hash
	// TODO isRunning on Channel
	// will query the peer to see what is running and get info
	// should be able to verify the hash and sequence
	// TODO ... is there a way to check the endorsement policy

	/**
	 * @typedef {Object} ChaincodeInstallRequest
	 * @property {Buffer} target Required. The peer to use for this request
	 * @property {number} request_timeout Optional. The amount of time for the
	 *        to respond. The default will be the system configuration
	 *        value of 'request-timeout'.
	 */

	/**
	 * Install the package on the specified peers.
	 * This method will send the package to the peers provided.
	 * Each peer will return a hash value of the installed
	 * package. When this method is called again and within this call, the hash value
	 * returnd from the peer must be equal to the pervious install.
	 *
	 * @async
	 * @param {ChaincodeInstallRequest} request - The request object with the
	 *        install attributes and settings.
	 * @returns {string} The hash value as calculated by the target peer(s).
	 */
	async install(request) {
		const method = 'install';
		logger.debug('%s - start');

		if (!request) {
			throw new Error('Install operation requires a ChaincodeInstallRequest object parameter');
		}

		if (!this._package) {
			throw new Error('Install operation requires a chaincode package be assigned to this chaincode');
		}

		const peers = request.targets; // TODO validate the targets

		// loop on each peer in the target list
		for (const peer of peers) {
			const hash = 'somehash'; // TODO put the install call here to the peer
			logger.debug('%s - working with peer %s', method, peer);

			// TODO install process here

			if (this._hash) {
				if (hash === this._hash) {
					logger.debug('%s - hash values are the same :: %s', method, hash);
				} else {
					const msg = utils.format('The install for chaincode: %s version: ' +
						'%s did not return the same hash value of %s, value was %s',
						this._name, this._version, this._hash, hash);
					logger.error(msg);
					throw new Error(msg);
				}
			} else {
				logger.debug('%s - first install of package returned hash of %s', method, hash);
				this._hash = hash;
			}
		}

		return this._hash;
	}

	/**
	 * Provide the endorsement policy for this chaincode. The input is a JSON object.
	 *
	 * @example <caption>Endorsement policy: "Signed by any member from one of the organizations"</caption>
	 * {
	 *   identities: [
	 *     { role: {name: "member", mspId: "org1"}},
	 *     { role: {name: "member", mspId: "org2"}}
	 *   ],
	 *   policy: {
	 *     "1-of": [{"signed-by": 0}, {"signed-by": 1}]
	 *   }
	 * }
	 * @example <caption>Endorsement policy: "Signed by admin of the ordererOrg and any member from one of the peer organizations"</caption>
	 * {
	 *   identities: [
	 *     {role: {name: "member", mspId: "peerOrg1"}},
	 *     {role: {name: "member", mspId: "peerOrg2"}},
	 *     {role: {name: "admin", mspId: "ordererOrg"}}
	 *   ],
	 *   policy: {
	 *     "2-of": [
	 *       {"signed-by": 2},
	 *       {"1-of": [{"signed-by": 0}, {"signed-by": 1}]}
	 *     ]
	 *   }
	 * }
	 * @param {string} policy - The JSON representation of an fabric endorsement policy.
	 */
	setEndorsementPolicy(policy) {
		const method = 'setEndorsementPolicy';
		logger.debug('%s - start');

		if (policy instanceof Object) {
			logger.debug('%s - have a policy object %j', method, policy);
			this._endorsement_policy_json = policy;
		} else {
			throw new Error('A JSON policy parameter is required');
		}

		this._endorsement_policy_proto = Policy.buildPolicy(null, policy);

		return this;
	}

	/**
	 * Provide the collection configuration for this chaincode. The input is a JSON object.
	 *
	 * @example <caption>Collection config</caption>
	 * [{
	 *     name: "detailCol",
	 *     policy: {
	 *        identities: [
	 *           {role: {name: "member", mspId: "Org1MSP"}},
	 *           {role: {name: "member", mspId: "Org2MSP"}}
	 *         ],
	 *         policy: {
	 *            1-of: [
	 *               {signed-by: 0},
	 *               {signed-by: 1}
	 *             ]
	 *          }
	 *     },
	 *     requiredPeerCount: 1,
	 *     maxPeerCount: 1,
	 *     blockToLive: 100
	 *   }]
	 * @param {string} config - The JSON representation of a fabric collection configuration definition.
	 */
	setCollectionConfig(config) {
		const method = 'setCollectionConfig';
		logger.debug('%s - start');

		if (config instanceof Object) {
			logger.debug('%s - have a config object %j', method, config);
			this._collection_config_json = config;
		} else {
			throw new Error('A JSON config parameter is required');
		}

		this._colletion_config_proto = CollectionConfig.buildCollectionConfigPackage(config);

		return this;
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {
		return 'Chaincode : {' +
			'name : ' + this._name +
			', version : ' + this._version +
			', sequence : ' + this._sequence +
			', hash : ' + this._hash +
			'}';
	}

	static translateCCType(type) {
		const chaincodeType = type.toLowerCase();

		const map = {
			golang: fabprotos.ChaincodeSpec.Type.GOLANG,
			car: fabprotos.ChaincodeSpec.Type.CAR,
			java: fabprotos.ChaincodeSpec.Type.JAVA,
			node: fabprotos.ChaincodeSpec.Type.NODE
		};
		const value = map[chaincodeType];

		return value;
	}

};

module.exports = Chaincode;
