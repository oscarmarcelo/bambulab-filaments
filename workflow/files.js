import {mkdirSync, copyFileSync} from 'node:fs';
import {join} from 'node:path';



function files() {
	const files = [
		'index.html',
		'styles.css',
		'scripts.js',
	];

	return Promise.all(files.map(file => new Promise((resolve, reject) => {
		try {
			mkdirSync('./build', {
				recursive: true,
			});

			copyFileSync(join('./source', file), join('./build', file));

			resolve();
		} catch (error) {
			reject(error);
		}
	})));
};



export default files;
