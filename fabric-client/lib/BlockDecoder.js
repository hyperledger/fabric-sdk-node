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
var path = require('path');
var utils = require('./utils.js');
var logger = utils.getLogger('BlockDecoder.js');

var _ccProto = grpc.load(__dirname + '/protos/peer/chaincode.proto').protos;
var _ccEventProto = grpc.load(__dirname + '/protos/peer/chaincode_event.proto').protos;
var _transProto = grpc.load(__dirname + '/protos/peer/transaction.proto').protos;
var _proposalProto = grpc.load(__dirname + '/protos/peer/proposal.proto').protos;
var _responseProto = grpc.load(__dirname + '/protos/peer/proposal_response.proto').protos;
var _queryProto = grpc.load(__dirname + '/protos/peer/query.proto').protos;
var _peerConfigurationProto = grpc.load(__dirname + '/protos/peer/configuration.proto').protos;
var _mspPrProto = grpc.load(__dirname + '/protos/msp/msp_principal.proto').common;
var _commonProto = grpc.load(__dirname + '/protos/common/common.proto').common;
var _configtxProto = grpc.load(__dirname + '/protos/common/configtx.proto').common;
var _policiesProto = grpc.load(__dirname + '/protos/common/policies.proto').common;
var _ledgerProto = grpc.load(__dirname + '/protos/common/ledger.proto').common;
var _commonConfigurationProto = grpc.load(__dirname + '/protos/common/configuration.proto').common;
var _ordererConfigurationProto = grpc.load(__dirname + '/protos/orderer/configuration.proto').orderer;
var _abProto = grpc.load(__dirname + '/protos/orderer/ab.proto').orderer;
var _mspConfigProto = grpc.load(__dirname + '/protos/msp/msp_config.proto').msp;
var _timestampProto = grpc.load(__dirname + '/protos/google/protobuf/timestamp.proto').google.protobuf;
var _identityProto = grpc.load(path.join(__dirname, '/protos/msp/identities.proto')).msp;
var _rwsetProto = grpc.load(path.join(__dirname, '/protos/ledger/rwset/rwset.proto')).rwset;
var _kv_rwsetProto = grpc.load(path.join(__dirname, '/protos/ledger/rwset/kvrwset/kv_rwset.proto')).kvrwset;


/**
 * Utility class to convert a protobuf encoded byte array of a Hyperledger Fabric block
 * message into a pure Javascript object
 *
 * @class
 */
