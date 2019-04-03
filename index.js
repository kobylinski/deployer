require('dotenv').config();

const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs'); 
const git = require('nodegit');
const ejs = require('ejs');

const sass = require('node-sass-middleware');
const postcss = require('postcss-middleware');
const autoprefixer = require('autoprefixer');
const browserify = require('browserify-middleware');

const appEnv = require('./app/env');
const appJobs = require('./app/jobs');
const appVersions = require('./app/versions');

const repoPull = require('./app/repo/pull');
const repoInit = require('./app/repo/init');
const repoCreate = require('./app/repo/create');
const repoPatch = require('./app/repo/patch');
const repoBranch = require('./app/repo/branch');
const repoHistory = require('./app/repo/history');

app.use(appEnv);
app.use(appJobs.watch);
app.use(appVersions.check);

app.engine('html', ejs.renderFile);
app.set('view engine', 'html');

browserify.settings('transform', [
    [{ presets: ['@babel/preset-env']}, 'babelify']
]);

app.use(sass({ 
	src: path.join( __dirname, 'assets' ),
	dest: path.join( __dirname, 'assets' ), 
	debug: process.env.DEBUG, 
	outputStyle: 'compressed', 
	includePaths: [path.join(__dirname), 'node_modules'],
	prefix: '/assets' 
}));

app.use(postcss({
	plugins: [ autoprefixer ],
	src: (req) => path.join( __dirname, 'dest', req.url )
}));

app.get('/assets/script.js', browserify(__dirname + '/assets/script.js'));

app.use('/assets/', express.static( path.join( __dirname, 'assets/' )));

app.get('/repo/update', async (req, res, next) => {
	const repo = await repoCreate(req.deployer.repoPath);
	const head = await repoPull(repo);
	res.json({ 
		head, 
		actual: req.deployer.version
	});
	next();
});

app.get('/repo/init', async (req, res, next) => {
	const repo = await repoCreate(req.deployer.repoPath);
	const head = await repo.getHeadCommit()
	const files = await repoInit(repo, req.deployer.projectPath, head.sha());
	appVersions.update(req, head.sha());
	res.json({head: head.sha(), files});
	next();
});

app.get('/repo/history', async (req, res, next) => {
	const repo = await repoCreate(req.deployer.repoPath);
	const commits = await repoHistory(repo, req.deployer.version);
	res.json(commits);
	next();
});

app.get('/repo/patch/:to', async (req, res, next) => {
	const repo = await repoCreate(req.deployer.repoPath);
	const files = await repoPatch(repo, req.deployer.version, req.params.to, req.deployer.projectPath);
	appVersions.update(req, req.params.to);
	res.json({head: req.params.to, files});
	next();
});

app.get('/', function(req, res, next){
	res.render(path.join(__dirname, 'index.html'), { 
		basePath: req.deployer.basePath,
		version: req.deployer.version 
	});
	next();
});

app.use(appJobs.cleanup);

app.use(function errorHandler( err, req, res, next ) {
    res.json({
    	error: err.message
    });
});

app.listen(process.env.PORT);