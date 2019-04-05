const fs = require('fs');

module.exports = {
	check: function(req, res, next){
		try{
			req.deployer.version = fs.readFileSync(req.deployer.projectVersion).toString().trim();
		}catch(e){
			req.deployer.version = null;
		}
		next();
	},	
	update: function(req, hash){
		fs.writeFileSync(req.deployer.projectVersion, hash.toString().trim());
	}
};