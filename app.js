var csv = require("fast-csv");
var fs = require('fs');
var _ = require('lodash');
var request = require('request');
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
server.listen(80);
var page = 1;
var dadosMaisUol = []
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/analitics');

var Visualizacao = mongoose.model('Visualizacao', {
	editoria: String,
	mediaId: String,
	titulo: String ,
	videoStart: String,
	videoStartPorcentagem: String,
	videosCompletos : String,
	videosCompletosPorcentagem: String,
	taxaDeVideosCompletos : String,
	dataInsercao: { type: Date, default: Date.now },
	tags: []
});

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.get('/teste', function(req, res){
	res.send(dadosMaisUol.length.toString());
})

app.get('/maisuol/:channel/:tagId', function(req, res){
	 var channel = req.params.channel;
	 var tagId=req.params.tagId;

	 function requestMaisUol (cb) {
		 request('http://mais.uol.com.br/apiuol/mediasList.js?tagIds='+tagId+'%20&codProfile='+channel+'&index.itemsPerPage=100&index.currentPage=' + page, function (error, response, dadosResponse) {
		  if (!error && response.statusCode == 200) {
		  	var dados = JSON.parse(dadosResponse);
		  	console.log(dados.list.length);
		  	dadosMaisUol = dadosMaisUol.concat(dados.list);
		  	page++;
		  	if(dados && dados.paging && page <= dados.paging.totalPages){
		  		console.log('buscado com sucesso a pagina ' + (page -1) + ' do total de ' + dados.paging.totalPages)
		  		requestMaisUol();
		  	}
		  		
		  	else{
		  		page = 0;
		  		res.send({
		  			sucess: true,
		  			message: 'dados carregados com sucesso da uol.'
		  		});
		  	}
		  }else{
		  	console.log(error);
		  }
		})
	 }

	 requestMaisUol();

	
})

io.on('connection', function (socket) {
 	
 	socket.on('importar', function(dado){
 		if(dado){
 			lerDiretorio(socket);
 		}
 	})
});



function lerDiretorio (socket){
	var dir='dados/';
	var data={};

	fs.readdir(dir,function(err,files){
	    if (err) throw err;
	     files.forEach(function(file){
	     	var stream = fs.createReadStream(dir+file);
	     	salvarDados(stream, file, socket);
	     });
	});
}




function salvarDados(stream, file, socket){
	var EDITORIA = "";
	csv
	 .fromStream(stream)
	 .on("data", function(data){
	 	if(data.length == 7){
	 		if(data[1].length > 10)
	 			EDITORIA = data[1];
	 	}
	 	if(data.length == 8){
	 		var mediaId = data[2].split(' ')[0]
	 		var array = _.result(_.find(dadosMaisUol, {'mediaId' : parseInt(mediaId)}), 'tags');

	 		if(array && array.length){
	 			console.log('tem conteudo');
	 		}
	 	
	 		var visualizacao = new Visualizacao({
	 			editoria: EDITORIA,
	 			mediaId : mediaId,
	 			titulo: data[2],
	 			videoStart: data[3],
	 			videoStartPorcentagem: data[4],
	 			videosCompletos: data[5],
	 			videosCompletosPorcentagem: data[6],
	 			taxaDeVideosCompletos: data[7],
	 			tags: array
	 		});
			visualizacao.save(function (err) {
			  if (err) // ...
			  	console.log('nao consegui cadastrar no banco de dados');
			});
	 	}

	    // console.log({titulo: data[2], });
	 })
	 .on("end", function(){
	    socket.emit('importarDone',{
	    	arquivo: file,
	    	sucess: true
	    } )
	 });
}


