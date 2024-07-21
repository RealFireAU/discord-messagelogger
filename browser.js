// Function to intercept all MESSAGE_CREATE functions
function interceptMessageCreateFunctions(nodes) {
    nodes.forEach(node => {
        if (node.actionHandler && typeof node.actionHandler.MESSAGE_CREATE === 'function' && node.name === "h") {
            // Check if the function has already been intercepted
            if (!node.actionHandler._intercepted) {
                const originalFunction = node.actionHandler.MESSAGE_CREATE;

                node.actionHandler.MESSAGE_CREATE = function(...args) {
                    sendToWebSocket({ eventType: 'MESSAGE_CREATE', data: args });
                    return originalFunction.apply(this, args);
                };

                // Mark the function as intercepted
                node.actionHandler._intercepted = true;
            }
        }
    });
}

// Function to send data to WebSocket server
let socket;
function connectWebSocket() {
    socket = new WebSocket('ws://127.0.0.1:8080');

    socket.onopen = () => {
        console.log('WebSocket connection established');
    };

    socket.onclose = () => {
        console.log('WebSocket connection closed, retrying...');
        setTimeout(connectWebSocket, 1000); // Retry connection every second
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        socket.close();
    };
}

function sendToWebSocket(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    } else {
        console.error('WebSocket is not open, unable to send data');
    }
}

// Connect to WebSocket server
connectWebSocket();

// Find all nodes and intercept MESSAGE_CREATE functions
webpackChunkdiscord_app.push([[Math.random()], {}, (e) => { 
    if(e.c != undefined) {
        const module = Object.values(e.c).find(x => x?.exports?.default?.getUsers).exports.default;
        const nodes = Object.values(module._dispatcher._actionHandlers._dependencyGraph.nodes);
        interceptMessageCreateFunctions(nodes);
    } 
}]);
