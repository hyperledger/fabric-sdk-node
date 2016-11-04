/*
 Copyright 2016 IBM All Rights Reserved.

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

var api = require('./api.js');
var util = require('util');
var fs = require('fs');
var Peer = require('./Peer.js');
var sdkUtils = require('./utils.js');
var grpc = require('grpc');

var _ccProto = grpc.load(__dirname + '/protos/chaincode.proto').protos;
var _ccProposalProto = grpc.load(__dirname + '/protos/chaincode_proposal.proto').protos;
var _ccTransProto = grpc.load(__dirname + '/protos/chaincode_transaction.proto').protos;
var _transProto = grpc.load(__dirname + '/protos/fabric_transaction.proto').protos;
var _headerProto = grpc.load(__dirname + '/protos/fabric_transaction_header.proto').protos;
var _proposalProto = grpc.load(__dirname + '/protos/fabric_proposal.proto').protos;
var _responseProto = grpc.load(__dirname + '/protos/fabric_proposal_response.proto').protos;

var logger = sdkUtils.getLogger('Member.js');

/**
 * Represents an authenticated user of the application or an entity used by a Peer node.
 * A member can be in any of these following states:
 *
 * - unregistered: the user has successfully authenticated to the application but has not been
 * added to the user registry maintained by the member services
 *
 * - registered but un-enrolled: the use has been added to the user registry and assigned a member ID
 * with a one-time password, but it has not been enrolled
 *
 * - enrolled: the user has used the one-time password to exchange for an Enrollment Certificate (ECert)
 * which can be used to identify him/herself to the member services
 *
 * @class
 */
