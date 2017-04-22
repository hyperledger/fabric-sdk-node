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
var Policy = require('./Policy.js');

var logger = utils.getLogger('ChannelConfig.js');

var _ccProto = grpc.load(__dirname + '/protos/peer/chaincode.proto').protos;
var _transProto = grpc.load(__dirname + '/protos/peer/transaction.proto').protos;
var _proposalProto = grpc.load(__dirname + '/protos/peer/proposal.proto').protos;
var _responseProto = grpc.load(__dirname + '/protos/peer/proposal_response.proto').protos;
var _queryProto = grpc.load(__dirname + '/protos/peer/query.proto').protos;
var _peerConfigurationProto = grpc.load(__dirname + '/protos/peer/configuration.proto').protos;
var _mspPrProto = grpc.load(__dirname + '/protos/common/msp_principal.proto').common;
var _commonProto = grpc.load(__dirname + '/protos/common/common.proto').common;
var _configtxProto = grpc.load(__dirname + '/protos/common/configtx.proto').common;
var _policiesProto = grpc.load(__dirname + '/protos/common/policies.proto').common;
var _ledgerProto = grpc.load(__dirname + '/protos/common/ledger.proto').common;
var _commonConfigurationProto = grpc.load(__dirname + '/protos/common/configuration.proto').common;
var _ordererConfigurationProto = grpc.load(__dirname + '/protos/orderer/configuration.proto').orderer;
var _abProto = grpc.load(__dirname + '/protos/orderer/ab.proto').orderer;
var _mspConfigProto = grpc.load(__dirname + '/protos/msp/mspconfig.proto').msp;
var _timestampProto = grpc.load(__dirname + '/protos/google/protobuf/timestamp.proto').google.protobuf;
var _identityProto = grpc.load(path.join(__dirname, '/protos/identity.proto')).msp;

const ImplicitMetaPolicy_Rule = {ANY:0, ALL:1, MAJORITY:2};


/**
 * Builds a Protobuf Channel Config which may be used to create hyperledger/fabric channel
 * @class
 */
