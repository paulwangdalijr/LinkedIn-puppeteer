const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
const bodyParser = require("body-parser");
const port = process.env.PORT || 3000;

var prevCount = 0;

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
    
    startBot(req.body.email, req.body.password, req.body.search, req.body.message, req.body.waitMin, req.body.waitMax)
    res.send("Bot is running. Please check the server for progress.");    
});

app.listen(port, (req,res)=>{
    console.log(`Listening on PORT ${port}...`)
});


const startBot = async (email, password, search, message, waitMin, waitMax) => {
    let isHeadless = false;
    // if(bg == 'on'){
    //     isHeadless = true
    // }

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

    console.log("Successfully logged in to LinkedIn.");
    
    console.log("Searching for: '" + search + "'");            
    await linkedInPage.focus("#nav-typeahead-wormhole input");
    await linkedInPage.type("#nav-typeahead-wormhole input", search);
    await linkedInPage.type("#nav-typeahead-wormhole input", String.fromCharCode(13));
    await linkedInPage.waitForNavigation();

    let url = linkedInPage.url();
    url = url.replace('/results/index/?', '/results/people/?');  
    
    process.on("unhandledRejection", async (reason, p) => {
        console.log('Bot will need to refresh the page');
        // console.log(prevCount);
        await start(linkedInPage, url, message, waitMin, waitMax);        
    });

    await start(linkedInPage, url, message, waitMin, waitMax);
    
    console.log("Process completed");
}

start = async(linkedInPage, url, message, waitMin, waitMax) => {

    await linkedInPage.goto(url, {timeout: 30000}); 
    
    let flag = true;
    
    while(flag){        
        url = linkedInPage.url();

        let i = 0;
        while(i < 5){
            await linkedInPage.evaluate( 'window.scrollBy(0, document.body.scrollHeight)' );
            await linkedInPage.waitFor(1000);
            i++;
        }
        await linkedInPage.waitFor(5000);

        let currCount = 0;
        while(true){
            try{
                // console.log("evaluate");
                await linkedInPage.evaluate(() => {                    
                    let dom =  document.querySelectorAll('aside');
                    for(let elem of dom){
                        elem.parentNode.removeChild(elem);
                    }
                    if(!dom){
                        dom = document.querySelector('#launchpad-wormhole');
                        dom.parentNode.removeChild(dom);  
                    }                
                });

                let resultList = await linkedInPage.$x('//ul[contains(@class,"results-list")]/li');
                for (currCount = 0; currCount < resultList.length; currCount++) {
                    // prevCount = currCount;
                    
                    // console.log(currCount);

                    let resultButton = await resultList[currCount].$$('button[class*="search-result"]');                    

                    let resultButtonText;
                    for(let k = 0;  k < resultButton.length; k++){
                        resultButtonText = await ( await resultButton[k].getProperty('innerText')).jsonValue();
                        resultButtonText = resultButtonText.toLowerCase();
                        if (  resultButtonText.indexOf("connect") > -1 ){
                            resultButtonText = 'xxx'
                            await resultButton[k].click();
                            
                        }
                    }
                    if(resultButtonText != 'xxx'){
                        continue;
                    }  

                    let sname = await ( await( await resultList[currCount].$('span.actor-name')).getProperty('innerText')).jsonValue();                   

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

                        let firstName = "";
                        for(let x=0;x<arrName.length-1;x++){ //skip last name
                            if(arrName[x].length == 2){ 
                                if(arrName[x].substr(arrName[x].length - 1) == '.'){ //skip middle initial
                                    continue;
                                }
                            }
                            firstName = firstName + " " + arrName[x];
                        }
                        firstName = firstName.trim();

                        await addNoteButton.click();
                        
                        console.log("Wait before writing message");
                        await sleep(linkedInPage, waitMin, waitMax); 

                        let tempMessage = message.replace('$name', firstName);
                        await linkedInPage.waitForSelector('#custom-message');
                        await linkedInPage.evaluate((tempMessage) => {
                            document.querySelector("#custom-message").value = tempMessage;
                        }, tempMessage);

                        await linkedInPage.type('#custom-message', ' ');

                        let messageButtons = await linkedInPage.$x('//div[@role="document"]//button');
                        
                        for(let k = 0;  k < messageButtons.length; k++){
                            let messageButtonsText = await ( await messageButtons[k].getProperty('innerText')).jsonValue();
                            if (  messageButtonsText == "Send invitation" || 
                                  messageButtonsText == "Done"
                                ){

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
                
                let next = await linkedInPage.$x('//button[@class="next"]');
                if (next.length > 0){
                    flag = true;
                    next[0].click();  

                    console.log("Wait before connecting to the next person");                                    
                    await sleep(linkedInPage, waitMin, waitMax);

                }else{
                    flag = false;
                }

                // console.log("break!");                
                break;
            }catch(e){
                console.log("An error occured in the page:");
                // console.log(e);
                // throw new Error("unhandledRejection", prevCount);
                return;
                throw new Error("unhandledRejection");
            }
        }
    }
}

sleep = async (page, min, max) => {    
    let wait = Math.floor(Math.random() * (  parseInt(max) - parseInt(min) + 1 ) + parseInt(min)); 

    for (let i=0; i < wait; i++){
        console.log("Seconds to wait: " + (wait - i) );        
        await page.waitFor(1000);
    }
}

xPath = async (page, xpath ) => {
    while(true){
        try{
            let element = await page.$x(xpath);
            return element;
        }catch{
            await page.reload();
            await page.waitForNavigation();            
        }
    }
}
