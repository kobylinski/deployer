require('dotenv').config();

const repoPull = require('./app/repo/pull');
const repoInit = require('./app/repo/init');
const repoCreate = require('./app/repo/create');
const repoPatch = require('./app/repo/patch');
const repoBranch = require('./app/repo/branch');
const repoHistory = require('./app/repo/history');
const repoCommit = require('./app/repo/commit');


repoCreate('/Users/marek/Projects/test-project/repo')
	.then(repo => {
		console.log('---------------------------');
		console.log('repo', repo);
		repoPull(repo).then(version => {
			console.log('---------------------------');
			console.log(version);

			repoCommit(repo, version).then(commit => {
				console.log('---------------------------');
				console.log(commit);
			});
		});
	}).catch(e => console.log(e));
