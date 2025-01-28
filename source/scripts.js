import data from './data.json' with {type: 'json'};



const tableHeadGroup = document.querySelector('thead tr:first-child');
const tableHead = document.querySelector('thead tr:last-child');
const tableBody = document.querySelector('tbody');

const headLinkTemplate = document.querySelector('#head-link');
const headTemplate = document.querySelector('#head');
const rowTemplate = document.querySelector('#row');
const cellTemplate = document.querySelector('#cell');
const stepTemplate = document.querySelector('#step');
const typeTemplate = document.querySelector('#type');



// Build Table Head.
const tableHeadGroupFragment = new DocumentFragment();
const tableHeadFragment = new DocumentFragment();

for (const [group, headerGroup] of Object.entries(data.headerGroups)) {
	const headFragment = headLinkTemplate.content.cloneNode(true);

	const th = headFragment.querySelector('th');

	th.colSpan = headerGroup.headers.length;
	th.dataset.group = group;
	th.classList.add('separator');
	th.textContent = headerGroup.name;

	tableHeadGroupFragment.append(headFragment);

	tableHeadGroupFragment.append(tableHeadGroupFragment);

	let separator = true;

	for (const header of headerGroup.headers) {
		const headLinkFragment = headLinkTemplate.content.cloneNode(true);

		const th = headLinkFragment.querySelector('th');
		if (separator) {
			th.classList.add('separator');
			separator = false;
		}

		th.dataset.group = group;
		th.dataset.handle = header.handle;

		const link = headLinkFragment.querySelector('a');

		link.href = header.url;
		link.textContent = header.name;

		tableHeadFragment.append(headLinkFragment);
	}
}

tableHeadGroup.append(tableHeadGroupFragment);
tableHead.append(tableHeadFragment);



// Build Table Body.
const tableBodyFragment = new DocumentFragment();

for (const hue of Object.values(data.hues)) {
	const headFragment = headTemplate.content.cloneNode(true);

	const th = headFragment.querySelector('th');
	th.rowSpan = Object.values(hue.tones).length;
	th.textContent = hue.name;

	for (const tone of Object.values(hue.tones)) {
		const rowFragment = rowTemplate.content.cloneNode(true);
		const row = rowFragment.querySelector('tr');

		if (headFragment.childElementCount > 0) {
			row.append(headFragment);
		}


		for (const [group, headerGroup] of Object.entries(data.headerGroups)) {
			let separator = true;

			for (const header of headerGroup.headers) {
				const variant = tone[header.handle];

				const cellFragment = cellTemplate.content.cloneNode(true);

				const td = cellFragment.querySelector('td');
				td.dataset.group = group;
				td.dataset.handle = header.handle;

				if (separator) {
					td.classList.add('separator');
					separator = false;
				}

				if (variant) {
					const image = cellFragment.querySelector('.image');
					image.src = `images/${variant.code}.webp`;

					const colors = cellFragment.querySelector('.colors');

					for (const step of variant.colors) {
						const stepFragment = stepTemplate.content.cloneNode(true);

						const stepElement = stepFragment.querySelector('.step');

						stepElement.style.background = step;

						colors.append(stepFragment);
					}

					const name = cellFragment.querySelector('.name');
					name.textContent = variant.name;

					const code = cellFragment.querySelector('.code');
					code.textContent = variant.code;

					for (const type of variant.types) {
						const types = cellFragment.querySelector('.types');

						const typeFragment = typeTemplate.content.cloneNode(true);

						const typeElement = typeFragment.querySelector('.type');
						typeElement.href = type.url;
						typeElement.textContent = type.name;

						types.append(typeFragment);
					}
				} else {
					const content = cellFragment.querySelector('.content');
					content.replaceChildren();
				}

				row.append(cellFragment);
			}
		}

		tableBodyFragment.append(rowFragment);
	}
}

tableBody.append(tableBodyFragment);
