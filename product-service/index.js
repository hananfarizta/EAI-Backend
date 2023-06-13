const express = require('express');
const app = express()
const PORT = process.env.PORT_ONE || 8080;
const mongoose = require('mongoose');
const jwt = require("jsonwebtoken");
const amqp = require('amqplib');
const Product = require('./Product');
const isAuthenticated = require('../isAuthenticated');
const axios = require('axios');

app.use(express.json());

var order;

var channel, connection;

mongoose.connect("mongodb://localhost/product-service", {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => {
        console.log('Product-Service DB Connected');
        app.listen(PORT, () => {
            console.log(`Product-Service at ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Error connecting to database:', error);
    });

async function connect() {
    const amqpServer = "amqp://localhost:5672";
    connection = await amqp.connect(amqpServer);
    channel = await connection.createChannel();
    await channel.assertQueue("PRODUCT");
}
connect()

// Create a new Product
// Buy a Product
app.post("/product/create", isAuthenticated, async(req, res) => {
    // req.user.email
    const { name, description, price } = req.body;
    console.log(req.body);
    const newProduct = new Product({
        name,
        description,
        price,
    });
    newProduct.save();
    return res.json(newProduct);
});

// Get all product
app.get("/product/all-product", isAuthenticated, async(req, res) => {
    try {
        const products = await Product.find();
        return res.json(products);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});


// User sends a list of product's Ids to buy
// Creating an order with those products and a total value of sum of products prices.

app.post("/product/buy", isAuthenticated, async(req, res) => {
    const { names, payment } = req.body;
    const auth = req.rawHeaders[1]

    const products = await Product.find({ name: { $in: names } });
    await channel.sendToQueue(
        "ORDER",
        Buffer.from(
            JSON.stringify({
                products,
                userEmail: req.user.email,
            })
        )
    );
    await channel.consume("PRODUCT", async(data) => {
        console.log("Consuming PRODUCT queue");
        order = JSON.parse(data.content);
        channel.ack(data);
        const orderPayment = await axios.post('http://localhost:6060/payment/create-payment', {
            order,
            payment
        }, {
            headers: {
                Authorization: auth,
            },
        })

        const dataOrder = orderPayment.data.data;

        if (payment.toLowerCase() == "permata") {
            return res.json({
                va_number: dataOrder.permata_va_number,
                status_message: dataOrder.status_message,
                gross_amount: dataOrder.gross_amount,
                payment_type: dataOrder.payment_type,
                transaction_time: dataOrder.transaction_time,
                transaction_status: dataOrder.transaction_status
            });
        } else {
            return res.json({
                va_number: dataOrder.va_numbers[0].va_number,
                status_message: dataOrder.status_message,
                gross_amount: dataOrder.gross_amount,
                payment_type: dataOrder.payment_type,
                transaction_time: dataOrder.transaction_time,
                transaction_status: dataOrder.transaction_status
            });
        }
    })
});