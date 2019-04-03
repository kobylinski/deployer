const git = require('nodegit');
const os = require('os');

module.exports = async (path) => {
	const repo = await git.Repository.open( path );
	const remote = await repo.getRemote('origin');
	
	await repo.fetch(remote, {
		callbacks: {
			certificateCheck: () => true,
			credentials: (url, username) => git.Cred.sshKeyNew(
				username, 
				process.env.KEY_PUBLIC.replace("~", os.homedir),
				process.env.KEY_PRIVATE.replace("~", os.homedir),
				process.env.KEY_PASSWORD
			)
		},
		downloadTags: 0,
		prune: 1
	});

	return repo;
};