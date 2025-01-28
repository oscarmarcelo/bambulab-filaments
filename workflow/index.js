import {argv} from 'node:process';

import clear from './clear.js';
import publish from './publish.js';
import data from './data.js';
import files from './files.js';



if (argv[2] === 'clear') {
	clear();
} else if (argv[2] === 'publish') {
	publish();
} else {
	data();
	files();
}
