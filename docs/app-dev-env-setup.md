
This tutorial describes how to prepare a development environment in order to build a business application to use a blockchain network based on Hyperledger Fabric. At a high level, a business application against a Hyperledger Fabric network is made up of two parts: chaincode that runs in the servers ([endorser](http://hyperledger-fabric.readthedocs.io/en/latest/arch-deep-dive.html#peer) nodes), and client code that runs in the client application.

For chaincode development, please visit the tutorial [here](http://hyperledger-fabric.readthedocs.io/en/latest/FAQ/chaincode_FAQ.html#chaincode-smart-contracts-and-digital-assets).

The following tutorial assumes a chaincode has been developed and the focus is developing the client application.

## What makes up a Hyperledger Fabric application development environment?

Below you'll find a high level summary of the Hyperledger Fabric design aimed at an introductory level of understanding, so that you can be on your way to setting up the development environment. For a comprehensive description of the concepts, the architecture, please visit the official [Hyperledger Fabric documentation](http://hyperledger-fabric.readthedocs.io/en/latest/overview.html).

First of all, you will need an [orderer](http://hyperledger-fabric.readthedocs.io/en/latest/orderingservice.html). But isn't an orderer responsible for the consensus? Why start here? It's true that the main responsibility of the ordering service of a Hyperledger Fabric blockchain network is to provide consensus on a transaction among the maintainers of the ledger, a.k.a the committer nodes. However, the ordering service also maintains critical data about the overall network: what organizations are participating, what channels have been created, which organizations are part of a given channel, and last but not least what policies are in place for any kind of changes to the network. In essence, the ordering service holds the network together.

Ok we've got to have an orderer node so we can add participating organizations to it and get a network started. Next you would need peers for each participating organization in order to participate in transaction endorsing and maintaining the ledger.

The peer nodes play two roles: endorser and committer. A peer's endorser role may be enabled or disabled based on bootstrap configuration. But all peers are always committers. For high availability you would want more than one peer for each organization in a real deployment. But for the development environment, one peer per organization is sufficient under most circumstances. This peer will be both an endorse and a committer. It will be sent transaction proposals to endorse, and queries to discover information from the ledger.

Another important role that peer nodes play is broadcasting events to interested parties. Whenever a block is added to the ledger, an event is sent by the peer through a dedicated streaming port. Any applications within the organization can register themselves to listen on that port to get notified.

The final piece of the puzzle is identities. Every operation in a Hyperledger Fabric network must be digitially signed for the purposes of access control, or provenance/auditing (who did what), or both. As of v1.0, identities are based on the Public Key Infrastructure (PKI)) standards. Every orderer node, peer node and every user/transactor must have a key pair with the public key wrapped in a x.509 certificate signed by a Certificate Authority (CA). Since x.509 is an open standard, Hyperledger Fabric would work with any existing certificate authorities. But it's typically a painful process with lots of potential red taping to get real certificates, so for development purposes it is a popular practice to use self-signed certificates locally generated. As you will see in the later section, the fabric provides tools to make this less painful.

Also related to identities, you should make a decision on whether [Fabric-CA](http://hyperledger-fabric.readthedocs.io/en/latest/Setup/ca-setup.html) should be part of your solution. This is a server with REST APIs that supports dynamic identity management with registration, enrollment (getting certificates), revocation and re-enrollment. So it is very useful in providing user identities on the fly. But note that user identities provisioned this way are only of the `MEMBER` role in the fabric, which means it won't be able to perform certain operations reserved for the `ADMIN` role:
* create/update channel
* install/instantiate chaincode
* query installed/instantiated chaincodes

For these privileged operations, the client must use an ADMIN user to submit the request. This will be discussed in more details in the [User identities]() tutorial.

If you choose to not use Fabric-CA, everything will still work but the application is responsible for managing the user certificates. This will be discussed in more details in the [User identities]() tutorial.

## Prerequisites

You will need the following software:
* [Docker](https://www.docker.com/products/overview) - v1.12 or higher
* [Docker Compose](https://docs.docker.com/compose/overview/) - v1.8 or higher
* [Nodejs](https://nodejs.org/en/download/) v6.2.0 - 6.10.0 ( __Node v7+ is not supported__ )

## Prepare crypto materials

As discussed above, identities are established with x.509 certificates. If you think about it, we will need a whole bunch of certificates because there are many identities involved:
* peers need identities to sign endorsements
* orderers need identities to sign proposed blocks for the committers to validate and append to the ledger
* applications need identities to sign transaction requests
* even the Fabric CA themselves also need identities so their signatures in the certificates can be validated

Luckily there is a tool for that. Follow [this guide](http://hyperledger-fabric.readthedocs.io/en/latest/getting_started.html#using-the-cryptogen-tool) to use the cryptogen tool to generate all the required keys and certificates in one swoop. Recommend the following configuration:

| Organization  | # of nodes    | # of users        |
| ------------- |:-------------:|:-----------------:|
| orderer org   | 1 orderer     | 1 admin           |
| peer org1     | 2 peers       | 1 admin, 1 member |
| peer org2     | 2 peers       | 1 admin, 1 member |

Note that the cryptogen tool will automatically generate identities for the Fabric CA nodes for each orderer and peer organization, which can be used to start the Fabric-CA servers (if you choose to use it as part of the solution as discussed above). In addition, it also generates one admin user of the `ADMIN` role with the privileges to perform admin-level operations listed above. Finally, it also generates regular users (`MEMBER` role) for submitting transactions.

This would get us all the crypto materials needed to start things up.

## Getting things rolling for real - the genesis block

As discussed above, the orderer should be the first step to bootstrap to launch a network. It will need the initial configurations wrapped inside a `genesis block`. Follow the [instructions here](http://hyperledger-fabric.readthedocs.io/en/latest/getting_started.html#using-the-configtxgen-tool) to use the `congigtxgen` tool to generate that. The output, the genesis block for the orderer, will be used in the next step to launch the orderer node.

## Start the network (no TLS)

Now we are ready to put it all together. The easiest way to launch the development environment is to use docker-compose. Follow the [instructions here](http://hyperledger-fabric.readthedocs.io/en/latest/getting_started.html#start-the-network-no-tls) to start the network. To minimize the chance to make mistakes, we will run the network without TLS.

The above steps give you a development environment. Now before you can ask it to process any transactions, you must first create a channel. Next, we will create a channel in [this tutorial]().


<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
s
