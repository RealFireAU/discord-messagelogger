const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const path = require('path');

// Replace with your actual MongoDB credentials and connection details
const username = encodeURIComponent("admin");
const password = encodeURIComponent("pass");
const clusterUrl = "mongo-dev:27017"; // Use the host and port for your MongoDB container
const uri = `mongodb://${username}:${password}@${clusterUrl}/admin`;

const dbName = 'messageDB';
const messageCollectionName = 'messages';
const attachmentCollectionName = 'attachments';

// Create Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let db, messageCollection, attachmentCollection;

// Create a new MongoClient
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// Function to connect to the MongoDB server
async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        db = client.db(dbName);
        messageCollection = db.collection(messageCollectionName);
        attachmentCollection = db.collection(attachmentCollectionName);
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
            const messageData = data.data[0]?.message;

            // Check if the author is a bot
            if (messageData?.author?.bot) {
                return;
            }

            // Extract only necessary fields
            const filteredMessage = {
                _id: messageData.id,
                content: messageData.content,
                timestamp: messageData.timestamp,
                author: {
                    id: messageData.author.id,
                    username: messageData.author.username,
                    discriminator: messageData.author.discriminator,
                    avatar: messageData.author.avatar
                },
                channel_id: messageData.channel_id,
                guild_id: messageData.guild_id,
                attachments: messageData.attachments || []
            };

            // Check if the document already exists
            const existingMessage = await messageCollection.findOne({ _id: filteredMessage._id });

            if (!existingMessage) {
                // Download and store attachments if any
                const attachmentPromises = filteredMessage.attachments.map(async (attachment) => {
                    try {
                        const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
                        const attachmentData = {
                            _id: attachment.id,
                            messageId: filteredMessage._id,
                            filename: attachment.filename,
                            size: attachment.size,
                            contentType: attachment.content_type,
                            data: Buffer.from(response.data).toString('base64'), // Store as base64 encoded string
                        };
                        await attachmentCollection.insertOne(attachmentData);
                        return { attachmentId: attachment.id };
                    } catch (error) {
                        console.error('Error downloading attachment:', error);
                        return null;
                    }
                });

                // Wait for all attachment downloads to complete
                const downloadedAttachments = await Promise.all(attachmentPromises);

                // Filter out any failed downloads and store only the IDs in the message
                filteredMessage.attachments = downloadedAttachments
                    .filter(Boolean)
                    .map(a => a.attachmentId);

                // Insert the document into MongoDB
                await messageCollection.insertOne(filteredMessage);
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

// Route to get paginated messages
// Route to get paginated and filtered messages
app.get('/messages', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const hasAttachments = req.query.attachments || 'any'; // 'with', 'without', or 'any'
        const content = req.query.content || ''; // New: content filter
        const author = req.query.author || ''; // New: author filter
        const channelId = req.query.channelId || ''; // New: channel ID filter
        const guildId = req.query.guildId || ''; // New: guild ID filter

        // Create a query object
        const query = {};

        // Add attachment filter
        if (hasAttachments === 'with') {
            query.attachments = { $exists: true, $ne: [] };
        } else if (hasAttachments === 'without') {
            query.attachments = { $exists: true, $size: 0 };
        }

        if (content) {
            query.content = { $regex: content, $options: 'i' }; // Case-insensitive search
        }

        if (author) {
            query['author.username'] = { $regex: author, $options: 'i' }; // Case-insensitive search
        }

        // Add channel ID filter
        if (channelId) {
            query.channel_id = channelId;
        }

        // Add guild ID filter
        if (guildId) {
            query.guild_id = guildId;
        }

        const totalMessages = await messageCollection.countDocuments(query);
        const messages = await messageCollection.find(query)
            .sort({ timestamp: 1 }) // Sort by timestamp in descending order
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();

        const totalPages = Math.ceil(totalMessages / limit);

        res.json({
            messages,
            totalPages,
            currentPage: page,
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// Route to get attachment by ID
app.get('/attachments/:id', async (req, res) => {
    try {
        const attachment = await attachmentCollection.findOne({ _id: req.params.id });
        if (attachment) {
            res.json({
                id: attachment._id,
                filename: attachment.filename,
                size: attachment.size,
                contentType: attachment.contentType
            });
        } else {
            res.status(404).send('Attachment not found');
        }
    } catch (err) {
        res.status(500).send('Error fetching attachment details');
    }
});

app.get('/attachments/:id/raw', async (req, res) => {
    try {
        const attachment = await attachmentCollection.findOne({ _id: req.params.id });
        if (attachment) {
            const buffer = Buffer.from(attachment.data, 'base64');
            res.set('Content-Type', attachment.content_type);
            res.send(buffer);
        } else {
            res.status(404).send('Attachment not found');
        }
    } catch (err) {
        res.status(500).send('Error fetching attachment');
    }
});

// Serve the static HTML page
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB and start the server
connectToDatabase().then(() => {
    server.listen(8080, () => {
        console.log('Server is listening on port 8080');
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

// Public folder for static files
app.use(express.static('public'));
