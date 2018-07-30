/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

var fs = require('fs-extra');
var path = require('path');
var utils = require('../utils');
var Constants = require('../Constants.js');
var Channel = require('../Channel.js');
var Organization = require('../Organization.js');
var CertificateAuthority = require('../CertificateAuthority.js');

var logger = utils.getLogger('NetworkConfig101.js');
const CHANNELS_CONFIG = 'channels';
const ORGS_CONFIG = 'organizations';
const PEERS_CONFIG = 'peers';
const ORDERERS_CONFIG = 'orderers';
const CAS_CONFIG = 'certificateAuthorities';
const TLS_CACERTS = 'tlsCACerts';
const ADMIN_PRIVATE_KEY = 'adminPrivateKey';
const ADMIN_CERT = 'signedCert';
const GRPC_CONNECTION_OPTIONS = 'grpcOptions';
const HTTP_CONNECTION_OPTIONS = 'httpOptions';
const URL = 'url';
const CANAME = 'caName';
const PEM = 'pem';
const PATH = 'path';
const REGISTRAR = 'registrar';
const ENDORSER = 1;
const ORDERER = 2;
const EVENTHUB = 3;
const EVENTREG = 4;
const TYPES = ['unknown', 'endorser', 'orderer', 'eventHub', 'eventReg'];
const REQUEST_TIMEOUT = 'request-timeout';
var ROLES = Constants.NetworkConfig.ROLES;

/**
 * This is an implementation of the [NetworkConfig]{@link module:api.NetworkConfig} API.
 * It will be used to work with the v1.0.1 version of a JSON based network configuration.
 *
 * @class
 * @extends module:api.NetworkConfig
 */
