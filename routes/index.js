var express = require('express');
var router = express.Router();

/*/!* GET home page. *!/
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});*/
// 对网站首页的访问返回 "Hello World!" 字样
router.get('/', function (req, res) {
    var data={ id:"11",
        name:"jack"
    }
    res.send(JSON.stringify(data));
    //res.send()
});

// 网站首页接受 POST 请求
router.post('/', function (req, res) {
    res.send('Got a POST request');
});

// /user 节点接受 PUT 请求
router.put('/user', function (req, res) {
    res.send('Got a PUT request at /user');
});

// /user 节点接受 DELETE 请求
router.delete('/user', function (req, res) {
    res.send('Got a DELETE request at /user');
});

module.exports = router;
