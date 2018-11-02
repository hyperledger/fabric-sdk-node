/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const path = require('path');

/**
 * CommonConnectionProfile
 *
 * Utility class for dealing with a common connection profile
 */
class CommonConnectionProfile {

	/**
	 * Constructor for the CCP class
	 * @param {String} profilePath path to the common connection profile
	 * @param {Boolean} json true if a json profile; false if not
	 */
	constructor(profilePath, json) {
		if (json) {
			this.profile = require(profilePath);
			this._makeJsonPathsAbsolute(this.profile, path.dirname(profilePath));
		} else {
			throw new Error('Only JSON profile currently accepted');
		}
	}

	/**
	 * Check all file paths in the profile and make absolute if required
	 * @param {JSON} profile the JSON format common connection profile
	 * @param {String} rootPath the root path to use when setting absolute
	 */
	_makeJsonPathsAbsolute(parent, rootPath) {
		if (parent && typeof parent === 'object') {
			Object.entries(parent).forEach(([key, value]) => {
				// key is either an array index or object key
				if (key.localeCompare('path') === 0) {
					if (!path.isAbsolute(value)) {
						parent[key] = path.join(rootPath, value);
					}
				} else {
					this._makeJsonPathsAbsolute(parent[key], rootPath);
				}
			});
		}
	}

	/**
	 * Retrieve the channels named in the profile
	 * @return {Object[]} an objeect array of all channels within the profile
	 */
	getChannels() {
		return this.profile.channels;
	}

	/**
	 * Retrieve the channel Object based on name
	 * @param {String} channelName the channel of interest
	 * @return {Object} the channel object
	 */
	getChannel(channelName) {
		return this.profile.channels[channelName];
	}

	/**
	 * Retrieve all the organizations named in the profile
	 * @return {Object[]} all organizations
	 */
	getOrganizations() {
		return this.profile.organizations;
	}

	/**
	 * Retrieve the organization object
	 * @param {String} orgName the organization of interest
	 * @return {Object} the organization object
	 */
	getOrganization(orgName) {
		return this.profile.organizations[orgName];
	}

	/**
	 * Retrieve the organizations included within a channel
	 * @param {String} channelName the channel of interest
	 * @return {String[]} the organizations associated with a channel
	 */
	getOrganizationsForChannel(channelName) {
		const channelPeers = Object.keys(this.profile.channels[channelName].peers);
		const orgs = this.profile.organizations;

		const channelOrgs = new Array();
		for (const key in orgs) {
			const org = orgs[key];
			const orgPeers = org.peers;

			if (orgPeers.filter(peerName => channelPeers.includes(peerName)).length > 0) {
				channelOrgs.push(key);
			}
		}
		return channelOrgs;

	}

	/**
	 * Retrieve all the orderers named in the profile
	 * @return {Object[]} all orderers
	 */
	getOrderers() {
		return this.profile.orderers;
	}

	/**
	 * Retrieve a named orderer from the profile
	 * @param {String} ordererName the name of the orderer
	 * @return {Object} the named orderer
	 */
	getOrderer(ordererName) {
		return this.profile.orderers[ordererName];
	}

	/**
	 * Retrieve all orderers from a named channel
	 * @param {String} channelName the channel of interest
	 * @return {Object[]} orderers for the named channel
	 */
	getOrderersForChannel(channelName) {
		return this.profile.channels[channelName].orderers;
	}

	/**
	 * Retrieve all the certificate authorities named in the profile
	 * @return {Object[]} all certificate authorities
	 */
	getCertificateAuthorities() {
		return this.profile.certificateAuthorities;
	}

	/**
	 * Retrieve a certificate authority named in the profile
	 * @param {String} caName the name of the certificate authority
	 * @return {Object} the certifaicate authority
	 */
	getCertificateAuthority(caName) {
		return this.profile.certificateAuthorities[caName];
	}

	/**
	 * Retrieve certificate authorities for a named organization
	 * @param {String} orgName the organization name
	 * @return {Object[]} certificate authorities for the named organization
	 */
	getCertificatAuthoritiesForOrg(orgName) {
		return this.profile.organizations[orgName].certificateAuthorities;
	}

	/**
	 * Retrieve all the peers named in the profile
	 * @return {Object[]} the peers named in the profile
	 */
	getPeers() {
		return this.profile.peers;
	}

	/**
	 * Retrieve a named peers from the profile
	 * @param {String} peerName the peer name
	 * @return {Object} the peer object
	 */
	getPeer(peerName) {
		return this.profile.peers[peerName];
	}

	/**
	 * Retrieve all peers for an organization from the profile
	 * @param {String} orgName the organizartion name
	 * @return {Object[]} all peers for the named organization
	 */
	getPeersForOrganization(orgName) {
		return this.profile.organizations[orgName].peers;
	}

	/**
	 * Retrieve all peers for a named channel in the profile
	 * @param {String} channelName the channel name of interest
	 * @return {String[]} the string array of all peer for the channel
	 */
	getPeersForChannel(channelName) {
		return this.profile.channels[channelName].peers;
	}
}

module.exports = CommonConnectionProfile;
