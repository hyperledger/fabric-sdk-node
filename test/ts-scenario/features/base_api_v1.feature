#
# SPDX-License-Identifier: Apache-2.0
#

@base_api_1
Feature: Use base API to perform core operations

Background:
	Given I place a scenario start message BASE API FEATURE V1 Channel and V1 Chaincode deployment
	Given I deploy a tls Fabric network at 2.1 version
	And I use the cli to create and join the channel named baseapichannel on the deployed network
	And I use the cli to update the channel with name baseapichannel with config file baseapichannel-anchor.tx on the deployed network
	And I use the cli to deploy a node smart contract named fabcar at version 1.0.0 for all organizations on channel baseapichannel with endorsement policy 1of and arguments ["initLedger"]
	And I have created a client named leon based on information in profile ccp-tls under organization Org1
	And I have used the client named leon to create a channel object for the channel named baseapichannel

Scenario: Using only fabric-common V1 channel
	When I build a new endorsement request named myFirstRequest for smart contract named fabcar with arguments [createCar, 2000, GMC, Savana, grey, Jones] as client leon on channel baseapichannel
	And I commit the endorsement request named myFirstRequest as client leon on channel baseapichannel
	Then the request named myFirstRequest for client leon has a general result matching {"result":"SUCCESS"}
	And the request named myFirstRequest for client leon has a event result matching {"result":"Commit success"}
	And the request named myFirstRequest for client leon has a commit result matching {"status":"SUCCESS"}

	When I submit a query named myFirstQuery with args [queryCar,CAR0] for contract fabcar as client leon on channel baseapichannel
	Then the query named myFirstQuery for client leon has a general result matching {"result":"SUCCESS"}
	And the query named myFirstQuery for client leon has a peer0 result matching {"color":"blue","docType":"car","make":"Toyota","model":"Prius","owner":"Tomoko"}

	When I build a new endorsement request named myDiscoveryRequest for smart contract named fabcar with arguments [createCar, 2008, Crysler, PTCurser, grey, Smith] as client leon on discovery channel baseapichannel
	And I commit the endorsement request named myDiscoveryRequest as client leon on channel baseapichannel
	Then the request named myDiscoveryRequest for client leon has discovery results
	Then the request named myDiscoveryRequest for client leon has a general result matching {"result":"SUCCESS"}
	And the request named myDiscoveryRequest for client leon has a event result matching {"result":"Commit success"}
	And the request named myDiscoveryRequest for client leon has a commit result matching {"status":"SUCCESS"}

	When I create an event service myFilteredEventService as client leon on channel baseapichannel
	And I regisister a block listener named myFilteredBlockListener with myFilteredEventService for startBlock 1 and endBlock 3 as client leon
	And I regisister a chaincode listener named myFilteredChaincodeListener with myFilteredEventService for createCar event on contract fabcar as client leon
	And I regisister a transaction listener named myFilteredTransactionListener with myFilteredEventService for all transactions as client leon
	When I create an event service myFullEventService as client leon on channel baseapichannel
	And I regisister a block listener named myFullBlockListener with myFullEventService for startBlock 1 and endBlock 4 as client leon
	And I regisister a chaincode listener named myFullChaincodeListener with myFullEventService for createCar event on contract fabcar as client leon
	And I regisister a transaction listener named myFullTransactionListener with myFullEventService for all transactions as client leon
	And I start the event service myFilteredEventService as filtered blocks to start at block 0 and end at block 4 as client leon
	And I start the event service myFullEventService as full blocks to start at block 0 and end at block END as client leon
	And I build a new endorsement request named replay1 for smart contract named fabcar with arguments [createCar,2006,Ford,Focus,blue,Henry] as client leon on channel baseapichannel
	And I commit the endorsement request named replay1 as client leon on channel baseapichannel
	Then the event listener myFilteredBlockListener of myFilteredEventService has results matching {"block":"3"} as client leon
	Then the event listener myFilteredChaincodeListener of myFilteredEventService has results matching {"createCar":""} as client leon
	Then the event listener myFilteredTransactionListener of myFilteredEventService has results matching {"transaction":"3"} as client leon
	Then the event listener myFullBlockListener of myFullEventService has results matching {"block":"4"} as client leon
	Then the event listener myFullChaincodeListener of myFullEventService has results matching {"createCar":"Focus"} as client leon
	Then the event listener myFullTransactionListener of myFullEventService has results matching {"transaction":"4"} as client leon
