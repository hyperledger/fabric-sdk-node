/*
 Copyright 2016 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

	  http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict';

var sdkUtils = require('./utils.js');
process.env.GRPC_SSL_CIPHER_SUITES = sdkUtils.getConfigSetting('grpc-ssl-cipher-suites');

var api = require('./api.js');
var User = require('./User.js');
var Chain = require('./Chain.js');
var Peer = require('./Peer.js');
var Orderer = require('./Orderer.js');
var logger = sdkUtils.getLogger('Client.js');
var util = require('util');

var grpc = require('grpc');
var _commonProto = grpc.load(__dirname + '/protos/common/common.proto').common;
var _ccProto = grpc.load(__dirname + '/protos/peer/chaincode.proto').protos;
var _queryProto = grpc.load(__dirname + '/protos/peer/query.proto').protos;

/**
 * Main interaction handler with end user. A client instance provides a handler to interact
 * with a network of peers, orderers and optionally member services. An application using the
 * SDK may need to interact with multiple networks, each through a separate instance of the Client.
 *
 * Each client when initially created should be initialized with configuration data from the
 * consensus service, which includes a list of trusted roots, orderer certificates and IP addresses,
 * and a list of peer certificates and IP addresses that it can access. This must be done out of band
 * as part of bootstrapping the application environment. It is also the responsibility of the application
 * to maintain the configuration of a client as the SDK does not persist this object.
 *
 * Each Client instance can maintain several {@link Chain} instances representing channels and the associated
 * private ledgers.
 *
 * @class
 *
 */
