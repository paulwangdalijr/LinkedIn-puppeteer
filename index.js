const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
const bodyParser = require("body-parser");
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());

app.get('*', (req,res)=>{
    res.sendFile(__dirname + "/index.html");
});

app.post('/start', (req,res)=>{
    if (req.body.email === "" ||
        req.body.password === "" ||
        req.body.search === "" ){
        console.log("Request rejected - Some mandatory fields are missing");        
        res.json({success: false, message: "Populate mandatory fields"});  
        return;  
    }

    console.log("Bot is running...");
    
    startBot(req.body.email, req.body.password, req.body.search, req.body.message, req.body.bg, req.body.wait)
    res.send("Bot is running. Please check the server for progress.");    
});

app.listen(port, (req,res)=>{
    console.log(`Listening on PORT ${port}...`)
});


const startBot = async (email, password, search, message, bg, wait) => {
    let isHeadless = false;
    if(bg == 'on'){
        isHeadless = true
    }

    const browser = await puppeteer.launch({
        headless: isHeadless,
    });   

    const linkedInPage = await browser.newPage();
    // await linkedInPage.setViewport({ width: 1366, height: 768});
    await linkedInPage.setViewport({ width: 800, height: 600 })
    
    await linkedInPage.goto("https://www.linkedin.com/uas/login", {timeout: 30000}); 
    console.log("Logging in LinkedIn...");

    // await linkedInPage.waitForSelector('#login-submit');
    await linkedInPage.evaluate((email, password) => {
        document.querySelector("#session_key-login").value = email;
        document.querySelector("#session_password-login").value = password;
        // document.querySelector("#login-submit").click();
    }, email, password);

    await linkedInPage.click("#btn-primary");

    await linkedInPage.waitForSelector("#nav-typeahead-wormhole input")

    console.log("Successfully logged in to LinkedIn...");
    
    await linkedInPage.focus("#nav-typeahead-wormhole input");

    await linkedInPage.type("#nav-typeahead-wormhole input", search);
    await linkedInPage.type("#nav-typeahead-wormhole input", String.fromCharCode(13));

    console.log("Searching for '" + search + "'...");

    await linkedInPage.waitForNavigation();
    // const btnPeople = await linkedInPage.$x("//button[contains(text(), 'People')]");

    // const buttons = await linkedInPage.$$("button");
    
    // for (let i = 0; i < buttons.length; i++) {
    //     // console.log(await (await buttons[i].getProperty('innerText')).jsonValue());
    //     if (await (await buttons[i].getProperty('innerText')).jsonValue() == "People"){
    //         await buttons[i].click();
    //     }
    // }

    let url = linkedInPage.url();
    url = url.replace('/results/index/?', '/results/people/?');

    await linkedInPage.goto(url, {timeout: 30000}); 
    
    let flag = true;
    while(flag){        

        let i = 0;
        while(i < 5){
            await linkedInPage.evaluate( 'window.scrollBy(0, document.body.scrollHeight)' );
            await linkedInPage.waitFor(1000);
            i++;
        }
        
        const resultButtons = await linkedInPage.$x('//button[contains(@class,"search-result")]');

        for (let i = 0; i < resultButtons.length; i++) {
            // console.log(await (await resultButtons[i].getProperty('innerText')).jsonValue());
            if (await (await resultButtons[i].getProperty('innerText')).jsonValue() == "Connect"){
                
                await resultButtons[i].click();

                await linkedInPage.waitForXPath('//div[contains(@class,"send-invite")]', {timeout: 30000});
                await linkedInPage.waitForXPath('//div[@role="document"]//button', {timeout: 30000});

                const name = await linkedInPage.$x('//div[@role="document"]//strong');
                let sname = await (await name[0].getProperty('innerText')).jsonValue();
        
                const arrName = sname.split(' ');
                let addNoteButtons = await linkedInPage.$x('//div[@role="document"]//button');
                addNoteButtons[0].click();

                const tempMessage = message.replace('$name', arrName[0]);

                await linkedInPage.waitForSelector('#custom-message');
                await linkedInPage.evaluate((tempMessage) => {
                    document.querySelector("#custom-message").value = tempMessage;
                }, tempMessage);

                await linkedInPage.type('#custom-message', ' ');

                const doneButtons = await linkedInPage.$x('//div[@role="document"]//button');
                doneButtons[1].click();

                console.log(sname + " was added.");

                await linkedInPage.waitFor(parseInt(wait)*1000);  
            }
        }
        
        const next = await linkedInPage.$x('//button[@class="next"]')
        if (next.length > 0){
            flag = true;
            next[0].click();
        }else{
            flag = false;
        }
        await linkedInPage.waitFor(parseInt(wait)*1000);        

    }
};