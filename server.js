const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const VALID_API_KEY = "rzp_test_secret_12345";

// Safely pull the database link from your secure environment settings
const MONGO_URI = process.env.MONGO_URI; 

if (!MONGO_URI) {
    console.error("❌ CRITICAL: MONGO_URI environment variable is missing!");
    process.exit(1);
}

// Connect to MongoDB Atlas Cloud
mongoose.connect(MONGO_URI)
    .then(() => console.log("🔌 Connected permanently to MongoDB Atlas!"))
    .catch(err => console.error("❌ Database connection error:", err));
mongodb+srv://hashim225063_db_user:FlashMoneyPass123@flashmoneycluster.cusezii.mongodb.net/?appName=flashmoneycluster &ssl=true;
// Connect to MongoDB Atlas Cloud
mongoose.connect(MONGO_URI)
    .then(() => console.log("🔌 Connected permanently to MongoDB Atlas!"))
    .catch(err => console.error("❌ Database connection error:", err));

// Define Permanent Order Database Schema
const OrderSchema = new mongoose.Schema({
    order_id: { type: String, required: true, unique: true },
    merchant_id: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, default: 'created' },
    payment_method: { type: String },
    paid_via: { type: String },
    transaction_id: { type: String },
    created_at: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', OrderSchema);

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

/**
 * STEP 1: Create an Order (Saves into MongoDB)
 */
app.post('/api/v1/orders', authenticateMerchant, async (req, res) => {
    const { amount, currency, merchant_id } = req.body;

    if (!amount || !currency || !merchant_id) {
        return res.status(400).json({ 
            status: "error", 
            message: "Missing required fields" 
        });
    }

    try {
        const newOrder = new Order({
            order_id: `ord_${Math.random().toString(36).substr(2, 9)}`,
            merchant_id: merchant_id,
            amount: amount,
            currency: currency.toUpperCase(),
            status: "created"
        });

        await newOrder.save();
        return res.status(201).json({ status: "success", data: newOrder });
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

/**
 * STEP 2: Capture Payment (Updates MongoDB Document)
 */
app.post('/api/v1/payments/capture', authenticateMerchant, async (req, res) => {
    const { order_id, method, card_number, cvc, expiry, upi_id } = req.body;

    if (!order_id || !method) {
        return res.status(400).json({ status: "error", message: "Missing order_id or method" });
    }

    try {
        const currentOrder = await Order.findOne({ order_id: order_id });
        if (!currentOrder) {
            return res.status(404).json({ status: "error", message: "Order not found" });
        }

        if (currentOrder.status === 'paid') {
            return res.status(400).json({ status: "error", message: "This order has already been paid" });
        }

        // Card validation simulation logic
        if (method === 'card') {
            if (!card_number || !cvc || !expiry) {
                return res.status(400).json({ status: "error", message: "Missing card details" });
            }
            if (card_number.endsWith('0000')) {
                currentOrder.status = 'failed';
                await currentOrder.save();
                return res.status(402).json({ status: "failed", message: "Card declined by bank" });
            }
        } 
        // UPI validation simulation logic
        else if (method === 'upi') {
            if (!upi_id) {
                return res.status(400).json({ status: "error", message: "Missing UPI ID" });
            }
            if (upi_id.includes('fail')) {
                currentOrder.status = 'failed';
                await currentOrder.save();
                return res.status(402).json({ status: "failed", message: "UPI transaction rejected" });
            }
        }

        // Update payment metrics inside MongoDB
        currentOrder.status = 'paid';
        currentOrder.payment_method = method;
        currentOrder.paid_via = method === 'upi' ? upi_id : `XXXX-XXXX-XXXX-${card_number.slice(-4)}`;
        currentOrder.transaction_id = `txn_${Math.random().toString(36).substr(2, 9)}`;

        await currentOrder.save();

        return res.status(200).json({
            status: "success",
            message: "Payment captured successfully",
            transaction_id: currentOrder.transaction_id,
            order_details: currentOrder
        });
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

/**
 * DEBUG VIEW LINK: Read straight from active MongoDB Collection Atlas records
 */
app.get('/api/v1/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ created_at: -1 });
        return res.status(200).json({
            total_orders: orders.length,
            orders: orders
        });
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Database Connected Gateway live at http://localhost:${PORT}`);
});