const git = require('nodegit');

const getBranches = async (repo) => {
	const branches = await repo.getReferenceNames(git.Reference.TYPE.OID);
	return await Promise.all(
		branches
			.filter(el => el.startsWith('refs/heads/'))
			.map(el => new Promise((done) => {
				repo.getReference(el).then((ref) => {
					done({
						hash: ref.target().tostrS(),
						name: el
					});
				})
			}))
	);
};

const getCurrentBranch = async (repo) => {
	const ref = await repo.getCurrentBranch();

	switch(ref.type()){
		case git.Reference.TYPE.SYMBOLIC: return ref.symbolicTarget().tostrS();
		case git.Reference.TYPE.OID: return ref.target().tostrS();
	}
}

module.exports = async (repo) => {
	const branches = await getBranches(repo);
	const current = await getCurrentBranch(repo);

	for(let i = branches.length; i--;){
		if(branches[i].hash === current){
			let name = branches[i].name.split('/').pop();
			return {
				local: name,
				remote: 'origin/'+name
			};
		}
	}

	return false;
};