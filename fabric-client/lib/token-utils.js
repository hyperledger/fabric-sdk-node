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

const util = require('util');
const client_utils = require('./client-utils.js');
const {Utils: utils} = require('fabric-common');
const logger = utils.getLogger('token-utils.js');
const fabprotos = require('fabric-protos');

const valid_command_names = ['issue', 'transfer', 'redeem', 'list'];

/*
 * This function will build a token command for issue request
 */
module.exports.buildIssueCommand = (request) => {
	logger.debug('buildIssueCommand - Start');

	let params = request.params;
	if (!Array.isArray(params)) {
		params = [request.params];
	}

	// iterate params to populate tokensToIssue
	const tokensToIssue = [];
	params.forEach((param) => {
		const owner = {raw: param.owner, type: fabprotos.token.TokenOwner_MSP_IDENTIFIER};
		const token = {owner: owner, type: param.type, quantity: param.quantity};
		tokensToIssue.push(token);
	});

	// construct import request and token command
	const issueRequest = {tokens_to_issue: tokensToIssue};
	const tokenCmd = new fabprotos.token.Command();
	tokenCmd.set('issue_request', issueRequest);

	return tokenCmd;
};

/*
 * This function will build a token command for transfer request
 */
module.exports.buildTransferCommand = (request) => {
	logger.debug('buildTransferCommand - Start');

	let params = request.params;
	if (!Array.isArray(params)) {
		params = [request.params];
	}

	// iterate params to populate transfer shares
	const shares = [];
	params.forEach((param) => {
		const owner = {raw: param.owner, type: fabprotos.token.TokenOwner_MSP_IDENTIFIER};
		const share = {recipient: owner, quantity: param.quantity};
		shares.push(share);
	});

	// construct transfer request and token command
	const transferRequest = {token_ids: request.tokenIds, shares: shares};
	const tokenCmd = new fabprotos.token.Command();
	tokenCmd.set('transfer_request', transferRequest);

	return tokenCmd;
};

/*
 * This function will build a token command for redeem request
 */
module.exports.buildRedeemCommand = (request) => {
	logger.debug('buildRedeemCommand - Start');

	let param = request.params;
	if (Array.isArray(param)) {
		param = request.params[0];
	}

	// construct redeem request and token command
	const redeemRequest = {token_ids: request.tokenIds, quantity: param.quantity};
	const tokenCmd = new fabprotos.token.Command();
	tokenCmd.set('redeem_request', redeemRequest);

	return tokenCmd;
};

/*
 * This function will build a token command for list request
 */
module.exports.buildListCommand = () => {
	logger.debug('buildListCommand - Start');

	// construct list request and token command
	const listRequest = new fabprotos.token.ListRequest();
	const tokenCmd = new fabprotos.token.Command();
	tokenCmd.set('list_request', listRequest);

	return tokenCmd;
};

/*
 * This function will send the token command to a prover peer.
 * It will send the request to one peer at a time and return the response
 * if the peer returns a response. If the peer fails to respond,
 * the function will send to next peer until it gets a response or all the peers fail.
 */
module.exports.sendTokenCommandToPeer = async (peers, signedCommand, timeout) => {
	logger.debug('sendTokenCommandToPeer - Start');

	let targets = peers;
	if (!Array.isArray(peers)) {
		targets = [peers];
	}

	let commandResponse = null;
	let error = null;

	for (const peer of targets) {
		try {
			// send to one peer, if peer returns response, check error and return
			logger.debug('calling sendTokenCommand for peer %s', peer.getUrl());
			const signedCommandResponse = await peer.sendTokenCommand(signedCommand, timeout);
			commandResponse = fabprotos.token.CommandResponse.decode(signedCommandResponse.response);
			logger.debug('received command response: %s', commandResponse);
		} catch (err) {
			// peer didn't return response, so loop back to next peer
			error = err;
			logger.error('caught error when sending token command to peer (%s): %s', peer.getUrl(), error);
		}

		if (commandResponse !== null) {
			if (!commandResponse.get('err')) {
				return commandResponse;
			} else {
				logger.error('command response has error: %s', commandResponse.get('err').getMessage());
				throw new Error(util.format('command response has error: %s', commandResponse.get('err').getMessage()));
			}
		}
	}

	// all peers failed, so return error.
	throw error;
};

