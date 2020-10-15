#
# SPDX-License-Identifier: Apache-2.0
#

@base_api_2
Feature: Use base API to perform core operations

Background:
	Given I place a scenario start message BASE API FEATURE V2 Channel and V2 Chaincode lifecycle
	Given I deploy a tls Fabric network at 2.1 version
	And I use the cli to create and join the channel named basev2channel on the deployed network
	And I use the cli to update the channel with name basev2channel with config file basev2channel-anchor.tx on the deployed network
	And I use the cli to lifecycle deploy a node smart contract named fabcar at version 1.0.0 as fabcar for all organizations on channel basev2channel with default endorsement policy and init-required true
	Given I have created a client named fred based on information in profile ccp-tls under organization Org1
	And I have used the client named fred to create a channel object for the channel named basev2channel

Scenario: Using only fabric-common on V2 channel
	When I build a new endorsement request named initRequest for smart contract named fabcar with arguments [initLedger] as client fred on channel basev2channel
	And I commit the endorsement request named initRequest as client fred on channel basev2channel
	Then the request named initRequest for client fred has a general result matching {"result":"SUCCESS"}
	And the request named initRequest for client fred has a event result matching {"result":"Commit success"}
	And the request named initRequest for client fred has a commit result matching {"status":"SUCCESS"}

	When I build a new endorsement request named myFirstRequest for smart contract named fabcar with arguments [createCar,2000,GMC,Savana,grey,Jones] as client fred on channel basev2channel
	And I commit the endorsement request named myFirstRequest as client fred on channel basev2channel
	Then the request named myFirstRequest for client fred has a general result matching {"result":"SUCCESS"}
	And the request named myFirstRequest for client fred has a event result matching {"result":"Commit success"}
	And the request named myFirstRequest for client fred has a commit result matching {"status":"SUCCESS"}

	When I submit a query named myFirstQuery with args [queryCar,CAR0] for contract fabcar as client fred on channel basev2channel
	Then the query named myFirstQuery for client fred has a general result matching {"result":"SUCCESS"}
	And the query named myFirstQuery for client fred has a peer0 result matching {"color":"blue","docType":"car","make":"Toyota","model":"Prius","owner":"Tomoko"}

	When I submit a chaincode query named checkChaincodeName with args [queryCar,CAR0] for contract fabcar as client fred on channel basev2channel
	Then the query named checkChaincodeName for client fred has a general result matching {"result":"SUCCESS"}
	Then the query named checkChaincodeName for client fred has a chaincodecheck result matching {"result":"FAILURE"}
	And the query named checkChaincodeName for client fred has a peer1 result matching {"color":"blue","docType":"car","make":"Toyota","model":"Prius","owner":"Tomoko"}
	And the query named checkChaincodeName for client fred has a peer0 result matching Error: Peer peer0.org1.example.com is not running chaincode fabcar

	When I build a new endorsement request named myDiscoveryRequest for smart contract named fabcar with arguments [createCar,2008,Chrysler,PTCurser,white,Jones] as client fred on discovery channel basev2channel
	And I commit the endorsement request named myDiscoveryRequest as client fred on channel basev2channel
	Then the request named myDiscoveryRequest for client fred has discovery results
	Then the request named myDiscoveryRequest for client fred has a general result matching {"result":"SUCCESS"}
	And the request named myDiscoveryRequest for client fred has a event result matching {"result":"Commit success"}
	And the request named myDiscoveryRequest for client fred has a commit result matching {"status":"SUCCESS"}

	When I create an event service myFilteredEventService as client fred on channel basev2channel
	And I regisister a block listener named myFilteredBlockListener with myFilteredEventService for startBlock 1 and endBlock 3 as client fred
	And I regisister a chaincode listener named myFilteredChaincodeListener with myFilteredEventService for createCar event on contract fabcar as client fred
	And I regisister a transaction listener named myFilteredTransactionListener with myFilteredEventService for all transactions as client fred
	When I create an event service myFullEventService as client fred on channel basev2channel
	And I regisister a block listener named myFullBlockListener with myFullEventService for startBlock 1 and endBlock 4 as client fred
	And I regisister a chaincode listener named myFullChaincodeListener with myFullEventService for createCar event on contract fabcar as client fred
	And I regisister a transaction listener named myFullTransactionListener with myFullEventService for all transactions as client fred
	And I start the event service myFilteredEventService as filtered blocks to start at block 0 and end at block 6 as client fred
	And I start the event service myFullEventService as full blocks to start at block 0 and end at block END as client fred
	And I build a new endorsement request named replay1 for smart contract named fabcar with arguments [createCar,2006,Ford,Focus,blue,Henry] as client fred on channel basev2channel
	And I commit the endorsement request named replay1 as client fred on channel basev2channel
	Then the event listener myFilteredBlockListener of myFilteredEventService has results matching {"block":"3"} as client fred
	Then the event listener myFilteredChaincodeListener of myFilteredEventService has results matching {"createCar":""} as client fred
	Then the event listener myFilteredTransactionListener of myFilteredEventService has results matching {"transaction":"5"} as client fred
	Then the event listener myFullBlockListener of myFullEventService has results matching {"block":"4"} as client fred
	Then the event listener myFullChaincodeListener of myFullEventService has results matching {"createCar":"Focus"} as client fred
	Then the event listener myFullTransactionListener of myFullEventService has results matching {"transaction":"7"} as client fred

	When I disconnect Event Service myFilteredEventService as client fred
	And I regisister a block listener named myRestartListener with myFilteredEventService for startBlock 1 and endBlock 6 as client fred
	And I restart the event service myFilteredEventService as filtered blocks to start at block 0 and end at block 6 as client fred
	When I build a new endorsement request named myEventRequest for smart contract named fabcar with arguments [createCar,2008,Chrysler,PTCurser,white,Jones] as client fred on discovery channel basev2channel
	And I commit the endorsement request named myEventRequest as client fred on channel basev2channel
	Then the event listener myRestartListener of myFilteredEventService has results matching {"block":"6"} as client fred
	When I disconnect Event Service myFilteredEventService as client fred
	And I regisister a block listener named myRestartListener with myFilteredEventService for startBlock 1 and endBlock 6 as client fred
	And I restart the event service myFilteredEventService as filtered blocks to start at block 0 and end at block 6 as client fred
	When I build a new endorsement request named myEventRequest for smart contract named fabcar with arguments [createCar,2008,Chrysler,PTCurser,white,Jones] as client fred on discovery channel basev2channel
	And I commit the endorsement request named myEventRequest as client fred on channel basev2channel
	Then the event listener myRestartListener of myFilteredEventService has results matching {"block":"6"} as client fred
