const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const filename = "data-out";
const url = process.argv[2];
let depth = process.argv[3];
const mode = process.argv[4];

let browser;
let page;

let currentDepth = 0;
let startTime;
let visited = [];

const re = new RegExp(url.split('/')[2]);


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
			console.log('\nVisit next ' + givenUrls.length + ' Urls at Depth ' + currentDepth);
			for (let i = 0; i < givenUrls.length; i++) {
				if (visited.indexOf(givenUrls[i]) === -1) {
					if (mode === "fast") {
						await page.goto(givenUrls[i]);
					} else {
						await page.goto(givenUrls[i], {waitUntil: 'networkidle2'});
					}

					console.log('(' + (i + 1) + '/' + givenUrls.length + ' ' + (((i + 1) / givenUrls.length) * 100).toFixed(2) + '%) ' + page.url());

					visited.push(page.url());

					if (currentDepth < depth) {
						newUrls.push(...await getUrls());
						newUrls = filterUrls(newUrls);
					}
				}
			}

			console.log('New Urls found: ' + newUrls.length);
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
	input = input.filter(item => re.test(item));
	input = input.filter(item => item.substr(item.length - 4, 1) !== ".");
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

			cookie.currentTimeLeft = result;
		} else {
			cookie.currentTimeLeft = 'session';
		}

		return cookie;
	});

	await formatCookies(cookies);
}

async function formatCookies(cookies) {
	cookies = cookies.map(cookie => {
		delete cookie.size;
		delete cookie.value;
		delete cookie.expires;

		return cookie;
	});

	await writeFile(cookies);
}


async function writeFile(cookies) {
	if (cookies.length > 0) {
		let yamlStr = yaml.safeDump(cookies);
		const filePath = path.join(__dirname, filename + '.yaml');
		await fs.writeFile(filePath, yamlStr, 'utf-8');

		let seconds = (new Date(Date.now()).getTime() - startTime) / 1000;
		let minutes = seconds / 60;
		let hours = minutes / 60;

		let timeString = '';

		if (hours > 1) {
			timeString += hours.toFixed(0) + 'h ';
			minutes -= Math.floor(hours) * 60;
		}
		if (minutes > 1) {
			timeString += minutes.toFixed(0) + 'min ';
			seconds -= Math.floor(minutes) * 60;
		}

		timeString += seconds.toFixed(2) + 'sec ';


		console.log('\nVisited Urls:               ' + visited.length);
		console.log('Total time required:        ' + timeString);
		console.log('Cookies found:              ' + cookies.length);
		console.log('Yaml file saved to:         ' + filePath + "\n");
	} else {
		console.log('No Cookies found at the given url');
	}
}