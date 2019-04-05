require('dotenv').config();

const express = require('express');
const session = require('express-session');
const app = express();
const path = require('path');
const fs = require('fs'); 
const git = require('nodegit');
const ejs = require('ejs');
const github = require('octonode');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const favicon = require('serve-favicon');
const crypto = require('crypto');

const sass = require('node-sass-middleware');
const browserify = require('browserify-middleware');

const appEnv = require('./app/env');
const appVersions = require('./app/versions');
const appGithub = require('./app/github');

const repoPull = require('./app/repo/pull');
const repoInit = require('./app/repo/init');
const repoCreate = require('./app/repo/create');
const repoPatch = require('./app/repo/patch');
const repoBranch = require('./app/repo/branch');
const repoHistory = require('./app/repo/history');
const repoCommit = require('./app/repo/commit');

app.enable('trust proxy');

app.use(appEnv);
app.use(appVersions.check);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(favicon(path.join(__dirname, 'favicon.ico')))

app.use(session({
  secret: process.env.SECRET,
  cookie: { maxAge: 60000 },
  saveUninitialized: false,
  resave: true
}));

app.use((req, res, next) => {

	console.log('githubToken:', req.session.githubToken);
	console.log('githubAuthAppHost', req.session.githubAuthAppHost);

	if( 
		!req.session.githubToken && 
		!req.url.startsWith('/assets') && 
		!req.url.startsWith('/auth') && 
		!req.url.startsWith('/webhook')
	){
		res.redirect(req.deployer.basePath+'/auth');
		return;
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
	console.log('save route:', req.query.code, req.session.githubAuthAppHost);

	github.auth.login(req.query.code, (err, token, headers) => {
		console.log('github login:', err, token, headers);

		if(!req.session.githubAuthAppHost){
			res.redirect('/auth');
			return next();
		}
		
		if(appGithub.hasCallback(req.session.githubAuthAppHost)){
			appGithub.saveTokenFor(req.session.githubAuthAppHost, token);
			res.redirect(appGithub.getFor(req.session.githubAuthAppHost).callback);
			return next();
		}
		
		req.session.githubAuthAppHost = null;
		appGithub.authorize(req.deployer.repoPath, token).then( result => {
			req.session.githubToken = token;
			appGithub.cleanup(req.session.githubAuthAppHost);
			res.redirect('/');
			next();
		}).catch(e => {
			console.log('Login error: ', e);
			res.redirect('/auth');
			next();
		});
    });
});

app.get('/auth/populate', (req, res, next) => {
	if(!appGithub.hasToken(req.headers['host'])){
		return req.redirect('/auth');
	}

	const token = appGithub.getFor(req.headers['host']);

	appGithub.authorize(req.deployer.repoPath, token).then( result => {
		req.session.githubToken = token;
		appGithub.cleanup(req.headers['host']);
		res.redirect('/');
		next();
	}).catch(e => {
		console.log('Login error: ', e);
		res.redirect('/auth');
		next();
	});
});

app.get('/auth/redirect/:host', (req, res) => {
	const auth_url = appGithub.getLoginUrlFor(req.params.host);
	req.session.githubAuthAppHost = req.params.host;
	res.render( path.join(__dirname, 'login.html'), {
		basePath: req.deployer.basePath,
		login: auth_url
	});
});

app.get('/auth',  (req, res) => {
	if(req.headers['host'] !== process.env.MAIN_HOST){
		appGithub.setCallback(req.deployer.url + '/auth/populate');
		return res.redirect('http://'+process.env.MAIN_HOST+'/auth/redirect/'+req.headers['host']);
	}

	const auth_url = appGithub.getLoginUrlFor(req.headers['host']);
	req.session.githubAuthAppHost = req.headers['host'];
	res.render( path.join(__dirname, 'login.html'), {
		basePath: req.deployer.basePath,
		login: auth_url
	});
});

app.post('/webhook', async (req, res, next) => {
	const payload = JSON.stringify(req.body)
	if (!payload) {
		return next();
	}

	const hmac = crypto.createHmac('sha1', process.env.SECRET);
	const digest = 'sha1=' + hmac.update(payload).digest('hex');
	const checksum = req.headers['x-hub-signature'];
	
	if (!checksum || !digest || checksum !== digest) {
		return next();
	}

	const repo = await repoCreate(req.deployer.repoPath);
	const version = await repoPull(repo);

	if(version !== req.deployer.version){
		const commit = await repoCommit(version);
		const command = /\[(\w{1})\:(\w+)\]/.exec(commit.message);
		if(null !== command){
			switch(command[1]){
				case 'd':
					if(command[2] === req.deployer.serverRole || command[2] === req.deployer.serverId){
						const files = await repoPatch(repo, req.deployer.version, commit, req.deployer.projectPath);
						appVersions.update(req, commit);
					}
					break;
			}
		}
	}

	next();
});

app.get('/', (req, res, next) => {
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