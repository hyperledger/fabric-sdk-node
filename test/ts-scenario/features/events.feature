#
# SPDX-License-Identifier: Apache-2.0
#

@events
@gateway
@fabric_merge
Feature: Node SDK Events

	Background:
		Given I place a scenario start message EVENTS FEATURE
	 	Given I deploy a tls Fabric network
	 	And I use the cli to create and join the channel named eventschannel on the deployed network
		And I use the cli to update the channel with name eventschannel with config file eventschannel-anchor.tx on the deployed network
		And I use the cli to deploy a node smart contract named events at version 1.0.0 for all organizations on channel eventschannel with endorsement policy 1ofAny and arguments ["initLedger"]
		And I have a memory backed gateway named event_gateway with discovery set to true for user User1 using the connection profile named ccp-tls.json

 	Scenario: Using a Contract I can listen to unfiltered contract create events emitted by instantiated chaincodes
	 	Given I use the gateway named event_gateway to listen for unfiltered contract events of type create with a listener named createValueListener for the smart contract named events on channel eventschannel
		When I use the gateway named event_gateway to submit a total of 5 transactions with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive 5 events from the listener named createValueListener

	Scenario: Using a Contract I can stop listening to unfiltered contract create events emitted by instantiated chaincodes
		Given I am listening for unfiltered contract events of type create with a listener named createValueListener
		When I unregister the listener named createValueListener
		And I use the gateway named event_gateway to submit a total of 5 transactions with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive 0 events from the listener named createValueListener

 	Scenario: Using a Contract I can listen to filtered contract disconnect events emitted by instantiated chaincodes
	 	Given I use the gateway named event_gateway to listen for filtered contract events of type dc with a listener named dcValueListener for the smart contract named events on channel eventschannel
		When I use the gateway named event_gateway to submit a total of 5 transactions with args [createValueDisconnect] for contract events instantiated on channel eventschannel
		Then I receive 5 events from the listener named dcValueListener

	Scenario: Using a Contract I can stop listening to filtered disconnect create events emitted by instantiated chaincodes
		Given I am listening for filtered contract events of type dc with a listener named dcValueListener
		When I unregister the listener named dcValueListener
		And I use the gateway named event_gateway to submit a total of 5 transactions with args [createValueDisconnect] for contract events instantiated on channel eventschannel
		Then I receive 0 events from the listener named dcValueListener

	Scenario: Using a Contract I can listen to unfiltered block events emitted by networks
		When I use the gateway named event_gateway to listen for unfiltered block events with a listener named unfilteredBlockListener on channel eventschannel
		When I use the gateway named event_gateway to submit a transaction with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive a minimum 1 events from the listener unfilteredBlockListener

	Scenario: Using a Contract I can stop listening to unfiltered block events emitted by networks
		Given I am listening for unfiltered block events with a listener named unfilteredBlockListener
		When I unregister the listener named unfilteredBlockListener
		And I use the gateway named event_gateway to submit a total of 5 transactions with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive 0 events from the listener named unfilteredBlockListener

	Scenario: Using a Contract I can listen to filtered block events emitted by networks
		When I use the gateway named event_gateway to listen for filtered block events with a listener named filteredBlockListener on channel eventschannel
		And I use the gateway named event_gateway to submit a transaction with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive a minimum 1 events from the listener filteredBlockListener

	Scenario: Using a Contract I can stop listening to filtered block events emitted by networks
		Given I am listening for filtered block events with a listener named filteredBlockListener
		When I unregister the listener named filteredBlockListener
		And I use the gateway named event_gateway to submit a total of 5 transactions with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive 0 events from the listener named filteredBlockListener

	Scenario: Using a Contract I can listen to unfiltered block events emitted by networks between a start and end block
		When I use the gateway named event_gateway to listen for unfiltered block events between 0 and 2 with a listener named unfilteredNumberedBlockListener on channel eventschannel
		And I use the gateway named event_gateway to submit a total of 10 transactions with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive a minimum 2 events from the listener unfilteredNumberedBlockListener

	Scenario: Using a Contract I can stop listening to unfiltered block events emitted by networks between a start and end block
		Given I am listening for unfiltered block events with a listener named unfilteredNumberedBlockListener
		When I unregister the listener named unfilteredNumberedBlockListener
		And I use the gateway named event_gateway to submit a total of 5 transactions with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive 0 events from the listener named unfilteredNumberedBlockListener

	Scenario: I can listen to a transaction commit event
		Given I use the gateway named event_gateway to create a transaction named transaction1 that calls createValue using contract events instantiated on channel eventschannel
		And I use the transaction named transaction1 to create a commit listener called transaction1Listener
		When I use the transaction named transaction1 to submit a transaction with args []
		Then I receive 1 events from the listener named transaction1Listener