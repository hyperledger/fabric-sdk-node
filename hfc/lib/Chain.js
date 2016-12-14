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
var utils = require('./utils.js');
var urlParser = require('url');
var net = require('net');
var util = require('util');
var fs = require('fs');
var Peer = require('./Peer.js');
var Orderer = require('./Orderer.js');
var settle = require('promise-settle');
var grpc = require('grpc');
var logger = utils.getLogger('Chain.js');

var _ccProto = grpc.load(__dirname + '/protos/peer/chaincode.proto').protos;
var _ccProposalProto = grpc.load(__dirname + '/protos/peer/chaincode_proposal.proto').protos;
var _ccTransProto = grpc.load(__dirname + '/protos/peer/chaincode_transaction.proto').protos;
var _transProto = grpc.load(__dirname + '/protos/peer/fabric_transaction.proto').protos;
var _proposalProto = grpc.load(__dirname + '/protos/peer/fabric_proposal.proto').protos;
var _responseProto = grpc.load(__dirname + '/protos/peer/fabric_proposal_response.proto').protos;
var _commonProto = grpc.load(__dirname + '/protos/common/common.proto').common;

/**
 * The class representing a chain with which the client SDK interacts.
 *
 * The “Chain” object captures settings for a channel, which is created by
 * the orderers to isolate transactions delivery to peers participating on channel.
 * A chain must be initialized after it has been configured with the list of peers
 * and orderers. The initialization sends a CONFIGURATION transaction to the orderers
 * to create the specified channel and asks the peers to join that channel.
 *
 * @class
 */
