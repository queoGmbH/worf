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
let slicedUrl = url.split('/');
let visited = [];


(async () => {
	if (url != null) {
		if (!isNaN(depth) || depth == null) {
			try {
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

	if (currentDepth > depth) {
		await getCookies();
	} else if (currentDepth <= depth) {
		console.log('Visit ' + givenUrls.length + ' Urls at Depth ' + currentDepth);
		for (let i = 0; i < givenUrls.length; i++) {
			if (visited.indexOf(givenUrls[i]) === -1) {
				if (mode === "fast") {
					await page.goto(givenUrls[i]);
				} else {
					await page.goto(givenUrls[i], {waitUntil: 'networkidle2'});
				}

				console.log('('+ (i + 1) + '/' + givenUrls.length + ' ' + (((i + 1) / givenUrls.length) * 100).toFixed(2) + '%) ' + page.url());

				visited.push(page.url());

				if (currentDepth < depth) {
					newUrls.push(...await getUrls());
					newUrls = filterUrls(newUrls);
				}
			}
		}

		currentDepth++;

		if (newUrls != null) {
			await loopOverUrls(newUrls);
		}
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
	input = input.filter(item => item.startsWith(slicedUrl[0] + '//www.' + slicedUrl[2]));
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
		console.log("\nCookies found: " + cookies.length + "\n\n" + "Yaml file save to: " + filePath + "\n");
	} else {
		console.log("No Cookies found at the given url");
	}
}