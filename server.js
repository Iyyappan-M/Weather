const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
    origin: true, // Allow any origin to connect during development
    credentials: true
}));
app.use(cookieParser());
app.use(express.static(__dirname));

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI || MONGO_URI.includes('test_user')) {
    console.warn('⚠️ WARNING: Using placeholder MONGO_URI. Database features will not work.');
    console.warn('Please update your .env file with a real MongoDB Atlas connection string.');
}

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    tls: true,
})
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        if (err.message.includes('SSL routines') || err.message.includes('tlsv1 alert internal error') || err.message.includes('80')) {
            console.error('👉 TIP: This is a TLS/SSL error which usually means your IP is not whitelisted in MongoDB Atlas.');
            console.error('   1. Go to MongoDB Atlas: https://cloud.mongodb.com/');
            console.error('   2. Select Network Access in the left sidebar.');
            console.error('   3. Click "Add IP Address" and select "Allow Access From Anywhere" (0.0.0.0/0) or "Add Current IP Address".');
            console.error('   4. Wait 1-2 minutes for the changes to apply and restart your server.');
        }
        console.error('The server will continue to run, but database operations will fail.');
    });

// Routes
const authRoutes = require('./server/routes/auth');
const userRoutes = require('./server/routes/user');

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// Route handlers with error catching
const serveFile = (fileName) => (req, res) => {
    const filePath = path.join(__dirname, fileName);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Error sending ${fileName}:`, err);
            res.status(500).send(`Server Error: Could not load ${fileName}`);
        }
    });
};

app.get('/login', serveFile('login.html'));
app.get('/signup', serveFile('signup.html'));
app.get('/profile-setup', serveFile('profile-setup.html'));
app.get('/dashboard', serveFile('index.html'));

app.get('/', (req, res) => {
    res.redirect('/login');
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack);
    res.status(500).json({ message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
