#
# SPDX-License-Identifier: Apache-2.0
#

@deploy
Feature: Configure Fabric using SDK

	Background:
		Given I have forcibly taken down all docker containers

	Scenario: Using the SDK I can create and join a channel
		Given I have deployed a tls Fabric network
		Then I can create a channels from the tls common connection profile
		And I can join organization Org1 to the tls enabled channel named mychannel
		And I can join organization Org2 to the tls enabled channel named mychannel

	Scenario: Using the SDK I can install and instantiate chaincode
		Given I have deployed a tls Fabric network
		Then I can create and join all channels from the tls common connection profile
	 	And I can install node chaincode at version 1.0.0 named marbles to the tls Fabric network as organization Org1 on channel mychannel
		And I can install node chaincode at version 1.0.0 named marbles to the tls Fabric network as organization Org2 on channel mychannel
	 	And I can instantiate the newly installed node chaincode at version 1.0.0 named marbles on the tls Fabric network as organization Org1 on channel mychannel with endorsement policy 2ofAny and args [init,a,1000,b,2000]
