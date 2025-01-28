import {rmSync} from 'node:fs';



function clear() {
	return rmSync('./build', {
		recursive: true,
	});
}



export default clear;