var BlockDecoder = class {
	/**
	 * An object of a fully decoded protobuf message "Block".
	 * <br><br>
	 * A Block may contain the configuration of the channel or transactions on the channel.
	 * <br><br>
	 * A Block object will have the following object structure.
<br><pre>
header
	number -- {int}
	previous_hash -- {byte[]}
	data_hash -- {byte[]}
data
	data -- {array}
		signature -- {byte[]}
		payload
			header -- {{@link Header}}
			data -- {{@link ConfigEnvelope} | {@link Transaction}}
metadata
	metadata -- {array} #each array item has it's own layout
		[0] #SIGNATURES
			signatures -- {{@link MetadataSignature[]}}
		[1] #LAST_CONFIG
			value
				index -- {number}
				signatures -- {{@link MetadataSignature[]}}
		[2] #TRANSACTIONS_FILTER
				{int[]} #see TxValidationCode in proto/peer/transaction.proto
</pre>
	 *
	 * @typedef {Object} Block
	 *
	 * @example
	 * <caption>Get the block number:</caption>
	 * var block_num = block.header.number;
	 *
	 * @example
	 * <caption>Get the number of transactions, including the invalid transactions:</caption>
	 * var block_num = block.data.data.legnth;
	 *
	 * @example
	 * <caption>Get the Id of the first transaction in the block:</caption>
	 * var tx_id = block.data.data[0].payload.header.channel_header.tx_id;
	 */

	/**
	 * Headers describe basic information about a transaction record, such
	 * as its type (configuration update, or endorser transaction, etc.),
	 * the id of the channel it belongs to, the transaction id and so on.
	 * The header message also contains a common field {@link SignatureHeader}
	 * that describes critical information about how to verify signatures.
	 * <br><br>
	 * A "Header" will have the following object structure.
<br><pre>
channel_header
	type -- {string}
	version -- {int}
	timestamp -- {time}
	channel_id -- {string}
	tx_id -- {string}
	epoch -- {int}
signature_header -- {{@link SignatureHeader}}
</pre>
	 * @typedef {Object} Header
	 */

	/**
	 * A signature over the metadata of a block, to ensure the authenticity of
	 * the metadata that describes a Block.
<br><pre>
signature_header {{@link SignatureHeader}}
signature -- {byte[]}
</pre>
	 *
	 * @typedef {Object} MetadataSignature
	 */

	/**
	 * An object that is part of all signatures in Hyperledger Fabric. The "creator"
	 * field has two important pieces of information about the identity of the signer,
	 * the organization (Mspid) that the signer belongs to, and the certificate (IdBytes).
	 * The "nonce" field is a unique value to guard against replay attacks.
	 *
<br><pre>
creator
	Mspid -- {string}
	IdBytes -- {byte[]}
nonce -- {byte[]}
</pre>
	 * @typedef {Object} SignatureHeader
	 */

	/**
	 * A ConfigEnvelope contains the channel configurations data and is the
	 * main content of a configuration block. Another type of blocks are those
	 * that contain endorser transactions, where the main content is an array
	 * of {@link Transaction}.
	 * <br><br>
	 * A "ConfigEnvelope" will have the following object structure.
<br><pre>
config
	sequence -- {int}
	channel_group -- {{@link ConfigGroup}}
last_update
	signature -- {byte[]}
	payload
		header -- {{@link Header}}
		data -- {{@link ConfigUpdateEnvelope}}
</pre>
	 * @typedef {Object} ConfigEnvelope
	 */

	/**
	 * A Transaction, or "Endorser Transaction", is the result of invoking chaincodes
	 * to collect endorsements, getting globally ordered in the context of a channel,
	 * and getting validated by the committer peer as part of a block before finally
	 * being formally "committed" to the ledger inside a Block. Each transaction contains
	 * an array of "actions" representing different steps for executing a transaction,
	 * and those steps will be processed atomically, meaning if any one step failed
	 * then the whole transaction will be marked as rejected.
	 * <br><br>
	 * Each entry of the "actions" array contains a chaincode proposal and corresponding proposal
	 * responses that encapsulate the endorsing peer's decisions on whether the proposal
	 * is considered valid. Note that even if a transaction proposal(s) is considered
	 * valid by the endorsing peers, it may still be rejected by the committers during
	 * transaction validation. Whether a transaction as a whole is valid or not, is not
	 * reflected in the transaction record itself, but rather recorded in a separate
	 * field in the Block's metadata.
	 * <br><br>
	 * A "Transaction" will have the following object structure.
<br><pre>
actions {array}
	header -- {{@link SignatureHeader}}
	payload
		chaincode_proposal_payload
			input -- {byte[]}
		action
			proposal_response_payload
				proposal_hash -- {byte[]}
				extension
					results
						data_model -- {int}
						ns_rwset -- {array}
							namespace -- {string}
							rwset
								reads -- {array}
									key -- {string}
									version
										block_num -- {number}
										tx_num -- {number}
								range_queries_info -- {array}
								writes -- {array}
									key -- {string}
									is_delete -- {boolean}
									value -- {string}
					events
						chaincode_id --  {string}
						tx_id -- {string}
						event_name -- {string}
						payload -- {byte[]}
					response
						status -- {int}
						message -- {string}
						payload -- {byte[]}
			endorsements -- {{@link Endorsement}[]}
</pre>
	 * @typedef {Object} Transaction
	 */

	/**
	 * An object of a protobuf message "ConfigUpdateEnvelope".
	 * <br><br>
	 * A "ConfigUpdateEnvelope" will have the following object structure.
<br><pre>
config_update
	channel_id -- {string}
	read_set -- {{@link ChannelConfigGroup}}
	write_set -- {{@link ChannelConfigGroup}}
signatures -- {array}
	signature_header -- {{@link SignatureHeader}}
	signature -- {byte[]}
</pre>
	 * @typedef {Object} ConfigUpdateEnvelope
	 * @property {ChannelConfigGroup} config_update.read_set A set of the current version numbers of all
	 *           configuration items being updated
	 * @property {ChannelConfigGroup} config_update.write_set A set of all configuration items being updated. Must have a
	 *           version number one greater than the version number of the same item
	 *           in the read_set along with the new value.
	 */

	/**
	 * The configuration settings that govern how the fabric should maintain
	 * a channel are included in the blocks of the channel itself. When a block contains
	 * the channel configuration, the channel configuration record is the only item in
	 * the block's data array. Every block, including the configuration blocks themselves,
	 * has a pointer to the latest configuration block, making it easy to query for the
	 * latest channel configuration settings.
	 * <br><br>
	 * A channel configuration record will have the following object structure.
<br><pre>
version -- {int}
mod_policy -- {string}
groups
	Orderer
		version -- {int}
		groups
			&ltorderer_org_name&gt -- {{@link OrganizationConfigGroup}}
		values
			ConsensusType
				version -- {int}
				mod_policy -- {string}
				value
					type -- {string}
			BatchSize
				version -- {int}
				mod_policy -- {string}
				value
					max_message_count -- {int}
					absolute_max_bytes -- {int}
					preferred_max_bytes -- {int}
			BatchTimeout
				version -- {int}
				mod_policy -- {string}
				value
					timeout -- {duration}
			ChannelRestrictions
				version -- {int}
				mod_policy -- {string}
				value
					max_count -- {int}
		policies
			Admins
				version -- {int}
				mod_policy -- {string}
				policy -- {{@link ImplicitMetaPolicy}}
			Writers
				version -- {int}
				mod_policy -- {string}
				policy -- {{@link ImplicitMetaPolicy}}
			Readers
				version -- {int}
				mod_policy -- {string}
				policy -- {{@link ImplicitMetaPolicy}}
			BlockValidation
				version -- {int}
				mod_policy -- {string}
				policy -- {{@link SignaturePolicy}}
	Application
		version -- {int}
		groups
			&ltpeer_org_name&gt -- {{@link OrganizationConfigGroup}}
		values
		policies
			Admins
				version -- {int}
				mod_policy -- {string}
				policy -- {{@link ImplicitMetaPolicy}}
			Writers
				version -- {int}
				mod_policy -- {string}
				policy -- {{@link ImplicitMetaPolicy}}
			Readers
				version -- {int}
				mod_policy -- {string}
				policy -- {{@link ImplicitMetaPolicy}}
values
	OrdererAddresses
		version -- {int}
		mod_policy -- {string}
		value
			addresses -- {array}
				{string - host:port}
	HashingAlgorithm
		version -- {int}
		mod_policy -- {string}
		value
			name -- {string}
	BlockDataHashingStructure
		version -- {int}
		mod_policy -- {string}
		value
			width -- {int}
	Consortium
		version -- {int}
		mod_policy -- {string}
		value
			name -- {string}
</pre>
	 * @typedef {Object} ChannelConfigGroup
	 * @property {OrganizationConfigGroup} groups.Orderer.groups.&ltorderer_org_name&gt These are the
	 *                                              orderer organizatoin names defined on the network
	 * @property {OrganizationConfigGroup} groups.Application.groups.&ltpeer_org_name&gt These are the
	 *                                              peer organization names defined on the network
	 * @property {ImplicitMetaPolicy} policy These policies point to other policies and specify a
	 *                                              threshold as in "ANY", "MAJORITY" or "ALL"
	 */

	/**
	 * Each participating organization of the channel gets represented in a section
	 * in the configuration block as described below. Critical information about the
	 * organzation such as its Membership Service Provider (MSP) content and its pre-defined
	 * policies that form the basis of the channel's access control policies (Admins, Writers
	 * and Readers) are contained in these sections.
	 * <br><br>
	 * A organizational configuration will have the following object structure.
<br><pre>
version -- {int}
mod_policy -- {string}
values
	MSP
		version -- {int}
		mod_policy -- {string}
		value
			type -- {int}
			config
				name -- {string}
				root_certs -- {string[]}
				intermediate_certs -- {string[]}
				admins -- {string[]}
				revocation_list -- {string[]}
				signing_identity -- {byte[]}
				organizational_unit_identifiers -- {string[]}
policies
	 Admins
			version -- {int}
			mod_policy -- {string}
			policy -- {{@link SignaturePolicy}}
	 Writers
			version -- {int}
			mod_policy -- {string}
			policy -- {{@link SignaturePolicy}}
	 Readers
			version -- {int}
			mod_policy -- {string}
			policy -- {{@link SignaturePolicy}}
</pre>
	 * @typedef {Object} OrganizationConfigGroup
	 */


	/**
	 * An endorsement is a signature of an endorser over a proposal response.  By
	 * producing an endorsement message, an endorser implicitly "approves" that
	 * proposal response and the actions contained therein. When enough
	 * endorsements have been collected, a transaction can be generated out of a
	 * set of proposal responses
	 * <br><br>
	 * An endorsement message has the following structure:
<br><pre>
endorser
	Mspid -- {string]
	IdBytes -- {byte[]}
signature -- {byte[]}
</pre>
	 *
	 * @typedef {Object} Endorsement
	 */

	/**
	 * ImplicitMetaPolicy is a policy type which depends on the hierarchical nature of the configuration
	 * It is implicit because the rule is generate implicitly based on the number of sub policies
	 * It is meta because it depends only on the result of other policies
	 * <br><br>
	 * When evaluated, this policy iterates over all immediate child sub-groups, retrieves the policy
	 * of name sub_policy, evaluates the collection and applies the rule.
	 * <br><br>
	 * For example, with 4 sub-groups, and a policy name of "Readers", ImplicitMetaPolicy retrieves
	 * each sub-group, retrieves policy "Readers" for each subgroup, evaluates it, and, in the case of ANY
	 * 1 satisfied is sufficient, ALL would require 4 signatures, and MAJORITY would require 3 signatures.
	 * <br><br>
	 * An "ImplicitMetaPolicy" will have the following object structure.
<br><pre>
type -- IMPLICIT_META
policy
	sub_policy -- {string}
	rule -- ANY | ALL | MAJORITY
</pre>
	 * @typedef {Object} ImplicitMetaPolicy
	 */

	/**
	 * SignaturePolicy is a recursive message structure which defines a featherweight DSL for describing
	 * policies which are more complicated than 'exactly this signature'.  The NOutOf operator is sufficent
	 * to express AND as well as OR, as well as of course N out of the following M policies.
	 * <br><br>
	 * SignedBy implies that the signature is from a valid certificate which is signed by the trusted
	 * authority specified in the bytes.  This will be the certificate itself for a self-signed certificate
	 * and will be the CA for more traditional certificates
	 * <br><br>
	 * A "SignaturePolicy" will have the following object structure.
<br><pre>
type -- SIGNATURE
policy
	Type -- n_out_of
	n_out_of
		N -- {int}
		policies -- {array}
			Type -- signed_by
			signed_by -- {int}
	identities -- {array}
		principal_classification -- {int}
		msp_identifier -- {string}
		Role -- MEMBER | ADMIN
</pre>
	 * @typedef {Object} SignaturePolicy
	 */

	/**
	 * Constructs a JSON object containing all decoded values from the
	 * protobuf encoded `Block` bytes.
	 *
	 * @param {byte[]} block_bytes - The encoded bytes of a Block protobuf message
	 * @returns {Block} An object of the Block
	 */
	static decode(block_bytes) {
		if (!block_bytes || !(block_bytes instanceof Buffer)) {
			throw new Error('Block input data is not a byte buffer');
		}
		var block = {};
		try {
			var proto_block = _commonProto.Block.decode(block_bytes);
			block.header = decodeBlockHeader(proto_block.getHeader());
			block.data = decodeBlockData(proto_block.getData());
			block.metadata = decodeBlockMetaData(proto_block.getMetadata());
		} catch (error) {
			logger.error('decode - ::' + error.stack ? error.stack : error);
			throw error;
		}

		return block;
	};

	/**
	 * Constructs an object containing all decoded values from the
	 * protobuf encoded `Block` object
	 *
	 * @param {Object} block - a protobuf common.Block object
	 * @returns {Block} An object of the fully decoded protobuf common.Block
	 */
	static decodeBlock(proto_block) {
		if (!proto_block) {
			throw new Error('Block input data is not a protobuf Block');
		}
		var block = {};
		try {
			block.header = {
				number: proto_block.header.number,
				previous_hash: proto_block.header.previous_hash.toString('hex'),
				data_hash: proto_block.header.data_hash.toString('hex')
			};
			block.data = decodeBlockData(proto_block.data, true);
			block.metadata = decodeBlockMetaData(proto_block.metadata);
		} catch (error) {
			logger.error('decode - ::' + error.stack ? error.stack : error);
			throw error;
		}

		return block;
	};

	/**
	 * @typedef {Object} ProcessedTransaction
	 * @property {number} validationCode - See [this list]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/peer/transaction.proto#L125}
	 *                                     for all the defined validation codes
	 * @property {Object} transactionEnvelope - Encapsulates the transaction and the signature over it.
	 *                                          It has the following structure:
<br><pre>
signature -- {byte[]}
payload -- {}
	header -- {{@link Header}}
	data -- {{@link Transaction}}
</pre>
	 */

	/**
	 * Constructs an object containing all decoded values from the
	 * protobuf encoded "ProcessedTransaction" bytes
	 *
	 * @param {byte[]} processed_transaction_bytes - The encode bytes of a protobuf
	 *                                               message "ProcessedTransaction"
	 * @returns {ProcessedTransaction} A fully decoded ProcessedTransaction object
	 */
	static decodeTransaction(processed_transaction_bytes) {
		if (!(processed_transaction_bytes instanceof Buffer)) {
			throw new Error('Proccesed transaction data is not a byte buffer');
		}
		var processed_transaction = {};
		var proto_processed_transaction = _transProto.ProcessedTransaction.decode(processed_transaction_bytes);
		processed_transaction.validationCode = proto_processed_transaction.getValidationCode();
		processed_transaction.transactionEnvelope = decodeBlockDataEnvelope(proto_processed_transaction.getTransactionEnvelope());
		return processed_transaction;
	}
};

