require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
passport.Strategy = require('passport-local').Strategy;

const auth = require('./routes/auth');
const models = require('./models/models');

const app = express();
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);

const cookieParser = require('cookie-parser');

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    dbName: "berney-tech",
    auth: {
        user: "berney-tech",
        password: process.env.MONGODB_PASSWORD
    }
}).catch((err) => {
    console.log(err);
});

const allowCrossDomain = function (req, res, next) {
    res.header('Access-Control-Allow-Origin', process.env.DOMAIN);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
}

let secureCookies;
if (process.env.USE_SECURE_COOKIES) {
    secureCookies = true;
} else {
    secureCookies = false;
}

app.use(allowCrossDomain);
app.use(cookieParser());
app.use(express.json());
app.use(session({
    secret: process.env.SECRET,
    store: new MongoStore({ mongooseConnection: mongoose.connection }),
    saveUninitialized: true,
    resave: true,
    cookie: {
        secure: secureCookies,
    },
}));
app.use(passport.initialize());
app.use(passport.session());
app.use('/api/auth', auth(app, passport));

app.listen(process.env.PORT || 3000);