#
# SPDX-License-Identifier: Apache-2.0
#

@base_api
Feature: Use base API to perform core operations

Background:
	Given I place a scenario start message BASE API FEATURE
	Given I deploy a tls Fabric network at 2.1 version
	And I use the cli to create and join the channel named eventschannel on the deployed network
	And I use the cli to update the channel with name eventschannel with config file eventschannel-anchor.tx on the deployed network
	And I use the cli to lifecycle deploy a node smart contract named fabcar at version 1.0.0 as fabcar for all organizations on channel eventschannel with default endorsement policy and init-required true

Scenario: Using only fabric-base I can initialize node chaincode
	Given I have created a client named leon based on information in profile ccp-tls under organization Org1
	And I have used the client named leon to create a channel object for the channel named eventschannel
	When I build a new endorsement request named initRequest for smart contract named fabcar with arguments [initLedger] as client leon on channel eventschannel
	And I commit the endorsement request named initRequest as client leon on channel eventschannel
	Then the request named initRequest for client leon has a general result matching {"result":"SUCCESS"}
	And the request named initRequest for client leon has a event result matching {"result":"Commit success"}
	And the request named initRequest for client leon has a commit result matching {"status":"SUCCESS"}

Scenario: Using only fabric-base I can propose, endorse and commit a transaction on approved/committed node chaincode
	Given I have created a client named leon based on information in profile ccp-tls under organization Org1
	And I have used the client named leon to create a channel object for the channel named eventschannel
	When I build a new endorsement request named myFirstRequest for smart contract named fabcar with arguments [createCar, 2000, GMC, Savana, grey, Jones] as client leon on channel eventschannel
	And I commit the endorsement request named myFirstRequest as client leon on channel eventschannel
	Then the request named myFirstRequest for client leon has a general result matching {"result":"SUCCESS"}
	And the request named myFirstRequest for client leon has a event result matching {"result":"Commit success"}
	And the request named myFirstRequest for client leon has a commit result matching {"status":"SUCCESS"}

Scenario: Using only fabric-base I can send a query request to peers and recieve a valid result
	Given I have created a client named leon based on information in profile ccp-tls under organization Org1
	And I have used the client named leon to create a channel object for the channel named eventschannel
	When I submit a query named myFirstQuery with args [queryCar,CAR0] for contract fabcar as client leon on channel eventschannel
	Then the query named myFirstQuery for client leon has a general result matching {"result":"SUCCESS"}
	And the query named myFirstQuery for client leon has a peer0 result matching {"color":"blue","docType":"car","make":"Toyota","model":"Prius","owner":"Tomoko"}
