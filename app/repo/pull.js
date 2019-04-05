const git = require('nodegit');
const repoBranch = require('./branch.js');

module.exports = async (repo) => {
	const branch = await repoBranch(repo);
	return await repo.mergeBranches(branch.local, branch.remote);
};