function decodeBlockHeader(proto_block_header) {
	var block_header = {};
	block_header.number = proto_block_header.getNumber();
	block_header.previous_hash = proto_block_header.getPreviousHash().toBuffer().toString('hex');
	block_header.data_hash = proto_block_header.getDataHash().toBuffer().toString('hex');

	return block_header;
};

function decodeBlockData(proto_block_data, not_proto) {
	var data = {};
	data.data = [];
	for (var i in proto_block_data.data) {
		var proto_envelope = null;
		if (not_proto) {
			proto_envelope = _commonProto.Envelope.decode(proto_block_data.data[i]);
		} else {
			proto_envelope = _commonProto.Envelope.decode(proto_block_data.data[i].toBuffer());
		}
		var envelope = decodeBlockDataEnvelope(proto_envelope);
		data.data.push(envelope);
	}

	return data;
};

function decodeBlockMetaData(proto_block_metadata) {
	var metadata = {};
	metadata.metadata = [];
	if (proto_block_metadata && proto_block_metadata.metadata) {
		var signatures = decodeMetadataSignatures(proto_block_metadata.metadata[0]);
		metadata.metadata.push(signatures);

		var last_config = decodeLastConfigSequenceNumber(proto_block_metadata.metadata[1]);
		metadata.metadata.push(last_config);

		var transaction_filter = decodeTransactionFilter(proto_block_metadata.metadata[2]);
		metadata.metadata.push(transaction_filter);
	}

	return metadata;
};

