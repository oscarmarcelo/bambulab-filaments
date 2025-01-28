import {mkdirSync, existsSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

import {globbySync} from 'globby';
import sharp from 'sharp';

import colors from '../source/data/colors.json' with {type: 'json'};




function data() {
	const paths = globbySync('./data/products/*.json', {
		cwd: './source/',
	});

	return Promise.all(paths.map(path => new Promise(async (resolve, reject) => {
		try {
			const {default: data} = await import(join('../source', path), {
				with: {
					type: 'json',
				},
			});

			const result = {
				handle: data.data.product.handle,
				title: data.data.product.title,
				url: data.data.product.onlineStoreUrl
					.replace('/\/\/\w+\.store.bambulab.com/\w+-\w+\/', '//store.bambulab.com/'),
				variants: data.data.product.variants.nodes.map(variant => {
					const {groups: {name, code}} = variant.selectedOptions
						.find(option => option.name === 'Color')
						.value.match(/(?<name>.+?)\s?\((?<code>.+?)\)/);

					return {
						id: variant.id.split('/').at(-1),
						image: variant.featured_image.src,
						name,
						code,
						type: variant.selectedOptions
							.find(option => option.name === 'Type')
							.value,
						colors: colors[code].split(';'),
					}
				}),
			};
			resolve(result);
		} catch (error) {
			reject(error);
		}
	})))
		.then(async data => {
			for (const product of data) {
				product.variants.sort((a, b) => a.code - b.code);
			}

			data.sort((a, b) => a.variants[0].code - b.variants[0].code);

			mkdirSync('./build/images', {
				recursive: true,
			});

			for (const product of data) {
				for (const variant of product.variants) {
					if (!existsSync(`./build/images/${variant.code}.webp`)) {
						const response = await fetch(variant.image);
						const arrayBuffer = await response.arrayBuffer();

						const image = sharp(arrayBuffer)
							.resize({
								width: 64 * 2,
							})
							.webp()
							.toFile(`./build/images/${variant.code}.webp`)
							.then(() => []);
					}

					delete variant.image;
				}
			}

			const result = {
				headerGroups: {
					pla: {
						name: 'PLA',
						pattern: /^PLA/,
						headers: [],
					},
					petg: {
						name: 'PETG',
						pattern: /^PETG/,
						headers: [],
					},
					'abs-asa': {
						name: 'ABS/ASA',
						pattern: /^(ABS|ASA)/,
						headers: [],
					},
					'pc-tpu': {
						name: 'PC/TPU',
						pattern: /^(PC|TPU)/,
						headers: [],
					},
					'pa-pet': {
						name: 'PA/PET',
						pattern: /^(PA6|PAHT|PPA|PET)/,
						headers: [],
					},
					pps: {
						name: 'PPS',
						pattern: /^PPS/,
						headers: [],
					},
					support: {
						name: 'Support',
						pattern: /^(Support|PVA)/,
						headers: [],
					},
				},
				hues: {
					1: {
						name: 'Neutral',
						tones: {},
					},
					2: {
						name: 'Red',
						tones: {},
					},
					3: {
						name: 'Orange',
						tones: {},
					},
					4: {
						name: 'Yellow',
						tones: {},
					},
					5: {
						name: 'Green',
						tones: {},
					},
					6: {
						name: 'Blue',
						tones: {},
					},
					7: {
						name: 'Purple',
						tones: {},
					},
					8: {
						name: 'Brown',
						tones: {},
					},
					9: {
						name: 'Other',
						tones: {},
					},
				},
			};

			for (const product of data) {
				const [headerGroup] = Object.entries(result.headerGroups)
					.find(([_, headerGroupData]) => headerGroupData.pattern.test(product.title));

				const name = product.title
					.replace(result.headerGroups[headerGroup].pattern, '')
					.replace(/^-/, '')
					.trim();

				result.headerGroups[headerGroup].headers.push({
					handle: product.handle,
					name: name.length > 0 ? name : product.title,
					url: product.url,
				});


				for (const variant of product.variants) {
					const hueCode = Number.parseInt(variant.code.toString().slice(2, 3), 10);
					const toneCode = Number.parseInt(variant.code.toString().slice(3), 10);

					if (result.hues[hueCode].tones[toneCode] === undefined) {
						result.hues[hueCode].tones[toneCode] = {};
					}

					if (result.hues[hueCode].tones[toneCode][product.handle] == undefined) {
						result.hues[hueCode].tones[toneCode][product.handle] = {
							name: variant.name,
							code: variant.code,
							colors: variant.colors,
							group: headerGroup,
							types: [],
						};
					}

					result.hues[hueCode].tones[toneCode][product.handle].types.push({
						name: variant.type,
						url: `${product.url}?variant=${variant.id}`,
					});
				}
			}

			writeFileSync('./build/data.json', JSON.stringify(result));
		});
};



export default data;
