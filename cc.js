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
let urls = [];


(async () => {

	if (url != null) {

		if (!isNaN(depth) || depth == null) {

			try {

				browser = await puppeteer.launch();
				page = await browser.newPage();

				if (depth == null) depth = 0;

				await loopOverUrls([[url]]);

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

	if (currentDepth > depth) {

		await getCookies();

	} else if (currentDepth <= depth) {

		console.log('Search for Urls at depth: ' + currentDepth);

		if (givenUrls != null) {

			for (let i = 0; i < givenUrls.length; i++) {

				for (let j = 0; j < givenUrls[i].length; j++) {

					if (visited.indexOf(givenUrls[i][j]) === -1) {

						if (mode === "fast") {
							await page.goto(givenUrls[i][j]);
						} else {
							await page.goto(givenUrls[i][j], {waitUntil: 'networkidle2'});
						}

						//console.log(page.url());

						if (currentDepth < depth) urls.push(await getUrls());

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


async function getUrls() {

	try {

		const hrefs = await page.$$eval('a', as => as.map(a => a.href));

		let result = hrefs.filter(item => item.startsWith(slicedUrl[0] + '//www.' + slicedUrl[2]));

		result = result.filter(item => item.substr(item.length - 4, 1) !== ".");

		for (let i = 0; i < result.length; i++) {
			result[i] = result[i].split('#')[0];
		}

		result = result.filter(item => item != '');

		let uniqueUrls = result.filter(function (elem, index, self) {
			return index === self.indexOf(elem);
		});

		console.log('At Url ' + page.url() + ' founded Urls: ' + uniqueUrls.length);

		return uniqueUrls;

	} catch (error) {

		console.log(error);

	}
}


async function getCookies() {

	const response = await page._client.send('Network.getAllCookies');

	const cookies = response.cookies.map(cookie => {
		cookie.expiresUTC = new Date(cookie.expires * 1000);


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

	await writeFile(cookies);
}


async function writeFile(cookies) {

	if (cookies.length > 0) {
		let yamlStr = yaml.safeDump(cookies);

		const filePath = path.join(__dirname, filename + '.yaml');

		await fs.writeFile(filePath, yamlStr, 'utf-8');

		console.log("\nCookies found: " + cookies.length + "\n" + "Yaml file save to: " + filePath);

	} else {

		console.log("no cookies found at the given url");

	}
}