function decodeTransactionFilter(metadata_bytes) {
	var transaction_filter = [];
	if(!metadata_bytes) {
		logger.debug('decodeTransactionFilter - no metadata');
		return null;
	}
	if(!(metadata_bytes instanceof Buffer)) {
		metadata_bytes = metadata_bytes.toBuffer();
	}
	logger.debug('decodeTransactionFilter - metadata length:%s',metadata_bytes.length);

	for (let i = 0; i < metadata_bytes.length; i++) {
		let value = parseInt(metadata_bytes[i]);
		logger.debug('decodeTransactionFilter - looking at index:%s with value:%s',i,value);
		transaction_filter.push(value);
	}
	return transaction_filter;
}

function decodeLastConfigSequenceNumber(metadata_bytes) {
	var last_config = {};
	last_config.value = {};
	if (metadata_bytes) {
		var proto_metadata = _commonProto.Metadata.decode(metadata_bytes);
		var proto_last_config = _commonProto.LastConfig.decode(proto_metadata.getValue());
		last_config.value.index = proto_last_config.getIndex();
		last_config.signatures = decodeMetadataValueSignatures(proto_metadata.signatures);
	}
	return last_config;
}

function decodeMetadataSignatures(metadata_bytes) {
	var metadata = {};
	var proto_metadata = _commonProto.Metadata.decode(metadata_bytes);
	metadata.value = proto_metadata.getValue().toBuffer().toString();
	metadata.signatures = decodeMetadataValueSignatures(proto_metadata.signatures);

	return metadata;
}

function decodeMetadataValueSignatures(proto_meta_signatures) {
	var signatures = [];
	if (proto_meta_signatures)
		for (let i in proto_meta_signatures) {
			var metadata_signature = {};
			var proto_metadata_signature = _commonProto.MetadataSignature.decode(proto_meta_signatures[i].toBuffer());
			metadata_signature.signature_header = decodeSignatureHeader(proto_metadata_signature.getSignatureHeader());
			metadata_signature.signature = proto_metadata_signature.getSignature().toBuffer();
			signatures.push(metadata_signature);
		}

	return signatures;
}

function decodeBlockDataEnvelope(proto_envelope) {
	var envelope = {};
	envelope.signature = proto_envelope.getSignature().toBuffer(); //leave as bytes

	envelope.payload = {};
	var proto_payload = _commonProto.Payload.decode(proto_envelope.getPayload().toBuffer());
	envelope.payload.header = decodeHeader(proto_payload.getHeader());

	if (envelope.payload.header.channel_header.type === HeaderType[1]) { // CONFIG
		envelope.payload.data = decodeConfigEnvelope(proto_payload.getData().toBuffer());
	}
	//  else if(envelope.payload.header.channel_header.type === HeaderType[2]) { // CONFIG_UPDATE
	//    envelope.payload.data = decodeConfigUpdateEnvelope(proto_payload.getData().toBuffer());
	//  }
	else if (envelope.payload.header.channel_header.type === HeaderType[3]) { //ENDORSER_TRANSACTION
		envelope.payload.data = decodeEndorserTransaction(proto_payload.getData().toBuffer());
	} else {
		throw new Error('Only able to decode ENDORSER_TRANSACTION and CONFIG type blocks');
	}

	return envelope;
};

function decodeEndorserTransaction(trans_bytes) {
	var data = {};
	var transaction = _transProto.Transaction.decode(trans_bytes);
	data.actions = [];
	if (transaction && transaction.actions)
		for (let i in transaction.actions) {
			var action = {};
			action.header = decodeSignatureHeader(transaction.actions[i].header);
			action.payload = decodeChaincodeActionPayload(transaction.actions[i].payload);
			data.actions.push(action);
		}

	return data;
};

function decodeConfigEnvelope(config_envelope_bytes) {
	var config_envelope = {};
	var proto_config_envelope = _configtxProto.ConfigEnvelope.decode(config_envelope_bytes);
	config_envelope.config = decodeConfig(proto_config_envelope.getConfig());

	logger.debug('decodeConfigEnvelope - decode complete for config envelope - start config update');
	config_envelope.last_update = {};
	var proto_last_update = proto_config_envelope.getLastUpdate(); //this is a common.Envelope
	if (proto_last_update !== null) { // the orderer's genesis block may not have this field
		config_envelope.last_update.payload = {};
		var proto_payload = _commonProto.Payload.decode(proto_last_update.getPayload().toBuffer());
		config_envelope.last_update.payload.header = decodeHeader(proto_payload.getHeader());
		config_envelope.last_update.payload.data = decodeConfigUpdateEnvelope(proto_payload.getData().toBuffer());
		config_envelope.last_update.signature = proto_last_update.getSignature().toBuffer(); //leave as bytes
	}

	return config_envelope;
};

function decodeConfig(proto_config) {
	var config = {};
	config.sequence = proto_config.getSequence();
	config.channel_group = decodeConfigGroup(proto_config.getChannelGroup());

	return config;
};

function decodeConfigUpdateEnvelope(config_update_envelope_bytes) {
	var config_update_envelope = {};
	var proto_config_update_envelope = _configtxProto.ConfigUpdateEnvelope.decode(config_update_envelope_bytes);
	config_update_envelope.config_update = decodeConfigUpdate(proto_config_update_envelope.getConfigUpdate().toBuffer());
	var signatures = [];
	for (var i in proto_config_update_envelope.signatures) {
		let proto_configSignature = proto_config_update_envelope.signatures[i];
		var config_signature = decodeConfigSignature(proto_configSignature);
		signatures.push(config_signature);
	}
	config_update_envelope.signatures = signatures;

	return config_update_envelope;
};

