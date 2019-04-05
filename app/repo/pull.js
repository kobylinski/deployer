const git = require('nodegit');
const repoBranch = require('./branch.js');

module.exports = async (repo) => {
	const branch = await repoBranch(repo);
	const commit = await repo.mergeBranches(branch.local, branch.remote);
	console.log(typeof commit, commit.toString);
	return commit.tostrS ? commit.tostrS() : commit;
};