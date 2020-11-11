#
# SPDX-License-Identifier: Apache-2.0
#

@discovery
@gateway
@fabric_merge
Feature: Configure Fabric using CLI and submit/evaluate using a network Gateway with discovery enabled

	Background:
		Given I place a scenario start message DISCOVERY FEATURE
		Given I deploy a tls Fabric network at 2.1 version
		And I use the cli to create and join the channel named discoverychannel on the deployed network
		And I use the cli to update the channel with name discoverychannel with config file discoverychannel-anchor.tx on the deployed network
		#And I use the cli to deploy a node smart contract named fabcar at version 1.0.0 for all organizations on channel discoverychannel with endorsement policy 1of and arguments ["initLedger"]
		And I use the cli to lifecycle deploy a node smart contract named fabcar at version 1.0.0 as fabcar for all organizations on channel discoverychannel with default endorsement policy and init-required false
		And I have a file backed gateway named myDiscoveryGateway with discovery set to true for user User1 using the connection profile named ccp-tls.json

	Scenario: Using a Gateway I can submit and evaluate transactions on instantiated node smart contract
		When I use the discovery gateway named myDiscoveryGateway to submit a transaction with args [createCar,1001,Ariel,Atom,red,Nick] for contract fabcar instantiated on channel discoverychannel using collection badbad
		Then The gateway named myDiscoveryGateway has a error type response containing failed constructing descriptor
		When I use the discovery gateway named myDiscoveryGateway to submit a transaction with args [createCar,1001,Ariel,Atom,red,Nick] for contract fabcar instantiated on channel discoverychannel using collection collectionFabcar
		Then The gateway named myDiscoveryGateway has a submit type response
		When I use the gateway named myDiscoveryGateway to evaluate a transaction with args [queryCar,1001] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a evaluate type response matching {"color":"red","docType":"car","make":"Ariel","model":"Atom","owner":"Nick"}

	Scenario: Using a Gateway I recieve useful error messages when I submit or evaulate invalid transactions
		When I use the gateway named myDiscoveryGateway to submit a transaction with args [noSuchSubmitTransaction,1001,Trabant,601 Estate,brown,Simon] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a error type response containing function that does not exist: noSuchSubmitTransaction
		When I use the gateway named myDiscoveryGateway to submit a transaction with args [createCar,9,Ford] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a error type response containing No valid responses from any peers
		When I use the gateway named myDiscoveryGateway to evaluate a transaction with args [noSuchEvauateTransaction,1001] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a error type response containing You've asked to invoke a function that does not exist: noSuchEvauateTransaction
		When I use the gateway named myDiscoveryGateway to evaluate a transaction with args [queryCar,because,I,said,so] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a error type response containing Expected 1 parameters, but 4 have been supplied

	Scenario: Using a Gateway to submit transactions I can use different event handler strategies
		When I modify myDiscoveryGateway to submit a transaction with args [createCar,1002,Ford,Mustang,Silver,Andy] for contract fabcar instantiated on channel discoverychannel using handler option MSPID_SCOPE_ALLFORTX
		And  I use the gateway named myDiscoveryGateway to evaluate a transaction with args [queryCar,1002] for contract fabcar instantiated on channel discoverychannel
	    Then The gateway named myDiscoveryGateway has a evaluate type response matching {"color":"Silver","docType":"car","make":"Ford","model":"Mustang","owner":"Andy"}
		When I modify myDiscoveryGateway to submit a transaction with args [createCar,1003,Ford,Fiesta,Blue,Heather] for contract fabcar instantiated on channel discoverychannel using handler option MSPID_SCOPE_ANYFORTX
		And  I use the gateway named myDiscoveryGateway to evaluate a transaction with args [queryCar,1003] for contract fabcar instantiated on channel discoverychannel
	    Then The gateway named myDiscoveryGateway has a evaluate type response matching {"color":"Blue","docType":"car","make":"Ford","model":"Fiesta","owner":"Heather"}
		When I modify myDiscoveryGateway to submit a transaction with args [createCar,1004,Vauxhall,Corsa,White,Mark] for contract fabcar instantiated on channel discoverychannel using handler option NETWORK_SCOPE_ALLFORTX
		And  I use the gateway named myDiscoveryGateway to evaluate a transaction with args [queryCar,1004] for contract fabcar instantiated on channel discoverychannel
	    Then The gateway named myDiscoveryGateway has a evaluate type response matching {"color":"White","docType":"car","make":"Vauxhall","model":"Corsa","owner":"Mark"}
		When I modify myDiscoveryGateway to submit a transaction with args [createCar,1005,Bugatti,Veyron,Black,Bret] for contract fabcar instantiated on channel discoverychannel using handler option NETWORK_SCOPE_ANYFORTX
		Then The gateway named myDiscoveryGateway has a submit type response
		When I modify myDiscoveryGateway to submit a transaction with args [createCar,1006,Lotus,Elise,Pink,Nick] for contract fabcar instantiated on channel discoverychannel using handler option custom
		And  I use the gateway named myDiscoveryGateway to evaluate a transaction with args [queryCar,1006] for contract fabcar instantiated on channel discoverychannel
	    Then The gateway named myDiscoveryGateway has a evaluate type response matching {"color":"Pink","docType":"car","make":"Lotus","model":"Elise","owner":"Nick"}

	Scenario: Using a Gateway to evaluate transactions I can use different query handler strategies
		When I modify myDiscoveryGateway to evaluate a transaction with args [queryCar,1001] for contract fabcar instantiated on channel discoverychannel using handler option MSPID_SCOPE_SINGLE
		Then The gateway named myDiscoveryGateway has a evaluate type response matching {"color":"red","docType":"car","make":"Ariel","model":"Atom","owner":"Nick"}
		When I modify myDiscoveryGateway to evaluate a transaction with args [queryCar,1001] for contract fabcar instantiated on channel discoverychannel using handler option MSPID_SCOPE_ROUND_ROBIN
		Then The gateway named myDiscoveryGateway has a evaluate type response matching {"color":"red","docType":"car","make":"Ariel","model":"Atom","owner":"Nick"}
		When I modify myDiscoveryGateway to evaluate a transaction with args [queryCar,1001] for contract fabcar instantiated on channel discoverychannel using handler option custom
		Then The gateway named myDiscoveryGateway has a evaluate type response matching {"color":"red","docType":"car","make":"Ariel","model":"Atom","owner":"Nick"}

	Scenario: Using a Gateway I can use transient data
		When I modify myDiscoveryGateway to submit a transaction with transient data using args [getTransient,value1,value2] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a submit type response matching {"key0":"value1","key1":"value2"}
		When I modify myDiscoveryGateway to evaluate a transaction with transient data using args [getTransient,valueA,valueB] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a evaluate type response matching {"key0":"valueA","key1":"valueB"}

	Scenario: Using a Gateway I can submit and evaluate transactions on instantiated node smart contract with specific organizations
		When I use the discovery gateway named myDiscoveryGateway to submit a transaction with args [createCar,2001,Ford,F350,red,Sam] for contract fabcar instantiated on channel discoverychannel using requiredOrgs ["Org1MSP","Org2MSP"]
		Then The gateway named myDiscoveryGateway has a submit type response
		When I use the gateway named myDiscoveryGateway to evaluate a transaction with args [queryCar,2001] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a evaluate type response matching {"color":"red","docType":"car","make":"Ford","model":"F350","owner":"Sam"}

	Scenario: Using a Gateway I can use transient data
		When I use the discovery gateway named myDiscoveryGateway to submit a transaction a 100 times with args [createCar,2001,Ford,F350,red,Sam] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a submit type response

	Scenario: Using a Gateway I can submit to system chaincodes
		When I use the gateway named myDiscoveryGateway to submit a transaction with args [deploy] for contract lscc instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a error type response containing invalid number of arguments to lscc:

	Scenario: Using a Gateway I can evaluate to system chaincodes
		When I use the gateway named myDiscoveryGateway to evaluate a transaction with args [GetBlockByNumber,discoverychannel,0] for contract qscc instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a evaluate type response