var Client = class {

	constructor() {
		logger.debug('const - new Client');
		this._chains = {};
		this._stateStore = null;
		// TODO, assuming a single CrytoSuite implementation per SDK instance for now
		// change this to be per Client or per Chain
		this._cryptoSuite = null;
		this._userContext = null;

		// Is in dev mode or network mode
		this._devMode = false;
	}

	setCryptoSuite(cryptoSuite) {
		this._cryptoSuite = cryptoSuite;
	}

	getCryptoSuite() {
		return this._cryptoSuite;
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
	 * Returns a chain instance with the given name. This represents a channel and its associated ledger
	 * (as explained above), and this call returns an empty object. To initialize the chain in the blockchain network,
	 * a list of participating endorsers and orderer peers must be configured first on the returned object.
	 * @param {string} name The name of the chain.  Recommend using namespaces to avoid collision.
	 * @returns {Chain} The uninitialized chain instance.
	 * @throws {Error} if the chain by that name already exists in the application's state store
	 */
	newChain(name) {
		var chain = this._chains[name];

		if (chain)
			throw new Error(util.format('Chain %s already exists', name));

		var chain = new Chain(name, this);
		this._chains[name] = chain;
		return chain;
	}

	/**
	 * Get a {@link Chain} instance from the state storage. This allows existing chain instances to be saved
	 * for retrieval later and to be shared among instances of the application. Note that it’s the
	 * application/SDK’s responsibility to record the chain information. If an application is not able
	 * to look up the chain information from storage, it may call another API that queries one or more
	 * Peers for that information.
	 * @param {string} name The name of the chain.
	 * @returns {Chain} The chain instance
	 * @throws {Error} if the state store has not been set or a chain does not exist under that name.
	 */
	getChain(name) {
		var ret = this._chains[name];

		// TODO: integrate reading from state store

		if (ret)
			return ret;
		else {
			logger.error('Chain not found for name '+name+'.');
			throw new Error('Chain not found for name '+name+'.');
		}
	}

    /**
	 * Returns a peer instance with the given url.
	 * @param {string} url - The URL with format of "grpcs://host:port".
	 * @param {Object} opts - The options for the connection to the peer.
	 * <br>- request-timeout {string} A integer value in milliseconds to
	 *       be used as node.js based timeout. This will break the request
	 *       operation if the grpc request has not responded within this
	 *       timeout period.
	 * <br>- pem {string} The certificate file, in PEM format,
	 *    to use with the gRPC protocol (that is, with TransportCredentials).
	 *    Required when using the grpcs protocol.
	 * <br>- ssl-target-name-override {string} Used in test environment only, when the server certificate's
	 *    hostname (in the 'CN' field) does not match the actual host endpoint that the server process runs
	 *    at, the application can work around the client TLS verify failure by setting this property to the
	 *    value of the server certificate's hostname
	 * <br>- any other standard grpc call options will be passed to the grpc service calls directly
	 * @returns {Peer} The Peer instance.
	 */
	newPeer(url, opts) {
		var peer = new Peer(url, opts);
		return peer;
	}

    /**
	 * Returns an order instance with the given url.
	 * @param {string} url The URL with format of "grpcs://host:port".
	 * @param {Object} opts The options for the connection to the peer.
	 * <br>- request-timeout {string} A integer value in milliseconds to
	 *       be used as node.js based timeout. This will break the request
	 *       operation if the grpc request has not responded within this
	 *       timeout period.
	 * <br>- pem {string} The certificate file, in PEM format,
	 *    to use with the gRPC protocol (that is, with TransportCredentials).
	 *    Required when using the grpcs protocol.
	 * <br>- ssl-target-name-override {string} Used in test environment only, when the server certificate's
	 *    hostname (in the 'CN' field) does not match the actual host endpoint that the server process runs
	 *    at, the application can work around the client TLS verify failure by setting this property to the
	 *    value of the server certificate's hostname
	 * <br>- any other standard grpc call options will be passed to the grpc service calls directly
	 * @returns {Orderer} The orderer instance.
	 */
	newOrderer(url, opts) {
		var orderer = new Orderer(url, opts);
		return orderer;
	}

	/**
	 * Calls the orderer to start building the new chain.
	 * Only one of the application instances needs to call this method.
	 * Once the chain is successfully created, this and other application
	 * instances only need to call Chain joinChannel() to participate on the channel.
	 * @param {Object} request - An object containing the following field:
	 *      <br>`name` : required - The name of the new channel
	 *      <br>`orderer` : required - Orderer Object to create the channel
	 *		<br>`envelope` : required - byte[] of the envelope object containing
	 *                          all required settings to initialize this channel
	 * @returns {boolean} Whether the chain initialization process was successful.
	 */
	createChannel(request) {
		logger.debug('createChannel - start');
		var errorMsg = null;

		if(!request) {
			errorMsg = 'Missing all required input request parameters for initialize channel';
		}
		else {
			// Verify that a config envelope has been included in the request object
			if (!request.envelope) {
				errorMsg = 'Missing envelope request parameter containing the configuration of the new channel';
			}
			// verify that we have an orderer configured
			if(!request.orderer) {
				errorMsg = 'Missing orderer request parameter for the initialize channel';
			}
			// verify that we have the name of the new channel
			if(!request.name) {
				errorMsg = 'Missing name request parameter for the new channel';
			}
		}

		if(errorMsg) {
			logger.error('createChannel error %s',errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		var self = this;
		var chain_id = request.name;
		var orderer = request.orderer;
		var userContext = null;
		var chain = null;

		return this.getUserContext()
		.then(
			function(foundUserContext) {
				userContext = foundUserContext;

				// building manually or will get protobuf errors on send
				var envelope = _commonProto.Envelope.decode(request.envelope);
				logger.debug('createChannel - about to send envelope');

				var out_envelope = {
					signature: envelope.signature,
					payload : envelope.payload
				};

				return orderer.sendBroadcast(out_envelope);
			}
		)
		.then(
			function(results) {
				logger.debug('createChannel - good results from broadcast :: %j',results);
				chain = self.newChain(chain_id);
				chain.addOrderer(orderer);
				return chain.initialize(request.envelope);
			}
		)
		.then(
			function(results) {
				logger.debug('createChannel - good results from chain initialize :: %j',results);
				return Promise.resolve(chain);
			}
		)
		.catch(
			function(error) {
				if(error instanceof Error) {
					logger.debug('createChannel - rejecting with %s', error);
					return Promise.reject(error);
				}
				else {
					logger.error('createChannel - system error :: %s', error);
					return Promise.reject(new Error(error));
				}
			}
		);
	}

	/**
	 * This is a network call to the designated Peer(s) to discover the chain information.
	 * The target Peer(s) must be part of the chain to be able to return the requested information.
	 * @param {string} name The name of the chain.
	 * @param {Peer[]} peers Array of target Peers to query.
	 * @returns {Chain} The chain instance for the name or error if the target Peer(s) does not know
	 * anything about the chain.
	 */
	queryChainInfo(name, peers) {
		//to do
	}

	/**
	 * Queries the names of all the channels that a
	 * peer has joined.
	 * @param {Peer} peer
	 * @returns {Promise} A promise to return a ChannelQueryResponse proto Object
	 */
	queryChannels(peer) {
		logger.debug('queryChannels - start');
		if(!peer) {
			return Promise.reject( new Error('Peer is required'));
		}
		var self = this;
		var nonce = sdkUtils.getNonce();
		return this.getUserContext(nonce)
		.then(function(userContext) {
			var txId = Chain.buildTransactionID(nonce, userContext);
			var request = {
				targets: [peer],
				chaincodeId : 'cscc',
				chainId: '',
				txId: txId,
				nonce: nonce,
				fcn : 'GetChannels',
				args: []
			};
			return Chain.sendTransactionProposal(request, self);
		})
		.then(
			function(results) {
				var responses = results[0];
				logger.debug('queryChannels - got response');
				if(responses && Array.isArray(responses)) {
					//will only be one response as we are only querying one peer
					if(responses.length > 1) {
						return Promise.reject(new Error('Too many results returned'));
					}
					let response = responses[0];
					if(response instanceof Error ) {
						return Promise.reject(response);
					}
					if(response.response) {
						logger.debug('queryChannels - response status :: %d', response.response.status);
						var queryTrans = _queryProto.ChannelQueryResponse.decode(response.response.payload);
						logger.debug('queryChannels - ProcessedTransaction.channelInfo.length :: %s', queryTrans.channels.length);
						for (let i=0; i<queryTrans.channels.length; i++) {
							logger.debug('>>> channel id %s ',queryTrans.channels[i].channel_id);
						}
						return Promise.resolve(queryTrans);
					}
					// no idea what we have, lets fail it and send it back
					return Promise.reject(response);
				}
				return Promise.reject(new Error('Payload results are missing from the query'));
			}
		).catch(
			function(err) {
				logger.error('Failed Channels Query. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/**
	 * Queries the installed chaincodes on a peer
	 * returning the details of all chaincodes
	 * installed on a peer.
	 * @param {Peer} peer
	 * @returns {object} ChaincodeQueryResponse proto
	 */
	queryInstalledChaincodes(peer) {
		logger.debug('queryInstalledChaincodes - start peer %s',peer);
		if(!peer) {
			return Promise.reject( new Error('Peer is required'));
		}
		var self = this;
		var nonce = sdkUtils.getNonce();
		return self.getUserContext()
		.then(function(userContext) {
			var tx_id = Chain.buildTransactionID(nonce, userContext);
			var request = {
				targets: [peer],
				chaincodeId : 'lccc',
				chainId: 'mychannel',
				txId: tx_id,
				nonce: nonce,
				fcn : 'getinstalledchaincodes',
				args: []
			};
			return Chain.sendTransactionProposal(request, self);
		})
		.then(
			function(results) {
				var responses = results[0];
				logger.debug('queryInstalledChaincodes - got response');
				if(responses && Array.isArray(responses)) {
					//will only be one response as we are only querying one peer
					if(responses.length > 1) {
						return Promise.reject(new Error('Too many results returned'));
					}
					let response = responses[0];
					if(response instanceof Error ) {
						return Promise.reject(response);
					}
					if(response.response) {
						logger.debug('queryInstalledChaincodes - response status :: %d', response.response.status);
						var queryTrans = _queryProto.ChaincodeQueryResponse.decode(response.response.payload);
						logger.debug('queryInstalledChaincodes - ProcessedTransaction.chaincodeInfo.length :: %s', queryTrans.chaincodes.length);
						for (let i=0; i<queryTrans.chaincodes.length; i++) {
							logger.debug('>>> name %s, version %s, path %s',queryTrans.chaincodes[i].name,queryTrans.chaincodes[i].version,queryTrans.chaincodes[i].path);
						}
						return Promise.resolve(queryTrans);
					}
					// no idea what we have, lets fail it and send it back
					return Promise.reject(response);
				}
				return Promise.reject(new Error('Payload results are missing from the query'));
			}
		).catch(
			function(err) {
				logger.error('Failed Installed Chaincodes Query. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/**
	 * Sends an install proposal to one or more endorsing peers.
	 *
	 * @param {Object} request - An object containing the following fields:
	 *		<br>`chaincodePath` : required - String of the path to location of
	 *                            the source code of the chaincode
	 *		<br>`chaincodeId` : required - String of the name of the chaincode
	 *		<br>`chaincodeVersion` : required - String of the version of the chaincode
	 *		<br>`chaincodePackage` : optional - Byte array of the archive content for
	 *                               the chaincode source. The archive must have a 'src'
	 *                               folder containing subfolders corresponding to the
	 *                               'chaincodePath' field. For instance, if the chaincodePath
	 *                               is 'mycompany/myproject', then the archive must contain a
	 *                               folder at the path 'src/mycompany/myproject', where the
	 *                               GO source code resides.
	 *		<br>`chaincodeType` : optional - Type of chaincode ['golang', 'car', 'java']
	 *                   (default 'golang')
	 *		<br>`txId` : required - String of the transaction id
	 *		<br>`nonce` : required - Integer of the once time number
	 * @returns {Promise} A Promise for a `ProposalResponse`
	 * @see /protos/peer/proposal_response.proto
	 */
	installChaincode(request) {
		logger.debug('installChaincode - start');

		var errorMsg = null;

		var peers = null;
		if (request) {
			peers = request.targets;
			// Verify that a Peer has been added
			if (peers && peers.length > 0) {
				logger.debug('installChaincode - found peers ::%s',peers.length);
			}
			else {
				errorMsg = 'Missing peer objects in install chaincode request';
			}
		}
		else {
			errorMsg = 'Missing input request object on install chaincode request';
		}


		// modify the request so the following checks will be OK
		if(request) {
			request.chainId = 'dummy';
		}

		if (!errorMsg) errorMsg = Chain._checkProposalRequest(request);
		if (!errorMsg) errorMsg = Chain._checkInstallRequest(request);

		if (errorMsg) {
			logger.error('installChaincode error ' + errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		let self = this;

		let ccSpec = {
			type: Chain._translateCCType(request.chaincodeType),
			chaincode_id: {
				name: request.chaincodeId,
				path: request.chaincodePath,
				version: request.chaincodeVersion
			}
		};
		logger.debug('installChaincode ccSpec %s ',JSON.stringify(ccSpec));

		// step 2: construct the ChaincodeDeploymentSpec
		let chaincodeDeploymentSpec = new _ccProto.ChaincodeDeploymentSpec();
		chaincodeDeploymentSpec.setChaincodeSpec(ccSpec);
		chaincodeDeploymentSpec.setEffectiveDate(Chain._buildCurrentTimestamp()); //TODO may wish to add this as a request setting

		return Chain._getChaincodePackageData(request, this.isDevMode())
		.then((data) => {
			logger.debug('installChaincode data %s ',data);
			// DATA may or may not be present depending on devmode settings
			if (data) {
				chaincodeDeploymentSpec.setCodePackage(data);
			}
			logger.debug('installChaincode sending deployment spec %s ',chaincodeDeploymentSpec);

			// TODO add ESCC/VSCC info here ??????
			let lcccSpec = {
				type: _ccProto.ChaincodeSpec.Type.GOLANG,
				chaincode_id: {
					name: 'lccc'
				},
				input: {
					args: [Buffer.from('install', 'utf8'), chaincodeDeploymentSpec.toBuffer()]
				}
			};

			var header, proposal;
			return self.getUserContext()
				.then(
					function(userContext) {
						var txId = Chain.buildTransactionID(request.nonce, userContext);
						var channelHeader = Chain._buildChannelHeader(
							_commonProto.HeaderType.ENDORSER_TRANSACTION,
							'', //install does not target a channel
							txId,
							null,
							'lccc'
						);
						header = Chain._buildHeader(userContext.getIdentity(), channelHeader, request.nonce);
						proposal = Chain._buildProposal(lcccSpec, header);
						let signed_proposal = Chain._signProposal(userContext.getSigningIdentity(), proposal);

						return Chain._sendPeersProposal(peers, signed_proposal);
					}
				).then(
					function(responses) {
						return [responses, proposal, header];
					}
				);
		});
	}

	/**
	 * The enrollment materials for Users that have appeared in the instances of the application.
	 *
	 * The SDK should have a built-in key value store file-based implementation to allow easy setup during
	 * development. Production systems would use a store backed by database for more robust storage and
	 * clustering, so that multiple app instances can share app state via the database.
	 * This API makes this pluggable so that different store implementations can be selected by the application.
	 * @param {KeyValueStore} keyValueStore Instance of an alternative KeyValueStore implementation provided by
	 * the consuming app.
	 */
	setStateStore(keyValueStore) {
		var err = '';

		var methods = sdkUtils.getClassMethods(api.KeyValueStore);
		methods.forEach(function(m) {
			if (typeof keyValueStore[m] !== 'function') {
				err += m + '() ';
			}
		});

		if (err !== '') {
			throw new Error('The "keyValueStore" parameter must be an object that implements the following methods, which are missing: ' + err);
		}

		this._stateStore = keyValueStore;
	}

	/**
	 * Save the state of this member to the key value store.
	 * @returns {Promise} A Promise for the user context object upon successful save
	 */
	saveUserToStateStore() {
		var self = this;
		logger.debug('saveUserToStateStore, userContext: ' + self._userContext);
		return new Promise(function(resolve, reject) {
			if (self._userContext && self._userContext._name && self._stateStore) {
				logger.debug('saveUserToStateStore, begin promise stateStore.setValue');
				self._stateStore.setValue(self._userContext._name, self._userContext.toString())
				.then(
					function(result) {
						logger.debug('saveUserToStateStore, store.setValue, result = ' + result);
						resolve(self._userContext);
					},
					function (reason) {
						logger.debug('saveUserToStateStore, store.setValue, reject reason = ' + reason);
						reject(reason);
					}
				).catch(
					function(err) {
						logger.debug('saveUserToStateStore, store.setValue, error: ' +err);
						reject(new Error(err));
					}
				);
			} else {
				if (self._userContext == null) {
					logger.debug('saveUserToStateStore Promise rejected, Cannot save user to state store when userContext is null.');
					reject(new Error('Cannot save user to state store when userContext is null.'));
				} else if (self._userContext._name == null) {
					logger.debug('saveUserToStateStore Promise rejected, Cannot save user to state store when userContext has no name.');
					reject(new Error('Cannot save user to state store when userContext has no name.'));
				} else {
					logger.debug('saveUserToStateStore Promise rejected, Cannot save user to state store when stateStore is null.');
					reject(new Error('Cannot save user to state store when stateStore is null.'));
				}
			}
		});
	}

	/**
	 * Sets an instance of the User class as the security context of self client instance. This user’s
	 * credentials (ECert), or special transaction certificates that are derived from the user's ECert,
	 * will be used to conduct transactions and queries with the blockchain network.
	 * Upon setting the user context, the SDK saves the object in a persistence cache if the “state store”
	 * has been set on the Client instance. If no state store has been set, this cache will not be established
	 * and the application is responsible for setting the user context again if the application crashes and is recovered.
	 *
	 * @param {User} user An instance of the User class encapsulating the authenticated user’s signing materials
	 * (private key and enrollment certificate)
	 * @param {boolean} skipPersistence Whether to skip saving the user object into persistence. Default is false and the
	 * method will attempt to save the user object to the state store.
	 * @returns {Promise} Promise of the 'user' object upon successful persistence of the user to the state store
	 */
	setUserContext(user, skipPersistence) {
		logger.debug('setUserContext, user: ' + user + ', skipPersistence: ' + skipPersistence);
		var self = this;
		return new Promise((resolve, reject) => {
			if (user) {
				self._userContext = user;
				if (!skipPersistence) {
					logger.debug('setUserContext begin promise to saveUserToStateStore');
					self.saveUserToStateStore()
					.then((user) => {
						return resolve(user);
					}).catch((err) => {
						reject(err);
					});
				} else {
					logger.debug('setUserContext, resolved user');
					return resolve(user);
				}
			} else {
				logger.debug('setUserContext, Cannot save null userContext');
				reject(new Error('Cannot save null userContext.'));
			}
		});
	}

	/**
	 * As explained above, the client instance can have an optional state store. The SDK saves enrolled users
	 * in the storage which can be accessed by authorized users of the application (authentication is done by
	 * the application outside of the SDK). This function attempts to load the user by name from the local storage
	 * (via the KeyValueStore interface). The loaded user object must represent an enrolled user with a valid
	 * enrollment certificate signed by a trusted CA (such as the CA server).
	 *
	 * @param {String} name Optional. If not specified, will only return the in-memory user context object, or null
	 * if not found in memory. If "name" is specified, will also attempt to load it from the state store if search
	 * in memory failed.
	 * @returns {Promise} The user object corresponding to the name, or null if the user does not exist or if the
	 * state store has not been set.
	 */
	getUserContext(name) {
		var self = this;
		var username = name;
		return new Promise(function(resolve, reject) {
			if (self._userContext) {
				return resolve(self._userContext);
			} else {
				if (typeof username === 'undefined' || !username) {
					return resolve(null);
				}

				// this could be because the application has not set a user context yet for this client, which would
				// be an error condiditon, or it could be that this app has crashed before and is recovering, so we
				// should allow the previously saved user context object to be deserialized

				// first check if there is a user context of the specified name in persistence
				if (self._stateStore) {
					self.loadUserFromStateStore(username).then(
						function(userContext) {
							if (userContext) {
								logger.debug('Requested user "%s" loaded successfully from the state store on this Client instance: name - %s', name, name);
								return self.setUserContext(userContext, false);
							} else {
								logger.debug('Requested user "%s" not loaded from the state store on this Client instance: name - %s', name, name);
								return null;
							}
						}
					).then(
						function(userContext) {
							return resolve(userContext);
						}
					).catch(
						function(err) {
							logger.error('Failed to load an instance of requested user "%s" from the state store on this Client instance. Error: %s', name, err.stack ? err.stack : err);
							reject(err);
						}
					);
				} else {
					// we don't have it in memory or persistence, just return null
					return resolve(null);
				}
			}
		});
	}

	/**
	 * Restore the state of this member from the key value store (if found).  If not found, do nothing.
	 * @returns {Promise} A Promise for a {User} object upon successful restore, or if the user by the name
	 * does not exist in the state store, returns null without rejecting the promise
	 */
	loadUserFromStateStore(name) {
		var self = this;

		return new Promise(function(resolve, reject) {
			self._stateStore.getValue(name)
			.then(
				function(memberStr) {
					if (memberStr) {
						// The member was found in the key value store, so restore the state.
						var newUser = new User(name);

						return newUser.fromString(memberStr);
					} else {
						return null;
					}
				})
			.then(function(data) {
				if (data) {
					logger.info('Successfully loaded user "%s" from local key value store', name);
					return resolve(data);
				} else {
					logger.info('Failed to load user "%s" from local key value store', name);
					return resolve(null);
				}
			}).catch(
				function(err) {
					logger.error('Failed to load user "%s" from local key value store. Error: %s', name, err.stack ? err.stack : err);
					reject(err);
				}
			);
		});
	}

	/**
	 * A convenience method for obtaining the state store object in use for this client.
	 * @return {KeyValueStore} The KeyValueStore implementation object set within this Client, or null if it does not exist.
	 */
	getStateStore() {
		return this._stateStore;
	}

	/**
	* Utility method to build an unique transaction id
	* based on a nonce and the user context.
	* @param {int} nonce - a one time use number
	* @param {User} userContext - the user context
	* @returns {string} An unique string
	*/
	static buildTransactionID(nonce, userContext) {
		return Chain.buildTransactionID(nonce, userContext);
	}

	/**
	 * Obtains an instance of the [KeyValueStore]{@link module:api.KeyValueStore} class. By default
	 * it returns the built-in implementation, which is based on files ([FileKeyValueStore]{@link module:api.FileKeyValueStore}).
	 * This can be overriden with an environment variable KEY_VALUE_STORE, the value of which is the
	 * full path of a CommonJS module for the alternative implementation.
	 *
	 * @param {Object} options is whatever the implementation requires for initializing the instance. For the built-in
	 * file-based implementation, this requires a single property "path" to the top-level folder for the store
	 * @returns [KeyValueStore]{@link module:api.KeyValueStore} an instance of the KeyValueStore implementation
	 */
	static newDefaultKeyValueStore(options) {
		return sdkUtils.newKeyValueStore(options);
	}

	/**
	 * Configures a logger for the entire HFC SDK to use and override the default logger. Unless this method is called,
	 * HFC uses a default logger (based on winston). When using the built-in "winston" based logger, use the environment
	 * variable HFC_LOGGING to pass in configurations in the following format:
	 *
	 * {
	 *   'error': 'error.log',				// 'error' logs are printed to file 'error.log' relative of the current working dir for node.js
	 *   'debug': '/tmp/myapp/debug.log',	// 'debug' and anything more critical ('info', 'warn', 'error') can also be an absolute path
	 *   'info': 'console'					// 'console' is a keyword for logging to console
	 * }
	 *
	 * @param {Object} logger a logger instance that defines the following methods: debug(), info(), warn(), error() with
	 * string interpolation methods like [util.format]{@link https://nodejs.org/api/util.html#util_util_format_format}.
	 */
	static setLogger(logger) {
		var err = '';

		if (typeof logger.debug !== 'function') {
			err += 'debug() ';
		}

		if (typeof logger.info !== 'function') {
			err += 'info() ';
		}

		if (typeof logger.warn !== 'function') {
			err += 'warn() ';
		}

		if (typeof logger.error !== 'function' ) {
			err += 'error()';
		}

		if (err !== '') {
			throw new Error('The "logger" parameter must be an object that implements the following methods, which are missing: ' + err);
		}

		if (global.hfc) {
			global.hfc.logger = logger;
		} else {
			global.hfc = {
				logger: logger
			};
		}
	}

	/**
	 * Adds a file to the top of the list of configuration setting files that are
	 * part of the hierarchical configuration.
	 * These files will override the default settings and be overriden by environment,
	 * command line arguments, and settings programmatically set into configuration settings.
	 *
	 * hierarchy search order:
	 *  1. memory - all settings added with sdkUtils.setConfigSetting(name,value)
	 *  2. Command-line arguments
	 *  3. Environment variables (names will be change from AAA-BBB to aaa-bbb)
	 *  4. Custom Files - all files added with the addConfigFile(path)
	 *     will be ordered by when added, were last one added will override previously added files
	 *  5. The file located at 'config/default.json' with default settings
	 *
	 * @param {String} path - The path to the file to be added to the top of list of configuration files
	 */
	static addConfigFile(path) {

		sdkUtils.addConfigFile(path);
	}

	/**
	 * Adds a setting to override all settings that are
	 * part of the hierarchical configuration.
	 *
	 * hierarchy search order:
	 *  1. memory - settings added with this call
	 *  2. Command-line arguments
	 *  3. Environment variables (names will be change from AAA-BBB to aaa-bbb)
	 *  4. Custom Files - all files added with the addConfigFile(path)
	 *     will be ordered by when added, were last one added will override previously added files
	 *  5. The file located at 'config/default.json' with default settings
	 *
	 * @param {String} name - The name of a setting
	 * @param {Object} value - The value of a setting
	 */
	static setConfigSetting(name, value) {

		sdkUtils.setConfigSetting(name, value);
	}

	/**
	 * Retrieves a setting from the hierarchical configuration and if not found
	 * will return the provided default value.
	 *
	 * hierarchy search order:
	 *  1. memory - settings added with sdkUtils.setConfigSetting(name,value)
	 *  2. Command-line arguments
	 *  3. Environment variables (names will be change from AAA-BBB to aaa-bbb)
	 *  4. Custom Files - all files added with the addConfigFile(path)
	 *     will be ordered by when added, were last one added will override previously added files
	 *  5. The file located at 'config/default.json' with default settings
	 *
	 * @param {String} name - The name of a setting
	 * @param {Object} default_value - The value of a setting if not found in the hierarchical configuration
	 */
	static getConfigSetting(name, default_value) {

		return sdkUtils.getConfigSetting(name, default_value);
	}
};

module.exports = Client;
