#
# SPDX-License-Identifier: Apache-2.0
#

@networkAPI
@clean-gateway
Feature: Listen to events using a fabric-network
	Background:
		Given I have deployed a tls Fabric network
		And I have created and joint all channels from the tls common connection profile
		And I have created a gateway named test_gateway as user User1 within Org1 using the tls common connection profile
		Given I install/instantiate node chaincode named events at version 1.0.0 as events01 to the tls Fabric network for all organizations on channel mychannel with endorsement policy 1AdminOr2Other and args [initLedger]

	Scenario: Using a Contract I can listen to contract events emitted by instantiated chaincodes
		When I use the gateway named test_gateway to listen for unfiltered create events with listener createValueListener on chaincode events01 instantiated on channel mychannel
		When I use the gateway named test_gateway to submit 5 transactions with args [createValue] for chaincode events01 instantiated on channel mychannel
		Then I receive 5 events from the listener createValueListener
		When I use the gateway named test_gateway to listen for filtered dc events with listener ehDisconnectListener on chaincode events01 instantiated on channel mychannel
		When I use the gateway named test_gateway to submit 10 transactions with args [createValueDisconnect] for chaincode events01 instantiated on fabric channel mychannel disconnecting the event hub on listener ehDisconnectListener every 5 transactions
		Then I receive 10 events from the listener ehDisconnectListener

	Scenario: Using a Contract I can listen to block events emitted by networks
		When I use the gateway named test_gateway to listen for filtered_block_events with listener filteredBlockListener on chaincode events01 instantiated on channel mychannel
		When I use the gateway named test_gateway to submit a transaction with args [createValue] for chaincode events01 instantiated on channel mychannel
		Then I receive at least 1 events from the listener filteredBlockListener
		When I use the gateway named test_gateway to listen for unfiltered_block_events with listener unfilteredBlockListener on chaincode events01 instantiated on channel mychannel
		When I use the gateway named test_gateway to submit a transaction with args [createValue] for chaincode events01 instantiated on channel mychannel
		Then I receive at least 1 events from the listener unfilteredBlockListener

	Scenario: I can listen to a transaction commit event
		When I use the gateway named test_gateway to create a transaction named transaction1 that calls createValue using chaincode events01 instantiated on channel mychannel
		When I use the transaction named transaction1 to create a commit listener called transaction1Listener
		When I use the transaction named transaction1 to submit a transaction with args []
		Then I receive 1 events from the listener transaction1Listener

	Scenario: Using a Contract I can listen to contract events emmited by instantiated chaincodes
		When I use the gateway named test_gateway to listen for unfiltered create events with listener unfilteredListener on chaincode events01 instantiated on channel mychannel
		When I use the gateway named test_gateway to submit 5 transactions with args [createValue] for chaincode events01 instantiated on channel mychannel
		# Waiting for 6 events due to fabric-client bug
		Then I receive 6 events from the listener unfilteredListener
