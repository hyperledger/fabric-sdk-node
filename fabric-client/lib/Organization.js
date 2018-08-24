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

const utils = require('./utils.js');
const logger = utils.getLogger('Organization.js');

/**
 * The Organization class represents an organization in the target blockchain network.
 *
 * @class
 */
const Organization = class {

	/**
	 * Construct a Organization object
	 * @param {string} name - The name of this organization
	 * @param {string} mspid - The mspid of this organization
	 * @returns {Organization} The Organization instance.
	 */
	constructor(name, mspid) {
		logger.debug('Organization.const');
		if (!name) {
			throw new Error('Missing name parameter');
		}
		if (!mspid) {
			throw new Error('Missing mspid parameter');
		}
		this._name = name;
		this._mspid = mspid;
		this._peers = [];
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
	 * Sets the admin private key in PEM format for this organization.
	 */
	setAdminPrivateKey(adminPrivateKeyPEM) {
		this._adminPrivateKeyPEM = adminPrivateKeyPEM;
	}

	/**
	 * Gets the admin private key in PEM format for this organization.
	 */
	getAdminPrivateKey() {
		return this._adminPrivateKeyPEM;
	}

	/**
	 * Sets the admin signing certificate in PEM format for this organization.
	 */
	setAdminCert(adminCertPEM) {
		this._adminCertPEM = adminCertPEM;
	}

	/**
	 * Gets the admin signing certificate in PEM format for this organization.
	 */
	getAdminCert() {
		return this._adminCertPEM;
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {
		let peers = '';
		this._peers.forEach((peer) => {peers = peers.length ? peers + ',' + peer.toString() : peers + peer.toString();});
		let cas = '';
		this._certificateAuthorities.forEach((ca) => {cas = cas.length ? cas + ',' + ca.toString() : cas + ca.toString();});
		return 'Organization : {' +
			'name : ' +  this._name +
			', mspid : ' +  this._mspid +
			', peers : [' +  peers + ']' +
			', certificateAuthorities : [' +  cas + ']' +
		'}';
	}

};

module.exports = Organization;
