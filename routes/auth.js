"use strict";

const mongoose = require('mongoose');
const models = require('../models/models');

const express = require('express');
const router = express.Router();

const { check, validationResult } = require('express-validator/check');

module.exports = function (app, passport, stripe) {
    passport.use(new passport.Strategy({
            usernameField: 'email',
            passwordField: 'password',
            session: true,
    },
        function (email, password, done) {
            models.User.findById(email, (err, user) => {
                if (err) {
                    return done(err);
                }
                if (!user) {
                    return done(null, false);
                }
                user.verifyPassword(password).then((success) => {
                    if (success) {
                        return done(null, user);
                    } else {
                        return done("wrong password");
                    }
                }).catch((err) => {
                    return done(err);
                });
            });
        })
    );

    passport.serializeUser(function (user, done) {
        return done(null, user._id);
    });

    passport.deserializeUser(function (_id, done) {
        models.User.findById(_id).populate('tickets').exec(function (err, rawUser) {
            let user = {
                firstName: rawUser.firstName,
                lastName: rawUser.lastName,
                email: rawUser._id,
                accessLevel: rawUser.accessLevel,
                tickets: rawUser.tickets,
            };
            stripe.customers.retrieve(rawUser.stripeId, function (err, customer) {
                if (customer.subscriptions.total_count) {
                    user.subscription = customer.subscriptions.data[0].plan.nickname;
                }  else {
                    user.subscription = "None";
                }
                done(err, user);
            });
        });
    });

    router.post('/login', function (req, res, next) {
        passport.authenticate('local', function (err, user) {
            if (err) {
                res.status(500).json([err]);
            } else if (!user) {
                res.status(401).json(['user doesn\'t exist']);
            } else {
                req.logIn(user, function (err) {
                    if (err) {
                        return next(err);
                    }
                    return res.status(200).json("OK");
                })
            }
        })(req, res, next);
    });

    router.post('/signup', [
        check('email', 'Email not valid').isEmail(),
        check('firstName', 'First name must be at least length one').isLength({ min: 1 }),
        check('lastName', 'Last name must be at least length one').isLength({ min: 1 }),
        check('password', 'Password must be at least length 6').isLength({ min: 6 })
                        .custom(function (val, { req, loc, path }) {
                            if (val != req.body.confirmPassword) {
                                throw new Error('Passwords don\'t match');
                            } else {
                                return val;
                            }
                        }),
    ], function (req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }
        models.User.findById(req.body.email, function (err, doc) {
            if (err) {
                return res.status(500).json({errors: [{param: "email_check", msg: "Error accessing database"}]});
            }
            if (doc) {
                return res.status(400).json({specialErrors: [{param: "email_check", type: "user_exists"}]});
            } else {
                models.User.hashPassword(req.body.password).then(function (hash) {
                    stripe.customers.create({
                        description: "Customer for " + req.body.email,
                        email: req.body.email,
                    }, function (err, customer) {
                        if (err) {
                            res.status(500).json({errors: [{param: "stripe_customer_creation", msg: err}]});
                        } else {
                            const user = {
                                _id: req.body.email,
                                firstName: req.body.firstName,
                                lastName: req.body.lastName,
                                passwordHash: hash,
                                stripeId: customer.id,
                                accessLevel: 0,
                            };
                            models.User.create(user).then((doc) => {
                                req.login(user, function (err) {
                                    if (!err) {
                                        res.status(200).json("Successful login after signup");
                                    } else {
                                        res.status(500).json({errors: [{param: "user_login", msg: "Failed to login after signup"}]});
                                    }
                                })
                            });
                        }
                    });
                });
            }
        });
    });

    router.get('/get', function (req, res) {
        if (req.user) {
            res.status(200).json(req.user);
        } else {
            res.status(200).json(null);
        }
    });

    router.post('/logout', function (req, res, next) {
        req.logOut();
        req.session.destroy(function(err) {
            if (err) {
                res.status(500).json("error logging out");
            } else {
                res.status(200).json("OK");
            }
        });
    });

    router.post('/ticket/new', function (req, res) {
        const ticket = {
            categories: req.body.categories,
            author: req.user.email,
        }
        models.Ticket.create(ticket, function (err, doc) {
            if (err) {
                res.status(500).json(err);
            } else {
                models.User.findByIdAndUpdate(doc.author, { $push: { tickets: doc._id } }, function (err, _) {
                    if (err) {
                        res.status(500).json(err);
                    } else {
                        res.status(200).json(doc);
                    }
                });
            }
        });
    });

    router.get('/ticket/view/:ticketId', function (req, res) {
        models.Ticket.findById(req.params.ticketId)
            .populate({ path: 'messages', populate: { path: 'author' } })
            .exec(
                function (err, ticket) {
                    if (err) {
                        res.status(500).json(err);
                    } else if (!ticket.author == req.user._id) {
                        res.status(401).json("Not Authorized");
                    } else {
                        res.status(200).send(ticket);
                    }
                }
            );
    });

    router.post('/ticket/message/new', function (req, res) {
        models.Ticket.findById(req.body.ticketId, function (err, ticket) {
            if (ticket.author != req.user._id && !req.user.accessLevel) {
                res.status(401).json("Not Authorized");
            } else {
                const messageData = {
                    ticketRef: ticket._id,
                    author: req.user.email,
                    body: req.body.messageBody,
                };
                models.Message.create(messageData, function (err, message) {
                    ticket.update({ $push: { messages: message._id } }, function (err, _) {
                        if (err) {
                            res.status(500).json(err);
                        } else {
                            res.status(200).json(message);
                        }
                    });
                });
            }
        });
    });

    return router;
};
