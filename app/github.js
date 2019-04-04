const github = require('octonode');
const git = require('nodegit');
const logins = {};

const cleanup = now => {
	for( let host in logins ){
		if( logins[host].time < (now - 3600) ){
			delete logins[host];
		}
	}
};

const save = (host, data) => {
	logins[host] = Object.assign(logins[host] || {}, data);
};

module.exports = {

	getRepoId(repo){
		return new Promise(done => {
			git.Repository
				.open( repo )
				.then( repo => repo.config())
				.then( config => config.getStringBuf("remote.origin.url"))
				.then( buf => done(buf.toString().replace('git@github.com:', '').replace('.git', '')));
		});
	},

	cleanup(host){
		const now = new Date().getTime();
		cleanup(now);

		if(typeof logins[host] !== 'undefined'){
			delete logins[host];
		}
	},

	setCallback(host, callback){
		save(host, { callback });
	},

	getLoginUrlFor(host){
		const auth_url = github.auth.config({
			id: process.env.GITHUB_ID,
		  	secret: process.env.GITHUB_SECRET
		}).login(['user', 'repo']);

		const now = new Date().getTime();
		cleanup( now );
		save( auth_url.match(/&state=([0-9a-z]{32})/i)[1], now, host );
		return auth_url; 
	},

	saveTokenFor(host, token){
		if(typeof logins[host] === 'undefined'){
			return false;
		}

		logins[host].token = token;
		return true;
	},

	getFor(host){
		return logins[host];
	},

	hasCallback(host){
		if(typeof logins[host] === 'undefined'){
			return false;
		}
		return typeof logins[host].callback !== 'undefined';
	}
};