#
# SPDX-License-Identifier: Apache-2.0
#

@events
@gateway
@fabric_merge
Feature: Node SDK Events

	Background:
		Given I place a scenario start message EVENTS FEATURE
	 	Given I deploy a tls Fabric network at 2.1 version
	 	And I use the cli to create and join the channel named eventschannel on the deployed network
		And I use the cli to update the channel with name eventschannel with config file eventschannel-anchor.tx on the deployed network
		And I use the cli to lifecycle deploy a node smart contract named events at version 1.0.0 as events for all organizations on channel eventschannel with default endorsement policy and init-required false
		And I have a memory backed gateway named event_gateway with discovery set to true for user User1 using the connection profile named ccp-tls.json

 	Scenario: Using a Contract I can listen to full contract create events emitted by instantiated chaincodes
	 	When I use the gateway named event_gateway to listen for full contract events named create with a listener named createValueListener for the smart contract named events on channel eventschannel
		And I use the gateway named event_gateway to submit a total of 5 transactions with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive 5 events from the listener named createValueListener
		And the listener named createValueListener should have contract events with payload containing "createValueTransactionContent"

	Scenario: Using a Contract I can stop listening to full contract create events emitted by instantiated chaincodes
		Given I am listening for full contract events named create with a listener named createValueListener
		When I unregister the listener named createValueListener
		And I use the gateway named event_gateway to submit a total of 5 transactions with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive 0 events from the listener named createValueListener

 	Scenario: Using a Contract I can listen to filtered contract events emitted by instantiated chaincodes
	 	When I use the gateway named event_gateway to listen for filtered contract events named publicDC with a listener named dcValueListener for the smart contract named events on channel eventschannel
		And I use the gateway named event_gateway to submit a total of 5 transactions with args [createValueDisconnect] for contract events instantiated on channel eventschannel
		Then I receive 5 events from the listener named dcValueListener

	Scenario: Using a Contract I can stop listening to filtered contract events emitted by instantiated chaincodes
		Given I am listening for filtered contract events named publicDC with a listener named dcValueListener
		When I unregister the listener named dcValueListener
		And I use the gateway named event_gateway to submit a total of 5 transactions with args [createValueDisconnect] for contract events instantiated on channel eventschannel
		Then I receive 0 events from the listener named dcValueListener

	Scenario: Using a Contract I can replay filtered contract events emitted by instantiated chaincodes
		When I use the gateway named event_gateway to submit a total of 1 transactions with args [createValueDisconnect] for contract events instantiated on channel eventschannel
        And I use the gateway named event_gateway to replay filtered contract events named publicDC from starting block 1 with a listener named filteredContractReplayListener for the smart contract named events on channel eventschannel
        Then I receive a minimum 1 events from the listener named filteredContractReplayListener
		And I unregister the listener named filteredContractReplayListener

	Scenario: Using a gateway I can listen to full block events emitted by networks
		When I use the gateway named event_gateway to listen for full block events with a listener named fullBlockListener on channel eventschannel
		When I use the gateway named event_gateway to submit a transaction with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive a minimum 1 events from the listener named fullBlockListener

	Scenario: Using a gateway I can stop listening to full block events emitted by networks
		Given I am listening for full block events with a listener named fullBlockListener
		When I unregister the listener named fullBlockListener
		And I use the gateway named event_gateway to submit a total of 5 transactions with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive 0 events from the listener named fullBlockListener

	Scenario: Using a gateway I can listen to filtered block events emitted by networks
		When I use the gateway named event_gateway to listen for filtered block events with a listener named filteredBlockListener on channel eventschannel
		And I use the gateway named event_gateway to submit a transaction with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive a minimum 1 events from the listener named filteredBlockListener

	Scenario: Using a gateway I can stop listening to filtered block events emitted by networks
		Given I am listening for filtered block events with a listener named filteredBlockListener
		When I unregister the listener named filteredBlockListener
		And I use the gateway named event_gateway to submit a total of 5 transactions with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive 0 events from the listener named filteredBlockListener

	Scenario: Using a gateway I can listen to filtered block events emitted by networks between a start and end block
		When I use the gateway named event_gateway to listen for filtered block events between 0 and 2 with a listener named filteredNumberedBlockListener on channel eventschannel
		And I use the gateway named event_gateway to submit a total of 10 transactions with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive a minimum 2 events from the listener named filteredNumberedBlockListener

	Scenario: Using a gateway I can stop listening to filtered block events emitted by networks between a start and end block
		Given I am listening for filtered block events with a listener named filteredNumberedBlockListener
		When I unregister the listener named filteredNumberedBlockListener
		And I use the gateway named event_gateway to submit a total of 5 transactions with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive 0 events from the listener named filteredNumberedBlockListener

	Scenario: Using a gateway I can listen to private block events emitted by networks
		When I use the gateway named event_gateway to listen for private block events with a listener named privateBlockListener on channel eventschannel
		And I use the gateway named event_gateway to submit a transaction with args [privateValuePut] for contract events instantiated on channel eventschannel
		Then I receive a minimum 1 events from the listener named privateBlockListener
		And the listener named privateBlockListener should have private data containing "myprivatedata"

	Scenario: Using a gateway I can stop listening to private block events emitted by networks
		Given I am listening for private block events with a listener named privateBlockListener
		When I unregister the listener named privateBlockListener
		And I use the gateway named event_gateway to submit a total of 5 transactions with args [privateValuePut] for contract events instantiated on channel eventschannel
		Then I receive 0 events from the listener named privateBlockListener

	Scenario: Checkpoint block event listening
		When I use the gateway named event_gateway to listen for full block events with a new file checkpoint listener named checkpointBlockListener on channel eventschannel
		When I use the gateway named event_gateway to submit a transaction with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive a minimum 1 events from the listener named checkpointBlockListener
		When I unregister the listener named checkpointBlockListener
		When I use the gateway named event_gateway to submit a transaction with args [createValue] for contract events instantiated on channel eventschannel
		When I use the gateway named event_gateway to listen for full block events with an existing file checkpoint listener named checkpointBlockListener on channel eventschannel
		Then I receive a minimum 1 events from the listener named checkpointBlockListener

	Scenario: Checkpoint contract event listening
	 	When I use the gateway named event_gateway to listen for full contract events named create with a new file checkpoint listener named checkpointContractListener for the smart contract named events on channel eventschannel
		And I use the gateway named event_gateway to submit a transaction with args [createValue] for contract events instantiated on channel eventschannel
		Then I receive a minimum 1 events from the listener named checkpointContractListener
		And the listener named checkpointContractListener should have contract events with payload containing "createValueTransactionContent"
		When I unregister the listener named checkpointContractListener
		And I use the gateway named event_gateway to submit a transaction with args [createValue] for contract events instantiated on channel eventschannel
	 	And I use the gateway named event_gateway to listen for full contract events named create with an existing file checkpoint listener named checkpointContractListener for the smart contract named events on channel eventschannel
		Then I receive a minimum 1 events from the listener named checkpointContractListener
		And the listener named checkpointContractListener should have contract events with payload containing "createValueTransactionContent"
