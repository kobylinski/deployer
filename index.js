require('dotenv').config();
const app = require('express')();
const path = require('path');
const fs = require('fs');  

const jobs = {};

app.get('*', function(req, res){
	res.setHeader('Content-Type', 'application/json');
	
	const jobId = req.headers.root_path;
	if(typeof jobs[jobId] !== 'undefined'){
		return res.json(false);
	}

	var projectRoot = path.dirname(jobId);
	var repoRoot = projectRoot + '/repo';

	if(!fs.existsSync(repoRoot)){
		return res.json(false);
	}


	res.json(true);
});

app.listen(process.env.PORT);