var Chain = class {

	/**
	 * @param {string} name to identify different chain instances. The naming of chain instances
	 * is enforced by the ordering service and must be unique within the blockchain network
	 * @param {Client} clientContext An instance of {@link Client} that provides operational context
	 * such as submitting User etc.
	 */
	constructor(name, clientContext) {
		// name is required
		if (typeof name === 'undefined' || !name) {
			logger.error('Failed to create Chain. Missing requirement "name" parameter.');
			throw new Error('Failed to create Chain. Missing requirement "name" parameter.');
		}

		if (typeof clientContext === 'undefined' || !clientContext) {
			logger.error('Failed to create Chain. Missing requirement "clientContext" parameter.');
			throw new Error('Failed to create Chain. Missing requirement "clientContext" parameter.');
		}

		// naming for the chain will be enforced later by the orderer when "initialize()" gets called
		this._name = name;

		// Security enabled flag
		this._securityEnabled = true;//to do

		// The number of tcerts to get in each batch
		this._tcertBatchSize = utils.getConfigSetting('tcert-batch-size',200);

		// Is in dev mode or network mode
		this._devMode = false;

		// If in prefetch mode, we prefetch tcerts from member services to help performance
		this._preFetchMode = true;//to do - not in doc

		/**
		 * @member [CryptoSuite]{@link module:api.CryptoSuite} cryptoPrimitives The crypto primitives object provides access to the crypto suite
		 * for functions like sign, encrypt, decrypt, etc.
		 * @memberof module:api.Chain.prototype
		 */
		this.cryptoPrimitives = utils.getCryptoSuite();

		this._peers = [];
		this._orderers = [];

		this._clientContext = clientContext;

		//to do update logger
		logger.info('Constructed Chain instance: name - %s, securityEnabled: %s, TCert download batch size: %s, network mode: %s',
			this._name, this._securityEnabled, this._tcertBatchSize, !this._devMode);
	}

	/**
	 * Get the chain name.
	 * @returns {string} The name of the chain.
	 */
	getName() {
		return this._name;
	}

	/**
	 * Determine if security is enabled.
	 */
	isSecurityEnabled() {
		return true;//to do
	}

	/**
	 * Determine if pre-fetch mode is enabled to prefetch tcerts.
	 */
	isPreFetchMode() {
		return this._preFetchMode;
	}

	/**
	 * Set prefetch mode to true or false.
	 */
	setPreFetchMode(preFetchMode) {
		this._preFetchMode = preFetchMode;
	}

	/**
	 * Determine if dev mode is enabled.
	 */
	isDevMode() {
		return this._devMode;
	}

	/**
	 * Set dev mode to true or false.
	 */
	setDevMode(devMode) {
		this._devMode = devMode;
	}

	/**
	 * Get the tcert batch size.
	 */
	getTCertBatchSize() {
		return this._tcertBatchSize;
	}

	/**
	 * Set the tcert batch size.
	 */
	setTCertBatchSize(batchSize) {
		this._tcertBatchSize = batchSize;
	}

	/**
	 * Add peer endpoint to chain.
	 * @param {Peer} peer An instance of the Peer class that has been initialized with URL,
	 * TLC certificate, and enrollment certificate.
	 */
	addPeer(peer) {
		this._peers.push(peer);
	}

	/**
	 * Remove peer endpoint from chain.
	 * @param {Peer} peer An instance of the Peer class.
	 */
	removePeer(peer) {
		var url = peer.getUrl();
		for (let i = 0; i < this._peers.length; i++) {
			if (this._peers[i].getUrl() === url) {
				this._peers.splice(i, 1);
				logger.debug('Removed peer with url "%s".', url);
				return;
			}
		}
		logger.debug('Did not find a peer to remove with url "%s".', url);
	}

	/**
	 * Get peers of a chain from local information.
	 * @returns {Peer[]} The peer list on the chain.
	 */
	getPeers() {
		return this._peers;
	}

	/**
	 * Add orderer endpoint to a chain object, this is a local-only operation.
	 * A chain instance may choose to use a single orderer node, which will broadcast
	 * requests to the rest of the orderer network. Or if the application does not trust
	 * the orderer nodes, it can choose to use more than one by adding them to the chain instance.
	 * All APIs concerning the orderer will broadcast to all orderers simultaneously.
	 * @param {Orderer} orderer An instance of the Orderer class.
	 */
	addOrderer(orderer) {
		this._orderers.push(orderer);
	}

	/**
	 * Remove orderer endpoint from a chain object, this is a local-only operation.
	 * @param {Orderer} orderer An instance of the Orderer class.
	 */
	removeOrderer(orderer) {
		var url = orderer.getUrl();
		for (let i = 0; i < this._orderers.length; i++) {
			if (this._orderers[i].getUrl() === url) {
				this._orderers.splice(i, 1);
				logger.debug('Removed orderer with url "%s".', url);
				return;
			}
		}
		logger.debug('Did not find an orderer to remove with url "%s".', url);
	}

	/**
	 * Get orderers of a chain.
	 */
	getOrderers() {
		return this._orderers;
	}

	/**
	 * Calls the orderer(s) to start building the new chain, which is a combination
	 * of opening new message stream and connecting the list of participating peers.
	 * This is a long-running process. Only one of the application instances needs
	 * to call this method. Once the chain is successfully created, other application
	 * instances only need to call getChain() to obtain the information about this chain.
	 * @returns {boolean} Whether the chain initialization process was successful.
	 */
	initializeChain() {
		//to do
	}

	/**
	 * Calls the orderer(s) to update an existing chain. This allows the addition and
	 * deletion of Peer nodes to an existing chain, as well as the update of Peer
	 * certificate information upon certificate renewals.
	 * @returns {boolean} Whether the chain update process was successful.
	 */
	updateChain() {
		//to do
	}

	/**
	 * Get chain status to see if the underlying channel has been terminated,
	 * making it a read-only chain, where information (transactions and states)
	 * can be queried but no new transactions can be submitted.
	 * @returns {boolean} Is read-only, true or not.
	 */
	isReadonly() {
		return false;//to do
	}

	/**
	 * Queries for various useful information on the state of the Chain
	 * (height, known peers).
	 * @returns {object} With height, currently the only useful info.
	 */
	queryInfo() {
		//to do
	}

	/**
	 * Queries the ledger for Block by block number.
	 * @param {number} blockNumber The number which is the ID of the Block.
	 * @returns {object} Object containing the block.
	 */
	queryBlock(blockNumber) {
		//to do
	}

	/**
	 * Queries the ledger for Transaction by number.
	 * @param {number} transactionID
	 * @returns {object} Transaction information containing the transaction.
	 */
	queryTransaction(transactionID) {
		//to do
	}

	/**
	 * Sends a deployment proposal to one or more endorsing peers.
	 *
	 * @param {Object} request - An object containing the following fields:
	 *		<br>`targets` : required - An array or single Endorsing {@link Peer} objects as the targets of the request
	 *		<br>`chaincodePath` : required - String of the path to location of the source code of the chaincode
	 *		<br>`chaincodeId` : required - String of the name of the chaincode
	 *		<br>`chainId` : required - String of the name of the chain
	 *		<br>`txId` : required - String of the transaction id
	 *		<br>`nonce` : required - Integer of the once time number
	 *		<br>`fcn` : optional - String of the function to be called on the chaincode once deployed (default 'init')
	 *		<br>`args` : optional - String Array arguments specific to the chaincode being deployed
	 *		<br>`dockerfile-contents` : optional - String defining the
	 * @returns {Promise} A Promise for a `ProposalResponse`
	 * @see /protos/peer/fabric_proposal_response.proto
	 */
	sendDeploymentProposal(request) {
		var errorMsg = null;

		// Verify that chaincodePath is being passed
		if (request && (!request.chaincodePath || request.chaincodePath === '')) {
			errorMsg = 'Missing chaincodePath parameter in Deployment proposal request';
		} else {
			errorMsg = Chain._checkProposalRequest(request);
		}

		if(errorMsg) {
			logger.error('Chain.sendDeploymentProposal error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		// args is optional because some chaincode may not need any input parameters during initialization
		if (!request.args) {
			request.args = [];
		}
		let self = this;

		return packageChaincode(request.chaincodePath, request.chaincodeId, request['dockerfile-contents'])
		.then(
			function(data) {
				var targzFilePath = data;

				logger.debug('Chain.sendDeployment- Successfully generated chaincode deploy archive and name (%s)', request.chaincodeId);

				// at this point, the targzFile has been successfully generated

				// step 1: construct a ChaincodeSpec
				var args = [];
				args.push(Buffer.from(request.fcn ? request.fcn : 'init', 'utf8'));

				for (let i=0; i<request.args.length; i++)
					args.push(Buffer.from(request.args[i], 'utf8'));

				let ccSpec = {
					type: _ccProto.ChaincodeSpec.Type.GOLANG,
					chaincodeID: {
						name: request.chaincodeId
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

							// TODO add ESCC/VSCC info here ??????
							let lcccSpec = {
								type: _ccProto.ChaincodeSpec.Type.GOLANG,
								chaincodeID: {
									name: 'lccc'
								},
								ctorMsg: {
									args: [Buffer.from('deploy', 'utf8'), Buffer.from('default', 'utf8'), chaincodeDeploymentSpec.toBuffer()]
								}
							};

							var header, proposal;
							return self._clientContext.getUserContext()
							.then(
								function(userContext) {
									header = Chain._buildHeader(userContext.getEnrollment().certificate, request.chainId, 'lccc', request.txId, request.nonce);
									proposal = self._buildProposal(lcccSpec, header);
									let signed_proposal = self._signProposal(userContext.getEnrollment(), proposal);

									return Chain._sendPeersProposal(request.targets, signed_proposal);
								}
							).then(
								function(responses) {
									resolve([responses, proposal, header]);
								}
							).catch(
								function(err) {
									logger.error('Sending the deployment proposal failed. Error: %s', err.stack ? err.stack : err);
									reject(err);
								}
							);
						}
					});
				});
			}
		).catch(
			function(err) {
				logger.error('Building the deployment proposal failed. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/**
	 * Sends a transaction proposal to one or more endorsing peers.
	 *
	 * @param {Object} request
	 *		<br>`targets` : An array or single Endorsing {@link Peer} objects as the targets of the request
	 *		<br>`chaincodeId` : The id of the chaincode to perform the transaction proposal
	 *		<br>`chainId` : required - String of the name of the chain
	 *		<br>`txId` : required - String of the transaction id
	 *		<br>`nonce` : required - Integer of the once time number
	 *		<br>`args` : an array of arguments specific to the chaincode 'innvoke'
	 * @returns {Promise} A Promise for a `ProposalResponse`
	 */
	sendTransactionProposal(request) {
		logger.debug('Chain.sendTransactionProposal - start');
		var errorMsg = null;
		// args is not optional because we need for transaction to execute
		if (request && !request.args) {
			errorMsg = 'Missing "args" in Transaction proposal request';
		} else {
			errorMsg = Chain._checkProposalRequest(request);
		}

		if(errorMsg) {
			logger.error('Chain.sendTransactionProposal error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		var args = [];
		// leaving this for now... but this call is always an invoke and we are not telling caller to include 'fcn' any longer
		args.push(Buffer.from(request.fcn ? request.fcn : 'invoke', 'utf8'));
		logger.debug('Chain.sendTransactionProposal - adding function arg:%s', request.fcn ? request.fcn : 'invoke');

		for (let i=0; i<request.args.length; i++) {
			args.push(Buffer.from(request.args[i], 'utf8'));
			logger.debug('Chain.sendTransactionProposal - adding arg:%s', request.args[i]);
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

		var self = this;
		var proposal, header;
		return this._clientContext.getUserContext()
		.then(
			function(userContext) {
				header = Chain._buildHeader(userContext.getEnrollment().certificate, request.chainId, request.chaincodeId, request.txId, request.nonce);
				proposal = self._buildProposal(invokeSpec, header);
				let signed_proposal = self._signProposal(userContext.getEnrollment(), proposal);

				return Chain._sendPeersProposal(request.targets, signed_proposal);
			}
		).then(
			function(responses) {
				return Promise.resolve([responses, proposal, header]);
			}
		).catch(
			function(err) {
				logger.error('Failed Proposal. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/**
	 * Sends the orderer an endorsed proposal.
	 * The caller must use the proposal response returned from the endorser along
	 * with the original proposal request sent to the endorser.
	 *
	 * @param {Array} proposalResponses - An array or single {ProposalResponse} objects containing
	 *        the response from the endorsement
	 * @see fabric_proposal_response.proto
	 * @param {Proposal} chaincodeProposal - A Proposal object containing the original
	 *        request for endorsement(s)
	 * @see fabric_proposal.proto
	 * @returns {Promise} A Promise for a `BroadcastResponse`.
	 *         This will be an acknowledgement from the orderer of successfully submitted transaction.
	 * @see the ./proto/atomicbroadcast/ab.proto
	 */
	sendTransaction(request) {
		logger.debug('Chain.sendTransaction - start :: chain '+this._chain);
		var errorMsg = null;

		if (request) {
			// Verify that data is being passed in
			if (!request.proposalResponses) {
				errorMsg = 'Missing "proposalResponse" parameter in transaction request';
			}
			if (!request.proposal) {
				errorMsg = 'Missing "proposal" parameter in transaction request';
			}
			if (!request.header) {
				errorMsg = 'Missing "header" parameter in transaction request';
			}
		} else {
			errorMsg = 'Missing input request object on the proposal request';
		}

		if(errorMsg) {
			logger.error('Chain.sendTransaction error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		let proposalResponses = request.proposalResponses;
		let chaincodeProposal = request.proposal;
		let header            = request.header;

		// verify that we have an orderer configured
		if(!this.getOrderers()) {
			logger.error('Chain.sendTransaction - no orderers defined');
			return Promise.reject(new Error('no Orderer defined'));
		}

		var endorsements = [];
		let proposalResponse = proposalResponses;
		if(Array.isArray(proposalResponses)) {
			for(let i=0; i<proposalResponses.length; i++) {
				// make sure only take the valid responses to set on the consolidated response object
				// to use in the transaction object
				if (proposalResponses[i].response && proposalResponses[i].response.status === 200) {
					proposalResponse = proposalResponses[i];
					endorsements.push(proposalResponse.endorsement);
				}
			}
		} else {
			endorsements.push(proposalResponse.endorsement);
		}

		var chaincodeEndorsedAction = new _ccTransProto.ChaincodeEndorsedAction();
		chaincodeEndorsedAction.setProposalResponsePayload(proposalResponse.payload);
		chaincodeEndorsedAction.setEndorsements(endorsements);

		var chaincodeActionPayload = new _ccTransProto.ChaincodeActionPayload();
		chaincodeActionPayload.setAction(chaincodeEndorsedAction);
		var chaincodeProposalPayloadNoTrans = _ccProposalProto.ChaincodeProposalPayload.decode(chaincodeProposal.payload);
		chaincodeProposalPayloadNoTrans.transient = null;
		var payload_hash = this.cryptoPrimitives.hash(chaincodeProposalPayloadNoTrans.toBuffer());
		chaincodeActionPayload.setChaincodeProposalPayload(Buffer.from(payload_hash, 'hex'));

		var transactionAction = new _transProto.TransactionAction();
		transactionAction.setHeader(header.getSignatureHeader().toBuffer());
		transactionAction.setPayload(chaincodeActionPayload.toBuffer());

		var actions = [];
		actions.push(transactionAction);

		var transaction = new _transProto.Transaction();
		transaction.setActions(actions);


		var payload = new _commonProto.Payload();
		payload.setHeader(header);
		payload.setData(transaction.toBuffer());

		let payload_bytes = payload.toBuffer();
		// sign the proposal

		var self = this;
		return this._clientContext.getUserContext()
		.then(
			function(userContext) {
				let sig = self.cryptoPrimitives.sign(userContext.getEnrollment().privateKey, payload_bytes);
				let signature = Buffer.from(sig.toDER());

				// building manually or will get protobuf errors on send
				var envelope = {
					signature: signature,
					payload : payload_bytes
				};

				var orderer = self.getOrderers()[0];
				return orderer.sendBroadcast(envelope);
			}
		);
	}

	/**
	 * Sends a proposal to one or more endorsing peers that will be handled by the chaincode.
	 * This request will be presented to the chaincode 'invoke' and must understand
	 * from the arguments that this is a query request. The chaincode must also return
	 * results in the byte array format and the caller will have to be able to decode
	 * these results
	 *
	 * @param {Object} request A JSON object with the following
	 *		<br>targets : An array or single Endorsing {@link Peer} objects as the targets of the request
	 *		<br>chaincodeId : The id of the chaincode to perform the query
	 *		<br>`args` : an array of arguments specific to the chaincode 'innvoke'
	 *             that represent a query invocation on that chaincode
	 * @returns {Promise} A Promise for an array of byte array results from the chaincode on all Endorsing Peers
	 */
	queryByChaincode(request) {
		logger.debug('Chain.sendQueryProposal - start');

		return this.sendTransactionProposal(request)
		.then(
			function(results) {
				var responses = results[0];
				var proposal = results[1];
				logger.debug('Member-sendQueryProposal - response %j', responses);
				if(responses && Array.isArray(responses)) {
					var results = [];
					for(let i = 0; i < responses.length; i++) {
						if(responses[i].response && responses[i].response.payload) {
							results.push(responses[i].response.payload);
						}
					}
					return Promise.resolve(results);
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

	// internal utility method to build the header
	/**
	 * @private
	 */
	static _buildHeader(creator, chain_id, chaincode_id, tx_id, nonce) {
		let chainHeader = new _commonProto.ChainHeader();
		chainHeader.setType(_commonProto.HeaderType.ENDORSER_TRANSACTION);
		chainHeader.setTxID(tx_id.toString());
		chainHeader.setChainID(chain_id);
		if(chaincode_id) {
			let chaincodeID = new _ccProto.ChaincodeID();
			chaincodeID.setName(chaincode_id);

			let headerExt = new _ccProposalProto.ChaincodeHeaderExtension();
			headerExt.setChaincodeID(chaincodeID);

			chainHeader.setExtension(headerExt.toBuffer());
		}

		let signatureHeader = new _commonProto.SignatureHeader();

		signatureHeader.setCreator(Buffer.from(creator));
		signatureHeader.setNonce(nonce);

		let header = new _commonProto.Header();
		header.setSignatureHeader(signatureHeader);
		header.setChainHeader(chainHeader);

		return header;
	}

	// internal utility method to build the proposal
	/**
	 * @private
	 */
	_buildProposal(invokeSpec, header) {
		// construct the ChaincodeInvocationSpec
		let cciSpec = new _ccProto.ChaincodeInvocationSpec();
		cciSpec.setChaincodeSpec(invokeSpec);
//		cciSpec.setIdGenerationAlg('');

		let cc_payload = new _ccProposalProto.ChaincodeProposalPayload();
		cc_payload.setInput(cciSpec.toBuffer());
		//cc_payload.setTransient(null); // TODO application-level confidentiality related

		// proposal -- will switch to building the proposal once the signProposal is used
		let proposal = new _proposalProto.Proposal();
		proposal.setHeader(header.toBuffer());
		proposal.setPayload(cc_payload.toBuffer()); // chaincode proposal payload
		//proposal.setExtension(chaincodeAction); //optional chaincode action

		return proposal;
	}

	 // internal utility method to return one Promise when sending a proposal to many peers
	/**
	 * @private
	 */
	 static _sendPeersProposal(peers, proposal) {
		if(!Array.isArray(peers)) {
			peers = [peers];
		}
		// make function to return an individual promise
		var fn = function(peer) {
			return new Promise(function(resolve,reject) {
				peer.sendProposal(proposal)
				.then(
					function(result) {
						resolve(result);
					}
				).catch(
					function(err) {
						logger.error('Member-sendPeersProposal - Promise is rejected: %s',err.stack ? err.stack : err);
						return reject(err);
					}
				);
			});
		};
		// create array of promises mapping peers array to peer parameter
		// settle all the promises and return array of responses
		var promises = peers.map(fn);
		var responses = [];
		return settle(promises)
		  .then(function (results) {
			results.forEach(function (result) {
			  if (result.isFulfilled()) {
				logger.debug('Member-sendPeersProposal - Promise is fulfilled: '+result.value());
				responses.push(result.value());
			  } else {
				logger.debug('Member-sendPeersProposal - Promise is rejected: '+result.reason());
				responses.push(result.reason());
			  }
			});
			return responses;
		});
	}

	//internal method to sign a proposal
	/**
	 * @private
	 */
	_signProposal(enrollment, proposal) {
		let proposal_bytes = proposal.toBuffer();
		// sign the proposal
		let sig = this.cryptoPrimitives.sign(enrollment.privateKey, proposal_bytes);
		let signature = Buffer.from(sig.toDER());

		logger.debug('_signProposal - signature::'+JSON.stringify(signature));

		// build manually for now
		let signedProposal = {
			signature :  signature,
			proposalBytes : proposal_bytes
		};
		return signedProposal;
	}

	/*
	 * @private
	 */
	static _checkProposalRequest(request) {
		var errorMsg = null;

		if(request) {
			if(!request.chaincodeId) {
				errorMsg = 'Missing "chaincodeId" parameter in the proposal request';
			} else if(!request.chainId) {
				errorMsg = 'Missing "chainId" parameter in the proposal request';
			} else if(!request.targets) {
				errorMsg = 'Missing "targets" parameter in the proposal request';
			} else if(!request.txId) {
				errorMsg = 'Missing "txId" parameter in the proposal request';
			} else if(!request.nonce) {
				errorMsg = 'Missing "nonce" parameter in the proposal request';
			}
		} else {
			errorMsg = 'Missing input request object on the proposal request';
		}
		return errorMsg;
	}

	/**
	* return a printable representation of this object
	*/
	toString() {
		let orderers = '';
		for (let i = 0; i < this._orderers.length; i++) {
			orderers = orderers + this._orderers[i].toString() + '|';
		}
		var state = {
			name: this._name,
			orderers: this._orderers ? orderers : 'N/A'
		};

		return JSON.stringify(state);
	}

};

function toKeyValueStoreName(name) {
	return 'member.' + name;
}

function packageChaincode(chaincodePath, chaincodeId, dockerfileContents) {

	// Determine the user's $GOPATH
	let goPath =  process.env['GOPATH'];

	// Compose the path to the chaincode project directory
	let projDir = goPath + '/src/' + chaincodePath;

	// Compose the Dockerfile commands
	if (dockerfileContents === undefined) {
		dockerfileContents = utils.getConfigSetting('dockerfile-contents', undefined);
	}

	// Substitute the hashStrHash for the image name
	dockerfileContents = util.format(dockerfileContents, chaincodeId);

	return new Promise(function(resolve, reject) {
		// Create a Docker file with dockerFileContents
		let dockerFilePath = projDir + '/Dockerfile';
		fs.writeFile(dockerFilePath, dockerfileContents, function(err) {
			if (err) {
				reject(new Error(util.format('Error writing file [%s]: %s', dockerFilePath, err)));
			} else {
				// Create the .tar.gz file of the chaincode package
				let targzFilePath = '/tmp/deployment-package.tar.gz';
				// Create the compressed archive
				return utils.generateTarGz(projDir, targzFilePath)
				.then(
					function(targzFilePath) {
						// return both the hash and the tar.gz file path as resolved data
						resolve(targzFilePath);
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

module.exports = Chain;
