/*
 Copyright 2017 IBM All Rights Reserved.

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

var utils = require('./utils.js');
var Constants = require('./Constants.js');
const ChannelEventHub = require('./ChannelEventHub');
var logger = utils.getLogger('Organization.js');

/**
 * The Organization class represents an organization in the target blockchain network.
 *
 * @class
 */
var Organization = class {

	/**
	 * Construct a Organization object
	 * @param {string} name - The name of this organization
	 * @param {string} mspid - The mspid of this organization
	 * @returns {Organization} The Organization instance.
	 */
	constructor(name, mspid) {
		logger.debug('Organization.const ');
		if (typeof name === 'undefined' || name === null) {
			throw new Error('Missing name parameter');
		}
		if (typeof mspid === 'undefined' || mspid === null) {
			throw new Error('Missing mspid parameter');
		}
		this._name = name;
		this._mspid = mspid;
		this._peers = [];
		this._event_hubs = [];
		this._certificateAuthorities = [];
		this._adminPrivateKeyPEM = null;
		this._adminCertPEM = null;
	}

	/**
	 * Gets the name of this organization
	 *
	 * @returns {string} The name of this organization
	 */
	getName() {
		return this._name;
	}

	/**
	 * Gets the MSPID of this organization
	 *
	 * @returns {string} The mspid of this organization
	 */
	getMspid() {
		return this._mspid;
	}

	/**
	 * Add a {@link Peer} to this organization
	 *
	 * @param {Peer} peer - The peer instance to add to this organizations list of peers
	 */
	addPeer(peer) {
		this._peers.push(peer);
	}

	/**
	 * Gets the list of this organizations {@link Peer}
	 *
	 * @returns [{Peer}] An array of {@link Peer} objects
	 */
	getPeers() {
		return this._peers;
	}

	/**
	 * Add a {@link EventHub} to this organizations
	 *
	 * @param {EventHub} event_hub - The event hub instance to add to this
	 *        organization's list of event hubs
	 */
	addEventHub(event_hub) {
		this._event_hubs.push(event_hub);
	}

	/**
	 * Gets the list of this organization's {@link EventHub}
	 *
	 * @returns [{EventHub}] An array of {@link EventHub} objects
	 */
	getEventHubs() {
		return this._event_hubs;
	}

	/**
	 * Gets the list of this organization's {@link ChannelEventHub} as undefined
	 * by the 'endorsingPeer' setting on the peers defined in the channel that
	 * are in this orgranization.
	 *
	 * @param {Channel} channel - The {@link Channel} the channel instance that
	 *        the peers that are defined as channel event hubs are associated.
	 * @returns [{ChannelEventHub}] An array of {@link ChannelEventHub} objects
	 */
	getChannelEventHubs(channel) {
		const _channel_event_hubs = [];
		for(let peer of this._peers) {
			if(peer.isInRole(Constants.NetworkConfig.EVENT_SOURCE_ROLE)) {
				let channel_event_hub = new ChannelEventHub(channel, peer);
				_channel_event_hubs.push(channel_event_hub);
			}
		}
		return _channel_event_hubs;
	}

	/**
	 * Add a {@link CertificateAuthority} to this organization
	 *
	 * @param {CertificateAuthority} certificateAuthority - The CertificateAuthority
	 *          instance to add to this organizations list of CertificateAuthorities
	 */
	addCertificateAuthority(certificateAuthority) {
		this._certificateAuthorities.push(certificateAuthority);
	}

	/**
	 * Gets the list of this CertificateAuthorities {@link CertificateAuthority}
	 *
	 * @returns [{CertificateAuthority}] An array of {@link CertificateAuthority} objects
	 */
	getCertificateAuthorities() {
		return this._certificateAuthorities;
	}

	/**
	 * Gets the admin private key in PEM format for this organization.
	 */
	getAdminPrivateKey() {
		return this._adminPrivateKeyPEM;
	}
	/**
	 * Sets the admin private key in PEM format for this organization.
	 */
	setAdminPrivateKey(adminPrivateKeyPEM) {
		this._adminPrivateKeyPEM = adminPrivateKeyPEM;
	}
	/**
	 * Gets the admin signing certificate in PEM format for this organization.
	 */
	getAdminCert() {
		return this._adminCertPEM;
	}
	/**
	 * Sets the admin signing certificate in PEM format for this organization.
	 */
	setAdminCert(adminCertPEM) {
		this._adminCertPEM = adminCertPEM;
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {
		var peers = '';
		this._peers.forEach((peer) => {peers = peers + peer.toString() + ',';});
		var ehs = '';
		this._event_hubs.forEach((event_hub) => {ehs = ehs + event_hub.toString() + ',';});
		var cas = '';
		this._certificateAuthorities.forEach((ca) => {cas = cas + ca.toString() + ',';});
		return ' Organization : {' +
			'name : ' +  this._name +
			', mspid : ' +  this._mspid +
			', peers : [' +  peers + ']' +
			', event hubs : [' +  ehs + ']' +
			', certificateAuthorities : [' +  cas + ']' +
		'}';
	}

};

module.exports = Organization;
