const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const rl = require('readline').createInterface({
	input: process.stdin,
	output: process.stdout
});

const filename = 'cookies';

let data = {
	url: {
		value: '',
		validator: '^(https?:\/\/)(www\.)?[a-zA-Z0-9#=@:%._\+-]{1,256}(\.[a-zA-Z0-9]{1,6}\/?)([a-zA-Z0-9#=@:%._\+-\/]*)$',
		required: true
	},
	inputFile: {
		value: '',
		validator: '^.{1,}\..{2,}$',
		required: false,
	},
	outputPath: {
		value: '',
		validator: '^.*[\/]*.\/$', 	// [a-zA-Z0-9+/#.]*$
		required: false,
		default: './'
	},
	depth: {
		value: '',
		validator: '^[0-9]*$',
		required: false,
		default: '0'
	},
	mode: {
		value: '',
		validator: '^(deep|fast)$',
		required: false,
		default: 'deep'
	}
};

// PUPPETEER
let browser;
let page;

// TEMPORARY VARIABLES
let currentDepth = 0;
let startTime;
let visited = [];
let missingProperties = [];

// REGULAR EXPRESSIONS
let regularExpressionInput = new RegExp('^-[a-z]$');
const regExpDomain = new RegExp(data.url.value.split('/')[2]);
const regExpMail = new RegExp('@');

(async () => {

	sortInput(process.argv);

	//await startProcess();
})();

function sortInput(input) {
	for (let i = 0; i < input.length; i++) {
		for (let property in data) {
			if (data.hasOwnProperty(property)) {
				if (regularExpressionInput.test(input[i]) && input[i].length === 2) {
					if (input[i] === '-' + property.slice(0, 1)) {
						data[property].value = input[i + 1];
					}
				}
			}
		}
	}

	for (let property in data) {
		if(data.hasOwnProperty(property)) {
			if (data[property].value.length < 1) {
				missingProperties.push(property);
			}
		}
	}

	if(missingProperties.length > 0) {
		(function getMissingProperty() {
			const missingProperty = missingProperties.shift();
			if(data[missingProperty].required === true) {
				rl.question(missingProperty + ': ', (answer) => {
					if (validateData(missingProperty, answer)) {
						data[missingProperty].value = answer;
					} else {
						console.log('\nInvalid argument\n');
						missingProperties.push(missingProperty);
					}
					if (missingProperties.length > 0) {
						getMissingProperty();
					} else {
						displayInput(data.url.value, data.inputFile.value, data.outputPath.value, data.depth.value, data.mode.value);
						rl.close()
					}
				});
			} else {
				if(data[missingProperty.hasOwnProperty('default')])data[missingProperty].value = data[missingProperty].default;
			}
		})();
	} else {
		displayInput(data.url.value, data.inputFile.value, data.outputPath.value, data.depth.value, data.mode.value);
	}
}

function validateData(property, answer) {
	if(answer.length > 0) return new RegExp(data[property].validator).test(answer);
}


function displayInput(url, inputFile, outputPath, depth, mode) {
	rl.close();
	console.log('\nurl:          ' + url);
	console.log('inputFile:    ' + inputFile);
	console.log('outputPath:   ' + outputPath);
	console.log('depth:        ' + depth);
	console.log('mode:         ' + mode + '\n');

	startProcess();
}

async function startProcess() {
	if (data.url.value != null) {
		if (!isNaN(data.depth.value)) {
			try {
				startTime = new Date(Date.now()).getTime();

				browser = await puppeteer.launch();
				page = await browser.newPage();

				await loopOverUrls([data.url.value]);
			} catch (error) {
				console.log(error);
			} finally {
				await browser.close();
			}
		} else {
			console.log('No Depth is given');
		}
	} else {
		console.log('No Url is given');
	}
}

