/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'Channel';

const EventService = require('./EventService.js');
const DiscoveryService = require('./DiscoveryService.js');
const Endorsement = require('./Endorsement.js');
const Commit = require('./Commit.js');
const Query = require('./Query.js');
const fabproto6 = require('fabric-protos');
const {checkParameter, getLogger} = require('./Utils.js');

const logger = getLogger(TYPE);

/**
 * Channels provide data isolation for a set of participating organizations.
 * <br><br>
 * A Channel object captures the settings needed to interact with a fabric network in the
 * context of a channel. These settings including the list of participating organizations,
 * represented by instances of Membership Service Providers (MSP), endorsers,
 * and committers.
 *
 * @class
 */
const Channel = class {

	/**
	 * Returns a new instance of the Channel class.
	 *
	 * @param {string} name - Name to identify the channel. This value is used
	 *  as the identifier of the channel when making channel-aware requests
	 *  with the fabric, such as invoking chaincodes to endorse transactions.
	 *  The naming of channels is enforced by the ordering service and must
	 *  be unique within the fabric network. A channel name in fabric network
	 *  is subject to a pattern revealed in the configuration setting
	 *  <code>channel-name-regx-checker</code>.
	 * @param {Client} client - The Client instance.
	 */
	constructor(name = checkParameter('name'), client = checkParameter('client')) {
		const method = `${TYPE}.constructor[${name}]`;
		logger.debug('%s - start', method);
		this.type = TYPE;

		const channelNameRegxChecker = client.getConfigSetting('channel-name-regx-checker');
		if (channelNameRegxChecker) {
			const {pattern, flags} = channelNameRegxChecker;
			const namePattern = new RegExp(pattern, flags);
			if (name.match(namePattern)) {
				logger.debug('%s - channel name is good %s', method, name);
			} else {
				throw new Error(`Failed to create Channel. channel name should match Regex ${namePattern}, but got ${name}`);
			}
		}

		this.name = name;
		this.client = client;
		this.endorsers = new Map();
		this.committers = new Map();
		this.msps = new Map();

		logger.debug(`Constructed Channel instance: name - ${this.name}`);
	}

	/**
	 * Close the service connections of all assigned endorsers, committers,
	 * channel event hubs, and channel discovery.
	 */
	close() {
		const method = `close[${this.name}]`;
		logger.debug(`${method} - closing connections`);
		this.endorsers.forEach((endorser) => {
			endorser.disconnect(); // TODO how to handle a shared endorser ???
		});
		this.committers.forEach((committer) => {
			committer.disconnect();
		});
	}

	/**
	 * Gets an Endorsement instance for this channel.
	 * @param {string} chaincodeId
	 */
	newEndorsement(chaincodeId = checkParameter('chaincodeId')) {
		const method = `newEndorsement[${this.name}]`;
		logger.debug(`${method} - start`);

		return new Endorsement(chaincodeId, this);
	}

	/**
	 * Gets a Query instance for this channel.
	 * @param {string} chaincodeId
	 */
	newQuery(chaincodeId = checkParameter('chaincodeId')) {
		const method = `newQuery[${this.name}]`;
		logger.debug(`${method} - start`);

		return new Query(chaincodeId, this);
	}

	/**
	 * Gets a Commit instance for this channel.
	 * @param {string} chaincodeId
	 */
	newCommit(chaincodeId = checkParameter('chaincodeId')) {
		const method = `newCommit[${this.name}]`;
		logger.debug(`${method} - start`);

		return new Commit(chaincodeId, this);
	}

	/**
	 * Returns a new {@link EventService} instance
	 *
	 * @param {string} name - The name of this event service.
	 */
	newEventService(name = checkParameter('name')) {
		const method = `newEventService[${this.name}]`;
		logger.debug(`${method} - start`);

		const eventService = new EventService(name, this);

		return eventService;
	}

	/**
	 * Returns a new {@link DiscoveryService} instance
	 *
	 * @param {string} name - The name of this discovery service.
	 */
	newDiscoveryService(name = checkParameter('name')) {
		const method = `newDiscoveryService[${this.name}]`;
		logger.debug(`${method} - start`);
		const discoveryService = new DiscoveryService(name, this);

		return discoveryService;
	}

	/**
	 * @typedef {Object} MspConfig
	 * @property {string} id - The identifier for this MSP, Typically the
	 *  organization name.
	 * @property {string} name - The name for this MSP, Typically the
	 *  organization name. To avoid confusion the name and ID should be
	 *  the same. This will be key to finding this MSP configuration.
	 * @property {string[]} organizationalUnitIdentifiers
	 * @property {string[]} rootCerts - List of root certificates trusted by
	 *  this MSP. They are used upon certificate validation.
	 * @property {string[]} intermediateCerts - List of intermediate
	 *  certificates trusted by this MSP. They are used upon certificate
	 *  validation as follows:
	 *     Validation attempts to build a path from the certificate to be
	 *     validated (which is at one end of the path) and one of the certs
	 *     in the RootCerts field (which is at the other end of the path).
	 *     If the path is longer than 2, certificates in the middle are
	 *     searched within the Intermediate Certificates pool.
	 * @property {string} admins - Identity denoting the administrator
	 *  of this MSP
	 * @property {string} tlsRootCerts - TLS root certificates
	 *  trusted by this MSP
	 * @property {string} tlsIntermediateCerts - TLS intermediate certificates
	 *  trusted by this MSP
	 */

	/**
	 * Get an array of msp names (ids) from the MSP's for this channel
	 * @returns {string[]} Array of IDs representing the channel's participating
	 *  organizations
	 */
	getMspids() {
		const method = `getMspids[${this.name}]`;
		logger.debug(`${method} - start`);

		const ids = [];
		for (const msp of this.msps.values()) {
			ids.push(msp.id);
		}

		return ids;
	}

	/**
	 *  Use this method to get {@link MspConfig} object
	 *  for the id provided.
	 *
	 * @returns {MspConfig} The MSP JSON object
	 */
	getMsp(id = checkParameter('id')) {
		logger.debug(`getMsp[${this.name}] - start id:${id}`);

		return this.msps.get(id);
	}

	/**
	 * Remove a MSP from this channel's list.
	 * @param {string} id - The id of the MSP to remove
	 * @return {boolean} true if able to remove from the list
	 */
	removeMsp(id = checkParameter('id')) {
		logger.debug(`removeMsp[${this.name}] - start`);

		return this.msps.delete(id);
	}

	/**
	 * Add a MSP configuration to this channel
	 * @param {MspConfig} msp - The MSP configuration to add to this Channel
	 * @param {boolean} replace - If a MSP config has already been added to
	 *  this channel then replace it with this new configuration.
	 */
	addMsp(msp = checkParameter('msp'), replace) {
		const method = `addMsp[${this.name}]`;
		logger.debug(`${method} - start`);
		if (!msp.id) {
			throw Error('MSP does not have an id');
		}
		const check = this.msps.get(msp.id);
		if (check) {
			if (replace) {
				logger.debug(`${method} - removing existing MSP  --name: ${msp.id}`);
				this.removeMsp(check.id);
			} else {
				const error = new Error(`MSP ${msp.id} already exists`);
				logger.error(`${method} - error:${error.message}`);
				throw error;
			}
		}
		logger.debug(`${method} - adding a new MSP  --name: ${msp.id}`);
		this.msps.set(msp.id, msp);

		return this;
	}

	/**
	 * Add the endorser object to the channel object. A channel object can be optionally
	 * configured with a list of endorser objects, which will be used when calling certain
	 * methods such as [sendInstantiateProposal()]{@link Channel#sendInstantiateProposal},
	 * [sendUpgradeProposal()]{@link Channel#sendUpgradeProposal},
	 * [sendTransactionProposal]{@link Channel#sendTransactionProposal}.
	 *
	 * @param {Endorser} endorser - An instance of the Endorser class
	 * @param {boolean} replace - If a endorser exist with the same name, replace
	 *  with this one.
	 */
	addEndorser(endorser = checkParameter('endorser'), replace) {
		const method = `addEndorser[${this.name}]`;
		logger.debug(`${method} - start`);
		if (!endorser.name) {
			throw Error('Endorser does not have a name');
		}
		if (!(endorser.type === 'Endorser')) {
			throw Error('Missing valid endorser instance');
		}
		if (!endorser.isConnectable()) {
			throw Error('Endorser must be connectable');
		}
		const name = endorser.name;
		const check = this.endorsers.get(name);
		if (check) {
			if (replace) {
				logger.debug(`${method} - removing existing Endorser  --name: ${check.name}`);
				this.removeEndorser(check);
			} else {
				const error = new Error(`Endorser ${name} already exists`);
				logger.error(error.message);
				throw error;
			}
		}
		logger.debug(`${method} - adding a new Endorser  --name: ${name}`);
		this.endorsers.set(name, endorser);

		return this;
	}

	/**
	 * Remove the endorser object in the channel object's list of endorsers.
	 * Closes the endorser's endorsement and event service connections.
	 *
	 * @param {Endorser} endorser - An instance of the Endorser class.
	 * @return {boolean} true if able to remove from the list
	 */
	removeEndorser(endorser = checkParameter('endorser')) {
		const method = `removeEndorser[${this.name}]`;
		logger.debug(`${method} - start`);
		if (!(endorser.type === 'Endorser')) {
			throw Error('Missing valid endorser instance');
		}

		return this.endorsers.delete(endorser.name);
	}

	/**
	 * This method will return a {@link Endorser}.
	 *
	 * @param {string} name - The name of the endorser assigned to this channel
	 * @returns {Endorser} The Endorser instance
	 */
	getEndorser(name = checkParameter('name')) {
		const method = `getEndorser[${this.name}]`;
		logger.debug(`${method} - start`);
		return this.endorsers.get(name);
	}

	/**
	 * Will return an array of {@link Endorser} instances that have been
	 * assigned to this channel instance. Include a MSPID to only return endorsers
	 * in a specific organization.
	 *
	 * @param {string} [mspid] - Optional. The mspid of the endorsers to return
	 * @return {Endorser[]} the list of {@link Endorser}s.
	 */
	getEndorsers(mspid) {
		const method = `getEndorsers[${this.name}]`;
		logger.debug(`${method} - start`);

		return Channel._getServiceEndpoints(this.endorsers.values(), 'Endorser', mspid);
	}

	/**
	 * Add the committer object to the channel object
	 *
	 * @param {Committer} committer - An instance of the Committer class.
	 * @param {boolean} replace - If an committer exist with the same name, replace
	 *  with this one.
	 */
	addCommitter(committer = checkParameter('committer'), replace) {
		const method = `addCommitter[${this.name}]`;
		logger.debug(`${method} - start`);
		if (!committer.name) {
			throw Error('Committer does not have a name');
		}
		if (!(committer.type === 'Committer')) {
			throw Error('Missing valid committer instance');
		}
		if (!committer.isConnectable()) {
			throw Error('Committer must be connectable');
		}
		const name = committer.name;
		const check = this.committers.get(name);
		if (check) {
			if (replace) {
				logger.debug(`${method} - removing existing Committer  --name: ${check.name}`);
				this.removeCommitter(check);
			} else {
				const error = new Error(`Committer ${name} already exists`);
				logger.error(`${method} - error::${error.message}`);
				throw error;
			}
		}
		logger.debug(`${method} - adding a new Committer  --name: ${name}`);
		this.committers.set(name, committer);

		return this;
	}

	/**
	 * Remove the committer object from channel object's list of committers.
	 * Closes the committer before removal.
	 *
	 * @param {Committer} committer - An instance of the Committer class.
	 * @return {boolean} true if able to remove from the list
	 */
	removeCommitter(committer = checkParameter('committer')) {
		const method = `removeCommitter[${this.name}]`;
		logger.debug(`${method} - start`);
		if (!(committer.type === 'Committer')) {
			throw Error('Missing valid committer instance');
		}
		return this.committers.delete(committer.name);
	}

	/**
	 * This method will return a {@link Committer} instance if assigned to this
	 * channel. Endorsers that have been created by the {@link Client#newCommitter}
	 * method and then added to this channel may be reference by the url if no
	 * name was provided in the options during the create.
	 *
	 * @param {string} name - The name or url of the committer
	 * @returns {Committer} The Committer instance.
	 */
	getCommitter(name = checkParameter('name')) {
		const method = `getCommitter[${this.name}]`;
		logger.debug(`${method} - start`);
		return this.committers.get(name);
	}

	/**
	 * Will return an array of {@link Committer} instances that have been
	 * assigned to this channel instance. Include a MSPID to only return committers
	 * in a specific organization.
	 *
	 * @param {string} [mspid] - Optional. The mspid of the endorsers to return
	 * @return {Committer[]} the list of {@link Committer}s.
	 */
	getCommitters(mspid) {
		const method = `getCommitters[${this.name}]`;
		logger.debug(`${method} - start`);

		return Channel._getServiceEndpoints(this.committers.values(), 'Committer', mspid);
	}

	static _getServiceEndpoints(remotes, type, mspid) {
		const method = '_getServiceEndpoints';
		logger.debug(`${method} - start - ${mspid}`);
		const results = [];
		for (const remote of remotes) {
			if (mspid) {
				if (remote.mspid === mspid) {
					results.push(remote);
					logger.debug(`${method} - ${type} mspid matched, added ${remote.name} connected: ${remote.connected}`);
				} else {
					logger.debug(`${method} - ${type} mspid not matched, not added ${remote.name} - ${remote.mspid}`);
				}
			} else {
				results.push(remote);
				logger.debug(`${method} - ${type} added ${remote.name} connected: ${remote.connected}`);
			}
		}

		return results;
	}

	/*
	 * Internal utility method to get a list of Committer objects
	 * Throws an Error if no committers are found
	 */
	getTargetCommitters(targets = checkParameter('targets')) {
		const method = `getTargetCommitters[${this.name}]`;

		return this._getTargets(targets, this.committers, 'Committer', method);
	}

	/*
	 * utility method to decide on the targets for requests
	 * Returns an array of one or more {@link Endorsers}.
	 * Throws an Error if no targets are found.
	 */
	getTargetEndorsers(targets = checkParameter('targets')) {
		const method = `getTargetEndorsers[${this.name}]`;

		return this._getTargets(targets, this.endorsers, 'Endorser', method);
	}

	_getTargets(targets, this_list, type, method) {
		logger.debug(`${method} - start`);
		if (!Array.isArray(targets)) {
			throw Error('Targets must be an array');
		}

		const list = [];
		for (const target of targets) {
			if (typeof target === 'string') {
				const found = this_list.get(target);
				if (!found) {
					throw Error(`${type} named ${target} not found`);
				}
				list.push(found);
			} else if (target && target.type === type) {
				list.push(target);
			} else {
				throw Error(`Target ${type} is not valid`);
			}
		}

		return list;
	}

	/*
	 * This function will build a common channel header
	 */
	buildChannelHeader(type = checkParameter('type'), chaincode_id = checkParameter('chaincode_id'), tx_id = checkParameter('tx_id')) {
		const method = `buildChannelHeader[${this.name}]`;
		logger.debug(`${method} - start - type ${type} chaincode_id ${chaincode_id} tx_id ${tx_id}`);

		const chaincodeID = fabproto6.protos.ChaincodeID.create({
			name: chaincode_id
		});

		logger.debug('%s - chaincodeID %j', method, chaincodeID);

		let fields = {
			chaincode_id: chaincodeID
		};

		let check = fabproto6.protos.ChaincodeHeaderExtension.verify(fields);
		if (check) {
			logger.error('%s - channel header is not valid =>%s<=', method, check);
			throw Error(`Not able to build channel header ${check}`);
		}

		const chaincodeHeaderExtension = fabproto6.protos.ChaincodeHeaderExtension.create(fields);
		const chaincodeHeaderExtensionBuf = fabproto6.protos.ChaincodeHeaderExtension.encode(chaincodeHeaderExtension).finish();

		logger.debug('%s - ChaincodeHeaderExtension %j', method, chaincodeHeaderExtensionBuf);

		fields = {
			type: type,
			version: 1,
			channel_id: this.name,
			tx_id: tx_id,
			extension: chaincodeHeaderExtensionBuf,
			timestamp: buildCurrentTimestamp(),
			tls_cert_hash: this.client.getClientCertHash()
		};

		check = fabproto6.common.ChannelHeader.verify(fields);
		if (check) {
			logger.error('%s - channel header is not valid =>%s<=', method, check);
			throw Error(`Not able to build channel header ${check}`);
		}

		const channelHeader = fabproto6.common.ChannelHeader.create(fields);
		const channelHeaderBuf = fabproto6.common.ChannelHeader.encode(channelHeader).finish();

		return channelHeaderBuf;
	}

	/**
	 * return a printable representation of this channel object
	 */
	toString() {
		const committers = [];
		for (const committer of this.getCommitters()) {
			committers.push(committer.toString());
		}

		const endorsers = [];
		for (const endorser of this.getEndorsers()) {
			endorsers.push(endorser.toString());
		}

		const state = {
			name: this.name,
			committers: committers.length > 0 ? committers : 'N/A',
			endorsers: endorsers.length > 0 ? endorsers : 'N/A'
		};

		return JSON.stringify(state).toString();
	}
};

function buildCurrentTimestamp() {
	const method = `buildCurrentTimestamp[${this.name}]`;
	logger.debug(`${method} - start`);
	const now = new Date();
	const seconds = parseInt(now.getTime() / 1000);
	const nanos = (now.getTime() % 1000) * 1000000;
	logger.debug('%s - seconds %s nanos %s', method, seconds, nanos);
	const timestamp = fabproto6.google.protobuf.Timestamp.create({
		seconds: seconds,
		nanos: nanos
	});

	return timestamp;
}

module.exports = Channel;
