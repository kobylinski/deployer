const git = require('nodegit');
const fs = require('fs');
const path = require('path');
const emptyDir = require('empty-dir');

const applyPath = (patches, commit, to) => Promise.all( patches.map( patch => new Promise( fileDone => {
	
	const copyFile = (file) => new Promise(actionDone => {
		commit.getEntry(file).then(entry => {
			const entryPath = to + '/' + file;
			const entryType = entry.type();
			const entryDir = path.dirname( entryPath );

			entry.getBlob().then(blob => {
				try{
					if(!fs.existsSync( entryDir )){
						fs.mkdirSync( entryDir, { recursive: true } );
					}
					fs.writeFileSync( entryPath, blob.content() );
					actionDone({ path: entryPath, action: 'upsert', type: entryType, status: 'success' });
				}catch(e){
					actionDone({ path: entryPath, action: 'upsert', type: entryType, status: 'error', error: e.message });
				}
			});
		});
	});

	const deleteFile = (file) => new Promise(actionDone => {
		const entryPath = to + '/' + file;
		try{
			fs.unlinkSync(entryPath);
			let entryDir = path.dirname(entryPath);
			while(emptyDir.sync(entryDir) && to !== entryDir){	
				fs.rmdirSync(entryDir);
				entryDir = path.dirname(entryDir);
			}
			actionDone({ path: entryPath, action: 'remove', status: 'success' });
		}catch(e){
			actionDone({ path: entryPath, action: 'remove', status: 'error', error: e.message });
		}
	});

	switch(true){
		case patch.isAdded():
		case patch.isModified():		
			copyFile(patch.newFile().path()).then(fileDone);
			break;
		case patch.isDeleted():
			deleteFile(patch.oldFile().path()).then(fileDone);
			break;
		case patch.isRenamed():
			Promise.all([
				copyFile(patch.newFile().path()),
				deleteFile(patch.oldFile().path())
			]).then(fileDone);
			break;
	}
})));

module.exports = async (repo, hashFrom, hashTo, to) => {
	const fromCommit = await repo.getCommit(hashFrom);
	const toCommit = await repo.getCommit(hashTo);
	const fromTree = await fromCommit.getTree();
	const toTree = await toCommit.getTree();
	const diff = await toTree.diff(fromTree);
	const patches = await diff.patches();
	return await applyPath(patches, toCommit, to);
};