var Member = class {

	/**
	 * Constructor for a member.
	 * @param cfg {string | RegistrationRequest} The member name or registration request.
	 */
	constructor(cfg, chain) {
		if (util.isString(cfg)) {
			this._name = cfg;
			this._roles = null; //string[]
			this._affiliation = '';
		} else if (util.isObject(cfg)) {
			var req = cfg;
			this._name = req.enrollmentID || req.name;
			this._roles = req.roles || ['fabric.user'];
			this._affiliation = req.affiliation;
		}

		this._chain = chain;
		this._memberServices = chain.getMemberServices();
		this._keyValStore = chain.getKeyValueStore();
		this._keyValStoreName = toKeyValueStoreName(this._name);
		this._tcertBatchSize = chain.getTCertBatchSize();

		this._enrollmentSecret = '';
		this._enrollment = null;
		this._tcertGetterMap = {}; //{[s:string]:TCertGetter}
	}

	/**
	 * Get the member name.
	 * @returns {string} The member name.
	 */
	getName() {
		return this._name;
	}

	/**
	 * Get the chain.
	 * @returns [Chain]{@link Chain} The chain.
	 */
	getChain() {
		return this._chain;
	}

	/**
	 * Get the member services.
	 * @returns {MemberServices} The member services.
	 */
	getMemberServices() {
		return this._memberServices;
	}

	/**
	 * Get the roles.
	 * @returns {string[]} The roles.
	 */
	getRoles() {
		return this._roles;
	}

	/**
	 * Set the roles.
	 * @param roles {string[]} The roles.
	 */
	setRoles(roles) {
		this._roles = roles;
	}

	/**
	 * Get the affiliation.
	 * @returns {string} The affiliation.
	 */
	getAffiliation() {
		return this._affiliation;
	}

	/**
	 * Set the affiliation.
	 * @param affiliation The affiliation.
	 */
	setAffiliation(affiliation) {
		this._affiliation = affiliation;
	}

	/**
	 * Get the transaction certificate (tcert) batch size, which is the number of tcerts retrieved
	 * from member services each time (i.e. in a single batch).
	 * @returns The tcert batch size.
	 */
	getTCertBatchSize() {
		if (this._tcertBatchSize === undefined) {
			return this._chain.getTCertBatchSize();
		} else {
			return this._tcertBatchSize;
		}
	}

	/**
	 * Set the transaction certificate (tcert) batch size.
	 * @param batchSize
	 */
	setTCertBatchSize(batchSize) {
		this._tcertBatchSize = batchSize;
	}

	/**
	 * Get the enrollment info.
	 * @returns {Enrollment} The enrollment.
	 */
	getEnrollment() {
		return this._enrollment;
	}

	/**
	 * Determine if this name has been registered.
	 * @returns {boolean} True if registered; otherwise, false.
	 */
	isRegistered() {
		return this._enrollmentSecret !== '';
	}

	/**
	 * Determine if this name has been enrolled.
	 * @returns {boolean} True if enrolled; otherwise, false.
	 */
	isEnrolled() {
		return this._enrollment !== null;
	}

	/**
	 * Register the member.
	 * @param {Object} registrationRequest
	 */
	register(registrationRequest) {
		var self = this;

		return new Promise(function(resolve, reject) {
			if (registrationRequest.enrollmentID !== self.getName()) {
				reject(new Error('registration enrollment ID and member name are not equal'));
			}

			var enrollmentSecret = self._enrollmentSecret;
			if (enrollmentSecret && enrollmentSecret !== '') {
				return resolve(enrollmentSecret);
			} else {
				self._memberServices.register(registrationRequest, self._chain.getRegistrar())
				.then(
					function(enrollmentSecret) {

						self._enrollmentSecret = enrollmentSecret;
						return self.saveState();
					}
				).then(
					function(data) {
						return resolve(self._enrollmentSecret);
					}
				).catch(
					function(err) {
						logger.error('Failed to register user "%s". Error: %s', registrationRequest.enrollmentID, err.stack ? err.stack : err);
						reject(err);
					}
				);
			}
		});
	}

	/**
	 * Enroll the member and return the enrollment results.
	 * @param enrollmentSecret The password or enrollment secret as returned by register.
	 */
	enroll(enrollmentSecret) {
		var self = this;

		return new Promise(function(resolve, reject) {
			var enrollment = self._enrollment;
			if (self.isEnrolled()) {
				return resolve(self.getEnrollment());
			} else {
				var req = {
					enrollmentID: self.getName(),
					enrollmentSecret: enrollmentSecret
				};

				self._memberServices.enroll(req)
					.then(
						function(enrollment) {

							self._enrollment = enrollment;
							// Generate queryStateKey
							self._enrollment.queryStateKey = self._chain.cryptoPrimitives.generateNonce();

							// Save state
							return self.saveState()
								.then(function() {
									return resolve(enrollment);
								});
						}
					).then(
						function(enrollment) {
							// Unmarshall chain key
							// TODO: during restore, unmarshall enrollment.chainEncryptionKey
							var ecdsaChainKey = self._chain.cryptoPrimitives.getPublicKeyFromPEM(self._enrollment.chainEncryptionKey);
							self._enrollment.enrollChainKey = ecdsaChainKey;

							return resolve(enrollment);
						}
					).catch(
						function(err) {
							logger.error('Failed to enroll user "%s". Error: %s', self.getName(), err.stack ? err.stack : err);
							reject(err);
						}
					);
			}
		});
	}

	/**
	 * Perform both registration and enrollment.
	 * @param {Object} registrationRequest
	 */
	registerAndEnroll(registrationRequest) {
		var self = this;

		return new Promise(function(resolve, reject) {
			var enrollment = self._enrollment;
			if (enrollment) {
				return resolve(enrollment);
			} else {
				self.register(registrationRequest)
					.then(
						function(enrollmentSecret) {
							return self.enroll(enrollmentSecret);
						}
					).then(
						function(enrollment) {
							return resolve(enrollment);
						}
					).catch(
						function(err) {
							logger.error('Failed to register and enroll user "%s". Error: %s', self.getName(), err.stack ? err.stack : err);
							reject(err);
						}
					);
			}
		});
	}

	/**
	 * Save the state of this member to the key value store.
	 * @returns Promise for a 'true' upon successful save
	 */
	saveState() {
		return this._keyValStore.setValue(this._keyValStoreName, this.toString());
	}

	/**
	 * Restore the state of this member from the key value store (if found).  If not found, do nothing.
	 * @returns Promise for a 'true' upon successful restore
	 */
	restoreState() {
		var self = this;

		return new Promise(function(resolve, reject) {
			self._keyValStore.getValue(self._keyValStoreName)
			.then(
				function(memberStr) {
					if (memberStr) {
						// The member was found in the key value store, so restore the state.
						self.fromString(memberStr);
					}

					logger.info('Successfully loaded user "%s" from local key value store', self.getName());
					return resolve(true);
				}
			).catch(
				function(err) {
					logger.error('Failed to load user "%s" from local key value store. Error: %s', self.getName(), err.stack ? err.stack : err);
					reject(err);
				}
			);
		});
	}

	/**
	 * Sends the orderer an endorsed proposal.
	 * The caller must use the proposal response returned from the endorser along
	 * with the original proposal request sent to the endorser.
	 *
	 * @param {ProposalResponse} proposalResponse - A ProposalResponse object containing
	 *        the response from the endorsement (see fabric_proposal_response.proto)
	 * @param {Proposal} chaincodeProposal - A Proposal object containing the original
	 *        request for endorsement (see fabric_proposal.proto)
	 * @returns Promise for an acknowledgement from the orderer of successfully submitted transaction
	 */
	sendTransaction(proposalResponse, chaincodeProposal) {
		logger.debug('Member.sendTransaction - start :: chain '+this._chain);

		// Verify that data is being passed in
		if (!proposalResponse) {
			logger.error('Member.sendTransaction - input proposalResponse missing');
			return Promise.reject(new Error('Missing proposalResponse object parameter'));
		}
		if (!chaincodeProposal) {
			logger.error('Member.sendTransaction - input chaincodeProposal missing');
			return Promise.reject(new Error('Missing chaincodeProposal object parameter'));
		}
		// verify that we have an orderer configured
		if(!this._chain.getOrderer()) {
			logger.error('Member.sendTransaction - no orderer defined');
			return Promise.reject(new Error('no Orderer defined'));
		}

		//logger.debug('Member.sendTransaction - proposalResponse %j', proposalResponse);
		//logger.debug('Member.sendTransaction - chaincodePropsoal %j', chaincodeProposal);

		var endorsements = [];
		endorsements.push(proposalResponse.endorsement);
		var chaincodeEndorsedAction = new _ccTransProto.ChaincodeEndorsedAction();
		chaincodeEndorsedAction.setProposalResponsePayload(proposalResponse.payload);
		chaincodeEndorsedAction.setEndorsements(endorsements);

		var chaincodeActionPayload = new _ccTransProto.ChaincodeActionPayload();
		chaincodeActionPayload.setAction(chaincodeEndorsedAction);
		chaincodeActionPayload.setChaincodeProposalPayload(chaincodeProposal.payload);

		var transactionAction = new _transProto.TransactionAction();
		transactionAction.setHeader(chaincodeProposal.header);
		transactionAction.setPayload(chaincodeActionPayload.toBuffer());

		var transaction2 = new _transProto.Transaction2();
		var actions = [];
		actions.push(transactionAction);
		transaction2.setActions(actions);

		var orderer = this._chain.getOrderer();
		return orderer.sendBroadcast(transaction2.toBuffer());
	}

	/**
	 * Sends a deployment proposal to an endorser.
	 *
	 * @param {Object} request An object containing the following fields:
	 *		target : Endorsing Peer Object
	 *		chaincodePath : String
	 *		fcn : String
	 *		args : Strings
	 * @returns Promise for a ProposalResponse
	 */
	sendDeploymentProposal(request) {
		// Verify that chaincodePath is being passed
		if (!request.chaincodePath || request.chaincodePath === '') {
			logger.error('Invalid input parameter to "sendDeploymentProposal": must have "chaincodePath"');
		  	return Promise.reject(new Error('missing chaincodePath in Deployment proposal request'));
		}
		// verify that the caller has included a peer object
		if(!request.target) {
			logger.error('Invalid input parameter to "sendDeploymentProposal": must have "target" object');
			return Promise.reject(new Error('Missing "target" for the endorsing peer object in the Deployment proposal request'));
		}
		let peer = request.target;
		var chaincode_id;

		// args is optional because some chaincode may not need any input parameters during initialization
		if (!request.args) {
			request.args = [];
		}

		return packageChaincode(request.chaincodePath, request.fcn, request.args)
		.then(
			function(data) {
				var targzFilePath = data[0];
				var hash = data[1];
				chaincode_id = hash;

				logger.debug('Successfully generated chaincode deploy archive and name hash (%s)', hash);

				// at this point, the targzFile has been successfully generated

				// step 1: construct a ChaincodeSpec
				var args = [];
				args.push(Buffer.from(request.fcn ? request.fcn : 'init', 'utf8'));

				for (let i=0; i<request.args.length; i++)
					args.push(Buffer.from(request.args[i], 'utf8'));

				let ccSpec = {
					type: _ccProto.ChaincodeSpec.Type.GOLANG,
					chaincodeID: {
						name: hash
					},
					ctorMsg: {
						args: args
					}
				};

				// step 2: construct the ChaincodeDeploymentSpec
				let chaincodeDeploymentSpec = new _ccProto.ChaincodeDeploymentSpec();
				chaincodeDeploymentSpec.setChaincodeSpec(ccSpec);

				return new Promise(function(resolve, reject) {
					fs.readFile(targzFilePath, function(err, data) {
						if(err) {
							reject(new Error(util.format('Error reading deployment archive [%s]: %s', targzFilePath, err)));
						} else {
							chaincodeDeploymentSpec.setCodePackage(data);

							let lcccSpec = {
								type: _ccProto.ChaincodeSpec.Type.GOLANG,
								chaincodeID: {
									name: 'lccc'
								},
								ctorMsg: {
									args: [Buffer.from('deploy', 'utf8'), Buffer.from('default', 'utf8'), chaincodeDeploymentSpec.toBuffer()]
								}
							};

							// step 3: construct the ChaincodeInvocationSpec to call the LCCC
							let cciSpec = new _ccProto.ChaincodeInvocationSpec();
							cciSpec.setChaincodeSpec(lcccSpec);
							cciSpec.setIdGenerationAlg('');

							// step 4: construct the enveloping Proposal object
							// step 4.1: the header part of the proposal
							let headerExt = new _ccProposalProto.ChaincodeHeaderExtension();
							let header = new _headerProto.Header();
							header.setType(_headerProto.Header.Type.CHAINCODE);
							header.setExtensions(headerExt.toBuffer());

							// step 4.2: the payload part of the proposal for chaincode deploy is ChaincodeProposalPayload
							let payload = new _ccProposalProto.ChaincodeProposalPayload();
							payload.setInput(cciSpec.toBuffer());

							let proposal = {
								header: header.toBuffer(),
								payload: payload.toBuffer()
							};

							return peer.sendProposal(proposal)
							.then(
								function(response) {
									response.chaincodeId = chaincode_id;
									resolve([response, proposal]);
								}
							);
						}
					});
				});
			}
		).catch(
			function(err) {
				logger.error('Failed Deployment Proposal. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/**
	 * Sends a transaction proposal to an endorsing peer.
	 *
	 * @param {Object} request:
	 *		target : {Object} Endorsing Peer object as the target of the request
	 *		chaincodeId : {String} The id of the chaincode to perform the transaction proposal
	 *		args : {Array} Arguments specific to the chaincode 'innvoke'
	 * @returns Promise for a ProposalResponse
	 */
	sendTransactionProposal(request) {
		logger.debug('Member.sendTransactionProposal - start');

		// verify that the caller has included a peer object
		if(!request.target) {
			logger.error('Missing "target" endorser peer object in the Transaction proposal request');
			return Promise.reject(new Error('Missing "target" for endorser peer object in the Transaction proposal request'));
		}

		if(!request.chaincodeId) {
			logger.error('Missing chaincode ID in the Transaction proposal request');
			return Promise.reject(new Error('Missing chaincode ID in the Transaction proposal request'));
		}

		// args is not optional because we need for transaction to execute
		if (!request.args) {
			logger.error('Missing arguments in Transaction proposal request');
			return Promise.reject(new Error('Missing arguments in Transaction proposal request'));
		}

		var args = [];
		// leaving this for now... but this call is always an invoke and we are not telling caller to include 'fcn' any longer
		args.push(Buffer.from(request.fcn ? request.fcn : 'invoke', 'utf8'));
		logger.debug('Member.sendTransactionProposal - adding function arg:%s', request.fcn ? request.fcn : 'invoke');

		for (let i=0; i<request.args.length; i++) {
			args.push(Buffer.from(request.args[i], 'utf8'));
			logger.debug('Member.sendTransactionProposal - adding arg:%s', request.args[i]);
		}

		let invokeSpec = {
			type: _ccProto.ChaincodeSpec.Type.GOLANG,
			chaincodeID: {
				name: request.chaincodeId
			},
			ctorMsg: {
				args: args
			}
		};

		// construct the ChaincodeInvocationSpec
		let cciSpec = new _ccProto.ChaincodeInvocationSpec();
		cciSpec.setChaincodeSpec(invokeSpec);
		cciSpec.setIdGenerationAlg('');

		// construct the enveloping Proposal object
		//  - the header part of the proposal
		let headerExt = new _ccProposalProto.ChaincodeHeaderExtension();
		let header = new _headerProto.Header();
		header.setType(_headerProto.Header.Type.CHAINCODE);
		header.setExtensions(headerExt.toBuffer());
		//header.setChainID()

		//  - the payload part of the proposal for chaincode deploy is ChaincodeProposalPayload
		let payload = new _ccProposalProto.ChaincodeProposalPayload();
		payload.setInput(cciSpec.toBuffer());

		let proposal = {
			header: header.toBuffer(),
			payload: payload.toBuffer()
		};

		let peer = request.target;
		return peer.sendProposal(proposal)
		.then(
			function(response) {
				return Promise.resolve([response,proposal]);
			}
		).catch(
			function(err) {
				logger.error('Failed Transaction Proposal. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/**
	 * Sends a proposal to an endorsing peer that will be handled by the chaincode.
	 * This request will be presented to the chaincode 'invoke' and must understand
	 * from the arguments that this is a query request. The chaincode must also return
	 * results in the byte array format and the caller will have to be able to decode
	 * these results
	 *
	 * @param {Object} request:
	 *		target : {Object} Endorsing Peer object as the target of the request
	 *		chaincodeId : {String} The id of the chaincode to perform the query
	 *		args : {Array} Arguments for the 'invoke' function call on the chaincode
	 *             that represent a query invocation
	 * @returns Promise for a byte array results from the chaincode
	 */
	queryByChaincode(request) {
		logger.debug('Member.sendQueryProposal - start');

		return this.sendTransactionProposal(request)
		.then(
			function(results) {
				var response = results[0];
				var proposal = results[1];
				logger.debug('Member-sendQueryProposal - response %j', response);
				if(response.response && response.response.payload) {
					return Promise.resolve(response.response.payload);
				}
				return Promise.reject(new Error('Payload results are missing from the chaincode query'));
			}
		).catch(
			function(err) {
				logger.error('Failed Query by chaincode. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/**
	 * Get the current state of this member as a string
	 * @return {string} The state of this member as a string
	 */
	fromString(str) {
		var state = JSON.parse(str);

		if (state.name !== this.getName()) {
			throw new Error('name mismatch: \'' + state.name + '\' does not equal \'' + this.getName() + '\'');
		}

		this._name = state.name;
		this._roles = state.roles;
		this._affiliation = state.affiliation;
		this._enrollmentSecret = state.enrollmentSecret;
		this._enrollment = state.enrollment;
	}

	/**
	 * Save the current state of this member as a string
	 * @return {string} The state of this member as a string
	 */
	toString() {
		var state = {
			name: this._name,
			roles: this._roles,
			affiliation: this._affiliation,
			enrollmentSecret: this._enrollmentSecret,
			enrollment: this._enrollment
		};

		return JSON.stringify(state);
	}
};

function toKeyValueStoreName(name) {
	return 'member.' + name;
}

function packageChaincode(chaincodePath, fcn, args) {

	// Determine the user's $GOPATH
	let goPath =  process.env['GOPATH'];

	// Compose the path to the chaincode project directory
	let projDir = goPath + '/src/' + chaincodePath;

	// Compute the hash of the chaincode deployment parameters
	let hash = sdkUtils.generateParameterHash(chaincodePath, fcn, args);

	// Compute the hash of the project directory contents
	hash = sdkUtils.generateDirectoryHash(goPath + '/src/', chaincodePath, hash);

	// Compose the Dockerfile commands
	let dockerFileContents = 'from hyperledger/fabric-ccenv\n' +
		'COPY . $GOPATH/src/build-chaincode/\n' +
		'WORKDIR $GOPATH\n\n' +
		'RUN go install build-chaincode && mv $GOPATH/bin/build-chaincode $GOPATH/bin/%s';

	// Substitute the hashStrHash for the image name
	dockerFileContents = util.format(dockerFileContents, hash);

	return new Promise(function(resolve, reject) {
		// Create a Docker file with dockerFileContents
		let dockerFilePath = projDir + '/Dockerfile';
		fs.writeFile(dockerFilePath, dockerFileContents, function(err) {
			if (err) {
				reject(new Error(util.format('Error writing file [%s]: %s', dockerFilePath, err)));
			} else {
				// Create the .tar.gz file of the chaincode package
				let targzFilePath = '/tmp/deployment-package.tar.gz';
				// Create the compressed archive
				return sdkUtils.generateTarGz(projDir, targzFilePath)
				.then(
					function(targzFilePath) {
						// return both the hash and the tar.gz file path as resolved data
						resolve([targzFilePath, hash]);
					}
				).catch(
					function(err) {
						logger.error('Failed to build chaincode package: %s', err.stack ? err.stack : err);
						reject(err);
					}
				);
			}
		});
	});
}

module.exports = Member;