function decodeConfigUpdate(config_update_bytes) {
	var config_update = {};
	var proto_config_update = _configtxProto.ConfigUpdate.decode(config_update_bytes);
	config_update.channel_id = proto_config_update.getChannelId();
	config_update.read_set = decodeConfigGroup(proto_config_update.getReadSet());
	config_update.write_set = decodeConfigGroup(proto_config_update.getWriteSet());

	return config_update;
};

function decodeConfigGroups(config_group_map) {
	var config_groups = {};
	var keys = Object.keys(config_group_map.map);
	for (let i = 0; i < keys.length; i++) {
		let key = keys[i];
		config_groups[key] = decodeConfigGroup(config_group_map.map[key].value);
	}

	return config_groups;
};

function decodeConfigGroup(proto_config_group) {
	if (!proto_config_group) return null;
	var config_group = {};
	config_group.version = decodeVersion(proto_config_group.getVersion());
	config_group.groups = decodeConfigGroups(proto_config_group.getGroups());
	config_group.values = decodeConfigValues(proto_config_group.getValues());
	config_group.policies = decodeConfigPolicies(proto_config_group.getPolicies());
	config_group.mod_policy = proto_config_group.getModPolicy(); //string
	return config_group;
};

function decodeConfigValues(config_value_map) {
	var config_values = {};
	var keys = Object.keys(config_value_map.map);
	for (let i = 0; i < keys.length; i++) {
		let key = keys[i];
		config_values[key] = decodeConfigValue(config_value_map.map[key]);
	}

	return config_values;
};

function decodeConfigValue(proto_config_value) {
	var config_value = {};
	logger.debug(' ======> Config item ::%s', proto_config_value.key);
	config_value.version = decodeVersion(proto_config_value.value.getVersion());
	config_value.mod_policy = proto_config_value.value.getModPolicy();
	config_value.value = {};
	switch(proto_config_value.key) {
	case 'AnchorPeers':
		var anchor_peers = [];
		var proto_anchor_peers = _peerConfigurationProto.AnchorPeers.decode(proto_config_value.value.value);
		if(proto_anchor_peers && proto_anchor_peers.anchor_peers) for(var i in proto_anchor_peers.anchor_peers) {
			var anchor_peer = {
				host : proto_anchor_peers.anchor_peers[i].host,
				port : proto_anchor_peers.anchor_peers[i].port
			};
			anchor_peers.push(anchor_peer);
		}
		config_value.value.anchor_peers = anchor_peers;
		break;
	case 'MSP':
		var msp_config = {};
		var proto_msp_config = _mspConfigProto.MSPConfig.decode(proto_config_value.value.value);
		if(proto_msp_config.getType() == 0) {
			msp_config = decodeFabricMSPConfig(proto_msp_config.getConfig());
		}
		config_value.value.type = proto_msp_config.type;
		config_value.value.config = msp_config;
		break;
	case 'ConsensusType':
		var proto_consensus_type = _ordererConfigurationProto.ConsensusType.decode(proto_config_value.value.value);
		config_value.value.type = proto_consensus_type.getType(); // string
		break;
	case 'BatchSize':
		var proto_batch_size = _ordererConfigurationProto.BatchSize.decode(proto_config_value.value.value);
		config_value.value.max_message_count = proto_batch_size.getMaxMessageCount(); //uint32
		config_value.value.absolute_max_bytes = proto_batch_size.getAbsoluteMaxBytes(); //uint32
		config_value.value.preferred_max_bytes = proto_batch_size.getPreferredMaxBytes(); //uint32
		break;
	case 'BatchTimeout':
		var proto_batch_timeout = _ordererConfigurationProto.BatchTimeout.decode(proto_config_value.value.value);
		config_value.value.timeout = proto_batch_timeout.getTimeout(); //string
		break;
	case 'ChannelRestrictions':
		var proto_channel_restrictions = _ordererConfigurationProto.ChannelRestrictions.decode(proto_config_value.value.value);
		config_value.value.max_count = proto_channel_restrictions.getMaxCount(); //unit64
		break;
	case 'CreationPolicy':
		var proto_creation_policy = _ordererConfigurationProto.CreationPolicy.decode(proto_config_value.value.value);
		config_value.value.policy = proto_creation_policy.getPolicy(); //string
		break;
	case 'Consortium':
		var consortium_name = _commonConfigurationProto.Consortium.decode(proto_config_value.value.value);
		config_value.value.name = consortium_name.getName(); //string
		break;
	case 'ChainCreationPolicyNames':
		var proto_chain_creation_policy_names = _ordererConfigurationProto.ChainCreationPolicyNames.decode(proto_config_value.value.value);
		var names = [];
		var proto_names = proto_chain_creation_policy_names.getNames();
		if(proto_names) for(var i in proto_names) {
			names.push(proto_names[i]); //string
		}
		config_value.value.names = names;
		break;
	case 'HashingAlgorithm':
		var proto_hashing_algorithm = _commonConfigurationProto.HashingAlgorithm.decode(proto_config_value.value.value);
		config_value.value.name = proto_hashing_algorithm.getName();
		break;
	case 'BlockDataHashingStructure':
		var proto_blockdata_hashing_structure = _commonConfigurationProto.BlockDataHashingStructure.decode(proto_config_value.value.value);
		config_value.value.width = proto_blockdata_hashing_structure.getWidth(); //
		break;
	case 'OrdererAddresses':
		var orderer_addresses = _commonConfigurationProto.OrdererAddresses.decode(proto_config_value.value.value);
		var addresses = [];
		var proto_addresses = orderer_addresses.getAddresses();
		if(proto_addresses) for(var i in proto_addresses) {
			addresses.push(proto_addresses[i]); //string
		}
		config_value.value.addresses = addresses;
		break;
	default:
//		logger.debug('loadConfigValue - %s   - value: %s', group_name, config_value.value.value);
	}
	return config_value;
};

