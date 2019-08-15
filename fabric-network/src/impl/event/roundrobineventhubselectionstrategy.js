/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const AbstractEventHubSelectionStrategy = require('./abstracteventhubselectionstrategy');

/**
 * The Round Robin Event Hub Strategy is a basic event hub selection strategy used to
 * spread out load onto different event hubs and track event hub availability
 *
 * @memberof module:fabric-network
 * @implements {module:fabric-network.AbstractEventHubSelectionStrategy}
 * @class
 */
class RoundRobinEventHubSelectionStrategy extends AbstractEventHubSelectionStrategy {
	/**
	 * Constructor.
	 * @param {Peer[]} peers The list of peers that the strategy can chose from
	 */
	constructor(peers = []) {
		super(peers);
		this.lastPeerIdx = null;
	}

	/**
	 * Gets the next peer in the list of peers
	 * @returns {Peer}
	 */
	getNextPeer() {
		if (this.lastPeerIdx === null || this.lastPeerIdx === this.peers.length - 1) {
			this.lastPeerIdx = 0;
		} else {
			this.lastPeerIdx++;
		}
		return this.peers[this.lastPeerIdx];
	}
}

module.exports = RoundRobinEventHubSelectionStrategy;
