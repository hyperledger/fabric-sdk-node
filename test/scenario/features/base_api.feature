#
# SPDX-License-Identifier: Apache-2.0
#

@debug
#@clean-images

Feature: Configure Fabric using SDK and endorse and commit and query using a fabric-base

	Background:
		Given I put a log message NEW BASE API TESTING
		Given I have forcibly taken down all docker containers
		Given I have deleted all dev images
		Given I have deployed a tls Fabric network
		And I have created and joined all channels from the tls common connection profile
		And I update channel with name mychannel with config file mychannel-org1anchor.tx from the tls common connection profile
		And I force install/instantiate node chaincode named fabcar at version 1.0.0 as fabcar01 to the tls Fabric network for all organizations on channel mychannel with endorsement policy 1AdminOr2Other and args [initLedger]

 	Scenario: Using only fabric-base I can discover, query, endorse and commit transactions on instantiated node chaincode
		Given endorse chaincode fabcar01 channel mychannel
		Then discovery on channel mychannel chaincode fabcar01
		Then discovery endorse chaincode fabcar01 channel mychannel
		Then events full block with replay on channel mychannel
		Then events chaincode event with chaincode fabcar01 on channel mychannel
		Then endorse with transient on chaincode fabcar01 on channel mychannel