const NetworkConfig_1_0 = class {

	/**
	 * constructor
	 *
	 * @param {Object} network_config - Network Configuration as represented in a JSON object
	 */
	constructor(network_config, client_context) {
		logger.debug('constructor, network_config: ' + JSON.stringify(network_config));
		this._network_config = network_config;
		this._client_context = client_context;
		this._peers = new Map();
		this._channel = new Map();
		this._orderers = new Map();
	}

	mergeSettings(additions) {
		const method = 'mergeSettings';
		logger.debug('%s - additions start',method);
		if(additions && additions._network_config) {
			if(additions._network_config.client) {
				this._network_config.client = additions._network_config.client;
			}
			if(additions._network_config.channels) {
				this._network_config.channels = additions._network_config.channels;
			}
			if(additions._network_config.organizations) {
				this._network_config.organizations = additions._network_config.organizations;
			}
			if(additions._network_config.orderers) {
				this._network_config.orderers = additions._network_config.orderers;
			}
			if(additions._network_config.peers) {
				this._network_config.peers = additions._network_config.peers;
			}
			if(additions._network_config.certificateAuthorities) {
				this._network_config.certificateAuthorities = additions._network_config.certificateAuthorities;
			}
		}
	}

	hasClient() {
		if(this._network_config && this._network_config.client) {
			return true;
		}

		return false;
	}

	getClientConfig() {
		const result = {};
		if(this._network_config && this._network_config.client) {
			const client_config = this._network_config.client;
			for(let setting in client_config) {
				// copy all except credentialStore, special case to handle paths
				if(setting !== 'credentialStore') {
					result[setting] = client_config[setting];
				}
			}
			if(client_config.credentialStore) {
				result.credentialStore = {};
				if(client_config.credentialStore.path) {
					result.credentialStore.path = path.resolve(client_config.credentialStore.path);
				}
				for(let setting in client_config.credentialStore) {
					if(setting !== 'cryptoStore' && setting != 'path') {
						result.credentialStore[setting] = client_config.credentialStore[setting];
					}
				}
				if(client_config.credentialStore.cryptoStore) {
					result.credentialStore.cryptoStore = {};
					if(client_config.credentialStore.cryptoStore.path) {
						result.credentialStore.cryptoStore.path = path.resolve(client_config.credentialStore.cryptoStore.path);
					}
					for(let setting in client_config.credentialStore.cryptoStore) {
						if(setting != 'path') {
							result.credentialStore.cryptoStore[setting] = client_config.credentialStore.cryptoStore[setting];
						}
					}
				}
			}
			if(result.organization) {
				if(this._network_config.organizations && this._network_config.organizations[result.organization]) {
					result.mspid = this._network_config.organizations[result.organization].mspid;
				}
			}
			if(client_config.tlsClient) {
				if(client_config.tlsClient.clientCert && client_config.tlsClient.clientKey);
			}
		}

		return result;
	}

	getChannel(name) {
		const method = 'getChannel';
		logger.debug('%s - name %s',method, name);
		let channel = null;
		if(name && this._network_config && this._network_config[CHANNELS_CONFIG]) {
			const channel_config = this._network_config[CHANNELS_CONFIG][name];
			if(channel_config) {
				channel = new Channel(name, this._client_context);
				this._addPeersToChannel(channel);
				this._addOrderersToChannel(channel);
			}
		}

		return channel;
	}

	getPeer(name, channel_org) {
		const method = 'getPeer';
		logger.debug('%s - name %s, channel_org: %j',method, name, channel_org);
		let peer = this._peers.get(name);
		if(!peer && this._network_config && this._network_config[PEERS_CONFIG]) {
			const peer_config = this._network_config[PEERS_CONFIG][name];
			if(peer_config) {
				const opts = {name: name};
				opts.pem = getTLSCACert(peer_config);
				Object.assign(opts, peer_config[GRPC_CONNECTION_OPTIONS]);
				this.addTimeout(opts, ENDORSER);
				peer = this._client_context.newPeer(peer_config[URL], opts);
				this._peers.set(name, peer);
			}
		}

		return peer;
	}

	addTimeout(opts, type) {
		const method = 'addTimeout';
		if(opts && opts[REQUEST_TIMEOUT]) {
			logger.debug('%s - request-timeout exist',method);
			return;
		}
		if(opts && this.hasClient() &&
		this._network_config.client.connection &&
		this._network_config.client.connection.timeout) {
			const timeouts = this._network_config.client.connection.timeout;
			let timeout = '';
			if(type === ENDORSER && timeouts.peer && timeouts.peer.endorser) {
				timeout = timeouts.peer.endorser;
			} else if(type === ORDERER && timeouts.orderer) {
				timeout = timeouts.orderer;
			} else if(type === EVENTHUB && timeouts.peer && timeouts.peer.eventHub) {
				timeout = timeouts.peer.eventHub;
			} else if(type === EVENTREG && timeouts.peer && timeouts.peer.eventReg) {
				timeout = timeouts.peer.eventReg;
			}

			if(!isNaN(timeout)) {
				timeout = timeout * 1000;
				opts[REQUEST_TIMEOUT] = timeout;
			} else {
				logger.warn('%s - timeout value is not a number for the %s : %s',method, TYPES[type], timeout);
			}
		}
	}

	getOrderer(name) {
		const method = 'getOrderer';
		logger.debug('%s - name %s',method, name);
		let orderer = null;
		if(this._network_config && this._network_config[ORDERERS_CONFIG]) {
			const orderer_config = this._network_config[ORDERERS_CONFIG][name];
			if(orderer_config) {
				const opts = {name: name};
				opts.pem = getTLSCACert(orderer_config);
				Object.assign(opts, orderer_config[GRPC_CONNECTION_OPTIONS]);
				this.addTimeout(opts, ORDERER);
				orderer = this._client_context.newOrderer(orderer_config[URL], opts);
			}
		}

		return orderer;
	}

	getOrganizationByMspId(mspid, only_client) {
		const method = 'getOrganization';
		logger.debug('%s - mspid %s',method, mspid);
		if(mspid && this._network_config && this._network_config[ORGS_CONFIG]) {
			for(let name in this._network_config[ORGS_CONFIG]) {
				const organization_config = this._network_config[ORGS_CONFIG][name];
				if(organization_config.mspid === mspid) {
					return this.getOrganization(name, only_client);
				}
			}
		}
	}
	getOrganization(name, only_client) {
		const method = 'getOrganization';
		logger.debug('%s - name %s',method, name);
		let organization = null;
		if(name && this._network_config && this._network_config[ORGS_CONFIG]) {
			const organization_config = this._network_config[ORGS_CONFIG][name];
			if(organization_config) {
				organization = new Organization(name, organization_config.mspid);
				if(organization_config[PEERS_CONFIG] && !only_client) {
					for(let i in organization_config[PEERS_CONFIG]) {
						const peer_name = organization_config[PEERS_CONFIG][i];
						const peer = this.getPeer(peer_name);
						if(peer) {
							organization.addPeer(peer);
						}
					}
				}
				if(organization_config[CAS_CONFIG]) {
					for(let i in organization_config[CAS_CONFIG]) {
						const ca_name = organization_config[CAS_CONFIG][i];
						const ca = this.getCertificateAuthority(ca_name);
						if(ca) organization.addCertificateAuthority(ca);
					}
				}
				if(organization_config[ADMIN_PRIVATE_KEY]) {
					const key = getPEMfromConfig(organization_config[ADMIN_PRIVATE_KEY]);
					organization.setAdminPrivateKey(key);
				}
				if(organization_config[ADMIN_CERT]) {
					const cert = getPEMfromConfig(organization_config[ADMIN_CERT]);
					organization.setAdminCert(cert);
				}
			}
		}

		return organization;
	}

	getOrganizations() {
		const method = 'getOrganizations';
		logger.debug('%s - start',method);
		const organizations = [];
		if(this._network_config && this._network_config[ORGS_CONFIG]) {
			for(let organization_name in  this._network_config[ORGS_CONFIG]) {
				const organization = this.getOrganization(organization_name);
				organizations.push(organization);
			}
		}

		return organizations;
	}

	getCertificateAuthority(name) {
		const method = 'getCertificateAuthority';
		logger.debug('%s - name %s',method, name);
		let certificateAuthority = null;
		if(name && this._network_config && this._network_config[CAS_CONFIG]) {
			const certificateAuthority_config = this._network_config[CAS_CONFIG][name];
			if(certificateAuthority_config) {
				certificateAuthority = new CertificateAuthority(
					name,
					certificateAuthority_config[CANAME],
					certificateAuthority_config[URL],
					certificateAuthority_config[HTTP_CONNECTION_OPTIONS],
					getTLSCACert(certificateAuthority_config),
					certificateAuthority_config[REGISTRAR]
				);
			}
		}

		return certificateAuthority;
	}

	/*
	 * Internal method to add orderer instances to a channel as defined
	 * by the network configuration
	 */
	_addOrderersToChannel(channel) {
		// get the organization list for this channel
		if(this._network_config &&
			this._network_config[CHANNELS_CONFIG] &&
			this._network_config[CHANNELS_CONFIG][channel.getName()] ) {
			let orderer_names = this._network_config[CHANNELS_CONFIG][channel.getName()][ORDERERS_CONFIG];
			if(Array.isArray(orderer_names)) for(let i in orderer_names){
				const orderer_name = orderer_names[i];
				const orderer = this.getOrderer(orderer_name);
				if(orderer) channel.addOrderer(orderer);
			}
		}
	}

	/*
	 * Internal method to configure a channel as defined
	 * by the network configuration
	 */
	_addPeersToChannel(channel) {
		// get the organization list for this channel
		if(this._network_config &&
			this._network_config[CHANNELS_CONFIG] &&
			this._network_config[CHANNELS_CONFIG][channel.getName()] ) {
			let channel_peers = this._network_config[CHANNELS_CONFIG][channel.getName()][PEERS_CONFIG];
			if(channel_peers) for(let peer_name in channel_peers) {
				const channel_peer = channel_peers[peer_name];
				const peer = this.getPeer(peer_name);
				const roles = {};
				for(let i in ROLES) {
					if(typeof channel_peer[ROLES[i]] === 'boolean') {
						roles[ROLES[i]] = channel_peer[ROLES[i]];
					}
				}
				if(peer) {
					const org_name = this._getOrganizationForPeer(peer_name);
					const mspid = this._getMspIdForOrganization(org_name);
					logger.debug('_addPeersToChannel - %s - %s', peer.getName(), peer.getUrl());
					channel.addPeer(peer, mspid, roles);
				}
			}
		}

	}

	/*
	 * Internal utility method to get the organization the peer belongs
	 */
	_getOrganizationForPeer(peer_name) {
		if(this._network_config && this._network_config[ORGS_CONFIG]) {
			for(let organization_name in  this._network_config[ORGS_CONFIG]) {
				let organization = this.getOrganization(organization_name);
				for(let i in organization._peers) {
					if(peer_name === organization._peers[i].getName()) {
						return organization_name;
					}
				}
			}
		}

		return null;
	}

	/*
	 * Internal method to get the MSP id for an organization nam
	 */
	_getMspIdForOrganization(org_name) {
		if(this._network_config && this._network_config[ORGS_CONFIG]) {
			let organization = this.getOrganization(org_name);
			if(organization) {
				return organization.getMspid();
			}
		}

		return null;
	}
};

function getTLSCACert(config) {
	if(config && config[TLS_CACERTS]) {
		return getPEMfromConfig(config[TLS_CACERTS]);
	}
	return null;
}

function getPEMfromConfig(config) {
	let result = null;
	if(config) {
		if(config[PEM]) {
			// cert value is directly in the configuration
			result = config[PEM];
		} else if(config[PATH]) {
			// cert value is in a file
			result = readFileSync(config[PATH]);
			result = utils.normalizeX509(result);
		}
	}

	return result;
}

function readFileSync(config_path) {
	try {
		let config_loc = path.resolve(config_path);
		let data = fs.readFileSync(config_loc);
		return Buffer.from(data).toString();
	} catch(err) {
		logger.error('NetworkConfig101 - problem reading the PEM file :: ' + err);
		throw err;
	}
}

module.exports = NetworkConfig_1_0;
