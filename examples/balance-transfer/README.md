##Balance transfer

A sample node-based app to demonstrate ***fabric-client*** & ***fabric-ca-client*** Node SDK APIs

###Prerequisites and setup:
Follow the [Getting Started](http://hyperledger-fabric.readthedocs.io/en/latest/gettingstarted/#getting-started-with-v10-hyperledger-fabric-app-developers) instructions in the Hyperledger Fabric documentation.

Once you have completed the above setup, you will be provisioned a local network with following configuration:
- 3 **peers**, a **solo orderer**,  and a **CA server**
- A channel - `myc1` - and a corresponding genesis block - `myc1.block`
- With the peers - `peer0`, `peer1`, and `peer2` - automatically joined to the channel.

###Running the sample program:
The step-by-step instructions for executing the sample program are outlined in the [Getting Started](http://hyperledger-fabric.readthedocs.io/en/latest/gettingstarted/#use-node-sdk-to-registerenroll-user-and-deployinvokequery) documentation.  

**NOTE**: If you want to run the app from this directory, ensure that you set the `GOPATH`
variable to the correct folder during deployment execution:

```
	GOPATH=$PWD/../../test/fixtures node deploy.js
```

###Configuration considerations

You have the ability to change configuration parameters by editing the **config.json** file.

####IP Address and PORT information
If you choose to customize your docker-compose yaml file by hardcoding IP Addresses
and PORT information for your `peers` and `orderer`, then you __MUST__ also add the
identical values into the **config.json** file.  The four paths shown below will
need to be adjusted to match your docker-compose yaml file.  

 ```
 "orderer":{
      "orderer_url":"grpc://x.x.x.x:7050"
   },
 "peers":[
      {
         "peer_url":"grpc://x.x.x.x:7051"
      },
      {
         "peer_url":"grpc://x.x.x.x:8051"
      },
      {
         "peer_url":"grpc://x.x.x.x:9051"
      }
   ],

 ```

####Discover IP Address
To retrieve the IP Address for one of your network entities, issue the following command:
```bash
# this will return the IP Address for peer0
docker inspect peer0 | grep IPAddress
```

####Channel name

You can manually create your own channel from the cli container.  If you choose to do so,
the `ChannelID` field must also be updated in **config.json** to match your channel name.
For example:
```bash

   "chainName":"fabric-client1",
   "chaincodeID":"mycc",
   "channelID":"YOUR_CHANNEL_NAME",
   "goPath":"../../test/fixtures",
```


####Chaincode name
If you want to deploy a chaincode with a different name, then you must also update the
`chaincodeID` field in **config.json** to match your chaincode name.  For example:

```bash

   "chainName":"fabric-client1",
   "chaincodeID":"YOUR_CHAINCODE_NAME",
   "channelID":"YOUR_CHANNEL_NAME",
   "goPath":"../../test/fixtures",
```

####Chaincode path
The `chaincodePath` parameter tells the node program where to look when you execute
the deployment.  The default setup places the go code in `/src/github.com/example_cc`
path.  You can modify this path with a new name and your own go code.  For example:

```
"chaincodePath":"github.com/my_chaincode",
```

#### Transaction/Query payload information

You can modify payload information based on your chaincode implementation. For instance,
if you want to create a marble using [marbles02](https://github.com/hyperledger/fabric/blob/master/examples/chaincode/go/marbles02/marbles_chaincode.go)
chaincode, change your `invokeRequest` in **config.json** as shown below:


```
 "invokeRequest":{
      "functionName":"initMarble",
      "args":[
         "marble1",
         "blue",
         "33",
         "JohnDoe"
      ]
   },
```
