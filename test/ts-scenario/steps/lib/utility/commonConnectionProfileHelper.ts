/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as path from 'path';

interface Credentials {
	path: string;
}

interface CertificateAuthority {
	name: string;
	url: string;
}

interface Organization {
	mspid: string;
	adminPrivateKeyPEM: Credentials;
	signedCertPEM: Credentials;
	ca: CertificateAuthority;
}

interface Endpoint {
	tlsCACerts: Credentials;
	url: string;
	grpcOptions: Record<string, string>;
}

/**
 * CommonConnectionProfileHelper
 *
 * Utility class for dealing with a common connection profile
 */
export class CommonConnectionProfileHelper {

	protected profile: any;

	/**
	 * Constructor for the CCP class
	 * @param {String} profilePath path to the common connection profile
	 * @param {Boolean} json true if a json profile; false if not
	 */
	constructor(profilePath: string, json: boolean) {
		if (json) {
			this.profile = require(profilePath);
			this._makeJsonPathsAbsolute(this.profile, path.dirname(profilePath));
		} else {
			throw new Error('Only JSON profile currently accepted');
		}
	}

	/**
	 * Check all file paths in the profile and make absolute if required
	 * @param {JSON} parent the JSON format common connection profile
	 * @param {String} rootPath the root path to use when setting absolute
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public _makeJsonPathsAbsolute(parent: any, rootPath: string): void {
		if (parent && typeof parent === 'object') {
			Object.entries(parent as Record<string, unknown>).forEach(([key, value]: [string, any]) => {
				// key is either an array index or object key
				if (key.localeCompare('path') === 0) {
					if (!path.isAbsolute(String(value))) {
						parent[key] = path.join(rootPath, String(value));
					}
				} else {
					this._makeJsonPathsAbsolute(parent[key], rootPath);
				}
			});
		}
	}

	/**
	 * Retrieve the profile
	 */
	public getProfile(): Record<string, unknown> {
		return this.profile;
	}

	/**
	 * Retrieve the channels named in the profile
	 * @return {Object[]} an object array of all channels within the profile
	 */
	public getChannels(): any[] {
		return this.profile.channels;
	}

	/**
	 * Retrieve the channel Object based on name
	 * @param {String} channelName the channel of interest
	 * @return {Object} the channel object
	 */
	public getChannel(channelName: string): any {
		return this.profile.channels[channelName];
	}

	/**
	 * Retrieve all the organizations named in the profile
	 * @return {Object[]} all organizations
	 */
	public getOrganizations(): any[] {
		return this.profile.organizations;
	}

	/**
	 * Retrieve the organization object
	 * @param {String} orgName the organization of interest
	 * @return {Object} the organization object
	 */
	public getOrganization(orgName: string): Organization {
		return this.profile.organizations[orgName];
	}

	/**
	 * Retrieve the organizations included within a channel
	 * @param {String} channelName the channel of interest
	 * @return {String[]} the organizations associated with a channel
	 */
	public getOrganizationsForChannel(channelName: string): Array<string> {
		const channelPeers = Object.keys(this.profile.channels[channelName].peers as Record<string, unknown>);
		const orgs: Record<string, unknown> = this.profile.organizations;

		const channelOrgs: Array<string> = new Array<string>();
		for (const [orgName, org] of Object.entries<any>(orgs)) {
			const orgPeers: Array<string> = org.peers;

			if (orgPeers.filter((peerName: string) => channelPeers.includes(peerName)).length > 0) {
				channelOrgs.push(orgName);
			}
		}
		return channelOrgs;

	}

	/**
	 * Retrieve all the orderers named in the profile
	 * @return {Object[]} all orderers
	 */
	public getOrderers(): any[] {
		return this.profile.orderers;
	}

	/**
	 * Retrieve a named orderer from the profile
	 * @param {String} ordererName the name of the orderer
	 * @return {Object} the named orderer
	 */
	public getOrderer(ordererName: string): Endpoint {
		return this.profile.orderers[ordererName];
	}

	/**
	 * Retrieve all orderers from a named channel
	 * @param {String} channelName the channel of interest
	 * @return {Object[]} orderers for the named channel
	 */
	public getOrderersForChannel(channelName: string): string[] {
		return this.profile.channels[channelName].orderers;
	}

	/**
	 * Retrieve all the certificate authorities named in the profile
	 * @return {Object[]} all certificate authorities
	 */
	public getCertificateAuthorities(): any[] {
		return this.profile.certificateAuthorities;
	}

	/**
	 * Retrieve a certificate authority named in the profile
	 * @param {String} caName the name of the certificate authority
	 * @return {Object} the certificate authority
	 */
	public getCertificateAuthority(caName: string): Endpoint {
		return this.profile.certificateAuthorities[caName];
	}

	/**
	 * Retrieve certificate authorities for a named organization
	 * @param {String} orgName the organization name
	 * @return {Object[]} certificate authorities for the named organization
	 */
	public getCertificateAuthoritiesForOrg(orgName: string): string[] {
		return this.profile.organizations[orgName].certificateAuthorities;
	}

	/**
	 * Retrieve all the peers named in the profile
	 * @return {Object[]} the peers named in the profile
	 */
	public getPeers(): any[] {
		return this.profile.peers;
	}

	/**
	 * Retrieve a named peers from the profile
	 * @param {String} peerName the peer name
	 * @return {Object} the peer object
	 */
	public getPeer(peerName: string): Endpoint {
		return this.profile.peers[peerName];
	}

	/**
	 * Retrieve all peers for an organization from the profile
	 * @param {String} orgName the organization name
	 * @return {Object[]} all peers for the named organization
	 */
	public getPeersForOrganization(orgName: string): any[] {
		return this.profile.organizations[orgName].peers;
	}

	/**
	 * Retrieve all peers for a named channel in the profile
	 * @param {String} channelName the channel name of interest
	 * @return {String[]} the string array of all peer for the channel
	 */
	public getPeersForChannel(channelName: string): string[] {
		return this.profile.channels[channelName].peers;
	}

	/**
	 * check if the CCP is for a TLS network
	 */
	public isTls(): boolean | undefined {
		const peers: any = this.getPeers();
		if (peers) {
			for (const key of Object.keys(peers as Record<string, unknown>)) {
				const peer: any = peers[key];
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call
				return (peer.url).includes('grpcs');
			}
		} else {
			throw new Error('No peers listed in the CCP');
		}
	}
}
