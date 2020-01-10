const puppeteer = require('puppeteer');
const fs = require('fs');
const yaml = require('js-yaml');
const url = process.argv[2];

(async () => {

	if (url != null) {

		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.goto(url, {waitUntil: 'networkidle2'});

		try {


			// get cookies
			let data = await page._client.send('Network.getAllCookies');
			data = data.cookies.map(cookie => {
				cookie.expiresUTC = new Date(cookie.expires * 1000);
				return cookie;
			});

			// write yaml file
			if (data.length > 0) {
				let yamlStr = yaml.safeDump(data);
                fs.writeFileSync('./data-out.yaml', yamlStr, 'utf-8');

				console.log("cookies found: " + data.length + "\n" + "yaml file save to: " + __dirname + "/data-out.yaml");
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