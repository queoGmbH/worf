const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const filename = "data-out";
const url = process.argv[2];
let depth = process.argv[3]; //? undefined: 0;

let browser;
let page;

let currentDepth = 1;
let slicedUrl = url.split('/');

let cookies = [];
let result = [];
let visited = [];
let urls = [];
let startUrls = [];



(async () => {

	if (url != null) {

		browser = await puppeteer.launch();
		page = await browser.newPage();
		await page.goto(url, {waitUntil: 'networkidle2'});

		try {

			if(depth == null) depth = 0;

			startUrls.push(await getUrls());

			await loopOverUrls(startUrls);

		} catch (error) {

			console.log(error);

		} finally {

			await browser.close();

		}

	} else {

		console.log("no url set");

	}

})();

async function loopOverUrls(givenUrls) {

	if (currentDepth > depth) {

		await getCookies();

	} else if (currentDepth <= depth) {

		if (givenUrls != null) {

			console.log("Visit Urls at Depth: " + currentDepth);

			for (let i = 0; i < givenUrls.length; i++) {

				for (let j = 0; j < givenUrls[i].length; j++) {

					if (visited.indexOf(givenUrls[i][j]) === -1) {

						await page.goto(givenUrls[i][j], {waitUntil: 'networkidle2'});

						console.log(page.url());

						urls.push(await getUrls());

						visited.push(page.url());

					}
				}
			}
		}

		currentDepth++;

		if (urls != null) {

			await loopOverUrls(urls);

		}
	}
}

//get all urls from current page
async function getUrls() {

	try {

		const hrefs = await page.$$eval('a', as => as.map(a => a.href));

		result = hrefs.filter(item => item.startsWith(slicedUrl[0] + '//www.' + slicedUrl[2]));

		result = result.filter(item => !item.endsWith(".pdf"));

		for (let i = 0; i < result.length; i++) {
			result[i] = result[i].split('#')[0];
		}

		result = result.filter(item => item != '');

		let uniqueUrls = result.filter(function (elem, index, self) {
			return index === self.indexOf(elem);
		});

		return uniqueUrls;

	} catch (error) {

		console.log(error);

	}
}

// get all cookies form the given url
async function getCookies() {

	const response = await page._client.send('Network.getAllCookies');

	const currentCookies = response.cookies.map(cookie => {
		cookie.expiresUTC = new Date(cookie.expires * 1000);
		return cookie;
	});

	cookies.push(...currentCookies);

	await writeFile();
}


// write all collected cookies to yaml file
async function writeFile() {

	if (cookies.length > 0) {
		let yamlStr = yaml.safeDump(cookies);

		const filePath = path.join(__dirname, filename + '.yaml');

		await fs.writeFile(filePath, yamlStr, 'utf-8');

		console.log("cookies found: " + cookies.length + "\n" + "yaml file save to: " + filePath);

	} else {

		console.log("no cookies found at the given url");

	}
}