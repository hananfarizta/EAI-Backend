const express = require('express');
const app = express()
const PORT = process.env.PORT_ONE || 7070;
const mongoose = require('mongoose');
const User = require('./User');
const jwt = require("jsonwebtoken");
app.use(express.json());

mongoose.connect("mongodb://localhost/auth-service", {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => {
        console.log('Auth-Service DB Connected');
        app.listen(PORT, () => {
            console.log(`Auth-Service at ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Error connecting to database:', error);
    });

// Login
app.post("/auth/login", async(req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
        return res.json({ message: "User doesn't exist" });
    } else {
        if (password !== user.password) {
            return res.json({ message: "Password Incorrect" });
        }
        const payload = {
            email,
            username: user.username
        };
        jwt.sign(payload, "secret", (err, token) => {
            if (err) console.log(err);
            else return res.json({ token: token });
        });
    }
});

// Register
app.post("/auth/register", async(req, res) => {
    const { email, password, username } = req.body;
    console.log(req.body);
    const userExists = await User.findOne({ email });
    // console.log(userExists);
    if (userExists) {
        return res.json({ message: "User already exists" });

    } else {
        const newUser = new User({
            email,
            username,
            password,
        });
        newUser.save();
        return res.json(newUser);
    }
});