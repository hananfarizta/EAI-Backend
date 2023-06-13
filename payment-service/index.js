const express = require('express');
const app = express();
const PORT = process.env.PORT_ONE || 6060;
const axios = require('axios');
const jwt = require("jsonwebtoken");
const amqp = require('amqplib');
const isAuthenticated = require('../isAuthenticated');
const midtransClient = require('midtrans-client');

const coreApi = new midtransClient.CoreApi({
    isProduction: false,
    serverKey: 'SB-Mid-server-BIFOP7EjJZeHJs6PPDgytHKe',
    clientKey: 'SB-Mid-client-VTLdxX1Nl9TupCnb'

});

app.use(express.json());

var channel, connection;

async function connect() {
    const amqpServer = "amqp://localhost:5672";
    connection = await amqp.connect(amqpServer);
    channel = await connection.createChannel();
    await channel.assertQueue("PRODUCT");
}

connect();

app.post("/payment/checkout", isAuthenticated, async(req, res) => {
    const { ids } = req.body;
    try {
        // Get User Details
        const authResponse = await axios.get('http://localhost:7070/user', {
            headers: {
                Authorization: `Bearer ${req.headers.authorization.split(" ")[1]}`,
            },
        });

        const user = authResponse.data;

        // Get Products
        const productResponse = await axios.post('http://localhost:8080/product/get-products', { ids });

        const products = productResponse.data;

        // Create Order
        const orderResponse = await axios.post('http://localhost:9090/order/create', { products, userEmail: user.email });

        const order = orderResponse.data;

        // Create Payment Request in Midtrans
        const paymentResponse = await axios.post('http://localhost:6060/payment/create-payment', { order });

        const paymentUrl = paymentResponse.data.paymentUrl;

        return res.json({ paymentUrl });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});

app.post("/payment/create-payment", isAuthenticated, async(req, res) => {
    const { order, payment } = req.body;

    const parameter = {
        "payment_type": "bank_transfer",
        "bank_transfer": {
            "bank": payment
        },
        "transaction_details": {
            "order_id": order.newOrder._id,
            "gross_amount": order.newOrder.total_price
        },
        "customer_details": {
            "email": order.newOrder.user,
        }
    }

    coreApi.charge(parameter).then((chargeResponse) => {
        return res.json({
            message: 'Charge Response:',
            data: chargeResponse
        });
    })
});

app.post("/payment/notif", (req, res) => {
    coreApi.transaction.notification(req.body)
        .then((status) => {
            if (status.transaction_status == "settlement") {
                console.log("===================================================")
                console.log(status)
                console.log("===================================================")
            }
        })
})

app.listen(PORT, () => {
    console.log(`Payment-Service at ${PORT}`);
});