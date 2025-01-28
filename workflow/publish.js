import {publish as publishToGitHub} from 'gh-pages';



function publish() {
	publishToGitHub('build');
}


export default publish;
