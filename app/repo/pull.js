const git = require('nodegit');
const repoBranch = require('./branch.js');

module.exports = async (repo) => {
	const branch = await repoBranch(repo);
	const commit = await repo.mergeBranches(branch.local, branch.remote);
	console.log(commit, '2');
	return commit.tostrS();
};