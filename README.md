# Discord MESSAGE_CREATE logger

This project captures `message_create` events from Discord in the browser using the console to inject Javascript functions to forward them to a JavaScript WebSocket server. The server then stores the messages in a MongoDB database. It consists of:

- **Browser Console Script:** Intercepts Discord messages and sends them via WebSocket. (browser.js)
- **WebSocket Server:** Receives and processes messages from the browser, then stores them in MongoDB.
- **MongoDB Database:** Stores the captured message data for retrieval and analysis.

**Note:** This project is designed for use with Discord's standard web client and is intended for user accounts, not bots. It will not work with bot tokens.

## Project Structure

- **`server.js`**: The main server script for handling WebSocket connections, intercepting messages, and MongoDB operations.
- **`browser.js`**: Contains the script to paste into the borwser to intercept the create message function and creates a websocket to forward the messages to our `server.js`
- **`Dockerfile`**: Docker configuration for containerizing the application.
- **`docker-compose.yml`**: Docker Compose configuration for setting up MongoDB, Mongo Express, and the Node.js application.

## Prerequisites

1. **Node.js**: Make sure Node.js is installed. [Download Node.js](https://nodejs.org/)
2. **Docker**: Docker and Docker Compose must be installed. [Install Docker](https://docs.docker.com/get-docker/)

## Setup

### Docker Setup

1. **Clone the repository**:
    ```bash
    git clone https://github.com/RealFireAU/discord-messagelogger
    cd discord-messagelogger
    ```

2. **Build and start the containers**:
    ```bash
    docker-compose up --build
    ```

    This will start MongoDB, Mongo Express, and the Node.js application.


3. Inject Our Message Listener into the Browser

    1. **Open Discord:**
    - Navigate to [Discord's login page](https://discord.com/) in your preferred browser (Chrome or Firefox).

    2. **Open Developer Tools:**
    - **Chrome:** Press `Ctrl + Shift + I` (or `Cmd + Option + I` on macOS)
    - **Firefox:** Press `Ctrl + Shift + I` (or `Cmd + Option + I` on macOS)

    3. **Paste the Script:**
    - Go to the "Console" tab in Developer Tools.
    - Copy the provided script and paste it into the console.
    - Press `Enter` to execute the script.

    The script will now start intercepting `message_create` events and forwarding them to the WebSocket server.`

---

## Configuration

### MongoDB Connection

- **Username**: `admin`
- **Password**: `pass`
- **Host**: `mongo-dev`
- **Port**: `27017`
- **Database**: `messageDB`

### WebSocket

- **Port**: `8080`

## Code Overview

### `server.js`

- **WebSocket Server**: Listens on port `8080` for incoming WebSocket messages.
- **MongoDB Connection**: Connects to MongoDB and inserts messages into the `messageDB.messages` collection.
- **Message Filtering**: Removes `optimistic` and `isPushNotification` fields from messages and skips messages from bot users.
- **Graceful Shutdown**: Handles `SIGTERM` and `SIGINT` signals to close the WebSocket server and MongoDB client gracefully.

### `browser.js`

- **WebSocket Interception**: Intercepts `MESSAGE_CREATE` functions and forwards it to our external WebSocket server.
- **Interceptor Function**: Ensures that each `MESSAGE_CREATE` function is intercepted only once to avoid multiple interceptions.
- **Connection Management**: Manages the connection to the external WebSocket server, including automatic reconnections on failure.

### Disclaimer

**Important:** While I believe that using this script does not violate Discord's Terms of Service, I want to emphasize that you are using it at your own risk. I cannot be held responsible for any actions taken by Discord, including account bans or other penalties, resulting from the use of this code. Please ensure that you review and understand Discord's Terms of Service and Community Guidelines before using this project.