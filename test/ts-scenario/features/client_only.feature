#
# SPDX-License-Identifier: Apache-2.0
#

@client_only
@gateway
@fabric_merge
Feature: Configure Fabric using CLI and submit/evaluate using a network Gateway with discovery enabled using an organization that has no peers

	Background:
		Given I place a scenario start message CLIENT ONLY FEATURE
		Given I deploy a tls Fabric network at 2.1 version
		And I use the cli to create and join the channel named discoverychannel on the deployed network
		And I use the cli to update the channel with name discoverychannel with config file discoverychannel-anchor.tx on the deployed network
		#And I use the cli to deploy a node smart contract named fabcar at version 1.0.0 for all organizations on channel discoverychannel with endorsement policy 1of and arguments ["initLedger"]
		And I use the cli to lifecycle deploy a node smart contract named fabcar at version 1.0.0 as fabcar for all organizations on channel discoverychannel with default endorsement policy and init-required false
		And I have a file backed gateway named myClientOnlyGateway with discovery set to true for user User1 in organization Org3 using the connection profile named ccp-client-only.json

	Scenario: Using a Gateway I can submit and evaluate transactions on instantiated node smart contract
		When I use the discovery gateway named myClientOnlyGateway to submit a transaction with args [createCar,1001,Ariel,Atom,red,Nick] for contract fabcar instantiated on channel discoverychannel using collection badbad
		Then The gateway named myClientOnlyGateway has a error type response containing failed constructing descriptor
		When I use the discovery gateway named myClientOnlyGateway to submit a transaction with args [createCar,1001,Ariel,Atom,red,Nick] for contract fabcar instantiated on channel discoverychannel using collection collectionFabcar
		Then The gateway named myClientOnlyGateway has a submit type response
		When I use the gateway named myClientOnlyGateway to evaluate a transaction with args [queryCar,1001] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myClientOnlyGateway has a evaluate type response matching {"color":"red","docType":"car","make":"Ariel","model":"Atom","owner":"Nick"}

	Scenario: Using a Gateway I recieve useful error messages when I submit or evaulate invalid transactions
		When I use the gateway named myClientOnlyGateway to submit a transaction with args [noSuchSubmitTransaction,1001,Trabant,601 Estate,brown,Simon] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myClientOnlyGateway has a error type response containing function that does not exist: noSuchSubmitTransaction
		When I use the gateway named myClientOnlyGateway to submit a transaction with args [createCar,9,Ford] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myClientOnlyGateway has a error type response containing No valid responses from any peers
		When I use the gateway named myClientOnlyGateway to evaluate a transaction with args [noSuchEvauateTransaction,1001] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myClientOnlyGateway has a error type response containing You've asked to invoke a function that does not exist: noSuchEvauateTransaction
		When I use the gateway named myClientOnlyGateway to evaluate a transaction with args [queryCar,because,I,said,so] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myClientOnlyGateway has a error type response containing Expected 1 parameters, but 4 have been supplied

	Scenario: Using a Gateway I can use transient data
		When I modify myClientOnlyGateway to submit a transaction with transient data using args [getTransient,value1,value2] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myClientOnlyGateway has a submit type response matching {"key0":"value1","key1":"value2"}
		When I modify myClientOnlyGateway to evaluate a transaction with transient data using args [getTransient,valueA,valueB] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myClientOnlyGateway has a evaluate type response matching {"key0":"valueA","key1":"valueB"}

	Scenario: Using a Gateway I can submit and evaluate transactions on instantiated node smart contract with specific organizations
		When I use the discovery gateway named myClientOnlyGateway to submit a transaction with args [createCar,2001,Ford,F350,red,Sam] for contract fabcar instantiated on channel discoverychannel using requiredOrgs ["Org1MSP","Org2MSP"]
		Then The gateway named myClientOnlyGateway has a submit type response
		When I use the gateway named myClientOnlyGateway to evaluate a transaction with args [queryCar,2001] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myClientOnlyGateway has a evaluate type response matching {"color":"red","docType":"car","make":"Ford","model":"F350","owner":"Sam"}
