import dotenv from "dotenv";
import express from "express";
import ejs from "ejs";
import bodyParser from "body-parser";
import findOrCreate from "mongoose-findorcreate";
import mongoose from "mongoose";
import session from "express-session";
import passport from "passport";
import passportLocalMongoose from "passport-local-mongoose";
import GoogleStrategy from "passport-google-oauth20";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: "suraj-secret.",
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());
mongoose.connect("mongodb+srv://" + process.env.MONGO_USER + ":" + process.env.MONGO_PASSWORD + "@cluster0.qs8k5.mongodb.net/quoteDB", {useNewUrlParser: true, useUnifiedTopology: true});

const userSchema = new mongoose.Schema({
    username: String,
    googleId: String,
    savedQuotes: Array
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

passport.use(new GoogleStrategy.Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.SITE_URL + "/auth/google/callback",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    (accessToken, refreshToken, profile, cb)=>{
        User.findOrCreate({googleId: profile.id, username: profile.name.givenName}, (err, user)=>{
            return cb(err, user);
        });
    }
));

let allQuotes=[];

const promise = fetch("https://type.fit/api/quotes")
  .then(function(response) {
    return response.json();
  })
  .then(function(data) {
    allQuotes=data;
  });

let currQuote={
    text: "",
    author:""
};

let currIndex=0;

app.get("/", (req, res)=>{
    res.render(__dirname + "/views/home", {item: currQuote, quoteIndex: currIndex, loggedIn: req.isAuthenticated(), userName: (req.isAuthenticated() ? req.user.username : "")});
});

app.get("/list", (req, res)=>{
    if(req.isAuthenticated()){
        res.render(__dirname + "/views/list", {items: req.user.savedQuotes, loggedIn: req.isAuthenticated()});
    }
    else{
        res.render(__dirname + "/views/list", {items: [], loggedIn: req.isAuthenticated()});
    }
    
    
});

app.get("/auth", (req, res)=>{
    res.render(__dirname + "/views/auth");
});

app.get("/auth/google", passport.authenticate("google", {scope: ["profile"]}));

app.get("/auth/google/callback", passport.authenticate("google", {failureRedirect: "/"}), (req, res)=>{
    res.redirect("/");
});



app.get("/logout", (req, res)=>{
    req.logout();
    res.redirect("/");
    currQuote.text="";
    currQuote.author="";
    currIndex=0;
});


app.post("/get-quote", (req, res)=>{
    const index = Math.floor(Math.random()*allQuotes.length);
    currQuote=allQuotes[index];
    currIndex=index;
    res.redirect("/");
});


app.post("/", (req, res)=>{
    if(req.isAuthenticated()){
        User.findById(req.user._id, (err, foundUser)=>{
            if(err) console.log(err);
            else{
                if(foundUser){
                    let alreadyLiked = false;
                    foundUser.savedQuotes.forEach((quote)=>{
                        if(quote.content==allQuotes[req.body.quoteIndex].text && quote.author==allQuotes[req.body.quoteIndex].author) alreadyLiked=true;
                    });
                    if(alreadyLiked==false){
                        foundUser.savedQuotes.push({
                            content: allQuotes[req.body.quoteIndex].text,
                            author: allQuotes[req.body.quoteIndex].author
                        });
                        foundUser.save(()=>{
                            res.redirect("/");
                        });
                    }
                    else{
                        res.redirect("/");
                    }
                }
            }
        });
    }
    else{
        res.redirect("/list");
    }
});


app.post("/delete", (req, res)=>{
    req.user.savedQuotes.splice(req.body.quoteIndex, 1);
    req.user.save();
    res.redirect("/list");
});


let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, ()=>{
  console.log("Server started on port " + port);
});


