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
	"fmt"
	"strconv"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
	"encoding/json"
	"bytes"
)

var logger = shim.NewLogger("example_cc0")

// SimpleChaincode example simple Chaincode implementation
type SimpleChaincode struct {
}
type Land struct {
	Id int
	Name string
}
func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response  {
	logger.Info("########### test Init ###########")
	_, args := stub.GetFunctionAndParameters()
	logger.Info(args)
	return  shim.Success(nil)

}


func (t *SimpleChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("########### test Invoke ###########")

	function, args := stub.GetFunctionAndParameters()
	logger.Infof("args:",args)
	logger.Infof("function:",function)
	if function == "query" {
		// queries an entity state
		return t.query(stub, args)
	}
	if function == "add" {
		// add an entity from its state
		return t.add(stub, args)
	}
	if function == "testRichQuery" {
		// testRichQuery an entity from its state
		return t.testRichQuery(stub, args)
	}
	//logger.Errorf("Unknown action, check the first argument, must be one of 'delete', 'query', or 'move'. But got: %v", args[0])
	return shim.Error(fmt.Sprintf("Unknown action, check the first argument, must be one of 'delete', 'query', or 'move'. But got: %v", args[0]))
}

func (t *SimpleChaincode) add(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	id,err:=strconv.Atoi(args[0])
	student1:=Land{id,args[1]}
	key:="Land:"+args[0]//Key格式为 Land:{Id}
	logger.Infof("add key:",key)
	studentJsonBytes, err := json.Marshal(student1)//Json序列号
	if err != nil {
		return shim.Error(err.Error())
	}
	logger.Infof("add studentJsonBytes:",studentJsonBytes)
	err= stub.PutState(key,studentJsonBytes)
	if(err!=nil){
		return shim.Error(err.Error())
	}
	return shim.Success([]byte("Saved Land!"))
}


// Query callback representing the query of a chaincode
func (t *SimpleChaincode) query(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	key:="Land:"+args[0]//Key格式为 Student:{Id}
	dbStudentBytes,err:= stub.GetState(key)
	logger.Infof("add key:",key)

	var land Land;
	err=json.Unmarshal(dbStudentBytes,&land)//反序列化
	logger.Infof("add dbStudentBytes:",dbStudentBytes)
	if err != nil {
		return shim.Error("{\"Error\":\"Failed to decode JSON of: " + string(dbStudentBytes)+ "\" to land}")
	}

	fmt.Println("Read land from DB, name:"+land.Name)

	return shim.Success(dbStudentBytes)
}
//模糊查询 富查询GetQueryResult(query string) (StateQueryIteratorInterface, error)
func (t *SimpleChaincode) testRichQuery(stub shim.ChaincodeStubInterface, args []string) pb.Response{
	name:=args[0]//这里按理来说应该是参数传入
	queryString := fmt.Sprintf("{\"selector\":{\"Name\":\"%s\"}}", name)
	logger.Infof("query queryString:",queryString)
	resultsIterator,err:= stub.GetQueryResult(queryString)//必须是CouchDB才行
	if err!=nil{
		return shim.Error("Rich query failed")
	}
	lands,err:=getListResult(resultsIterator)
	if err!=nil{
		return shim.Error("Rich query failed")
	}
	return shim.Success(lands)
}
//历史数据查询GetHistoryForKey(key string) (HistoryQueryIteratorInterface, error)
func (t *SimpleChaincode) testHistoryQuery(stub shim.ChaincodeStubInterface, args []string) pb.Response{
	student1:=Land{1,"Devin Zeng"}
	key:="Student:"+strconv.Itoa(student1.Id)
	it,err:= stub.GetHistoryForKey(key)
	if err!=nil{
		return shim.Error(err.Error())
	}
	var result,_= getHistoryListResult(it)
	return shim.Success(result)
}
func getHistoryListResult(resultsIterator shim.HistoryQueryIteratorInterface) ([]byte,error){

	defer resultsIterator.Close()
	// buffer is a JSON array containing QueryRecords
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		item,_:= json.Marshal( queryResponse)
		buffer.Write(item)
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")
	fmt.Printf("queryResult:\n%s\n", buffer.String())
	return buffer.Bytes(), nil
}
//范围查询比如我们要查询编号从1号到3号的所有学生，那么我们的查询代码可以这么写：
func (t *SimpleChaincode) testRangeQuery(stub shim.ChaincodeStubInterface, args []string) pb.Response{
	resultsIterator,err:= stub.GetStateByRange("Land:1","Land:3")
	if err!=nil{
		return shim.Error("Query by Range failed")
	}
	students,err:=getListResult(resultsIterator)
	if err!=nil{
		return shim.Error("getListResult failed")
	}
	return shim.Success(students)
}
//Key区间查询GetStateByRange(startKey, endKey string) (StateQueryIteratorInterface, error)
func getListResult(resultsIterator shim.StateQueryIteratorInterface) ([]byte,error){

	defer resultsIterator.Close()
	// buffer is a JSON array containing QueryRecords
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Record\":")
		// Record is a JSON object, so we write as-is
		buffer.WriteString(string(queryResponse.Value))
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")
	fmt.Printf("queryResult:\n%s\n", buffer.String())
	return buffer.Bytes(), nil
}


func main() {
	err := shim.Start(new(SimpleChaincode))
	if err != nil {
		logger.Errorf("Error starting Simple chaincode: %s", err)
	}
}
