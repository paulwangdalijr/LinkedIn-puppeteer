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
    
    startBot(req.body.email, req.body.password, req.body.search, req.body.message, req.body.bg, req.body.waitMin, req.body.waitMax)
    res.send("Bot is running. Please check the server for progress.");    
});

app.listen(port, (req,res)=>{
    console.log(`Listening on PORT ${port}...`)
});


const startBot = async (email, password, search, message, bg, waitMin, waitMax) => {
    let isHeadless = false;
    if(bg == 'on'){
        isHeadless = true
    }

    const browser = await puppeteer.launch({
        headless: isHeadless,
        args: [
            '--no-default-browser-check'
        ]
    });   

    const linkedInPage = await browser.newPage();
    await linkedInPage.setViewport({ width: 1032, height: 600 })
    
    await linkedInPage.goto("https://www.linkedin.com/uas/login", {timeout: 30000}); 
    console.log("Logging in LinkedIn...");

    await linkedInPage.evaluate((email, password) => {
        document.querySelector("#session_key-login").value = email;
        document.querySelector("#session_password-login").value = password;
    }, email, password);

    await linkedInPage.click("#btn-primary");

    await linkedInPage.waitForSelector("#nav-typeahead-wormhole input")

    console.log("Successfully logged in to LinkedIn...");
    
    await linkedInPage.focus("#nav-typeahead-wormhole input");

    await linkedInPage.type("#nav-typeahead-wormhole input", search);
    await linkedInPage.type("#nav-typeahead-wormhole input", String.fromCharCode(13));

    console.log("Searching for: '" + search + "'");

    await linkedInPage.waitForNavigation();

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
        let resultList = await linkedInPage.$x('//ul[contains(@class,"results-list")]/li');
        for (let i = 0; i < resultList.length; i++) {
            let resultButton = await resultList[i].$$('button[class*="search-result"]')

            let resultButtonText;
            for(let k = 0;  k < resultButton.length; k++){
                resultButtonText = await ( await resultButton[k].getProperty('innerText')).jsonValue();
                if (  resultButtonText == "Connect"){
                    resultButtonText = 'xxx'
                    resultButton[k].click();
                }
            }

            if(resultButtonText != 'xxx'){
                continue;
            }

            
            let sname = await ( await( await resultList[i].$('span.actor-name')).getProperty('innerText')).jsonValue();

            console.log("Wait before performing next action");
            await sleep(linkedInPage, waitMin, waitMax); 
    
            let addButtons = await linkedInPage.$x('//div[@role="document"]//button');
            
            let addNoteButton;
            let sendNowButton;
            for(let k = 0;  k < addButtons.length; k++){
                let addButtonsText = await ( await addButtons[k].getProperty('innerText')).jsonValue();
                if (  addButtonsText == "Add a note"){
                    addNoteButton = addButtons[k];
                }else if( addButtonsText == "Send now" || addButtonsText == "Done"){
                    sendNowButton = addButtons[k];                            
                }
            }

            if( message != "" ){
                let arrName = sname.split(' ');

                await addNoteButton.click();
                
                console.log("Wait before writing message");
                await sleep(linkedInPage, waitMin, waitMax); 

                let tempMessage = message.replace('$name', arrName[0]);
                await linkedInPage.waitForSelector('#custom-message');
                await linkedInPage.evaluate((tempMessage) => {
                    document.querySelector("#custom-message").value = tempMessage;
                }, tempMessage);

                await linkedInPage.type('#custom-message', ' ');

                let messageButtons = await linkedInPage.$x('//div[@role="document"]//button');
                
                for(let k = 0;  k < messageButtons.length; k++){
                    let messageButtonsText = await ( await messageButtons[k].getProperty('innerText')).jsonValue();
                    if (  messageButtonsText == "Send invitation"){

                        console.log("Wait before clicking Send invitation");                                
                        await sleep(linkedInPage, waitMin, waitMax);                                
                        await messageButtons[k].click();

                    }
                }                        
            }else{
                await sendNowButton.click();                    
                
            }

            console.log(sname + " was added.");    
            console.log("Wait before connecting to the next person");                                    
            await sleep(linkedInPage, waitMin, waitMax);
        }
        
        let next = await linkedInPage.$x('//button[@class="next"]')
        if (next.length > 0){
            flag = true;
            next[0].click();  

            console.log("Wait before connecting to the next person");                                    
            await sleep(linkedInPage, waitMin, waitMax);

        }else{
            flag = false;
        }
    }

    console.log("Process completed")
};

sleep = async (page, min, max) => {    
    let wait = Math.floor(Math.random() * parseInt(max)) + parseInt(min); 

    for (let i=0; i < wait; i++){
        console.log("Seconds to wait: " + (wait - i) );        
        await page.waitFor(1000);
    }
}