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

let currentDepth = 1;
let slicedUrl = url.split('/');

let cookies = [];
let result = [];
let visited = [];
let urls = [];
let startUrls = [];



(async () => {

	if (url != null) {

		if(!isNaN(depth)) {

			try {

				browser = await puppeteer.launch();
				page = await browser.newPage();
				await page.goto(url, {waitUntil: 'networkidle2'});

				if(depth == null) depth = 0;

				startUrls.push(await getUrls());

				await loopOverUrls(startUrls);

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

		if (givenUrls != null) {

			for (let i = 0; i < givenUrls.length; i++) {

				for (let j = 0; j < givenUrls[i].length; j++) {

					if (visited.indexOf(givenUrls[i][j]) === -1) {

						if(mode === "fast") {
							await page.goto(givenUrls[i][j]);
						} else {
							await page.goto(givenUrls[i][j], {waitUntil: 'networkidle2'});
						}

						console.log(page.url());

						if(currentDepth < depth) urls.push(await getUrls());

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

		result = hrefs.filter(item => item.startsWith(slicedUrl[0] + '//www.' + slicedUrl[2]));

		result = result.filter(item => item.substr(item.length - 4, 1) !== ".");

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


async function getCookies() {

	const response = await page._client.send('Network.getAllCookies');

	const currentCookies = response.cookies.map(cookie => {
		cookie.expiresUTC = new Date(cookie.expires * 1000);
		return cookie;
	});

	cookies.push(...currentCookies);

	await writeFile();
}


async function writeFile() {

	if (cookies.length > 0) {
		let yamlStr = yaml.safeDump(cookies);

		const filePath = path.join(__dirname, filename + '.yaml');

		await fs.writeFile(filePath, yamlStr, 'utf-8');

		console.log("\nCookies found: " + cookies.length + "\n" + "Yaml file save to: " + filePath);

	} else {

		console.log("no cookies found at the given url");

	}
}