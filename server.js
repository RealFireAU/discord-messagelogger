const WebSocket = require('ws');
const http = require('http');
const { MongoClient } = require('mongodb');

// Replace with your actual MongoDB credentials and connection details
const username = encodeURIComponent("admin");
const password = encodeURIComponent("pass");
const clusterUrl = "mongo-dev:27017"; // Use the host and port for your MongoDB container
const uri = `mongodb://${username}:${password}@${clusterUrl}/admin`;

const dbName = 'messageDB';
const collectionName = 'messages';

// Create HTTP server (required for WebSocket server)
const server = http.createServer();
const wss = new WebSocket.Server({ server });

let db, collection;

// Create a new MongoClient
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// Function to connect to the MongoDB server
async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        db = client.db(dbName);
        collection = db.collection(collectionName);
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err.message);
        process.exit(1);
    }
}

// Function to handle WebSocket connections
function handleWebSocketConnection(ws) {
    console.log('WebSocket connection established');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            // Check if the author is a bot
            if (data.data[0]?.message?.author?.bot) {
                return;
            }

            // Remove unwanted fields
            delete data.optimistic;
            delete data.isPushNotification;

            // Check if the document already exists
            const existingMessage = await collection.findOne({ _id: data.data[0]?.message?.id });

            if (!existingMessage) {
                // Insert the document into MongoDB
                await collection.insertOne(data);
            }
        } catch (e) {
            console.error('Error handling WebSocket message:', e);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
}

// Connect to MongoDB and start the WebSocket server
connectToDatabase().then(() => {
    server.listen(8080, () => {
        console.log('WebSocket server is listening on port 8080');
    });

    // Handle graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    async function gracefulShutdown() {
        console.log('Received shutdown signal, closing server and database connections...');
        wss.close(() => {
            console.log('WebSocket server closed');
        });
        await client.close();
        console.log('MongoDB client closed');
        process.exit(0);
    }
});

// Handle WebSocket connections
wss.on('connection', handleWebSocketConnection);
