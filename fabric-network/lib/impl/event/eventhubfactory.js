/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const logger = require('../../logger').getLogger('EventHubFactory');

/**
 * Factory for obtaining event hubs for peers on a given channel.
 * Where possible, ensures that event hubs are connected.
 * @private
 * @class
 */
class EventHubFactory {
	/**
	 * Constructor.
	 * @param {Channel} channel Channel used to create event hubs.
	 */
	constructor(channel) {
		if (!channel) {
			const message = 'Channel not set';
			logger.error('constructor:', message);
			throw new Error(message);
		}
		logger.debug('constructor:', channel.getName());
		this.channel = channel;
	}

	/**
     * Gets event hubs for all specified peers. Where possible, the event hubs will be connected.
     * @async
     * @param {ChannelPeer} peers Peers for which event hubs should be connected.
     * @returns {ChannelEventHub[]} Event hubs, which may or may not have successfully connected.
     */
	async getEventHubs(peers) {
		// Get event hubs in parallel as each may take some time
		const eventHubPromises = peers.map((peer) => this.getEventHub(peer));
		return Promise.all(eventHubPromises);
	}

	/**
     * Get the event hub for a specific peer. Where possible, the event hub will be connected.
     * @private
     * @async
     * @param {ChannelPeer} peer Peer for which the event hub should be connected.
     * @returns {ChannelEventHub} Event hub, which may or may not have successfully connected.
     */
	async getEventHub(peer) {
		const eventHub = this.channel.getChannelEventHub(peer.getName());
		if (!eventHub.isconnected()) {
			await this.connectEventHub(eventHub);
		} else {
			// event hub is already connected, nothing else needs to be done
			logger.debug('getEventHub:', 'event hub already connected:', eventHub.getName());
		}
		return eventHub;
	}

	/**
     * Attempt to connect a given event hub. Resolves successfully regardless of whether or the event hub connection
     * was successful or failed.
     * @private
     * @async
     * @param {ChannelEventHub} eventHub An event hub.
     */
	async connectEventHub(eventHub) {
		const connectPromise = new Promise((resolve) => {
			const regId = eventHub.registerBlockEvent(
				() => {
					logger.debug('connectEventHub:', 'successfully connected event hub:', eventHub.getName());
					eventHub.unregisterBlockEvent(regId);
					resolve();
				},
				() => {
					logger.info('connectEventHub:', 'failed to connect event hub:', eventHub.getName());
					eventHub.unregisterBlockEvent(regId);
					resolve();
				}
			);
		});
		eventHub.connect();
		await connectPromise;
	}
}

module.exports = EventHubFactory;
