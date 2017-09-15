var express = require('express');
var router = express.Router();
var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);
var e2eUtils = require('../test/integration/api/e2eUtils');
var utils = require('../fabric-client/lib/utils.js');
var logger = utils.getLogger('land');
router.post("/query", function (req, res) {
    console.log(req.query.name);
    console.log(req.query.id);
    console.log(req.body.name);
    console.log(req.body.id);
    var data = [];


    e2eUtils.queryChaincode('org2', 'v0', req.body.id)
        .then((result) => {

            if (result) {
                if(result[0].code!='2')
                for (let i = 0; i < result.length; i++) {
                    logger.info(result[i].toString('utf8'));
                    data.push(result[i].toString('utf8'));
                }
                logger.info('Successfully query chaincode on the channel');

            }
            else {
                logger.info('Failed to query chaincode ');

            }
            res.json(data);
        }, (err) => {
            logger.info('Failed to query chaincode on the channel. ' + err.stack ? err.stack : err);
            res.json(data);
        }).catch((err) => {
        logger.info('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
        res.json(data);
    });
});
router.post("/add", function (req, res) {
    console.log(req.body.name);
    console.log(req.body.id);
    var data2 = {
        id:req.body.id,
        name:req.body.name
    };

    var data ={
        state:0,
        msg:"ok"
    };
    e2eUtils.invokeChaincode('org2', 'v0',  false,data2)
        .then((result) => {
            if(result){
                //res.json(data);
            }
            else {
                data.state=1;
                data.msg="error";
            }
            res.json(data);
        }, (err) => {
            data.state=1;
            data.msg="error";
            res.json(data);
        }).catch((err) => {
        data.state=1;
        data.msg="error";
        res.json(data);
    });
});


module.exports = router;