function decodeConfigPolicies(config_policy_map) {
	var config_policies = {};
	var keys = Object.keys(config_policy_map.map);
	for (let i = 0; i < keys.length; i++) {
		let key = keys[i];
		config_policies[key] = decodeConfigPolicy(config_policy_map.map[key]);
	}

	return config_policies;
};

var Policy_PolicyType = ['UNKNOWN', 'SIGNATURE', 'MSP', 'IMPLICIT_META'];

function decodeConfigPolicy(proto_config_policy) {
	var config_policy = {};
	config_policy.version = decodeVersion(proto_config_policy.value.getVersion());
	config_policy.mod_policy = proto_config_policy.value.getModPolicy();
	config_policy.policy = {};
	if (proto_config_policy.value.policy) {
		config_policy.policy.type = Policy_PolicyType[proto_config_policy.value.policy.type];
		logger.debug('decodeConfigPolicy ======> Policy item ::%s', proto_config_policy.key);
		switch (proto_config_policy.value.policy.type) {
		case _policiesProto.Policy.PolicyType.SIGNATURE:
			config_policy.policy.policy = decodeSignaturePolicyEnvelope(proto_config_policy.value.policy.policy);
			break;
		case _policiesProto.Policy.PolicyType.MSP:
			var proto_msp = _policiesProto.Policy.decode(proto_config_policy.value.policy.policy);
			logger.warn('decodeConfigPolicy - found a PolicyType of MSP. This policy type has not been implemented yet.');
			break;
		case _policiesProto.Policy.PolicyType.IMPLICIT_META:
			config_policy.policy.policy = decodeImplicitMetaPolicy(proto_config_policy.value.policy.policy);
			break;
		default:
			throw new Error('Unknown Policy type');
		}
	}

	return config_policy;
};

var ImplicitMetaPolicy_Rule = ['ANY', 'ALL', 'MAJORITY'];

function decodeImplicitMetaPolicy(implicit_meta_policy_bytes) {
	var implicit_meta_policy = {};
	var proto_implicit_meta_policy = _policiesProto.ImplicitMetaPolicy.decode(implicit_meta_policy_bytes);
	implicit_meta_policy.sub_policy = proto_implicit_meta_policy.getSubPolicy();
	implicit_meta_policy.rule = ImplicitMetaPolicy_Rule[proto_implicit_meta_policy.getRule()];
	return implicit_meta_policy;
}

function decodeSignaturePolicyEnvelope(signature_policy_envelope_bytes) {
	var signature_policy_envelope = {};
	var porto_signature_policy_envelope = _policiesProto.SignaturePolicyEnvelope.decode(signature_policy_envelope_bytes);
	signature_policy_envelope.version = decodeVersion(porto_signature_policy_envelope.getVersion());
	signature_policy_envelope.policy = decodeSignaturePolicy(porto_signature_policy_envelope.getPolicy());
	var identities = [];
	var proto_identities = porto_signature_policy_envelope.getIdentities();
	if (proto_identities)
		for (var i in proto_identities) {
			var msp_principal = decodeMSPPrincipal(proto_identities[i]);
			identities.push(msp_principal); //string
		}
	signature_policy_envelope.identities = identities;

	return signature_policy_envelope;
};

function decodeSignaturePolicy(proto_signature_policy) {
	var signature_policy = {};
	signature_policy.Type = proto_signature_policy.Type;
	if (signature_policy.Type == 'n_out_of') {
		signature_policy.n_out_of = {};
		signature_policy.n_out_of.N = proto_signature_policy.n_out_of.getN();
		signature_policy.n_out_of.policies = [];
		for (var i in proto_signature_policy.n_out_of.policies) {
			var proto_policy = proto_signature_policy.n_out_of.policies[i];
			var policy = decodeSignaturePolicy(proto_policy);
			signature_policy.n_out_of.policies.push(policy);
		}
	} else if (signature_policy.Type == 'signed_by') {
		signature_policy.signed_by = proto_signature_policy.getSignedBy();
	} else {
		throw new Error('unknown signature policy type');
	}

	return signature_policy;
};

function decodeMSPPrincipal(proto_msp_principal) {
	var msp_principal = {};
	msp_principal.principal_classification = proto_msp_principal.getPrincipalClassification();
	var proto_principal = null;
	switch (msp_principal.principal_classification) {
	case _mspPrProto.MSPPrincipal.Classification.ROLE:
		proto_principal = _mspPrProto.MSPRole.decode(proto_msp_principal.getPrincipal());
		msp_principal.msp_identifier = proto_principal.getMspIdentifier();
		if (proto_principal.getRole() === 0) {
			msp_principal.Role = 'MEMBER';
		} else if (proto_principal.getRole() === 1) {
			msp_principal.Role = 'ADMIN';
		}
		break;
	case _mspPrProto.MSPPrincipal.Classification.ORGANIZATION_UNIT:
		proto_principal = _mspPrProto.OrganizationUnit.decode(proto_msp_principal.getPrincipal());
		msp_principal.msp_identifier = proto_principal.getMspIdendifier(); //string
		msp_principal.organizational_unit_identifier = proto_principal.getOrganizationalUnitIdentifier(); //string
		msp_principal.certifiers_identifier = proto_principal.getCertifiersIdentifier().toBuffer(); //bytes
		break;
	case _mspPrProto.MSPPrincipal.Classification.IDENTITY:
		msp_principal = decodeIdentity(proto_msp_principal.getPrincipal());
		break;
	}

	return msp_principal;
};

function decodeConfigSignature(proto_configSignature) {
	var config_signature = {};
	config_signature.signature_header = decodeSignatureHeader(proto_configSignature.getSignatureHeader().toBuffer());
	config_signature.sigature = proto_configSignature.getSignature().toBuffer();

	return config_signature;
};

function decodeSignatureHeader(signature_header_bytes) {
	//logger.debug('decodeSignatureHeader - %s',signature_header_bytes);
	var signature_header = {};
	var proto_signature_header = _commonProto.SignatureHeader.decode(signature_header_bytes);
	signature_header.creator = decodeIdentity(proto_signature_header.getCreator().toBuffer());
	signature_header.nonce = proto_signature_header.getNonce().toBuffer();

	return signature_header;
};

function decodeIdentity(id_bytes) {
	//logger.debug('decodeIdentity - %s',id_bytes);
	var identity = {};
	try {
		var proto_identity = _identityProto.SerializedIdentity.decode(id_bytes);
		identity.Mspid = proto_identity.getMspid();
		identity.IdBytes = proto_identity.getIdBytes().toBuffer().toString();
	} catch (err) {
		logger.error('Failed to decode the identity: %s', err.stack ? err.stack : err);
	}

	return identity;
};

