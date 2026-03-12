const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

console.log('Attempting to connect to MongoDB...');
console.log('URI:', MONGO_URI.replace(/:([^@]+)@/, ':****@')); // Hide password

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
})
.then(() => {
    console.log('✅ Success! Connected to MongoDB.');
    process.exit(0);
})
.catch(err => {
    console.error('❌ Connection Failed!');
    console.error('Error Name:', err.name);
    console.error('Error Message:', err.message);
    console.error('Full Error:', err);
    process.exit(1);
});
