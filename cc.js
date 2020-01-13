const puppeteer = require('puppeteer');
const fs = require('fs');
const yaml = require('js-yaml');
const filename = "data-out"
const url = process.argv[2];
let data = [];

(async () => {

	if (url != null) {

		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.goto(url, {waitUntil: 'networkidle2'});

		try {

			let urls = [];
			urls[0] = url;



			for (let i = 0; i < urls.length; i++) {
				await page.goto(urls[i], {waitUntil: 'networkidle2'});
				console.log(urls[i]);

				// get cookies
				data[i] = await page._client.send('Network.getAllCookies');
				data[i] = data[i].cookies.map(cookie => {
					cookie.expiresUTC = new Date(cookie.expires * 1000);
					return cookie;
				});

			}


			// write yaml file
			if (data.length > 0 && data[0].length > 0) {
				let cookies;
				for (let i = 0; i < data.length; i++) {
					cookies = data[i];
				}

				let yamlStr = yaml.safeDump(cookies);
				fs.writeFileSync('./' + filename + '.yaml', yamlStr, 'utf-8');

				console.log("cookies found: " + cookies.length + "\n" + "yaml file save to: " + __dirname + "/" + filename + ".yaml");
			} else {
				console.log("no cookies found at the given url");
			}




		} catch (error) {
			console.log(error);
		} finally {
			await browser.close();
		}

	} else {
		console.log("no url set");
	}

})();