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
    console.log("TEST");
    res.sendFile(__dirname + "/index.html");
    // console.log(req.body);
    // res.sendFile('index.html');
});

app.post('/start', async (req,res)=>{
    console.log(req.body);
    if (req.body.email === "" ||
        req.body.password === "" ||
        req.body.search === "" ){
        res.json({success: false, message: "Populate mandatory fields"});  
        return;  
    }

    await startBot(req.body.email, req.body.password, req.body.search, req.body.message, req.body.wait, req.body.max)
    res.sendFile(__dirname + "/index.html");
    
    // console.log(req.body);
    // res.sendFile('index.html');
});

app.listen(port, (req,res)=>{
    console.log(`Listening on PORT ${port}...`)
});


const startBot = async (email, password, search, message, wait, max) => {
    
    const browser = await puppeteer.launch({
        headless: false,
    });   

    const linkedInPage = await browser.newPage();

    await linkedInPage.goto("https://www.linkedin.com/uas/login", {timeout: 300000}); 

    // await linkedInPage.waitForSelector('#login-submit');
    await linkedInPage.evaluate((email, password) => {
        document.querySelector("#session_key-login").value = email;
        document.querySelector("#session_password-login").value = password;
        // document.querySelector("#login-submit").click();
    }, email, password);

    await linkedInPage.click("#btn-primary");

    await linkedInPage.waitForSelector("#nav-typeahead-wormhole input")
    await linkedInPage.focus("#nav-typeahead-wormhole input");

    await linkedInPage.type("#nav-typeahead-wormhole input", search);
    await linkedInPage.type("#nav-typeahead-wormhole input", String.fromCharCode(13));
};