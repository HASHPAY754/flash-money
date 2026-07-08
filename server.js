const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const VALID_API_KEY = "rzp_test_secret_12345";

// Authentication Middleware
const authenticateMerchant = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${VALID_API_KEY}`) {
        return res.status(401).json({
            status: "error",
            message: "Unauthorized: Invalid or missing API Key"
        });
    }
    next();
};

let ordersDb = [];

/**
 * STEP 1: Create an Order
 */
app.post('/api/v1/orders', authenticateMerchant, (req, res) => {
    const { amount, currency, merchant_id } = req.body;

    if (!amount || !currency || !merchant_id) {
        return res.status(400).json({ 
            status: "error", 
            message: "Missing required fields: amount, currency, or merchant_id" 
        });
    }

    const newOrder = {
        order_id: `ord_${Math.random().toString(36).substr(2, 9)}`,
        merchant_id: merchant_id,
        amount: amount,
        currency: currency.toUpperCase(),
        status: "created",
        created_at: new Date()
    };

    ordersDb.push(newOrder);
    return res.status(201).json({ status: "success", data: newOrder });
});

/**
 * STEP 2: Capture Payment (Supports CARD and UPI)
 */
app.post('/api/v1/payments/capture', authenticateMerchant, (req, res) => {
    const { order_id, method, card_number, cvc, expiry, upi_id } = req.body;

    if (!order_id || !method) {
        return res.status(400).json({ status: "error", message: "Missing order_id or payment method" });
    }

    const currentOrder = ordersDb.find(o => o.order_id === order_id);
    if (!currentOrder) {
        return res.status(404).json({ status: "error", message: "Order not found" });
    }

    if (currentOrder.status === 'paid') {
        return res.status(400).json({ status: "error", message: "This order has already been paid" });
    }

    // 1. Logic for Card Payments
    if (method === 'card') {
        if (!card_number || !cvc || !expiry) {
            return res.status(400).json({ status: "error", message: "Missing card details for card payment" });
        }
        if (card_number.endsWith('0000')) {
            currentOrder.status = 'failed';
            return res.status(402).json({ status: "failed", message: "Card declined by issuing bank" });
        }
    } 
    // 2. Logic for UPI Payments (GPay, PhonePe, etc.)
    else if (method === 'upi') {
        if (!upi_id) {
            return res.status(400).json({ status: "error", message: "Missing UPI ID for mobile app payment" });
        }
        // Simulate a fake blocked account scenario if they type "fail@upi"
        if (upi_id.includes('fail')) {
            currentOrder.status = 'failed';
            return res.status(402).json({ status: "failed", message: "UPI transaction timed out or rejected by user" });
        }
    } else {
        return res.status(400).json({ status: "error", message: "Unsupported payment method requested" });
    }

    // Save method used to the order tracking object
    currentOrder.status = 'paid';
    currentOrder.payment_method = method;
    currentOrder.paid_via = method === 'upi' ? upi_id : `XXXX-XXXX-XXXX-${card_number.slice(-4)}`;

    return res.status(200).json({
        status: "success",
        message: "Payment captured successfully",
        transaction_id: `txn_${Math.random().toString(36).substr(2, 9)}`,
        order_details: currentOrder
    });
});
/**
 * DEBUG ENDPOINT: View all orders currently in memory
 */
app.get('/api/v1/orders', (req, res) => {
    return res.status(200).json({
        total_orders: ordersDb.length,
        orders: ordersDb
    });
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Multi-Method Payment Gateway live at http://localhost:${PORT}`);
});