/*
 * This function will sign the command
 */
module.exports.signCommand = (signingIdentity, command) => {
	logger.debug('signCommand - Start');

	const command_bytes = command.toBuffer();
	const signature = Buffer.from(signingIdentity.sign(command_bytes));
	const signedCommand = new fabprotos.token.SignedCommand();
	signedCommand.setCommand(command_bytes);
	signedCommand.setSignature(signature);
	return signedCommand;
};

/*
 * This function will build the token command header
 */
module.exports.buildTokenCommandHeader = (creator, channelId, nonce, tlsCertHash) => {
	logger.debug('buildTokenCommandHeader - start');

	const timestamp = client_utils.buildCurrentTimestamp();
	const header = new fabprotos.token.Header();
	header.setChannelId(channelId);
	header.setCreator(creator.serialize());
	header.setNonce(nonce);
	header.setTimestamp(timestamp);
	if (tlsCertHash !== undefined && tlsCertHash !== null) {
		header.setTlsCertHash(tlsCertHash);
	}

	return header;
};

/*
 * Checks token request and throw an error if any required parameter is missing or invalid.
 */
module.exports.checkTokenRequest = (request, command_name, txIdRequired) => {
	logger.debug('checkTokenRequest - start');

	if (!request) {
		logger.error('Missing required "request" parameter on %s call', command_name);
		throw new Error(util.format('Missing required "request" parameter on %s call', command_name));
	}
	if (txIdRequired && !request.txId) {
		logger.error('Missing required "txId" in request on %s call', command_name);
		throw new Error(util.format('Missing required "txId" in request on %s call', command_name));
	}
	if (request.commandName !== undefined && !valid_command_names.includes(request.commandName)) {
		throw new Error(util.format('Invalid "commandName" in request on %s call: %s', command_name, request.commandName));
	}
	if (!request.commandName && !valid_command_names.includes(command_name)) {
		throw new Error(util.format('Missing "commandName" in request on %s call', command_name));
	}
	if (valid_command_names.includes(command_name) && request.commandName !== undefined && request.commandName !== command_name) {
		throw new Error(util.format('Invalid "commandName" in request on %s call: %s', command_name, request.commandName));
	}

	if (request.commandName === 'list' || command_name === 'list') {
		return;
	}

	// check parameters for non-list commands
	if (!request.params) {
		throw new Error(util.format('Missing required "params" in request on %s call', command_name));
	}

	if (!request.tokenIds) {
		if (command_name === 'transfer' || command_name === 'redeem') {
			throw new Error(util.format('Missing required "tokenId" in request on %s call', command_name));
		}
	}

	let params = request.params;
	if (!Array.isArray(params)) {
		params = [request.params];
	}

	params.forEach((param) => {
		if (!param.owner) {
			if (command_name === 'issue' || command_name === 'transfer') {
				throw new Error(util.format('Missing required "owner" in request on %s call', command_name));
			}
		}
		if (!param.type) {
			if (command_name === 'issue') {
				throw new Error(util.format('Missing required "type" in request on %s call', command_name));
			}
		}
		if (!param.quantity) {
			throw new Error(util.format('Missing required "quantity" in request on %s call', command_name));
		}
	});
};

/**
 * convert to protos.token.SignedCommand
 * @param signature
 * @param command_bytes
 */
exports.toSignedCommand = (signature, command_bytes) => ({signature: signature, command: command_bytes});

/**
 * convert to protos.common.Envelope
 * @param signature
 * @param payload_bytes
 */
exports.toEnvelope = (signature, payload_bytes) => ({signature: signature, payload: payload_bytes});

/**
 * convert an uint to Hex string
 */
function toHex(value) {
	return '0x' + value.toString(16);
}

module.exports.toHex = toHex;
