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

const {Utils: utils, Identity, HashPrimitives} = require('fabric-common');

const TransactionID = require('./TransactionID');
const util = require('util');
const clientUtils = require('./client-utils.js');
const tokenUtils = require('./token-utils.js');
const logger = utils.getLogger('TokenClient.js');
const fabprotos = require('fabric-protos');

/**
 * @classdesc
 * The TokenClient class provides the APIs to perform token operations.
 * A TokenClient instance is created based on a Client instance and a Channel instance.
 * An application using the SDK may need to interact with multiple channels,
 * each through a separate TokenClient instance that is created with
 * the corresponding channel object.
 * <br><br>
 * see the tutorial {@tutorial fabtoken}
 * <br><br>
 * From your {@link Client} instance use the {@link Client#newTokenClient} method.
 * This will return a TokenClient object instance that has been associated with
 * that client and the channel parameter. This will provide access to user credentials
 * used for signing requests, access to peer, orderer, and channel information.
 *
 * From the new TokenClient object you will be able to use it to call
 * token APIs: issue, transfer, redeem, and list.
 * The issue, transfer, and redeem APIs will create a token transaction
 * with the help of a prover peer and broadcast the token transaction
 * to orderers in the channel.
 * The list API returns a list of unspent tokens for the user and it does not
 * commit a transaction .
 * <br><br>
 *
 * @example
 *   // prerequisites - have created the following objects:
 *   // user1, client1 (associated to user1 context)
 *   // user2, client2 (associated to user2 context)
 *   // mychannel
 *
 *   // create a TokenClient object from client1 (user1)
 *   const tokenClient1 = client1.newTokenClient(mychannel);
 *
 *   // create a TokenClient object from client2 (user2)
 *   const tokenClient2 = client2.newTokenClient(mychannel);
 *
 *   // create request to issue tokens to user2
 *   // owner type is optional; default is 0 (i.e., TokenOwner_MSP_IDENTIFIER type)
 *   const txId = tokenClient1.newTransactionID();
 *   const owner = user2.getIdentity().serialize();
 *   const tokenType = 'myTokenType';
 *   let param = {owner: owner, type: tokenType, quantity: '200'};
 *   let request = {params: [param], txId: txId};
 *
 *   // user1 calls issue method to issue tokens to user2
 *   // If it is successful, result.status should be 'SUCCESS'.
 *   // Listen to the transaction event or wait a little for the transaction to be committed.
 *   let result = await tokenClient1.issue(request);
 *
 *   // user2 calls list method to get unspent tokens owned by user2
 *   // the above issued token should be an item in tokens array
 *   let tokens = tokenClient2.list()
 *   tokens.forEach((token) => {
 *     // get token.id, token.type, token.quantity for each token
 *   });
 *
 *   // user2 calls redeem method, result.status should be SUCCESS
 *   param = {quantity: '50'};
 *   request = {params: [param], txId: txId};
 *   result = await tokenClient2.redeem(request);
 *
 *   // user2 calls list method to get unspent tokens owned by user1
 *   // the previously issued token should have a new id and quantity is changed to 150.
 *   tokens = tokenClient2.list();
 *   tokens.forEach((token) => {
 *     // get token.id, token.type, token.quantity for each token
 *   });
 *
 *   // user2 calls transfer method to transfer the token to user1
 *   // owner type is optional; default is 0 (i.e., TokenOwner_MSP_IDENTIFIER type)
 *   const newOwner = user1.getIdentity().serialize();
 *   param = {owner: newOwner, quantity: '150'};
 *   request = {params: [param], tokenId: token.id, txId: txId};
 *   result = await tokenClient1.transfer(request);
 *
 *   // user1 calls list method, returned tokens should contain the transferred token
 *   let user1Tokens = tokenClient1.list();
 *   // user2 calls list method, returned tokens should not contain the transferred token
 *   let user2Tokens = tokenClient2.list();
 *
 * @class
 */
