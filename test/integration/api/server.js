var http = require('http');

var server = http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});

    res.end('Hello World\n');
   /* //如果你发一个GET到http://127.0.0.1:1337/test?a=1&b=2的话
    var url_info = require('url').parse(req.url, true);

        req.pipe(res);*/

});
server.listen(1337, '127.0.0.1');
//在server关闭的时候也关闭mysql连接
server.on('close',function(){
    connection.end();
});
console.log('listening on port  1337');