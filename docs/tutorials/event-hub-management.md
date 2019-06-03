This tutorial describes how to define the behavior of the event hub selection strategy used when event hubs disconnect or new event hubs are required.

The `ChannelEventHub` is a fabric-client class that receives contract, commit and block events from the event hub within a peer. The `fabric-network` abstracts the event hub away, and instead uses an event hub selection strategy to create new event hub instances or reuse existing instances. 

Below is an example event hub selection strategy:

```javascript
class ExampleEventHubSelectionStrategy extends AbstractEventHubSelectionStrategy {

	constructor(peers) {
		this.peers = peers;
		this.disconnectedPeers = [];

		this.cleanupInterval = null;
	}
	_disconnectedPeerCleanup() {
		this.cleanupInterval = setInterval(() => {
			// Reset the list of disconnected peers every 10 seconds
			for (const peerRecord of disconnectedPeers) {
				// If 10 seconds has passed since the disconnect
				if (Date.now() - peerRecord.time > 10000) {
					this.disconnectedPeers = this.disconnectedPeers.filter((p) => p !== peerRecord.peer);
				}
			}

			if (this.disconnectedPeers.length === 0) {
				clearInterval(this.cleanupInterval);
				this.cleanupInterval = null;
			}
		}, 10000);
	}
	/**
	 * Returns the next peer in the list per the strategy implementation
	 * @returns {ChannelPeer}
	 */
	getNextPeer() {
		// Only select those peers that have not been disconnected recently
		let availablePeers = this.peers.filter((peer) => this.disconnectedPeers.indexOf(peer) === -1)
		if (availablePeers.length === 0) {
			availablePeers = this.peers;
		}
		const randomPeerIdx = Math.floor(Math.random() * availablePeers.length);
		return availablePeers[randomPeerIdx];
	}

	/**
	 * Updates the status of a peers event hub
	 * @param {ChannelPeer} deadPeer The peer that needs its status updating
	 */
	updateEventHubAvailability(deadPeer) {
		if (!this.cleanupInterval) {
			this._disconnectedPeerCleanup()
		}
		this.disconnectedPeers.push({peer: deadPeer, time: Date.now()})
	}
}
```

The event hub strategy exists at a gateway level, and is included in the `GatewayOptions` in the form of a factory function. The factory gives the event hub selection strategy instance a list of peers that it can select event hubs from. 

```javascript
function EXAMPLE_EVENT_HUB_SELECTION_FACTORY(network) {
	const orgPeers = getOrganizationPeers(network);
	const eventEmittingPeers = filterEventEmittingPeers(orgPeers);
	return new ExampleEventHubSelectionStrategy(eventEmittingPeers);
}

const gateway = new Gateway();
await gateway.connect(connectionProfile, {
	...
	eventHubSelectionOptions: {
		strategy: EXAMPLE_EVENT_HUB_SELECTION_FACTORY
	}
})
```

### Static event hub
Calling {@link module:fabric-network.AbstractEventListener#setEventHub} allows you to set one event hub that will not change. On unanticipated disconnect the SDK will attempt to reconnect to that event hub, rather than select the next peer using the event hub selection strategy.
