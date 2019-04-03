const git = require('nodegit');
const fs = require('fs');
const path = require('path');

const copyFiles = (walker, to) => new Promise(allDone => {
	const calls = [];
	walker.on('entry', entry => {
		calls.push( new Promise( fileDone => {
			const entryPath = to + '/' + entry.path();
			const entryType = entry.type();
			entry.getBlob().then(blob => {
				const entryDir = path.dirname( entryPath );
				try{
					if(!fs.existsSync( entryDir )){
						fs.mkdirSync( entryDir, { recursive: true } );
					}
					fs.writeFileSync( entryPath, blob.content() );
					fileDone({ path: entryPath, action: 'upsert', type: entryType, status: 'success' });
				}catch(e){
					fileDone({ path: entryPath, action: 'upsert', type: entryType, status: 'error', error: e.message });
				}
			});
		}));
	});
	walker.on('end', () => Promise.all(calls).then(allDone));
	walker.start();
});

module.exports = async (repo, to, hash) => {
	const commit = typeof hash !== 'undefined' ? await repo.getCommit(hash) : await repo.getHeadCommit();
	const tree = await commit.getTree();
	return await copyFiles(tree.walk(), to);
};