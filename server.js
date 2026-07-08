const express = require('express');
const cors = require('cors'); // <-- 1. ADDED THIS LINE HERE
const app = express();

app.use(cors()); // <-- 2. ADDED THIS LINE HERE (Must be above your routes!)
app.use(express.json());

// 1. This is our hardcoded mock API Key for testing.
// In production, these would be unique per merchant and stored in a database.
const VALID_API_KEY = "rzp_test_secret_12345";

// 2. Authentication Middleware
// This function checks every incoming request for a valid API Key
const authenticateMerchant = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    // Real gateways expect keys in the format: "Bearer your_api_key"
    if (!authHeader || authHeader !== `Bearer ${VALID_API_KEY}`) {
        return res.status(401).json({
            status: "error",
            message: "Unauthorized: Invalid or missing API Key in Authorization header"
        });
    }

    // If the key matches, move on to the actual endpoint code
    next();
};

let ordersDb = [];

/**
 * STEP 1 ENDPOINT: Create an Order (Protected by authenticateMerchant)
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

    return res.status(201).json({
        status: "success",
        data: newOrder
    });
});

/**
 * STEP 2 ENDPOINT: Process/Capture Payment (Protected by authenticateMerchant)
 */
app.post('/api/v1/payments/capture', authenticateMerchant, (req, res) => {
    const { order_id, card_number, cvc, expiry } = req.body;

    if (!order_id || !card_number || !cvc || !expiry) {
        return res.status(400).json({
            status: "error",
            message: "Missing payment details"
        });
    }

    const currentOrder = ordersDb.find(o => o.order_id === order_id);

    if (!currentOrder) {
        return res.status(404).json({
            status: "error",
            message: "Order not found"
        });
    }

    if (currentOrder.status === 'paid') {
        return res.status(400).json({
            status: "error",
            message: "This order has already been paid successfully"
        });
    }

    if (card_number.endsWith('0000')) {
        currentOrder.status = 'failed';
        return res.status(402).json({
            status: "failed",
            message: "Payment declined by the issuing bank"
        });
    }

    currentOrder.status = 'paid';

    return res.status(200).json({
        status: "success",
        message: "Payment captured successfully",
        transaction_id: `txn_${Math.random().toString(36).substr(2, 9)}`,
        order_details: currentOrder
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Secure Payment Gateway API live at http://localhost:${PORT}`);
});