var ChannelConfig = class {
	/**
	 * Construct an utility object that builds a fabric channel configuration.
	 * This will allow the building of a protobuf ConfigUpdate object
	 * that will be based on the MSPs loaded here using the simplified JSON
	 * definition of a channel.
	 * 	@param {Object[]} msps Array of Member Service Provider objects
	 */
	constructor(msps) {
		if (typeof msps === 'undefined' || msps === null) {
			throw new Error('MSP definitions are required');
		}
		this._msps = msps;
		this._msp_array = [];
		this._msps.forEach((msp, id) => {this._msp_array.push(msp);});
		this._channel = null;
		this._proto_config_update = null;
		this._orderer_addresses = null;
		this._kafka_brokers = null;
	}

	/**
	 * Build a Protobuf ChannelConfigEnvelope based on the input configuration object. Will use the MSPs that
	 * are stored in the 'this' object for building the MSP's of the network endpoints and the policies.
	 * This will allow the sharing of the MSP information for the 'MSP' config values and within policies.
	 * The input configuration JSON will only reference the MSP information and not include it within the
	 * configuration settings.
	 *
	 * @param {Object} config - JSON  The configuration specification.
	 * see the /protos/common/configtx.proto
	 */
	build(config) {
		logger.debug('build - start');
		if (typeof config === 'undefined' || config === null) {
			throw new Error('ChannelConfig definition object is required');
		}
		if (typeof config.channel === 'undefined' || config.channel === null) {
			throw new Error('ChannelConfig "channel" definition object is required');
		}
		if (typeof config.channel.settings === 'undefined' || config.channel.settings === null) {
			throw new Error('ChannelConfig "settings" definition object is required');
		}
		if (typeof config.channel.orderers === 'undefined' || config.channel.orderers === null) {
			throw new Error('ChannelConfig "orderers" definition object is required');
		}
		if (typeof config.channel.peers === 'undefined' || config.channel.peers === null) {
			throw new Error('ChannelConfig "peers" definition object is required');
		}
		if (typeof config.channel.name === 'undefined' || config.channel.name === null) {
			throw new Error('ChannelConfig "name" is required');
		}

		this._channel = config.channel;
		this._orderer_addresses = [];
		this._kafka_brokers = [];

		this.version = this._channel.version;
		if (typeof this.version === 'undefined' || this.version === null) {
			this.version = 0;
		}

		try {
			this._proto_config_update = new _configtxProto.ConfigUpdate();
			this._proto_config_update.setChannelId(this._channel.name);
			this._proto_config_update.setWriteSet(this.buildWriteSetGroup());

			return this._proto_config_update;
		}
		catch(err) {
			logger.error('build -:: %s', err.stack ? err.stack : err);
			throw err;
		};

		logger.debug('build - end');
	}

	buildWriteSetGroup() {
		logger.debug('buildWriteSetGroup - start');
		var write_set_group = new _configtxProto.ConfigGroup();
		write_set_group.setVersion(this.version);

		var proto_order_group = this.buildOrderConfigGroup();
		write_set_group.getGroups().set('Orderer', proto_order_group);
		var proto_application_group = this.buildApplicationConfigGroup();
		write_set_group.getGroups().set('Application', proto_application_group);

		this.buildConfigValue('HashingAlgorithm', 'hashing-algorithm', write_set_group);
		this.buildConfigValue('BlockDataHashingStructure', 'block-data-hashing-structure', write_set_group);

		var proto_orderer_addresses = new _commonConfigurationProto.OrdererAddresses();
		proto_orderer_addresses.setAddresses(this._orderer_addresses);
		logger.debug('buildWriteSetGroup - proto_orderer_addresses :: %j',proto_orderer_addresses.encodeJSON());
		var proto_config_value = new _configtxProto.ConfigValue();
		proto_config_value.setVersion(this.version);
		proto_config_value.setValue(proto_orderer_addresses.toBuffer());
		write_set_group.getValues().set('OrdererAddresses', proto_config_value);

		if(this._channel.policies) {
			this.buildConfigPolicies(write_set_group.getPolicies(), this._channel.policies);
		}

		write_set_group.setModPolicy(this.buildConfigModPolicy(this._channel.mod_policy));

		logger.debug('buildWriteSetGroup - write_set_group :: %j',write_set_group.encodeJSON());
		return write_set_group;
	}

	buildOrderConfigGroup() {
		logger.debug('buildOrderConfigGroup - start');
		var proto_oderer_group = new _configtxProto.ConfigGroup();
		proto_oderer_group.setVersion(this.version);

		this.buildConfigValue('ConsensusType', 'consensus-type', proto_oderer_group);
		this.buildConfigValue('BatchSize', 'batch-size', proto_oderer_group);
		this.buildConfigValue('BatchTimeout', 'batch-timeout', proto_oderer_group);
		this.buildConfigValue('CreationPolicy', 'creation-policy', proto_oderer_group);

		if(Array.isArray(this._channel.orderers.organizations)){
			this.buildConfigGroups(proto_oderer_group.getGroups(), this._channel.orderers.organizations, false);
		}
		else {
			throw new Error('Missing orderers organizations array');
		}

		if(this._channel.orderers.policies) {
			this.buildConfigPolicies(proto_oderer_group.getPolicies(), this._channel.orderers.policies);
		}

		proto_oderer_group.setModPolicy(this.buildConfigModPolicy(this._channel.orderers.mod_policy));

		return proto_oderer_group;
	}

	// builds application group which is really the peers on the channel
	buildApplicationConfigGroup() {
		logger.debug('buildApplicationConfigGroup - start');
		var proto_application_group = new _configtxProto.ConfigGroup();
		proto_application_group.setVersion(this.version);

		// no values

		if(Array.isArray(this._channel.peers.organizations)){
			this.buildConfigGroups(proto_application_group.getGroups(), this._channel.peers.organizations, true);
		}
		else {
			throw new Error('Missing peers organizations array');
		}

		if(this._channel.peers.policies) {
			this.buildConfigPolicies(proto_application_group.getPolicies(), this._channel.peers.policies);
		}

		proto_application_group.setModPolicy(this.buildConfigModPolicy(this._channel.peers.mod_policy));

		return proto_application_group;
	}

	buildConfigGroups(parent_group_groups, groups, find_anchor_peers) {
		logger.debug('buildConfigGroups - start');
		var keys = Object.keys(groups);
		for(var i in keys) {
			var key = keys[i];
			var group = groups[key];
			logger.debug('buildConfigGroups - found %j', group);
			var proto_config_group = this.buildOrganizationGroup(group, find_anchor_peers);
			parent_group_groups.set(group.mspid, proto_config_group);
		}
	}

	buildOrganizationGroup(organization, find_anchor_peers) {
		logger.debug('buildOrganizationGroup - start');
		var proto_config_group = new _configtxProto.ConfigGroup();
		proto_config_group.setVersion(this.version);
		// msp
		if(organization.mspid) {
			let proto_config_value = new _configtxProto.ConfigValue();
			proto_config_value.setVersion(this.version);
			var msp = this._msps.get(organization.mspid);
			if(msp) {
				proto_config_value.setValue(msp.toProtobuf().toBuffer());
			}
			else{
				throw new Error(util.format('MSP %s was not found', organization.mspid));;
			}
			proto_config_group.getValues().set('MSP', proto_config_value);
		}
		else {
			throw new Error('Missing "mspid" value in the organization');
		}
		//anchor peers
		if(find_anchor_peers){
			let proto_config_value = new _configtxProto.ConfigValue();
			proto_config_value.setVersion(this.version);
			var anchor_peers = [];
			var proto_anchor_peers = new _peerConfigurationProto.AnchorPeers();
			if(organization['anchor-peers'] && Array.isArray(organization['anchor-peers'])){
				for(var i in organization['anchor-peers']) {
					var proto_anchor_peer = new _peerConfigurationProto.AnchorPeer();
					let host_port = organization['anchor-peers'][i];
					var host_port_split = host_port.split(':');
					logger.debug('buildOrganizationGroup - found anchor peer ::%s',host_port_split);
					try {
						proto_anchor_peer.setHost(host_port_split[0]);
						let port = Number(host_port_split[1]);
						if(Number.isNaN(port)) throw new Error('port is not a number');
						proto_anchor_peer.setPort(port);
					}
					catch(err) {
						logger.error('buildOrganizationGroup problem with anchor peer address::%s - %s', host_port, err.stack ? err.stack : err);
						throw new Error(util.format('Organization %s has an invalid achor peer address ::%s',organization.mspid,host_port));
					}

					anchor_peers.push(proto_anchor_peer);
				}
				proto_anchor_peers.setAnchorPeers(anchor_peers);
				proto_config_value.setValue(proto_anchor_peers.toBuffer());
			}
			else {
				throw new Error('Missing "anchor-peers" array in peers orgainization definition');
			}
			proto_config_group.getValues().set('AnchorPeers', proto_config_value);
		}
		// must be an orderer organization
		else {
			// for end-point just save them away, need to put these higher in the config
			if(organization['end-points']) {
				logger.debug('buildOrganizationGroup - saving orderers end-point %s',organization['end-points']);
				this._orderer_addresses = this._orderer_addresses.concat(organization['end-points']);
			}
			else {
				throw new Error('Missing "end-points" in orderer organization definition');
			}
			if(organization['kafka-brokers']) {
				var proto_kafka_brokers = new _ordererConfigurationProto.KafkaBrokers();
				proto_kafka_brokers.setBrokers(organization['kafka-brokers']);
				logger.debug('buildChannelGroup - proto_kafka_brokers :: %j',proto_kafka_brokers.encodeJSON());
				let proto_config_value = new _configtxProto.ConfigValue();
				proto_config_value.setVersion(this.version);
				proto_config_value.setValue(proto_kafka_brokers.toBuffer());
				proto_config_group.getValues().set('KafkaBrokers', proto_config_value);
			}
		}

		if(organization.policies) {
			this.buildConfigPolicies(proto_config_group.getPolicies(),organization.policies);
		}
		else {
			throw new Error('Missing "policies" in organization definitions');
		}

		proto_config_group.setModPolicy(this.buildConfigModPolicy(organization.mod_policy));

		return proto_config_group;
	}

	buildConfigValues(values) {
		logger.debug('buildConfigValues - start');
		var proto_values = new Map();
		var keys = Object.keys(values);
		for(var i in keys) {
			var key = keys[i];
			var value = values[key];
			var proto_value = this.buildConfigValue(key, value);
			proto_values.set(key, proto_value);
		}
		return proto_values;
	}

	buildConfigValue(name, config_name, proto_group) {
		var value = this._channel.settings[config_name];
		logger.debug('buildConfigValue - start %s :: %s --> %j',name, config_name, value);
		var proto_config_value = new _configtxProto.ConfigValue();
		proto_config_value.setVersion(this.version);
		switch(name) {
		case 'ConsensusType':
			var proto_consensus_type = new _ordererConfigurationProto.ConsensusType();
			if(!value) value = 'solo';
			proto_consensus_type.setType(value); // string
			proto_config_value.setValue(proto_consensus_type.toBuffer());
			break;
		case 'BatchSize':
			var proto_batch_size = new _ordererConfigurationProto.BatchSize();
			var found_batch_size = false;
			if(!value) 	value = {};
			if(!value['max-message-count']) value['max-message-count'] = 10;
			proto_batch_size.setMaxMessageCount(convert(value['max-message-count'],'max-message-count')); //uint32
			if(!value['absolute-max-bytes']) value['absolute-max-bytes'] = 99 * 1024 * 1024; // 99MB is the recommended value
			proto_batch_size.setAbsoluteMaxBytes(convert(value['absolute-max-bytes'],'absolute-max-bytes')); //uint32
			if(!value['preferred-max-bytes']) value['preferred-max-bytes'] = 512 * 1024; // 512KB is the recommended value
			proto_batch_size.setPreferredMaxBytes(convert(value['preferred-max-bytes'],'preferred-max-bytes')); //uint32
			proto_config_value.setValue(proto_batch_size.toBuffer());
			break;
		case 'BatchTimeout':
			var proto_batch_timeout = new _ordererConfigurationProto.BatchTimeout();
			if(!value) value = '10s';
			proto_batch_timeout.setTimeout(value); //duration string
			proto_config_value.setValue(proto_batch_timeout.toBuffer());
			break;
		case 'ChannelRestrictions':
			var proto_channel_restrictions = new _ordererConfigurationProto.ChannelRestrictions();
			if(value) {
				proto_channel_restrictions.setMaxCount(convert(value,config_name)); //unit64
				proto_config_value.setValue(proto_channel_restrictions.toBuffer());
			}
			break;
		case 'CreationPolicy':
			var proto_creation_policy = new _ordererConfigurationProto.CreationPolicy();
			if(value) {
				proto_creation_policy.setPolicy(value); //string
				proto_config_value.setValue(proto_creation_policy.toBuffer());
			}
			break;
		case 'ChainCreationPolicyNames':
			var proto_chain_creation_policy_names = new _ordererConfigurationProto.ChainCreationPolicyNames();
			if(value  && Array.isArray(value)) {
				proto_chain_creation_policy_names.setNames(value); //string - already a string array
				proto_config_value.setValue(proto_chain_creation_policy_names.toBuffer());
			}
			break;
		case 'HashingAlgorithm':
			var proto_hashing_algorithm = new _commonConfigurationProto.HashingAlgorithm();
			if(!value) value = 'SHA256';
			proto_hashing_algorithm.setName(value);
			proto_config_value.setValue(proto_hashing_algorithm.toBuffer());
			break;
		case 'BlockDataHashingStructure':
			var proto_blockdata_hashing_structure = new _commonConfigurationProto.BlockDataHashingStructure();
			if(!value) value = Math.pow(2, 32) - 1; // required value by the fabric and required on the API
			proto_blockdata_hashing_structure.setWidth(convert(value,config_name)); //uint32
			proto_config_value.setValue(proto_blockdata_hashing_structure.toBuffer());
			break;
		default:
//			logger.debug('loadConfigValue - %s   - value: %s', group_name, config_value.value.value);
		}
		proto_group.getValues().set(name, proto_config_value);

		return ;
	}

	buildConfigPolicies(proto_group_policies, policies) {
		logger.debug('buildConfigPolicies - start');
		var keys = Object.keys(policies);
		for(var i in keys) {
			var key = keys[i];
			var policy = policies[key];
			logger.debug('buildConfigPolicies - found %s :: %j',key, policy);
			var proto_policy = this.buildConfigPolicy(key, policy);
			proto_group_policies.set(key,proto_policy);
		}
		return policies;
	}

	/*
	 * ConfigGroup
	 *     map<string,ConfigPolicy> - policies
	 *         int - version
	 *         Policy - policy
	 *             int - type [enum-0:UNKNOWN, 1:SIGNATURE, 2:MSP, 3:IMPLICIT_META]
	 *             bytes - policy [ImplicitMetaPolicy]
	 *                 string sub_policy
	 *                 Rule - rule [enum-0:ANY, 1:ALL, 2:MAJORITY]
	 *         string - mod_policy
	 */
	buildConfigPolicy(name, policy) {
		logger.debug('buildConfigPolicy - start');
		var proto_policy = new _policiesProto.Policy();

		// IMPLICIT_META policy type
		let threshold = policy.threshold;
		let sub_policy = policy.sub_policy;
		if(!sub_policy) sub_policy = name;//sub policy name will be the same name as parent to simplify the configuration
		if(threshold) {
			logger.debug('buildConfigPolicy - found threshold ::%s',threshold);
			//should be one of ALL, ANY, MAJORITY
			var rule = ImplicitMetaPolicy_Rule[threshold];
			if (!(typeof rule === 'undefined' || rule === null)) {
				var proto_implicit = new _policiesProto.ImplicitMetaPolicy();
				proto_implicit.setSubPolicy(sub_policy);
				proto_implicit.setRule(rule);
				proto_policy.setType(_policiesProto.Policy.PolicyType.IMPLICIT_META);
				proto_policy.setPolicy(proto_implicit.toBuffer());
			}
			else {
				throw new Error('Implicit Rule is not known ::'+ threshold);
			}
		}

		// SIGNATURE policy type
		let n_of = policy.signature;
		if(n_of) {
			logger.debug('buildConfigPolicy - found n_of_signature ::%j',n_of);
			var proto_signature_policy_bytes = Policy.buildPolicy(this._msps_array, n_of);
			proto_policy.setType(_policiesProto.Policy.PolicyType.SIGNATURE);
			proto_policy.setPolicy(proto_signature_policy_bytes);
		}

		//build the ConfigPolicy to return
		var proto_config_policy = new _configtxProto.ConfigPolicy();
		proto_config_policy.setPolicy(proto_policy);
		proto_config_policy.setModPolicy(this.buildConfigModPolicy(policy.mod_policy));
		proto_config_policy.setVersion(this.version);

		return proto_config_policy;
	}

	buildConfigModPolicy(mod_policy) {
		if (typeof mod_policy === 'undefined' || rule === null) {
			return 'Admins'; //default for now
		}
		return mod_policy;
	}
};

function convert(value, setting) {
	if (typeof value === 'undefined' || value === null) {
		throw new Error(util.format('Setting %s is missing', setting));
	}

	if(Number.isInteger(value)) {
		return value;
	}

	let working = value.toLowerCase();
	// K = 1,024
	if(working.endsWith('k')) {
		var pieces = working.split('k');
		var inK = Number(pieces[0]);
		if(Number.isInteger(inK)) {
			return (inK * 1024);
		}
	}

	// M = 1,048,576
	if(working.endsWith('m')) {
		var pieces = working.split('m');
		var inMeg = Number(pieces[0]);
		if(Number.isInteger(inMeg)) {
			return (inMeg * 1024 * 1024);
		}
	}

	// G = 1,073,741,824
	if(working.endsWith('g')) {
		var pieces = working.split('g');
		var inGig = Number(pieces[0]);
		if(Number.isInteger(inGig)) {
			return (inGig * 1024 * 1024 * 1024);
		}
	}

	throw new Error(util.format('Setting %s is not valid value :: %s', setting, value));
}

module.exports = ChannelConfig;
