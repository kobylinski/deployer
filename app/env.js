const fs = require('fs');  
const path = require('path');

module.exports = function(req, res, next){


	const config = {
		documentPath: req.headers['x-document-path'],
		basePath: req.headers['x-base-path'] || '',
		serverRole: req.headers['x-server-role'],
		serverId: req.headers['x-server-id']
	};	

	config.projectVersion = config.documentPath + req.headers['x-project-version'];
	if(fs.existsSync(config.projectVersion)){
		try{
			fs.accessSync(config.projectVersion, fs.constants.R_OK | fs.constants.W_OK);
		}catch(e){
			next( Error( 'Project version file is not writable/readable' ) );
		}
	}else{
		try{
			fs.accessSync(path.dirname(config.projectVersion), fs.constants.R_OK | fs.constants.W_OK);
		}catch(e){
			next( Error( 'Not able to create project version file' ) );
		}
	}

	try{
		config.projectPath = fs.realpathSync(config.documentPath + req.headers['x-project-path']);
	}catch(e){
		next( Error( 'Project path not exists' ) );
	}

	try{
		config.repoPath = fs.realpathSync(config.documentPath + req.headers['x-repo-path']);
	}catch(e){
		next( Error( 'Local repository path not exists' ) );
	}

	try{
		fs.accessSync(config.projectPath, fs.constants.R_OK | fs.constants.W_OK);
	}catch(e){
		return next( Error( 'Project path is not writable' ) );
	}

	try{
		fs.accessSync(config.repoPath, fs.constants.R_OK | fs.constants.W_OK);
	}catch(e){
		return next( Error( 'Repo path is not writable' ) );
	}

	req.deployer = config;

	next();
}