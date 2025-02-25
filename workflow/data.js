import {mkdirSync, existsSync, writeFileSync} from 'node:fs';

import puppeteer from 'puppeteer';
import sharp from 'sharp';
import {parse} from 'acorn';
import {simple} from 'acorn-walk';

import overrides from '../source/data/overrides.js';



async function handleRequests(page) {
	await page.setRequestInterception(true);

	page.on('request', request => {
		if (!['document', 'xhr', 'fetch', 'script'].includes(request.resourceType())) {
			return request.abort();
		}

		request.continue();
	});
}



async function fetchData() {
	const result = {
		data: {},
		colors: undefined,
	};

	const browser = await puppeteer.launch({headless: false});
	const page = await browser.newPage();

	await handleRequests(page);

	await page.goto('https://store.bambulab.com/collections/bambu-lab-3d-printer-filament');

	const menu = await page.$$('.Header__MainNav .HorizontalList__Item')
		.then(menus => Promise.all(menus.map(async menu => ({
			text: await menu.$eval(':scope > a.Heading', node => node.textContent.trim()),
			menu,
		}))))
		.then(items => items.find(({text}) => text === 'Filament').menu);

	const groups = await menu.$$('.LevelTwoLinklist__Item')
		.then(groups => Promise.all(groups.map(async group => ({
			...await group.$eval(':scope > a', node => ({
				name: node.textContent.trim(),
				url: node.toString(),
			})),
			group,
		}))))
		.then(items => {
			const filteredItems = items.filter(({name}) => !overrides.ignoredGroupsRegex.test(name));

			for (const item of filteredItems) {
				result.data[item.url.split('/').at(-1)] = {
					name: item.name,
					url: item.url,
					items: {},
				};
			}

			return filteredItems;
		});

	return Promise.all(groups.map(group => new Promise(async (resolve, reject) => {
		try {
			const links = await group.group.$$eval(':scope .Linklist .Link', nodes => nodes
				.map(node => ({
					name: node.querySelector('.LevelThreeText').textContent.trim(),
					url: node.toString(),
				}))
				.filter(link => !link.url.includes('cmyk')),
			);

			Promise.all(links.map(link => new Promise(async (resolve, reject) => {
				try {
					result.data[group.url.split('/').at(-1)].items[link.url.split('/').at(-1)] = {...link};

					const itemPage = await browser.newPage();

					await handleRequests(itemPage);

					itemPage.on('response', async response => {
						if (/api\/\d{4}-\d{2}\/graphql\.json$/.test(response.url())) {
							response.json()
								.then(async data => {
									result.data[group.url.split('/').at(-1)].items[link.url.split('/').at(-1)].data = data;

									await itemPage.close();

									resolve();
								});
						} else if (response.url().includes('recommend-products-v2.js') && !result.colors) {
							response.text()
								.then(data => {
									simple(
										parse(data, {
											ecmaVersion: 'latest',
										}),
										{
											VariableDeclaration(node) {
												const colorCodes = node.declarations
													.find(declaration => declaration.id.name === 'colorCodes')
													?.init.properties
													.map(property => [property.key.value, property.value.value]);

												if (colorCodes) {
													result.colors = Object.fromEntries(colorCodes);
												}
											},
										},
									);
								});
						}
					});

					await itemPage.goto(link.url);
				} catch (error) {
					reject(error);
				}
			})))
				.then(() => {
					resolve();
				});
		} catch (error) {
			reject(error);
		}
	})))
		.then(async () => {
			await browser.close();

			return result;
		});
}



function cleanUrl(string) {
	return string.replace(
		/\/\/\w+\.store\.bambulab\.com\/\w+-\w+\//,
		'//store.bambulab.com/',
	);
}



async function data() {
	const {data, colors} = await fetchData();

	const result = {
		headerGroups: {},
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

	for (const [groupId, group] of Object.entries(data)) {
		result.headerGroups[groupId] = {
			name: group.name,
			url: cleanUrl(group.url),
			headers: {},
		};

		for (const [itemId, item] of Object.entries(group.items)) {
			result.headerGroups[groupId].headers[itemId] = {
				name: item.name.replace(new RegExp(`^${group.name}(?:-|\\s+for)?`), '').trim(),
				url: cleanUrl(item.url),
			};

			mkdirSync('./build/images', {
				recursive: true,
			});

			item.data.data.product.variants.nodes.sort((a, b) =>
				a.selectedOptions.find(option => option.name === 'Type').value
				- b.selectedOptions.find(option => option.name === 'Type').value,
			);

			for (const variant of item.data.data.product.variants.nodes) {
				let {groups: {name, code}} = variant.selectedOptions
					.find(option => option.name === 'Color')
					.value.match(/(?<name>.+?)\s?\((?<code>.+?)\)/);

				if (overrides.codes[code]) {
					code = overrides.codes[code];
				}

				const hueCode = Number.parseInt(code.toString().slice(2, 3), 10);
				const toneCode = Number.parseInt(code.toString().slice(3), 10);

				if (result.hues[hueCode].tones[toneCode] === undefined) {
					result.hues[hueCode].tones[toneCode] = {};
				}

				if (result.hues[hueCode].tones[toneCode][itemId] === undefined) {
					result.hues[hueCode].tones[toneCode][itemId] = {
						name,
						code,
						colors: (overrides.colors[code] || colors[code]).split(';'),
						group: groupId,
						types: [],
					};
				}

				result.hues[hueCode].tones[toneCode][itemId].types.push({
					name: variant.selectedOptions.find(option => option.name === 'Type').value
						+ ' ('
						+ variant.selectedOptions.find(option => option.name === 'Size').value
						+ ')',
					url: `${cleanUrl(item.url)}?variant=${variant.id.split('/').at(-1)}`,
				});

				if (!existsSync(`./build/images/${code}.webp`)) {
					fetch(variant.featured_image.src)
						.then(response => response.arrayBuffer())
						.then(arrayBuffer => sharp(arrayBuffer)
							.resize({
								width: 64 * 2,
							})
							.webp()
							.toFile(`./build/images/${code}.webp`),
						);
				}
			}
		}
	}

	writeFileSync(
		'./source/data/data.generated.jsonc',
		'// This file is generated and is used only for diff purposes.\n'
			+ JSON.stringify(result, null, 2),
	);

	result.time = Date.now();

	writeFileSync('./build/data.json', JSON.stringify(result));
}



export default data;
