import { el, list, mount } from 'redom';
import axios from 'axios';
import moment from 'moment';

class Commit {
	constructor() {
		this.el = el('.commit',
			el('.commit-data',
				this.message = el('.message'),
				el('.author',
					this.authorName = el('.author-name'),
					this.authorEmail = el('.author-email')
				),
				this.date = el('.date')
			),
			el('.commit-tools',
				this.patchTo = el('button.patch-to', 'Patch'),
			)
		);

		this.patchTo.onclick = e => {
			e.preventDefault();
			const event = new CustomEvent('patchto', { detail: this.id, bubbles: true });
			this.el.dispatchEvent(event);
		}
	}

	update(data) {
		this.id = data.id;
		this.message.textContent = data.message;
		this.authorName.textContent = data.author.name;
		this.authorEmail.textContent = data.author.email;
		this.date.textContent = moment(data.date).format('DD-MM-YYYY HH:mm:ss');

		if(window.REPO_VERSION === data.id){
			this.el.classList.add('active');
		}else{
			this.el.classList.remove('active');
		}
	}
}

class App {
	constructor() {
		this.el = el('.app', 
			this.topbar = el('.topbar'),
			this.commits = list('.commits', Commit)
		);

		this.el.addEventListener('patchto', e => {
			e.stopPropagation();
			this.el.classList.add('loading');
			axios.get(window.APP_BASE_PATH+'/repo/patch/'+e.detail).then(res => {
				window.REPO_VERSION = res.data.head;
				this.commits.update(this.data);
				this.el.classList.remove('loading');
			});
		});
	}

	update() {
		this.el.classList.add('loading');
		axios.get(window.APP_BASE_PATH + '/repo/history').then(res => {
			this.data = res.data;
			this.commits.update(res.data);
			this.el.classList.remove('loading');
		});
	}
}

document.querySelectorAll('#app').forEach(container => {
	const app = new App;
	app.update();
	mount(container, app);
});


