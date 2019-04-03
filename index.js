require('dotenv').config();

const express = require('express');
const session = require('express-session');
const app = express();
const path = require('path');
const fs = require('fs'); 
const git = require('nodegit');
const ejs = require('ejs');
const uuidv5 = require('uuid/v5');
const bodyParser = require("body-parser");
const github = require('octonode');

const sass = require('node-sass-middleware');
const browserify = require('browserify-middleware');

const appEnv = require('./app/env');
const appVersions = require('./app/versions');

const repoPull = require('./app/repo/pull');
const repoInit = require('./app/repo/init');
const repoCreate = require('./app/repo/create');
const repoPatch = require('./app/repo/patch');
const repoBranch = require('./app/repo/branch');
const repoHistory = require('./app/repo/history');

app.use(appEnv);
app.use(appVersions.check);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60000 },
  genid: (req) => uuidv5(req.headers['host'], uuidv5.DNS),
}));

app.use((req, res, next) => {
	if( 
		!req.session.githubToken && 
		!req.url.startsWith('/assets') && 
		!req.url.startsWith('/auth') && 
		!req.url.startsWith('/hook')
	){
		res.redirect(req.deployer.basePath+'/auth');
	}
	next();
});

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

var states = [];

app.get('/auth/save', (req, res, next) => {
	console.log('save route');
	github.auth.login(req.query.code, (err, token, headers) => {
		for(let i = states.length; i--;){
			if(req.query.state === states[i].state){
				if(states[i].host !== req.headers['host']){
					states[i].token = token;
			    	res.redirect('http://' + states[i].host + req.deployer.basePath + '/auth/populate/' + req.query.state);
				}else{
					req.session.githubToken = token;
					res.redirect('/');
				}

				next();
			}
		}
    });
});

app.get('/auth/populate/:state', (req, res) => {
	for(let i = states.length; i--;){
		if(req.params.state === states[i].state){
			req.session.githubToken = token;
			res.redirect('/');
		}
	}
});

app.get('/auth',  (req, res) => {

	const auth_url = github.auth.config({
		id: process.env.GITHUB_ID,
	  	secret: process.env.GITHUB_SECRET
	}).login(['user', 'repo']);

	const now = new Date().getTime();
	const state = auth_url.match(/&state=([0-9a-z]{32})/i);

	(states = states.filter(el => el.time < (now - 3200))).push({
		state: state.length ? state[1] : null,
		host: req.headers['host'],
		time: now 
	});

	res.render( path.join(__dirname, 'login.html'), {
		basePath: req.deployer.basePath,
		login: auth_url
	});
});

app.get('/', (req, res) => {
	if(req.session.token){
	 	const client = github.client(req.session.token);
	 	const user = client.me();

	 	console.log(user);
	}

	res.render(path.join(__dirname, 'index.html'), { 
		basePath: req.deployer.basePath,
		version: req.deployer.version 
	});
});

app.use(function errorHandler( err, req, res, next ) {
    res.json({
    	error: err.message
    });
});

app.listen(process.env.PORT);