const TokenClient = class {

	/**
	 * Construct a TokenClient object.
	 *
	 * @param {Client} client - The Client instance.
	 * @param {Channel} channel - The channel object.
	 * @param {Peer[]} targets - The prover peer(s) that are trusted by the token client
	 */
	constructor(client, channel, targets) {
		logger.debug('constructor - Start');
		if (!client) {
			throw new Error('Missing required "client" parameter on the constructor call');
		}
		if (!channel) {
			throw new Error('Missing required "channel" parameter the constructor call');
		}
		this._client = client;
		this._channel = channel;
		this._targets = targets;
	}

	/**
	 * Gets the client for the token client.
	 *
	 * @returns {Client} the client
	 */
	getClient() {
		return this._client;
	}

	/**
	 * Gets the channel for the token client.
	 *
	 * @returns {Channel} the channel
	 */
	getChannel() {
		return this._channel;
	}

	/**
	 * Gets the targets for the token client.
	 *
	 * @returns {Peer[]|string[]} the targets
	 */
	getTargets() {
		return this._targets;
	}

	/**
	 * Sets the prover peers.
	 *
	 * @returns {Peer[]|string[]} The prover peers
	 */
	setTargets(targets) {
		this._targets = targets;
	}

	/**
	 * @typedef {Object} TokenParam
	 *          This object contains properties that specify the owner, type,
	 *          and quantity of a token kind.
	 * @property {byte[]} owner - Required for issue and transfer. The serialized bytes for the recipient.
	 * @property {string} type - Required for issue. The type of the token.
	 * @property {string} quantity - Required. The quantity of the token in decimal string format.
	 *           For example, use '200' for 200.
	 */

	/**
	 * @typedef {Object} TokenRequest
	 *          This object contains properties that will be used by the token request.
	 * @property {Peer[] | string[]} targets - Optional. The peers that will receive this request,
	 *           when not provided the targets in the TokenClient instance will
	 *           be used. The request will be sent to the peers with proverPeer roles
	 *           if no targets are specified.
	 * @property {string} commandName - Required. The token command name, such as
	 *           issue, transfer, redeem, and list.
	 * @property {byte[]} tokenIds - Required for transfer and redeem.
	 An array of token ids that will be spent by the token command.
	 * @property {TokenParam[]} params - Required. One or multiple TokenParam
	 *           for the token command.
	 * @property {TransactionID} txId - Optional. Required for issue, transfer and redeem.
	 */

	/**
	 * Send issue request to a prover peer to get token transaction
	 * and broadcast the transaction to orderers.
	 *
	 * @param {TokenRequest} request - Required. A TokenRequest object.
	 *        Must contain a 'params' TokenParam[] with owner, type, and quantity properties.
	 * @param {Number} timeout - Optional. A number indicating milliseconds to wait on the
	 *        response before rejecting the promise with a timeout error. This
	 *        overrides the default timeout of the Peer instance and the global
	 *        timeout in the config settings.
	 *
	 * @returns {Promise} A Promise for a "BroadcastResponse" message returned by
	 *          the orderer that contains a single "status" field for a
	 *          standard [HTTP response code]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/common/common.proto#L27}.
	 *          This will be an acknowledgement from the orderer of a successfully
	 *          submitted transaction.
	 */
	async issue(request, timeout) {
		logger.debug('issue - Start');
		tokenUtils.checkTokenRequest(request, 'issue', true);

		// copy request so that we can make update
		const sendRequest = Object.assign({}, request);
		sendRequest.tokenCommand = tokenUtils.buildIssueCommand(request);
		const result = await this._sendAndCommit(sendRequest, timeout);
		return result;
	}

	/**
	 * Sends a transfer request to a prover peer to get token transaction
	 * and broadcast the transaction to orderers.
	 *
	 * @param {TokenRequest} request - Required. A TokenRequest object.
	 *        Must contain a 'params' TokenParam[] with owner and quantity properties.
	 * @param {Number} timeout - Optional. A number indicating milliseconds to wait on the
	 *        response before rejecting the promise with a timeout error. This
	 *        overrides the default timeout of the Peer instance and the global
	 *        timeout in the config settings.
	 *
	 * @returns {Promise} A Promise for a "BroadcastResponse" message returned by
	 *          the orderer that contains a single "status" field for a
	 *          standard [HTTP response code]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/common/common.proto#L27}.
	 *          This will be an acknowledgement from the orderer of a successfully
	 *          submitted transaction.
	 */
	async transfer(request, timeout) {
		logger.debug('transfer - Start');
		tokenUtils.checkTokenRequest(request, 'transfer', true);

		// copy request so that we can make update
		const sendRequest = Object.assign({}, request);
		sendRequest.tokenCommand = tokenUtils.buildTransferCommand(request);
		const result = await this._sendAndCommit(sendRequest, timeout);
		return result;
	}

	/**
	 * Sends a redeem request to a prover peer to get token transaction
	 * and broadcast the token transaction to orderer.
	 *
	 * @param {TokenRequest} request - Required. A TokenRequest object.
	 *        Must contain a 'params' TokenParam[] with the quantity property.
	 * @param {Number} timeout - Optional. A number indicating milliseconds to wait on the
	 *        response before rejecting the promise with a timeout error. This
	 *        overrides the default timeout of the Peer instance and the global
	 *        timeout in the config settings.
	 * @returns {Promise} A Promise for a "BroadcastResponse" message returned by
	 *          the orderer that contains a single "status" field for a
	 *          standard [HTTP response code]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/common/common.proto#L27}.
	 *          This will be an acknowledgement from the orderer of a successfully
	 *          submitted transaction.
	 */
	async redeem(request, timeout) {
		logger.debug('redeem - Start');
		tokenUtils.checkTokenRequest(request, 'redeem', true);

		// copy request so that we can make update
		const sendRequest = Object.assign({}, request);
		sendRequest.tokenCommand = tokenUtils.buildRedeemCommand(request);
		const result = await this._sendAndCommit(sendRequest, timeout);
		return result;
	}

	/**
	 * Sends a list request to a prover peer to list unspent tokens owned by the user.
	 *
	 * @param {TokenRequest} request - Optional. A TokenRequest object.
	 *        If provided, it can pass in targets and txId.
	 * @param {Number} timeout - Optional. A number indicating milliseconds to wait on the
	 *        response before rejecting the promise with a timeout error. This
	 *        overrides the default timeout of the Peer instance and the global
	 *        timeout in the config settings.
	 * @returns {Promise} A Promise for UnspentToken[] array returned by the prover peer
	 *          that contains all unspent tokens owned by the user.
	 */
	async list(request, timeout) {
		logger.debug('list - Start');

		// copy request so that we can make update
		const sendRequest = Object.assign({}, request);

		// Create txId if it is not passed in.
		// This is allowed because list command has no transaction.
		if (!sendRequest.txId) {
			sendRequest.txId = this._client.newTransactionID();
		}
		if (sendRequest.commandName !== undefined && sendRequest.commandName !== 'list') {
			throw new Error(util.format('Wrong "commandName" in request on list call: %s', sendRequest.commandName));
		}

		sendRequest.tokenCommand = tokenUtils.buildListCommand();

		if (!sendRequest.targets) {
			sendRequest.targets = this._targets;
		}
		const commandResp = await this._channel.sendTokenCommand(sendRequest, timeout);
		const tokens = commandResp.unspent_tokens.tokens;
		return tokens;
	}

	/*
	 * Internal method that sends a token command to a prover peer to
	 * get a token transaction and then broadcast the transaction to orders.
	 *
	 * @param {TokenRequest} request - Required. A TokenRequest object.
	 *        Must contain a 'tokenCommand' object.
	 * @param {Number} timeout - Optional. A number indicating milliseconds to wait on the
	 *        response before rejecting the promise with a timeout error. This
	 *        overrides the default timeout of the Peer instance and the global
	 *        timeout in the config settings.
	 * @returns {Promise} A Promise for a "BroadcastResponse" message returned by
	 *          the orderer that contains a single "status" field for a
	 *          standard [HTTP response code]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/common/common.proto#L27}.
	 *          This will be an acknowledgement from the orderer of a successfully
	 *          submitted transaction.
	 */
	async _sendAndCommit(request, timeout) {
		logger.debug('_sendAndCommit - Start');

		if (!request.targets) {
			request.targets = this._targets;
		}

		const commandResp = await this._channel.sendTokenCommand(request, timeout);
		const tokentx = commandResp.get('token_transaction');
		request.tokenTransaction = tokentx;
		const result = await this._channel.sendTokenTransaction(request, timeout);
		return result;
	}

	/**
	 * @typedef {Object} SignedCommandRequest
	 *          The object contains properties that will be used for sending a token command.
	 * @property {Buffer} command_bytes - Required. The token command bytes.
	 * @property {Buffer} signature - Required. The signer's signature for the command_bytes.
	 * @property {Peer[]|string[]} targets - Optional. The peers that will receive this
	 *           request, when not provided the list of peers added to this channel
	 *           object will be used.
	 */

	/**
	 * Sends signed token command to peer
	 *
	 * @param {SignedCommandRequest} request - Required.
	 *        Must contain command_bytes and signature properties.
	 * @param {number} timeout - Optional. The timeout setting passed on sendSignedCommand.
	 * @returns {Promise} A Promise for a "CommandResponse" message returned by
	 *          the prover peer.
	 */
	async sendSignedTokenCommand(request, timeout) {
		logger.debug('sendSignedTokenCommand - start');

		// copy request to protect user input
		const sendRequest = Object.assign({}, request);
		if (!sendRequest.targets) {
			sendRequest.targets = this._targets;
		}
		return this._channel.sendSignedTokenCommand(sendRequest, timeout);
	}

	/**
	 * @typedef {Object} SignedTokenTransactionRequest
	 *          This object contains properties that will be used for broadcasting a token transaction.
	 * @property {Buffer} payload_bytes - Required. Payload bytes for the token transaction.
	 * @property {Buffer} signature - Required. Signer's signature for payload_bytes.
	 * @property {TransactionID} txId - Required. Transaction ID to use for this request.
	 * @property {Orderer | string} orderer - Optional. The orderer that will receive this request,
	 *           when not provided, the transaction will be sent to the orderers assigned to this channel instance.
	 */

	/**
	 * send the signed token transaction
	 *
	 * @param {SignedTokenTransactionRequest} request - Required.
	 *        Must contain 'payload_bytes', 'signature' and 'txId' properties.
	 * @param {Number} timeout - A number indicating milliseconds to wait on the
	 *        response before rejecting the promise with a timeout error. This
	 *        overrides the default timeout of the Orderer instance and the global
	 *        timeout in the config settings.
	 * @returns {BroadcastResponse} A BroadcastResponse message returned by
	 *          the orderer that contains a single "status" field for a
	 *          standard [HTTP response code]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/common/common.proto#L27}.
	 *          This will be an acknowledgement from the orderer of a successfully
	 *          submitted transaction.
	 */
	async sendSignedTokenTransaction(request, timeout) {
		logger.debug('sendSignedTokenTransaction - start');
		return this._channel.sendSignedTokenTransaction(request, timeout);
	}

	/**
	 * Generates the unsigned token command
	 *
	 * Currently the [sendTokenCommand]{@link Channel#sendTokenCommand}
	 * signs a token command using the user identity from SDK's context (which
	 * contains the user's private key).
	 *
	 * This method is designed to build the token command at SDK side,
	 * and user can sign this token command with their private key, and send
	 * the signed token command to peer by [sendSignedTokenCommand]
	 * so the user's private key would not be required at SDK side.
	 *
	 * @param {TokenRequest} request token request
	 * @param {string} mspId the mspId for this identity
	 * @param {string} certificate PEM encoded certificate
	 * @param {boolean} admin if this transaction is invoked by admin
	 * @returns {Command} protobuf message for token command
	 */
	generateUnsignedTokenCommand(request, mspId, certificate, admin) {
		const method = 'generateUnsignedTokenCommand';
		logger.debug('%s - start', method);

		logger.debug('%s - token command name is %s', method, request.commandName);
		tokenUtils.checkTokenRequest(request, method, false);

		let tokenCommand;
		if (request.commandName === 'issue') {
			tokenCommand = tokenUtils.buildIssueCommand(request);
		} else if (request.commandName === 'transfer') {
			tokenCommand = tokenUtils.buildTransferCommand(request);
		} else if (request.commandName === 'redeem') {
			tokenCommand = tokenUtils.buildRedeemCommand(request);
		} else if (request.commandName === 'list') {
			tokenCommand = tokenUtils.buildListCommand(request);
		} else if (!request.commandName) {
			throw new Error(utils.format('Missing commandName on the %s call', method));
		} else {
			throw new Error(utils.format('Invalid commandName (%s) on the %s call', request.commandName, method));
		}

		// create identity using certificate, publicKey (null), and mspId
		const identity = new Identity(certificate, null, mspId);
		const txId = new TransactionID(identity, admin);
		const header = tokenUtils.buildTokenCommandHeader(
			identity,
			this._channel._name,
			txId.getNonce(),
			this._client.getClientCertHash()
		);

		tokenCommand.setHeader(header);
		return tokenCommand;
	}

	/**
	 * @typedef {Object} TokenTransactionRequest
	 *          This object contains properties that will be used build token transaction payload.
	 * @property {Buffer} tokentx_bytes - Required. The token transaction bytes.
	 * @property {Command} tokenCommand - Required. The token command that is used to receive the token transaction.
	 */

	/**
	 * Generates unsigned payload for the token transaction.
	 * The tokenCommand used to generate the token transaction must be passed in the request.
	 *
	 * @param {TokenTransactionRequest} request - required.
	 * @returns {Payload} protobuf message for token transaction payload
	 */
	generateUnsignedTokenTransaction(request) {
		const method = 'generateUnsignedTokenTransaction';
		logger.debug('%s - start', method);

		if (!request) {
			throw new Error(util.format('Missing input request parameter on the %s call', method));
		}
		if (!request.tokenTransaction) {
			throw new Error(util.format('Missing required "tokenTransaction" in request on the %s call', method));
		}
		if (!request.tokenCommand) {
			throw new Error(util.format('Missing required "tokenCommand" in request on the %s call', method));
		}
		if (!request.tokenCommand.header) {
			throw new Error(util.format('Missing required "header" in tokenCommand on the %s call', method));
		}

		const commandHeader = request.tokenCommand.header;
		const trans_bytes = Buffer.concat([commandHeader.nonce.toBuffer(), commandHeader.creator.toBuffer()]);
		const trans_hash = HashPrimitives.SHA2_256(trans_bytes);
		const txId = Buffer.from(trans_hash).toString();

		const channel_header = clientUtils.buildChannelHeader(
			fabprotos.common.HeaderType.TOKEN_TRANSACTION,
			this._channel._name,
			txId,
			null, // no epoch
			'',
			clientUtils.buildCurrentTimestamp(),
			this._client.getClientCertHash()
		);

		const signature_header = new fabprotos.common.SignatureHeader();
		signature_header.setCreator(commandHeader.creator);
		signature_header.setNonce(commandHeader.nonce);

		const header = new fabprotos.common.Header();
		header.setChannelHeader(channel_header.toBuffer());
		header.setSignatureHeader(signature_header.toBuffer());

		const payload = new fabprotos.common.Payload();
		payload.setHeader(header);
		payload.setData(request.tokenTransaction.toBuffer());

		return payload;
	}
};

module.exports = TokenClient;
