/*
Copyright IBM Corp. 2016 All Rights Reserved.

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
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

var logger = shim.NewLogger("example_cc0_private")

// SimpleChaincode example simple Chaincode implementation
type SimpleChaincode struct {
}

// private data for collection 'detailCol'
type detailCol struct {
	ObjectType string `json:"docType"` //docType is used to distinguish the various types of objects in state database
	Name       string `json:"name"`    //the fieldtags are needed to keep case from bouncing around
	Color      string `json:"color"`
	Size       int    `json:"size"`
	Owner      string `json:"owner"`
}

// private data for collection 'sensitiveCol'
type sensitiveCol struct {
	ObjectType string `json:"docType"` //docType is used to distinguish the various types of objects in state database
	Name       string `json:"name"`    //the fieldtags are needed to keep case from bouncing around
	Price      int    `json:"price"`
}

// Init - initialize the state
func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response  {
	logger.Info("########### example_cc0_private Init ###########")

	_, args := stub.GetFunctionAndParameters()
	var A, B string    // Entities
	var Aval, Bval int // Asset holdings
	var err error

    if len(args) != 4 {
		return shim.Error("Incorrect number of arguments. Expecting 4")
	}

	// Initialize the chaincode
	A = args[0]
	Aval, err = strconv.Atoi(args[1])
	if err != nil {
		return shim.Error("Expecting integer value for asset holding")
	}
	B = args[2]
	Bval, err = strconv.Atoi(args[3])
	if err != nil {
		return shim.Error("Expecting integer value for asset holding")
	}
	logger.Infof("Aval = %d, Bval = %d\n", Aval, Bval)

	// Write the state to the ledger
	err = stub.PutState(A, []byte(strconv.Itoa(Aval)))
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(B, []byte(strconv.Itoa(Bval)))
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(nil)
}

// Invoke - Transaction makes payment of X units from A to B
func (t *SimpleChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("########### example_cc0_private Invoke ###########")

	function, args := stub.GetFunctionAndParameters()

	if function == "delete" {
		// Deletes an entity from its state
		return t.delete(stub, args)
	}

	if function == "query" {
		// queries an entity state
		return t.query(stub, args)
	}

	if function == "move" {
		// Deletes an entity from its state
		return t.move(stub, args)
	}

	if function == "setPrivateData" {
		// set private data
		return t.setPrivateData(stub, args)
	}

	if function == "queryDetail" {
		// get private data
		return t.queryDetail(stub, args)
	}

	if function == "querySensitive" {
		// get private data
		return t.querySensitive(stub, args)
	}

	logger.Errorf("Unknown action, check the first argument, must be one of 'delete', 'query', or 'move'. But got: %v", args[0])
	return shim.Error(fmt.Sprintf("Unknown action, check the first argument, must be one of 'delete', 'query', or 'move'. But got: %v", args[0]))
}

func (t *SimpleChaincode) move(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	// must be an invoke
	var A, B string    // Entities
	var Aval, Bval int // Asset holdings
	var X int          // Transaction value
	var err error

	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 4, function followed by 2 names and 1 value")
	}

	A = args[0]
	B = args[1]

	// Get the state from the ledger
	// TODO: will be nice to have a GetAllState call to ledger
	Avalbytes, err := stub.GetState(A)
	if err != nil {
		return shim.Error("Failed to get state")
	}
	if Avalbytes == nil {
		return shim.Error("Entity not found")
	}
	Aval, _ = strconv.Atoi(string(Avalbytes))

	Bvalbytes, err := stub.GetState(B)
	if err != nil {
		return shim.Error("Failed to get state")
	}
	if Bvalbytes == nil {
		return shim.Error("Entity not found")
	}
	Bval, _ = strconv.Atoi(string(Bvalbytes))

	// Perform the execution
	X, err = strconv.Atoi(args[2])
	if err != nil {
		return shim.Error("Invalid transaction amount, expecting a integer value")
	}
	Aval = Aval - X
	Bval = Bval + X
	logger.Infof("Aval = %d, Bval = %d\n", Aval, Bval)

	// Write the state back to the ledger
	err = stub.PutState(A, []byte(strconv.Itoa(Aval)))
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(B, []byte(strconv.Itoa(Bval)))
	if err != nil {
		return shim.Error(err.Error())
	}

    return shim.Success([]byte("move succeed"))
}

// Deletes an entity from state
func (t *SimpleChaincode) delete(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	name := args[0]

	// Delete the key from the state in ledger
	err := stub.DelState(name)
	if err != nil {
		return shim.Error("Failed to delete state")
	}

	// Delete the key from detailCol collection
	err = stub.DelPrivateData("detailCol", name) //remove the marble from chaincode state
	if err != nil {
		return shim.Error("Failed to delete private data from detailCol:" + err.Error())
	}

	// Delete the key from sensitiveCol collection
	err = stub.DelPrivateData("sensitiveCol", name) //remove the marble from chaincode state
	if err != nil {
		return shim.Error("Failed to delete private data from sensitiveCol:" + err.Error())
	}

	return shim.Success(nil)
}

// ===============================================
// setPrivateData - set private data to collections detailCol and sensitiveCol
// ===============================================
func (t *SimpleChaincode) setPrivateData(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	//  0-name  1-color  2-size  3-owner  4-price
	// "test",  "blue",  "35",   "bob",   "99"
	if len(args) != 5 {
		return shim.Error("Incorrect number of arguments. Expecting 5")
	}

	// ==== Input sanitation ====
	fmt.Println("- start setPrivateData")
	if len(args[0]) == 0 {
		return shim.Error("1st argument must be a non-empty string")
	}
	if len(args[1]) == 0 {
		return shim.Error("2nd argument must be a non-empty string")
	}
	if len(args[2]) == 0 {
		return shim.Error("3rd argument must be a non-empty string")
	}
	if len(args[3]) == 0 {
		return shim.Error("4th argument must be a non-empty string")
	}
	if len(args[4]) == 0 {
		return shim.Error("5th argument must be a non-empty string")
	}
	name := args[0]
	color := strings.ToLower(args[1])
	owner := strings.ToLower(args[3])
	size, err := strconv.Atoi(args[2])
	if err != nil {
		return shim.Error("3rd argument must be a numeric string")
	}
	price, err := strconv.Atoi(args[4])
	if err != nil {
		return shim.Error("5th argument must be a numeric string")
	}

	// ==== Check if name already exists ====
	//detailAsBytes, err := stub.GetPrivateData("detailCol", name)
	//if err != nil {
	//	return shim.Error("Failed to get detailCol private data: " + err.Error())
	//} else if detailAsBytes != nil {
	//	fmt.Println("This name already exists: " + name)
	//	return shim.Error("This name already exists: " + name)
	//}

	// ==== Create the object and marshal to JSON ====
	objectType := "detailCol"
	detail := &detailCol{objectType, name, color, size, owner}
	detailJSONasBytes, err := json.Marshal(detail)
	if err != nil {
		return shim.Error(err.Error())
	}

	// === Save data to state ===
	err = stub.PutPrivateData("detailCol", name, detailJSONasBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	// ==== Save data in sensitiveCol ====
	objectType = "sensitiveCol"
	sensitiveData := &sensitiveCol{objectType, name, price}
	sensitiveDataBytes, err := json.Marshal(sensitiveData)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = stub.PutPrivateData("sensitiveCol", name, sensitiveDataBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	fmt.Println("- end setPrivateData")
	return shim.Success([]byte("set private data"))
}

// Query callback representing the query of a chaincode
func (t *SimpleChaincode) query(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	var A string // Entities
	var err error

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting name of the person to query")
	}

	A = args[0]

	// Get the state from the ledger
	Avalbytes, err := stub.GetState(A)
	if err != nil {
		jsonResp := "{\"Error\":\"Failed to get state for " + A + "\"}"
		return shim.Error(jsonResp)
	}

	if Avalbytes == nil {
		jsonResp := "{\"Error\":\"Nil amount for " + A + "\"}"
		return shim.Error(jsonResp)
	}

	jsonResp := "{\"Name\":\"" + A + "\",\"Amount\":\"" + string(Avalbytes) + "\"}"
	logger.Infof("Query Response:%s\n", jsonResp)
	return shim.Success(Avalbytes)
}

// ===============================================
// queryDetail - read private data from collection detailCol
// ===============================================
func (t *SimpleChaincode) queryDetail(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var name, jsonResp string
	var err error

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting a name to query")
	}

	fmt.Println("- start query detail")

	name = args[0]
	valAsbytes, err := stub.GetPrivateData("detailCol", name) //get data from detailCol
	if err != nil {
		jsonResp = "{\"Error\":\"Failed to get private state for " + name + "\"}"
		fmt.Println("- query detail, return error " + jsonResp);
		return shim.Error(jsonResp)
	} else if valAsbytes == nil {
		jsonResp = "{\"Error\":\"Detail does not exist: " + name + "\"}"
		fmt.Println("- query detail, return error " + jsonResp);
		return shim.Error(jsonResp)
	}

	fmt.Println("- end query detail, return " + string(valAsbytes));

	return shim.Success(valAsbytes)
}

// ===============================================
// querySensitive - read private data from collection sensitiveCol
// ===============================================
func (t *SimpleChaincode) querySensitive(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var name, jsonResp string
	var err error

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting a name to query")
	}

	fmt.Println("- start query sensitive");

	name = args[0]
	valAsbytes, err := stub.GetPrivateData("sensitiveCol", name) //get data from detailCol
	if err != nil {
		jsonResp = "{\"Error\":\"Failed to get private state for " + name + "\"}"
		fmt.Println("- query sensitive, return error " + jsonResp);
		return shim.Error(jsonResp)
	} else if valAsbytes == nil {
		jsonResp = "{\"Error\":\"Detail does not exist: " + name + "\"}"
		fmt.Println("- query sensitive, return error " + jsonResp);
		return shim.Error(jsonResp)
	}

	fmt.Println("- end query sensitive, return " + string(valAsbytes));
	return shim.Success(valAsbytes)
}

func main() {
	err := shim.Start(new(SimpleChaincode))
	if err != nil {
		logger.Errorf("Error starting Simple chaincode: %s", err)
	}
}
