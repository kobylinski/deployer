const jobs = {};

module.exports = {
	watch: (req, res, next) => {
		if(typeof jobs[req.deployer.documentPath] !== 'undefined'){
			return next( Error( 'Working...' ) );
		}

		if(req.url.startsWith('/repo')){
			jobs[req.deployer.documentPath] = true;
		}

		next();
	},

	cleanup: (req, res, next) => {

		if(typeof jobs[req.deployer.documentPath] !== 'undefined'){
			delete jobs[req.deployer.documentPath];
		}

		next();
	}
};