function decodeFabricMSPConfig(msp_config_bytes) {
	var msp_config = {};
	var proto_msp_config = _mspConfigProto.FabricMSPConfig.decode(msp_config_bytes);

	msp_config.name = proto_msp_config.getName();
	msp_config.root_certs = toPEMcerts(proto_msp_config.getRootCerts());
	msp_config.intermediate_certs = toPEMcerts(proto_msp_config.getIntermediateCerts());
	msp_config.admins = toPEMcerts(proto_msp_config.getAdmins());
	msp_config.revocation_list = toPEMcerts(proto_msp_config.getRevocationList());
	msp_config.signing_identity = decodeSigningIdentityInfo(proto_msp_config.getSigningIdentity());
	msp_config.organizational_unit_identifiers = decodeFabricOUIdentifier(proto_msp_config.getOrganizationalUnitIdentifiers());

	return msp_config;
};

function decodeFabricOUIdentifier(proto_organizational_unit_identitfiers) {
	var organizational_unit_identitfiers = [];
	if (proto_organizational_unit_identitfiers) {
		for (let i = 0; i < proto_organizational_unit_identitfiers.length; i++) {
			var proto_organizational_unit_identitfier = proto_organizational_unit_identitfiers[i];
			var organizational_unit_identitfier = {};
			organizational_unit_identitfier.certificate =
				proto_organizational_unit_identitfier.getCertificate().toBuffer().toString();
			organizational_unit_identitfier.organizational_unit_identifier =
				proto_organizational_unit_identitfier.getOrganizationalUnitIdentifier();
			organizational_unit_identitfiers.push(organizational_unit_identitfier);
		}
	}

	return organizational_unit_identitfiers;
}

function toPEMcerts(buffer_array_in) {
	var buffer_array_out = [];
	for (var i in buffer_array_in) {
		buffer_array_out.push(buffer_array_in[i].toBuffer().toString());
	}

	return buffer_array_out;
};

function decodeSigningIdentityInfo(signing_identity_info_bytes) {
	var signing_identity_info = {};
	if (signing_identity_info_bytes) {
		var proto_signing_identity_info = _mspConfigProto.SigningIdentityInfo.decode(signing_identity_info_bytes);
		signing_identity_info.public_signer = proto_signing_identity_info.getPublicSigner().toBuffer().toString();
		signing_identity_info.private_signer = decodeKeyInfo(proto_signing_identity_info.getPrivateSigner());
	}

	return signing_identity_info_bytes;
}

function decodeKeyInfo(key_info_bytes) {
	var key_info = {};
	if (key_info_bytes) {
		var proto_key_info = _mspConfigProto.KeyInfo.decode(key_info_bytes);
		key_info.key_identifier = proto_key_info.getKeyIdentitier();
		key_info.key_material = 'private'; //should not show this
	}

	return key_info;
}

function decodeHeader(proto_header) {
	var header = {};
	header.channel_header = decodeChannelHeader(proto_header.getChannelHeader().toBuffer());
	header.signature_header = decodeSignatureHeader(proto_header.getSignatureHeader().toBuffer());

	return header;
};

var HeaderType = {
	0: 'MESSAGE', // Used for messages which are signed but opaque
	1: 'CONFIG', // Used for messages which express the channel config
	2: 'CONFIG_UPDATE', // Used for transactions which update the channel config
	3: 'ENDORSER_TRANSACTION', // Used by the SDK to submit endorser based transactions
	4: 'ORDERER_TRANSACTION', // Used internally by the orderer for management
	5: 'DELIVER_SEEK_INFO', // Used as the type for Envelope messages submitted to instruct the Deliver API to seek
	6: 'CHAINCODE_PACKAGE' // Used for packaging chaincode artifacts for install
};

function decodeChannelHeader(header_bytes) {
	var channel_header = {};
	var proto_channel_header = _commonProto.ChannelHeader.decode(header_bytes);
	channel_header.type = HeaderType[proto_channel_header.getType()];
	channel_header.version = decodeVersion(proto_channel_header.getType());
	channel_header.timestamp = timeStampToDate(proto_channel_header.getTimestamp()).toString();
	channel_header.channel_id = proto_channel_header.getChannelId();
	channel_header.tx_id = proto_channel_header.getTxId();
	channel_header.epoch = proto_channel_header.getEpoch().toInt();
	//TODO need to decode this
	channel_header.extension = proto_channel_header.getExtension().toBuffer();

	return channel_header;
};

function timeStampToDate(time_stamp) {
	var millis = time_stamp.seconds * 1000 + time_stamp.nanos / 1000000;
	var date = new Date(millis);

	return date;
};

function decodeChaincodeActionPayload(payload_bytes) {
	var payload = {};
	var proto_chaincode_action_payload = _transProto.ChaincodeActionPayload.decode(payload_bytes);
	payload.chaincode_proposal_payload = decodeChaincodeProposalPayload(proto_chaincode_action_payload.getChaincodeProposalPayload());
	payload.action = decodeChaincodeEndorsedAction(proto_chaincode_action_payload.getAction());

	return payload;
};

function decodeChaincodeProposalPayload(chaincode_proposal_payload_bytes) {
	var chaincode_proposal_payload = {};
	var proto_chaincode_proposal_payload = _proposalProto.ChaincodeProposalPayload.decode(chaincode_proposal_payload_bytes);
	chaincode_proposal_payload.input = proto_chaincode_proposal_payload.getInput().toBuffer();
	//TransientMap is not allowed to be included on ledger

	return chaincode_proposal_payload;
}

function decodeChaincodeEndorsedAction(proto_chaincode_endorsed_action) {
	var action = {};
	action.proposal_response_payload = decodeProposalResponsePayload(proto_chaincode_endorsed_action.getProposalResponsePayload());
	action.endorsements = [];
	for (var i in proto_chaincode_endorsed_action.endorsements) {
		var endorsement = decodeEndorsement(proto_chaincode_endorsed_action.endorsements[i]);
		action.endorsements.push(endorsement);
	}

	return action;
};