async function loopOverUrls(givenUrls) {
	let newUrls = [];

	if (currentDepth <= data.depth.value) {
		if (givenUrls.length > 0) {
			console.log('\nVisit ' + givenUrls.length + ' Urls at Depth ' + currentDepth);
			for (let i = 0; i < givenUrls.length; i++) {
				if (visited.indexOf(givenUrls[i]) === -1) {
					console.log(givenUrls[i]);
					if (data.mode.value === 'fast') {
						await page.goto(givenUrls[i]);
					} else {
						await page.goto(givenUrls[i], {waitUntil: 'networkidle2'});
					}

					let p = page.url();
					if (p.length > 100) {
						p = p.slice(0, 100) + '...';
					}

					console.log((i + 1) + '/' + givenUrls.length + '  -  ' + (((i + 1) / givenUrls.length) * 100).toFixed(2) + '%  -  ' + p);

					visited.push(page.url());

					if (currentDepth < data.depth.value) {
						newUrls.push(...await getUrls());
						newUrls = filterUrls(newUrls);
					}
				}
			}

			console.log('Found ' + newUrls.length + ' new Urls');
		}

		currentDepth++;

		if (newUrls.length) {
			await loopOverUrls(newUrls);
		}
	} else if (currentDepth > data.depth.value) {
		await getCookies();
	}
}

async function getUrls() {
	try {
		const hrefs = await page.$$eval('a', as => as.map(a => a.href));
		return filterUrls(hrefs);
	} catch (error) {
		console.log(error);
	}
}

function filterUrls(input) {
	input = input.filter(item => regExpDomain.test(item));
	input = input.filter(item => item.substr(item.length - 4, 1) !== '.');
	input = input.filter(item => !regExpMail.test(item));
	input = input.map(i => {
		return i.split('#')[0];
	});
	input = input.filter(function (elem, index, self) {
		return index === self.indexOf(elem);
	});
	input = input.map(i => {
		if (visited.indexOf(i) === -1) {
			return i;
		}
	});
	input = input.filter(item => item != null);

	return input;
}

async function getCookies() {
	const response = await page._client.send('Network.getAllCookies');
	const cookies = response.cookies.map(cookie => {

		if (cookie.expires !== -1) {
			let timeDiff = Math.floor(new Date(Date.now()).getTime() - new Date(cookie.expires * 1000).getTime());

			let days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
			let months = Math.floor(days / 31);
			let years = Math.floor(months / 12);

			days *= -1;
			months *= -1;
			years *= -1;

			let result;

			if (days < 31) {
				result = days + 'd';
			} else if (months < 12) {
				result = months + 'm';
			} else {
				result = years + 'y';
			}

			cookie.expires = result;

			delete cookie.size;
			delete cookie.value;
		} else {
			cookie.expires = 'session';
		}

		return cookie;
	});

	await writeFile(cookies);
}

async function writeFile(cookies) {
	if (cookies.length > 0) {
		let foundedCookies = cookies.length;
		cookies = formatCookies(cookies);
		let yamlStr = yaml.safeDump(await yamlStringConstructor(cookies));
		const filePath = path.join(data.outputPath.value, filename + '.yaml');
		await fs.writeFile(filePath, yamlStr, 'utf-8');

		console.log('\nVisited Urls:               ' + visited.length);
		console.log('Total time required:        ' + timeStringConstructor());
		console.log('Cookies found:              ' + foundedCookies);
		console.log('Yaml file saved to:         ' + filePath + '\n');

		rl.close();
	} else {
		console.log('No Cookies found at the given url');
	}
}

function formatCookies(cookies) {
	let obj = {};

	for (let i = 0; i < cookies.length; i++) {
		let name = cookies[i].name;
		delete cookies[i].name;
		obj[name] = cookies[i];
	}

	return obj;
}

async function yamlStringConstructor(cookies) {
	if(data.inputFile.value != null) {
		let string = await readFile();
		string.cookie_registry.cookies = cookies;
		return string;
	} else {
		return cookies;
	}
}

async function readFile() {
	let fileContents = await fs.readFile(data.inputFile.value, 'utf8');
	return yaml.safeLoad(fileContents);
}

function timeStringConstructor() {
	let seconds = (new Date(Date.now()).getTime() - startTime) / 1000;
	let minutes = 0;
	let hours = 0;

	while (seconds > 59) {
		seconds -= 60;
		minutes += 1;

		if (minutes > 59) {
			minutes -= 60;
			hours += 1;
		}
	}


	let timeString = '';

	if (hours > 0) timeString += hours + 'h ';
	if (minutes > 0) timeString += minutes + 'min ';

	timeString += seconds.toFixed(2) + 'sec ';

	return timeString;
}