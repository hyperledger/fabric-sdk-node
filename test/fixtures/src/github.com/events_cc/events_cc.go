/*
Copyright London Stock Exchange 2017 All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

		 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package main

import (
	"fmt"
	"strconv"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)
var logger = shim.NewLogger("events_cc")

// EventSender example simple Chaincode implementation
type EventSender struct {
}

// Init function
func (t *EventSender) Init(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("*********** Init ***********")

	err := stub.PutState("num_events", []byte("0"))
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(nil)
}

func (t *EventSender) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("*********** Invoke ***********")
	function, args := stub.GetFunctionAndParameters()

	if function != "invoke" {
		return shim.Error("Unknown function call")
	}

	if args[0] == "invoke" {
		return t.invoke(stub)
	} else if args[0] == "query" {
		return t.query(stub)
	} else if args[0] == "clear" {
		return t.clear(stub)
	}

	return shim.Error("Invalid invoke function name. Expecting \"invoke\" \"query\"")
}

// Invoke function
func (t *EventSender) invoke(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("########### invoke start ###########")

	_ , args := stub.GetFunctionAndParameters()
	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}
	b, err := stub.GetState("num_events")
	if err != nil {
		return  shim.Error("Failed to get state")
	}
	num_events, _ := strconv.Atoi(string(b))

	tosend := "Event " + string(b) + args[1]
	eventName := "evtsender" + args[0]

	logger.Infof("########### invoke - num_events:%s\n", num_events)
	logger.Infof("########### invoke - tosend:%s\n", tosend)
	logger.Infof("########### invoke - eventName:%s\n", eventName)

	err = stub.PutState("num_events", []byte(strconv.Itoa(num_events+1)))
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.SetEvent(eventName, []byte(tosend))
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(nil)
}

// Clear State function
func (t *EventSender) clear(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("########### clear ###########")

	err := stub.PutState("num_events", []byte("0"))
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(nil)
}

// Query function
func (t *EventSender) query(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("########### query ###########")

	b, err := stub.GetState("num_events")
	num_events, _ := strconv.Atoi(string(b))
	logger.Infof("########### query - num_events:%s\n", num_events)

	if err != nil {
		return shim.Error("Failed to get state")
	}
	return shim.Success(b)
}

func main() {
	err := shim.Start(new(EventSender))
	if err != nil {
		fmt.Printf("Error starting EventSender chaincode: %s", err)
	}
}
