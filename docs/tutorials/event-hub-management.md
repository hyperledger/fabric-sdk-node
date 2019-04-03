This tutorial describes how to define the behavior of the event hub selection strategy used when event hubs disconnect or new event hubs are required.

The `ChannelEventHub` is a fabric-client class that receives contract, commit and block events from the event hub within a peer. The `fabric-network` abstracts the event hub away, and instead uses an event hub selection strategy to create new event hub instances or reuse existing instances. 

#### Note
If you do not want the event hub strategy to manage event hubs for a listener, call `AbstractEventListener.setEventHub(eventHub: ChannelEventHub, isFixed: boolean)` and it will continue to use the same event hub

The interface for an event hub selection strategy is as follows:

```javascript
class BaseEventHubSelectionStrategy {
	/**
	 * Returns the next peer in the list per the strategy implementation
	 * @returns {ChannelPeer}
	 */
	getNextPeer() {
		// Peer selection logic. Called whenever an event hub is required
	}

	/**
	 * Updates the status of a peers event hub
	 * @param {ChannelPeer} deadPeer The peer that needs its status updating
	 */
	updateEventHubAvailability(deadPeer) {
		// Peer availability update logic. Called whenever the event hub disconnects.
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