function decodeEndorsement(proto_endorsement) {
	var endorsement = {};
	endorsement.endorser = decodeIdentity(proto_endorsement.getEndorser());
	endorsement.signature = proto_endorsement.getSignature().toBuffer();

	return endorsement;
};

function decodeProposalResponsePayload(proposal_response_payload_bytes) {
	var proposal_response_payload = {};
	var proto_proposal_response_payload = _responseProto.ProposalResponsePayload.decode(proposal_response_payload_bytes);
	proposal_response_payload.proposal_hash = proto_proposal_response_payload.getProposalHash().toBuffer().toString('hex');
	proposal_response_payload.extension = decodeChaincodeAction(proto_proposal_response_payload.getExtension());

	return proposal_response_payload;
};

function decodeChaincodeAction(action_bytes) {
	var chaincode_action = {};
	var proto_chaincode_action = _proposalProto.ChaincodeAction.decode(action_bytes);
	chaincode_action.results = decodeReadWriteSets(proto_chaincode_action.getResults());
	chaincode_action.events = decodeChaincodeEvents(proto_chaincode_action.getEvents());
	chaincode_action.response = decodeResponse(proto_chaincode_action.getResponse());

	return chaincode_action;
};

function decodeChaincodeEvents(event_bytes) {
	var events = {};
	var proto_events = _ccEventProto.ChaincodeEvent.decode(event_bytes);
	events.chaincode_id = proto_events.getChaincodeId();
	events.tx_id = proto_events.getTxId();
	events.event_name = proto_events.getEventName();
	events.payload = proto_events.getPayload().toBuffer();
	return events;
}

function decodeReadWriteSets(rw_sets_bytes) {
	var proto_tx_read_write_set = _rwsetProto.TxReadWriteSet.decode(rw_sets_bytes);
	var tx_read_write_set = {};
	tx_read_write_set.data_model = proto_tx_read_write_set.getDataModel();
	if (proto_tx_read_write_set.getDataModel() === _rwsetProto.TxReadWriteSet.DataModel.KV) {
		tx_read_write_set.ns_rwset = [];
		let proto_ns_rwset = proto_tx_read_write_set.getNsRwset();
		for (let i in proto_ns_rwset) {
			let kv_rw_set = {};
			let proto_kv_rw_set = proto_ns_rwset[i];
			kv_rw_set.namespace = proto_kv_rw_set.getNamespace();
			kv_rw_set.rwset = decodeKVRWSet(proto_kv_rw_set.getRwset());
			tx_read_write_set.ns_rwset.push(kv_rw_set);
		}
	} else {
		// not able to decode this type of rw set, return the array of byte[]
		tx_read_write_set.ns_rwset = proto_tx_read_write_set.getNsRwset();
	}

	return tx_read_write_set;
}

function decodeKVRWSet(kv_bytes) {
	var proto_kv_rw_set = _kv_rwsetProto.KVRWSet.decode(kv_bytes);
	var kv_rw_set = {};

	// KV readwrite set has three arrays
	kv_rw_set.reads = [];
	kv_rw_set.range_queries_info = [];
	kv_rw_set.writes = [];

	// build reads
	let reads = kv_rw_set.reads;
	var proto_reads = proto_kv_rw_set.getReads();
	for (let i in proto_reads) {
		reads.push(decodeKVRead(proto_reads[i]));
	}

	// build range_queries_info
	let range_queries_info = kv_rw_set.range_queries_info;
	var proto_range_queries_info = proto_kv_rw_set.getRangeQueriesInfo();
	for (let i in proto_range_queries_info) {
		range_queries_info.push(decodeRangeQueryInfo(proto_range_queries_info[i]));
	}

	// build writes
	let writes = kv_rw_set.writes;
	var proto_writes = proto_kv_rw_set.getWrites();
	for (let i in proto_writes) {
		writes.push(decodeKVWrite(proto_writes[i]));
	}

	return kv_rw_set;
}

function decodeKVRead(proto_kv_read) {
	let kv_read = {};
	kv_read.key = proto_kv_read.getKey();
	let proto_version = proto_kv_read.getVersion();
	if (proto_version) {
		kv_read.version = {};
		kv_read.version.block_num = proto_version.getBlockNum();
		kv_read.version.tx_num = proto_version.getTxNum();
	} else {
		kv_read.version = null;
	}

	return kv_read;
}

function decodeRangeQueryInfo(proto_range_query_info) {
	let range_query_info = {};
	range_query_info.start_key = proto_range_query_info.getStartKey();
	range_query_info.end_key = proto_range_query_info.getEndKey();
	range_query_info.itr_exhausted = proto_range_query_info.getItrExhausted();

	range_query_info.reads_info = {};
	// reads_info is one of QueryReads
	let proto_raw_reads = proto_range_query_info.getRawReads();
	if (proto_raw_reads) {
		range_query_info.reads_info.kv_reads = [];
		for (let i in proto_raw_reads.kv_reads) {
			range_query_info.reads_info.kv_reads.push(proto_raw_reads.kv_reads[i]);
		}
	}
	// or QueryReadsMerkleSummary
	let proto_reads_merkle_hashes = proto_range_query_info.getReadsMerkleHashes();
	if (proto_reads_merkle_hashes) {
		range_query_info.reads_merkle_hashes = {};
		range_query_info.reads_merkle_hashes.max_degree = proto_reads_merkle_hashes.getMaxDegree();
		range_query_info.reads_merkle_hashes.max_level = proto_reads_merkle_hashes.getMaxLevel();
		range_query_info.reads_merkle_hashes.max_level_hashes = proto_reads_merkle_hashes.getMaxLevelHashes();
	}

	return range_query_info;
}

function decodeKVWrite(proto_kv_write) {
	let kv_write = {};
	kv_write.key = proto_kv_write.getKey();
	kv_write.is_delete = proto_kv_write.getIsDelete();
	kv_write.value = proto_kv_write.getValue().toBuffer().toString();

	return kv_write;
}

function decodeResponse(proto_response) {
	if (!proto_response) return null;
	var response = {};
	response.status = proto_response.getStatus();
	response.message = proto_response.getMessage();
	response.payload = proto_response.getPayload().toBuffer().toString();

	return response;
};

// version numbers should not get that big
// so lets just return an Integer (32bits)
function decodeVersion(version_long) {
	var version_string = version_long.toString();
	var version_int = Number.parseInt(version_string);

	return version_int;
}

module.exports = BlockDecoder;
