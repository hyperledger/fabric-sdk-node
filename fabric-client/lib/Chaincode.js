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
const Long = require('long');

const {Utils: utils} = require('fabric-common');
const client_utils = require('./client-utils.js');
const logger = utils.getLogger('Chaincode.js');
const Packager = require('./Packager.js');
const Policy = require('./Policy.js');
const CollectionConfig = require('./SideDB.js');
const TransactionID = require('./TransactionID');
const fabric_protos = require('fabric-protos').protos;
const lifecycle_protos = require('fabric-protos').lifecycle;

/**
 * @classdesc
 * The Chaincode class represents an Chaincode definition.
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
		this._client = client;
		this._name = name;
		this._version = version;

		// definition attributes with defaults
		this._endorsement_plugin = 'escc';
		this._validation_plugin = 'vscc';
		this._init_required = false;
		this._sequence = Long.fromValue(1); // starting value

		this._chaincode_path = null;
		this._metadata_path = null;
		this._golang_path = null;
		this._package = null;
		this._package_id = null;
		this._label = name + '_' + version;
		this._endorsement_policy = null;
		this._endorsement_policy_def = null;
		this._collection_package_proto = null;
		this._collection_package_json = null;
		this._type = null;
	}

	/**
	 * Build a {@link Chaincode} instance from the QueryChaincodeDefinitionResult protobuf object
	 * that is the result of the "QueryChaincodeDefinition" request to the Chaincode Lifecycle.
	 * @param {*} name
	 * @param {*} payload
	 * @param {*} client
	 *
	 * @return {Chaincode}
	 */
	static fromQueryResult(name, payload, client) {
		const chaincodeDefinitionQueryResult = lifecycle_protos.QueryChaincodeDefinitionResult.decode(payload);
		const chaincode = new Chaincode(
			name,
			chaincodeDefinitionQueryResult.getVersion(),
			client
		);
		chaincode.setSequence(chaincodeDefinitionQueryResult.getSequence());
		chaincode._endorsement_plugin = chaincodeDefinitionQueryResult.getEndorsementPlugin();
		chaincode._validation_plugin = chaincodeDefinitionQueryResult.getValidationPlugin();
		chaincode.setEndorsementPolicy(chaincodeDefinitionQueryResult.getValidationParameter());
		chaincode.setInitRequired(chaincodeDefinitionQueryResult.getInitRequired());
		if (chaincodeDefinitionQueryResult.getCollections()) {
			// TODO chaincode.setCollectionConfigPackageDefinition(chaincodeDefinitionQueryResult.getCollections());
		}

		return chaincode;
	}

	/**
	 * Get the name of this chaincode.
	 *
	 * @returns {string} The name of this chaincode
	 */
	getName() {
		return this._name;
	}

	/**
	 * Get the version of this chaincode.
	 *
	 * @returns {string} The version of this chaincode
	 */
	getVersion() {
		return this._version;
	}

	/**
	 * Set the version of this chaincode.
	 */
	setVersion(version) {
		this._version = version;

		return this;
	}

	/**
	 * Get the modification sequence of the chaincode definition.
	 *
	 * @returns {Long} The sequence of this chaincode
	 */
	getSequence() {
		return this._sequence;
	}

	/**
	 * Set the modification sequence of the chaincode definition.
	 * The sequence value gives a unique number to a set of attributes for the
	 * the chaincode. When a attribute changes for a chaincode, the sequence
	 * value must be incremented and all organizations must again run
	 * the defineChaincodeForOrg() method to agree to the new definition.
	 * The default is 1, new chaincode.
	 *
	 * @param {Long} sequence - sequence of this chaincode
	 */
	setSequence(sequence) {
		this._sequence = Long.fromValue(sequence);

		// if (!Number.isInteger(sequence) || sequence < 1) {
		// 	throw new Error('Sequence value must be an integer greater than zero');
		// }

		return this;
	}

	/**
	 * Get the source code package
	 *
	 * @returns {byte[]} The package of this chaincode
	 */
	getPackage() {

		return this._package;
	}

	/**
	 * Set the chaincode package
	 * It is recommended to set the package label associated with this package.
	 *
	 * @param {byte[]} package The source package
	 */
	setPackage(packaged_chaincode) {
		this._package = packaged_chaincode;

		return this;
	}

	/**
	 * Get the chaincode type
	 *
	 * @returns {string} The type of this chaincode
	 */
	getType() {

		return this._type;
	}

	/**
	 * Set the chaincode type
	 * @param {string} type The type of this chaincode. Must be "golang",
	 *        "node", "java" or "car".
	 */
	setType(type) {
		this._type = Chaincode.checkType(type);

		return this;
	}

	/**
	 * Set if the chaincode initialize is required
	 * @param {boolean} required Indicates if this chaincode must be initialized
	 */
	setInitRequired(required) {
		this._init_required = required;

		return this;
	}

	/**
	 * Get the initialize required setting
	 *
	 * @returns {boolean}
	 */
	getInitRequired() {

		return this._init_required;
	}

	/**
	 * Get the chaincode path
	 *
	 * @returns {string}
	 */
	getChaincodePath() {

		return this._chaincode_path;
	}

	/**
	 * Set the chaincode path
	 * @param {string} path The path of this chaincode.
	 */
	setChaincodePath(path) {
		this._chaincode_path = path;

		return this;
	}

	/**
	 * Get the chaincode path
	 *
	 * @returns {string}
	 */
	getMetadataPath() {

		return this._metadata_path;
	}

	/**
	 * Set the metadata path
	 * @param {string} path The path of this metadata.
	 */
	setMetadataPath(path) {
		this._metadata_path = path;

		return this;
	}

	/**
	 * Get the goLang path
	 *
	 * @returns {string}
	 */
	getGoLangPath() {

		return this._golang_path;
	}

	/**
	 * Set the goLang path
	 * @param {string} path The golang path.
	 */
	setGoLangPath(path) {
		this._golang_path = path;

		return this;
	}

	/**
	 * Get the chaincode package label
	 *
	 * @returns {string} The label value
	 */
	getLabel() {
		return this._label;
	}

	/**
	 * Set the label to be used for this packaged chaincode
	 * The default of name:version will be used if not set when
	 * the package() method is called.
	 *
	 * @param {string} The label value
	 */
	setLabel(label) {
		this._label = label;

		return this;
	}

	/**
	 * Get the package id value
	 *
	 * @returns {string} The package id value is generated by the peer when the
	 *  package is installed
	 */
	getPackageId() {
		return this._package_id;
	}

	/**
	 * Sets the chaincode package id
	 *
	 * @param {string} package_id The source package id value
	 */
	setPackageId(package_id) {
		this._package_id = package_id;

		return this;
	}

	/**
	 * Get the endorsement policy JSON definition.
	 *
	 * @returns {Object} The JSON endorsement policy
	 */
	getEndorsementPolicyDefinition() {
		return this._endorsement_policy_def;
	}

	/**
	 * Provide the endorsement policy definition for this chaincode. The input is a JSON object.
	 *
	 * @example <caption>Object Endorsement policy: "Signed by any member from one of the organizations"</caption>
	 * {
	 *   identities: [
	 *     { role: {name: "member", mspId: "org1"}},
	 *     { role: {name: "member", mspId: "org2"}}
	 *   ],
	 *   policy: {
	 *     "1-of": [{"signed-by": 0}, {"signed-by": 1}]
	 *   }
	 * }
	 * @example <caption>Object Endorsement policy: "Signed by admin of the ordererOrg and any member from one of the peer organizations"</caption>
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
	 * @example <caption>String Endorsement policy: "Policy reference of an existing policy in your channel configuration"</caption>
	 *    /Channel/Application/Endorsement
	 * @param {string | object} policy - When the policy is a string it will be
	 * the canonical path to a policy in the Channel configuration.
	 * When an object, it will be the fabric-client's JSON representation
	 * of an fabric endorsement policy.
	 */
	setEndorsementPolicyDefinition(policy) {
		const method = 'setEndorsementPolicyDefinition';
		logger.debug('%s - start', method);

		const application_policy = new fabric_protos.ApplicationPolicy();

		if (typeof policy === 'string') {
			logger.debug('%s - have a policy reference :: %s', method, policy);
			application_policy.setChannelConfigPolicyReference(policy);
		} else if (policy instanceof Object) {
			logger.debug('%s - have a policy object %j', method, policy);
			const signature_policy = Policy.buildPolicy(null, policy, true);
			application_policy.setSignaturePolicy(signature_policy);
		} else {
			throw new Error('The endorsement policy is not valid');
		}

		this._endorsement_policy_def = policy;
		this._endorsement_policy = application_policy.toBuffer();

		return this;
	}

	/**
	 * Get the serialized endorsement policy generated by the endorsement
	 * policy definition or directly assigned to this chaincode instance.
	 * The serialized bytes will be generated when the endorsement policy
	 * definition is assigned with {@link Chaincode#setEndorsementPolicyDefinition setEndorsementPolicyDefinition()}.

	 */
	getEndorsementPolicy() {
		return this._endorsement_policy;
	}

	/**
	 * Set the serialized endorsement policy required for the chaincode approval.
	 * The serialized bytes may have been generated when the endorsement policy
	 * JSON definition was assigned to a {@link Chaincode}. see {@link Chaincode#setEndorsementPolicyDefinition setEndorsementPolicyDefinition()}.
	 *
	 * @param {byte[]} policy the serialized endorsement policy
	 */
	setEndorsementPolicy(policy) {
		const method = 'setEndorsementPolicy';
		logger.debug('%s - start', method);

		this._endorsement_policy = policy;

		return this;
	}

	/**
	 * Set a collection package for this chaincode. The input is a JSON object.
	 *
	 * @example <caption>Collection package</caption> An array of collection
	 * configurations.
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
	 * @param {Object} configPackage - The JSON representation of a fabric collection package definition.
	 */
	setCollectionConfigPackageDefinition(configPackage) {
		const method = 'setCollectionConfigPackageDefinition';
		logger.debug('%s - start', method);

		if (configPackage instanceof Object) {
			logger.debug('%s - have a collection config package object %j', method, configPackage);
			const config_proto = CollectionConfig.buildCollectionConfigPackage(configPackage);
			this._collection_package_proto = config_proto;
			this._collection_package_json = configPackage;
		} else {
			throw new Error('A JSON config package parameter is required');
		}

		logger.debug('%s - end', method);
		return this;
	}

	/**
	 * Get the collection config package. This is the
	 * protobuf object built by the CollectionConfig class using
	 * the collection package JSON input.
	 *
	 * @returns {CollectionConfigPackage}
	 */
	getCollectionConfigPackage() {
		return this._collection_package_proto;
	}

	/**
	 * Get the collection config package JSON. This is the
	 * input to the CollectionConfig class to build the protobuf
	 * object needed by the Approve Chaincode Fabric request
	 * see {@link Channel#approveChaincodeForOrg}.
	 *
	 * @returns {Object}
	 */
	getCollectionConfigPackageDefinition() {
		return this._collection_package_json;
	}

	/**
	 * Verify that this Chaincode instance has all the required attributes required for an
	 * approval or commit request.
	 */
	validate() {
		if (!this.getSequence()) {
			throw new Error('Chaincode definition must include the chaincode sequence setting');
		}
		if (!this.getName()) {
			throw new Error('Chaincode definition must include the chaincode name setting');
		}
		if (!this.getVersion()) {
			throw new Error('Chaincode definition must include the chaincode version setting');
		}
	}

	/**
	 * @typedef {Object} ChaincodePackageRequest
	 * @property {string} [label] - Optional. This string will identify this
	 *        package. This will be used to associate the package_id returned
	 *        by the Peer when this package is installed. The package_id will
	 *        uniquely identity the package on the Peer, however it may be
	 *        difficult to associate with this package. Since the label is
	 *        supplied by the user, the label will be easier to
	 *        association with the chaincode package. The name and version will
	 *        be combined with a colon (name:version) to be the label if not
	 *        supplied.
	 * @property {string} chaincodeType - Required. Type of chaincode. One of
	 *        'golang', 'car', 'node' or 'java'.
	 * @property {string} chaincodePath - Required. The path to the location of
	 *        the source code of the chaincode. If the chaincode type is golang,
	 *        then this path is the fully qualified package name, such as
	 *        'mycompany.com/myproject/mypackage/mychaincode'
	 * @property {string} metadataPath - Optional. The path to the top-level
	 *        directory containing metadata descriptors.
	 * @property {string} [goPath] - Optional. The path to be used with the golang
	 *        chaincode. Will default to the environment "GOPATH" value. Will be
	 *        used to locate the actual Chaincode 'goLang' files by building a
	 *        fully qualified path = < goPath > / 'src' / < chaincodePath >
	 */

	/**
	 * Package the files at the locations provided.
	 * This method will both return the package and set the package on this instance.
	 * This method will set the label, type, and paths (if provided in the request).
	 * The package_id will be set by the install method or manually by the application.
	 * The package_id must be set before using this object on the {@link Channel#approveChaincodeForOrg}.
	 *
	 * @async
	 * @param {ChaincodePackageRequest} request - Optional. The parameters to build the
	 *        chaincode package. Parameters will be required when the parameter has not
	 *        been set on this instance.
	 */


	async package(request) {
		const method = 'package';
		logger.debug('%s - start', method);

		// just in case reset
		this._package = null;

		if (request) {
			if (request.chaincodeType) {
				this._type = request.chaincodeType;
			}
			if (request.chaincodePath) {
				this._chaincode_path = request.chaincodePath;
			}
			if (request.metadataPath) {
				this._metadata_path = request.metadataPath;
			}
			if (request.goPath) {
				this._golang_path = request.goPath;
			}
			if (request.label) {
				this._label = request.label;
			}
		}

		if (!this._type) {
			throw new Error('Chaincode package "chaincodeType" parameter is required');
		}
		this._type = Chaincode.checkType(this._type);

		if (!this._chaincode_path) {
			throw new Error('Chaincode package "chaincodePath" parameter is required');
		}

		// need a goPath when chaincode is golang
		if (this._type === 'golang') {
			if (!this._golang_path) {
				this._golang_path = process.env.GOPATH;
			}
			if (!this._golang_path) {
				throw new Error('Missing the GOPATH environment setting and the "goPath" parameter.');
			}
			logger.debug('%s - have golang chaincode using goPath %s', method, this._golang_path);
		}

		const inner_tarball = await Packager.package(this._chaincode_path, this._type, false, this._metadata_path, this._golang_path);

		this._package = await Packager.finalPackage(this._label, this._type, inner_tarball, this._chaincode_path);

		return this._package;
	}

	/**
	 * @typedef {Object} ChaincodeInstallRequest
	 * @property {Peer} target - Required. The peer to use for this request
	 * @property {number} request_timeout - Optional. The amount of time for the
	 *        to respond. The default will be the system configuration
	 *        value of 'request-timeout'.
	 * @property {TransactionID} txId - Optional. The transaction ID object to
	 *        use with the install request. If not included it will be generated.
	 */

	/**
	 * Install the package on the specified peers.
	 * This method will send the package to the peers provided.
	 * Each peer will return a hash value of the installed
	 * package.
	 *
	 * @async
	 * @param {ChaincodeInstallRequest} request - The request object with the
	 *        install attributes and settings.
	 * @returns {string} The hash value as calculated by the target peer(s).
	 */
	async install(request) {
		const method = 'install';
		logger.debug('%s - start', method);

		if (!request) {
			throw new Error('Install operation requires a ChaincodeInstallRequest object parameter');
		}

		if (!request.target) {
			throw new Error('Chaincode install "target" parameter is required');
		}

		// check the internal settings that need to be set on this object before
		// it will be able to do an install
		if (!this._package) {
			throw new Error('Install operation requires a chaincode package be assigned to this chaincode');
		}

		let signer;
		let tx_id = request.txId;
		if (!tx_id) {
			logger.debug('%s - need to build a transaction ID', method);
			signer = this._client._getSigningIdentity(true); // try to use the admin if available
			tx_id = new TransactionID(signer, true);
		} else {
			signer = this._client._getSigningIdentity(tx_id.isAdmin()); // use the identity that built the transaction id
		}

		// build install request
		try {
			logger.debug('%s - build the install chaincode request', method);
			const install_chaincode_arg = new lifecycle_protos.InstallChaincodeArgs();
			install_chaincode_arg.setChaincodeInstallPackage(this._package);
			const install_request = {
				chaincodeId: '_lifecycle',
				fcn: 'InstallChaincode',
				args: [install_chaincode_arg.toBuffer()],
				txId: tx_id
			};

			logger.debug('%s - build the signed proposal', method);
			const proposal = client_utils.buildSignedProposal(install_request, '', this._client);

			logger.debug('%s - about to sendPeersProposal', method);
			// if request_timeout does not exist, then configuration setting value will be used
			const responses = await client_utils.sendPeersProposal([request.target], proposal.signed, request.request_timeout);

			for (const response of responses) {
				logger.debug('%s - looking at response from peer %s', method, request.target);
				if (response instanceof Error) {
					logger.error('Problem with the chaincode install ::' + response);
					throw response;
				} else if (response.response && response.response.status) {
					if (response.response.status === 200) {
						logger.debug('%s - peer response %j', method, response);
						const {package_id, label} = this._getInfoFromInstallResponse(response.response);
						this._package_id = package_id;
						if (label === this._label) {
							logger.debug('%s- label is the same %s', method, label);
						} else {
							throw new Error(format('Chaincode package label returned is not the same as this chaincode :: %s vs %s', this._label, label));
						}
					} else {
						throw new Error(format('Chaincode install failed with status:%s ::%s', response.status, response.message));
					}
				} else {
					throw new Error('Chaincode install has failed');
				}
			}

			return this._package_id;
		} catch (error) {
			logger.error('Problem building the lifecycle install request :: %s', error);
			logger.error(' problem at ::' + error.stack);
			throw error;
		}
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {
		return 'Chaincode : {' +
			'name : ' + this._name +
			', version : ' + this._version +
			', sequence : ' + this._sequence +
		'}';
	}

	static checkType(type) {
		const chaincodeType = type.toLowerCase();

		const map = {
			golang: fabric_protos.ChaincodeSpec.Type.GOLANG,
			java: fabric_protos.ChaincodeSpec.Type.JAVA,
			node: fabric_protos.ChaincodeSpec.Type.NODE
		};
		const value = map[chaincodeType];
		if (value) {
			return chaincodeType;
		} else {
			throw new Error(format('Chaincode type is not a known type %s', type));
		}
	}

	/*
	 * Internal method to get the info returned by the install from the
	 * payload of the invoke response
	 */
	_getInfoFromInstallResponse(response) {
		const installChaincodeResult = lifecycle_protos.InstallChaincodeResult.decode(response.payload);
		const package_id = installChaincodeResult.getPackageId();
		const label = installChaincodeResult.getLabel();

		return {package_id, label};
	}


	/*
	 * Build a ApproveChaincodeDefinitionForMyOrgArgs protobuf object
	 * based on this Chaincode definition
	 */
	getApproveChaincodeDefinitionForMyOrgArgs() {
		const method = 'getApproveChaincodeDefinitionForMyOrgArgs';
		logger.debug('%s - start', method);

		const arg = new lifecycle_protos.ApproveChaincodeDefinitionForMyOrgArgs();
		this._setCommon(arg);

		const source = new lifecycle_protos.ChaincodeSource();
		if (this._package_id) {
			const local = new lifecycle_protos.ChaincodeSource.Local();
			local.setPackageId(this._package_id);
			source.setLocalPackage(local);
		} else {
			const unavailable = new lifecycle_protos.ChaincodeSource.Unavailable();
			source.setUnavailable(unavailable);
		}

		arg.setSource(source);

		logger.debug('%s - end', method);
		return arg;
	}

	/*
	 * Build a CheckCommitReadinessArgs protobuf object
	 * based on this Chaincode definition
	 */
	getCheckCommitReadinessArgs() {
		const method = 'getCheckCommitReadinessArgs';
		logger.debug('%s - start', method);

		const arg = new lifecycle_protos.CheckCommitReadinessArgs();
		this._setCommon(arg);

		logger.debug('%s - end', method);
		return arg;
	}

	/*
	 * Build a CommitChaincodeDefinitionArgs protobuf object
	 * based on this Chaincode definition
	 */
	getCommitChaincodeDefinitionArgs() {
		const method = 'getCommitChaincodeDefinitionArgs';
		logger.debug('%s - start', method);

		const arg = new lifecycle_protos.CommitChaincodeDefinitionArgs();
		this._setCommon(arg);

		logger.debug('%s - end', method);
		return arg;
	}

	/*
	 * Internal method to set the common chaincode attributes into a protobuf object
	*/
	_setCommon(arg) {
		arg.setName(this._name);
		arg.setVersion(this._version);
		arg.setSequence(this._sequence);
		arg.setEndorsementPlugin(this._endorsement_plugin);
		arg.setValidationPlugin(this._validation_plugin);
		if (this._endorsement_policy) {
			arg.setValidationParameter(this._endorsement_policy);
		}
		if (this._collection_package_proto) {
			arg.setCollections(this._collection_package_proto);
		}
		arg.setInitRequired(this._init_required);
	}
};

module.exports = Chaincode;
