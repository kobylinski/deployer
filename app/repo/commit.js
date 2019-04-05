const git = require('nodegit');

module.exports = async (repo, id) => {
	const commit = await repo.getCommit(id);
	return {
		id,
		message: commit.message().trim(),
		author: {
			name: commit.author().name(),
			email: commit.author().email()
		},
		date: commit.date()
	}
};