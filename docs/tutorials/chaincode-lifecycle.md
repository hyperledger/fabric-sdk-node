This tutorial illustrates how to handle the lifecycle of your chaincode.
The installation, updating, and the starting of chaincode has been
changed with Hyperledger Fabric 2.0 and fabric-client 2.0.

***** this doc is not done *****

For more information on:
* getting started with Hyperledger Fabric see
[Building your first network](http://hyperledger-fabric.readthedocs.io/en/latest/build_network.html).
* the configuration of a channel in Hyperledger Fabric and the internal
process of creating and updating see
[Hyperledger Fabric channel configuration](http://hyperledger-fabric.readthedocs.io/en/latest/configtx.html)
* [Chaincode Lifecycle](https://hyperledger-fabric.readthedocs.io/en/latest/discovery-overview.html)

The following assumes an understanding of the Hyperledger Fabric network
(orderers and peers),
and of Node application development, including the use of the
Javascript `promise` and `async await`.

### Overview
This discussion will focus on the steps that are required by an application
program to managing the install, update and starting of chaincodes
on your Hyperledger Fabric network. The existing api's for managing the lifecycle
of your pre 2.0 chaincodes will still be available in fabric-client and those
will not be discussed here.

The channel that will be running this version of chaincode lifecycle
must have been created with `Channel Capabilities` of `V2_0: true`. 

The steps to manage chaincode:
* `setup` - create the necessary application objects
* `package` - package the chaincode source artifacts
* `install` - push to the network
* `approve for organization` - each organization will approve a specific chaincode definition
* `commit for the channel` - the channel members will agree (commit) to run a specific chaincode definition
* `initialize` - (Optional) start the chaincode container and initialize the chaincode

#### New Class
A new class {@link Chaincode} has been added to the fabric-client to encapsulate
a chaincode definition.
A {@link Chaincode} instance will be created by a client instance's
{@link Client#newChaincode newChaincode(name,version)} method.
Then using the new instance, you will be able to build up a chaincode definition
with the following methods.
* {@link Chaincode#setEndorsementPolicyDefinition setEndorsementPolicyDefinition} - Provide the endorsement policy for this chaincode.
* {@link Chaincode#setCollectionConfigPackageDefinition setCollectionConfigPackageDefinition} - Provide the collection configuration for this chaincode.
* {@link Chaincode#setSequence setSequence} - Provide the modification number for this chaincode definition.
* {@link Chaincode#setPackage setPackage} - Provide the package when not packaging this chaincode locally.
* {@link Chaincode#setPackage setPackageId} - Provide the package ID when not installing this chaincode package locally.

The chaincode instance will allow for the packaging and installing of chaincode
to a peer within your organization with the following methods.
* {@link Chaincode#package package} Package the files at the locations provided.
* {@link Chaincode#install install} Install the package on the specified peers.

Once the chaincode definition has all the necessary attributes, it may be used
by a channel instance to be approved both for an organization and
then committed for use on the channel.

#### New methods on Channel
The {@link Channel} class has been enhanced to include new methods to approve
a chaincode for an organization and to commit it for channel wide use.

* {@link Channel#approveChaincodeForOrg approveChaincodeForOrg} - will approve
the chaincode for an organization on this channel
* {@link Channel#commitChaincode commitChaincode} - will commit
the chaincode for use on this channel.
* {@link Channel#queryChaincodeDefinition queryChaincodeDefinition} - will return
a {Chaincode} instance as defined on this peer on this channel
* {@link Channel#queryApprovalStatus queryApprovalStatus} - will indicate the
approval status for a chaincode name on this channel
* {@link Channel#queryInstalledChaincode queryInstalledChaincode} will indicate
by returning the label if the package ID is installed on this peer
* {@link Channel#queryInstalledChaincodes queryInstalledChaincodes} will indicate
all the package IDs and labels of installed chaincode on this peer
* {@link Channel#queryNamespaceDefinitions queryNamespaceDefinitions} will indicate
the chaincode names committed (running) on this channel

#### New method on Client
The {@link Client} class has been enhanced to include a new method to create
a {@link Chaincode} instance. This is the object to use for managing a
chaincode.

* {@link Client#newChaincode newChaincode} - Create a {@link Chaincode} instance.


### Step 1: Setup
In this step we will be building
the application objects needed to perform the operational steps that follow.
A fabric-client operational environment is required before any of the
following steps may be performed. A client instance is needed
that has a user store, crypto suite, and a user assigned. The target peers,
orderer, and channel instance objects will also be required prior to doing
any of the following steps.

The following sample code assumes that all of the normal fabric-client
setup has been completed and only shows the new chaincode lifecycle
related calls.

```
// get the chaincode instance associated with the client
const mychaincode = client.newChaincode('mychaincode', 'v1');

// The endorsement policy
const policy_def = {
   identities: [
      {role: {name: 'member', mspId: 'org1'}},
      {role: {name: 'member', mspId: 'org2'}}
   ],
   policy: {
       '1-of': [{'signed-by': 0}, {'signed-by': 1}]
   }
};
mychaincode.setEndorsementPolicyDefinition(policy_def);

// The collection configuration - optional.
const config_def = [{
   name: 'detailCol',
   policy: {
      identities: [
         {role: {name: 'member', mspId: 'Org1MSP'}},
         {role: {name: 'member', mspId: 'Org2MSP'}}
      ],
      policy: {
         '1-of': [{'signed-by': 0}, {'signed-by': 1}]
      }
   },
   requiredPeerCount: 1,
   maxPeerCount: 1,
   blockToLive: 100
}];
mychaincode.setCollectionConfigPackageDefinition(config_def));

// set the sequence (modification) number - default is 1
mychaincode.setSequence(1); // must increment for each definition change
```

### Step 2: Package
One organization will
take the source artifacts, chaincode source code and metadata files, and have
the fabric-client package them. This package may then be sent to other
organizations or administrators of your fabric network to be installed on
the network.

The following example is for the organization that packages the code
and then will send to other organizations to be installed.

```
// package the source code
const packge_request = {
   chaincodeType: 'golang',
   goPath: '/gopath',
   chaincodePath: '/path/to/code',
   metadataPath: '/path/to/metadat'
}
const package = await mychaincode.package(package_request);
```

The following example is for the organization that has not done the
packaging, but will do the install. It uses the package that was
produced above.

```
// use an existing package
mychaincode.setPackage(package);
```

### Step 3: Install
This step will be only required by organizations that will be running the chaincode
(executing transactions). The install will take the packaged source code artifacts
and send it to a peer or peers in your organization. Installing chaincode requires
admin authority for the organization. The peer will return a package ID value,
an unique identifer for this chaincode package. The package ID value will be needed
later when the chaincode is approved and committed. Organizations that will only
be approving or committing the chaincode will not require a package ID.
The chaincode instance object
that performs the install will also store the package ID
internally for the next step.

The following sample assumes that the chaincode instance object (`mychaincode`) has
been setup and packaged.

```
// install chaincode package on peers
 const install_request = {
   targets: [peer1, peer2],
   request_timeout: 20000 // give the peers some extra time
 }
const package_id = await mychaincode.install(install_request);

// package ID value is stored in the chaincode instance
const package_id = mychaincode.getPackageId();
```

For organizations that will not be running the chaincode and are
required to approve the chaincode will not require an package ID.

### Step 4: Approve for your organization
This step will approve a chaincode for your organization.
This will be required by enough organizations
to satisfy the channel's chaincode lifecycle system policy.
By default this will be a majority of the
organizations on the channel. Each of these organizations will endorse and
commit a transaction that approves a chaincode and it's definition settings.
This may be thought of not only as a definition of the chaincode but a vote
to authorize the running of the chaincode with these settings.
This definition is for a specific organization, specific settings,
and only on this channel.
The organizational chaincode definition transaction may be submitted at any
time, but must be submitted prior to being able to execute the chaincode
on a peer within the organization. A new organization may start
running an existing chaincode running on other organization
by approving the existing running chaincode definition for their organization.
The approve transactions must contain the same chaincode definition except for
the package ID value, this will be unique for each organization.
An organization will be able to submit the organizational chaincode approval
transactions without having installed the package.

The following sample assumes that the chaincode object being used (`mychaincode`)
has been setup and installed.
```
// send a approve chaincode for organization transaction
const tx_id = client.newTransactionID();
const request = {
   target: peer1,
   chaincode: mychaincode, // The chaincode instance fully populated
   txId: tx_id
}
// send to the peer to be endorsed
const {proposalResponses, proposal} = await mychannel.approveChaincodeForOrg(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
// send to the orderer to be committed
const results = await mychannel.sendTransaction(orderer_request);
```

### Step 5: Commit for the channel
This step will commit a chaincode for use on your channel.
The committing action will
not change the chaincode or it's settings, it will confirm that
enough organizations have approved the chaincode definitions
for the channel. 
The commit chaincode definition transaction will
be submitted by only one organization, however
the transaction must be endorsed by enough
organizations to satisfy the channel's chaincode lifecycle system policy
and there must be enough approved organizational chaincode definition
transactions that also satisfies the
channel's chaincode lifecycle system policy.
Think of the commit step as the counting of the votes to run the chaincode and
the approve step as the voting.
To be able to actually count the votes, the commit transaction must be
endorsed by enough members to satisfy the channel's chaincode lifecycle
system policy and then there must be enough approve votes to also satisfy the
channel's chaincode lifecycle system policy
before the chaincode will be allowed to run.
When only a chaincode setting has been changed, for example the endorsement policy,
enough organizations must approved step and then the commit must be run
to enable the change for the chaincode.

NOTE: Before submitting a new approve for a change to the chaincode definition,
the sequence number must be incremented. All organizations must be approving
the same chaincode definition settings before the commit step will succeed.

```
// send a commit chaincode for channel transaction
const tx_id = client.newTransactionID();
const request = {
   targets: [peer1, peer3],
   chaincode: mychaincode,
   txId: tx_id
}
// send to the peers to be endorsed
const {proposalResponses, proposal} = await mychannel.commitChaincode(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
// send to the orderer to be committed
const results = await mychannel.sendTransaction(orderer_request);
```

### Step 6: Initialize
This step may be used start new chaincode on your channel and initialize
the state of the channel. This step is only required when the chaincode
does not manage it's own initialization.
The initialize transaction will start the container and then call the
`Init` method of the chaincode with the provided arguments. The chaincode
definition must be defined as "initRequired=true"  and
the `is_init` request parameter must be true for the "Init" method
to be called on this `sendTransaction` rather than the "Invoke" method
of your chaincode.
```
// initialize the chaincode
const tx_id = client.newTransactionID();
const request = {
   chaincodeId : chaincodeId,
   fcn: 'init',
   args: args,
   txId: tx_id,
   is_init: true // must be set to initialization
}
// starting the container will take longer than the normal request-timeout
const init_results = await mychannel.sendTransaction(request, 20000);
const orderer_request = {
   proposalResponses: init_results[0],
   proposal: init_results[1]
}
// send to the orderer to be committed
const results = await mychannel.sendTransaction(orderer_request);
```

### Sample situations
The following samples will show the important snippets needed to perform the
different situations.

#### New chaincode
When installing chaincode for the first time, 5 steps must be run.
The initialization step is optional.
The following sample shows the code needed when the organization
will be packaging the chaincode, installing it, and the organization
to approve and commit it for the entire channel and initialize it.

```
// step 1: setup
const mychaincode = client.newChaincode('mychaincode', 'version1');
const policy_def = { ... };
mychaincode.setEndorsementPolicyDefinition(policy_def);
mychaincode.setSequence(1); //set to one for a new chaincode
mychaincode.setInitRequired(true);

// step 2: package
const package_request = {
   chaincodeType: 'golang',
   goPath: '/gopath',
   chaincodePath: '/path/to/code',
   metadataPath: '/path/to/metadata'
}
const package = await mychaincode.package(package_request);

// step 3: install
 const install_request = {
   target: peer1,
   request_timeout: 10000 // give the peer some extra time
 }
const package_id = await mychaincode.install(install_request);

// step 4: approve
const tx_id = client.newTransactionID();
const request = {
   targets: [peer1],
   chaincode: mychaincode,
   txId: tx_id
}
const {proposalResponses, proposal} = await mychannel.approveChaincodeForOrg(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
const results = await mychannel.sendTransaction(orderer_request);

//step 5: commit
const tx_id = client.newTransactionID();
const request = {
   targets: [peer1, peer3],
   chaincode: mychaincode,
   txId: tx_id
}
const {proposalResponses, proposal} = await mychannel.commitChaincode(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
const results = await mychannel.sendTransaction(orderer_request);

// step 6: init
const tx_id = client.newTransactionID();
const request = {
   chaincodeId : chaincodeId,
   fcn: 'init',
   args: args,
   txId: tx_id,
   is_init: true
}
const init_results = await mychannel.sendTransaction(request, 20000);
const orderer_request = {
   proposalResponses: init_results[0],
   proposal: init_results[1]
}
const results = await mychannel.sendTransaction(orderer_request);
```

#### Update the chaincode code
When updating the chaincode the 5 steps must be performed and maybe the
initialization might have to be run. Care must be
taken in setting the sequence number to be sure it reflects the current
modification number of the chaincode definition. In this case no other
changes have been made to the chaincode definition since it was first
installed, so the sequence number will be 2.

The following sample shows the code needed when the organization
will be packaging the chaincode, installing it, and being the organization
to approve and commit it for the entire channel.
```
// step 1: setup
const mychaincode = client.newChaincode('mychaincode', 'version2');
const policy_def = { ... };
mychaincode.setEndorsementPolicyDefinition(policy_def);
mychaincode.setSequence(2);

// step 2: package
// package the source code
const package_request = {
   chaincodeType: 'golang',
   goPath: '/gopath',
   chaincodePath: '/path/to/code',
   metadataPath: '/path/to/metadata'
}
const package = await mychaincode.package(package_request);

// step 3: install
 const install_request = {
   target: peer1,
   request_timeout: 10000 // give the peer some extra time
 }
const package_id = await mychaincode.install(install_request);

// step 4: approve
const tx_id = client.newTransactionID();
const request = {
   targets: [peer1],
   chaincode: mychaincode,
   txId: tx_id
}
const {proposalResponses, proposal} = await mychannel.approveChaincodeForOrg(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
const results = await mychannel.sendTransaction(orderer_request);

//step 5: commit
const tx_id = client.newTransactionID();
const request = {
   targets: [peer1, peer3],
   chaincode: mychaincode,
   txId: tx_id
}
// send to the peers to be endorsed
const {proposalResponses, proposal} = await mychannel.commitChaincode(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
// send to the orderer to be committed
const results = await mychannel.sendTransaction(orderer_request);

```

#### Modify the Endorsement policy

When updating the endorsement policy only 4 steps must be performed and care must be
taken in setting the sequence number to be sure it reflects the current
modification number of the chaincode definition. In this case let us assume
that the chaincode has been updated once, so the sequence number will be 3.
Step 2 may be skipped as there is not a new code package. It might
seem that we can also skip the install step, but we still need the package ID value
to uniquely identify the chaincode source that was installed earlier and has
not been changed.

The following sample shows the code needed when the organization
has updated the endorsement policy and is the organization
to approve and commit it for the entire channel.
```
// step 1: setup
const mychaincode = client.newChaincode('mychaincode', 'version2');
const new_policy_def = { ... };
mychaincode.setEndorsementPolicyDefinition(new_policy_def);
mychaincode.setSequence(3);

// step 3: install
mychaincode.setPackageId(package_id);

// step 4: approve
const tx_id = client.newTransactionID();
const request = {
   target: peer1,
   chaincode: mychaincode,
   txId: tx_id
}
const {proposalResponses, proposal} = await mychannel.approveChaincodeForOrg(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
const results = await mychannel.sendTransaction(orderer_request);

//step 5: commit
const tx_id = client.newTransactionID();
const request = {
   targets: [peer1, peer3],
   chaincode: mychaincode,
   txId: tx_id
}
// send to the peers to be endorsed
const {proposalResponses, proposal} = await mychannel.commitChaincode(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
// send to the orderer to be committed
const results = await mychannel.sendTransaction(orderer_request);
```

#### New organization needs to run the chaincode

When a new organization wishes to run an existing chaincode it will have to
perform all but the commit step. This sample does assume that the endorsement
policy allows the new organization to endorse transactions or this organization
will only be able to audit the ledger.

```
// step 1: setup
const mychaincode = client.newChaincode('mychaincode', 'version2');
const policy_def = { ... }; // must be the same as what the other organizations have used
mychaincode.setEndorsementPolicyDefinition(policy_def);
mychaincode.setSequence(3); // use existing value, if there is change, then up this number

// step 2: package
// package the source code
const package_request = {
   chaincodeType: 'golang',
   goPath: '/gopath',
   chaincodePath: '/path/to/code',
   metadataPath: '/path/to/metadata'
}
const package = await mychaincode.package(package_request);

// step 3: install
 const install_request = {
   target: peer1,
   request_timeout: 10000 // give the peer some extra time
 }
const package_id = await mychaincode.install(install_request);

// step 4: approve
// only the new organization has to run, unless there is change
// to the definition
const tx_id = client.newTransactionID();
const request = {
   targets: [peer1], // this peer is in my org
   chaincode: mychaincode,
   txId: tx_id
}
const {proposalResponses, proposal} = await mychannel.approveChaincodeForOrg(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
const results = await mychannel.sendTransaction(orderer_request);

// step 5: commit
// This step is not required, however if there was a change to the
// chaincode definition and the sequence number had to change,
// then it must be run
```
#### Use an existing endorsement policy
You may use policies that are defined on your channel.

#### Show the new Queries
QueryChaincodeDefinition
QueryApprovalStatus
QueryInstalledChaincode
QueryInstalledChaincodes
QueryNamespaceDefinitions

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.

