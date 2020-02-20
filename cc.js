const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const filename = "cookies";
const url = process.argv[2];
let depth = process.argv[3];
const mode = process.argv[4];

let browser;
let page;

let currentDepth = 0;
let startTime;
let visited = [];

const regExpDomain = new RegExp(url.split('/')[2]);
const regExpMail = new RegExp('@');

(async () => {
	if (url != null) {
		if (!isNaN(depth) || depth == null) {
			try {
				startTime = new Date(Date.now()).getTime();

				browser = await puppeteer.launch();
				page = await browser.newPage();

				if (depth == null) depth = 0;

				await loopOverUrls([url]);
			} catch (error) {
				console.log(error);
			} finally {
				await browser.close();
			}
		} else {
			console.log('No Depth is given');
		}
	} else {
		console.log("No Url is given");
	}
})();


async function loopOverUrls(givenUrls) {
	let newUrls = [];

	if (currentDepth <= depth) {
		if (givenUrls.length > 0) {
			console.log('\nVisit ' + givenUrls.length + ' Urls at Depth ' + currentDepth);
			for (let i = 0; i < givenUrls.length; i++) {
				if (visited.indexOf(givenUrls[i]) === -1) {
					if (mode === "fast") {
						await page.goto(givenUrls[i]);
					} else {
						await page.goto(givenUrls[i], {waitUntil: 'networkidle2'});
					}

					let p = page.url();
					if(p.length > 100) {
						p = p.slice(0, 100) + '...';
					}

					console.log((i + 1) + '/' + givenUrls.length + '  -  ' + (((i + 1) / givenUrls.length) * 100).toFixed(2) + '%  -  ' + p);

					visited.push(page.url());

					if (currentDepth < depth) {
						newUrls.push(...await getUrls());
						newUrls = filterUrls(newUrls);
					}
				}
			}

			console.log('Found ' + newUrls.length + ' new Urls');
		}

		currentDepth++;

		if (newUrls != null) {
			await loopOverUrls(newUrls);
		}
	} else if (currentDepth > depth) {
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
	input = input.filter(item => item.substr(item.length - 4, 1) !== ".");
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
		cookies = formatCookies(cookies);
		let yamlStr = yaml.safeDump(await yamlStringConstructor(cookies));
		const filePath = path.join(__dirname, filename + '.yaml');
		await fs.writeFile(filePath, yamlStr, 'utf-8');

		console.log('\nVisited Urls:               ' + visited.length);
		console.log('Total time required:        ' + timeStringConstructor());
		console.log('Cookies found:              ' + cookies.length);
		console.log('Yaml file saved to:         ' + filePath + "\n");
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
	let string = await readFile();
	string.cookie_registry.cookies = cookies;
	return string;
}

async function readFile() {
	let fileContents = await fs.readFile('./data.yaml', 'utf8');
	return yaml.safeLoad(fileContents);
}


function timeStringConstructor() {
	let seconds = (new Date(Date.now()).getTime() - startTime) / 1000;
	let minutes = 0;
	let hours = 0;

	while(seconds > 59) {
		seconds -= 60;
		minutes += 1;

		if(minutes > 59) {
			minutes -= 60;
			hours += 1;
		}
	}


	let timeString = '';

	if(hours > 0) timeString += hours + 'h ';
	if(minutes > 0) timeString += minutes + 'min ';

	timeString += seconds.toFixed(2) + 'sec ';

	return timeString;
}