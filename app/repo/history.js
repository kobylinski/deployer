const git = require('nodegit');

module.exports = async (repo, current) => {
	const walk = repo.createRevWalk();
	let counter = 20;
	let found = false;
	walk.sorting(git.Revwalk.SORT.TIME);
	walk.pushHead();

	const commits = await walk.getCommitsUntil(commit => {
		if(commit.sha() === current || found){
			found = true;
			counter--;
		}
		return counter;
	});

	return commits.map(commit => ({
		id: commit.sha(), 
		message: commit.message().trim(), 
		date: commit.date(),
		author: {
			name: commit.author().name(),
			email: commit.author().email()
		}
	}));
};