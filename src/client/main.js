// Open websocket connection to server, same address as url
const server_ip = window.location.hostname
const port = window.location.port
const fixationHolder = document.getElementById('fixation-holder');
const banner = document.getElementById('banner');

const fixationTargets = [];



let ws;
let bannerTimeout;
let reconnectTimeout;
let config;
let target_positions;

function makeTarget() {
    const target = document.createElement('div');
    target.className = 'target';
    target.style.color = config.target_color;

    const targetIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');

    targetIcon.appendChild(use);
    target.appendChild(targetIcon);
    fixationHolder.appendChild(target);

    return {
        target,
        targetIcon,
        use,
    };
}

function openWS() {
    if (ws) {
        return;
    }

    try {
        ws = new WebSocket(`ws://${server_ip}:${port}`);
    } catch (e) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(openWS, 500);
        banner.style.backgroundColor = '';
        banner.style.display = '';
        banner.textContent = 'Disconnected from server!';
        return;
    }

    // Send message to server
    ws.onopen = () => {
        banner.style.display = '';
        banner.style.backgroundColor = 'green';
        banner.textContent = 'Connected to server!';
        clearTimeout(bannerTimeout);
        bannerTimeout = setTimeout(() => {
            banner.style.display = 'none';
            banner.style.backgroundColor = '';
        }, 2000);

        // Send initial message to server
        const message = {
            type: 'resize',
            width: window.innerWidth,
            height: window.innerHeight,
        };
        ws.send(JSON.stringify(message));
    };

    // Log message from server
    ws.onmessage = (message) => {
        const dt = JSON.parse(message.data);
        if (dt.type === 'config') {
            config = dt.config;

            updateTargetStyles();
            fixationHolder.style.backgroundColor = config.canvas_background;

        } else if (dt.type === 'target_positions') {
            config.target_positions = dt.target_positions;

            if (config.target_positions.length !== fixationTargets.length) {
                while (fixationTargets.length > 0) {
                    const target = fixationTargets.pop();
                    target.target.remove();
                }

                for (let i = 0; i < config.target_positions.length; i++) {
                    fixationTargets.push(makeTarget());
                }
            }
        
            const clientSizes = dt.clientSizes;

            // Get max aspect
            let max_aspect = 0;
            for (const clientSize of clientSizes) {
                if (!clientSize.width || !clientSize.height) {
                    continue;
                }

                const aspect = clientSize.height / clientSize.width;
                if (aspect > max_aspect) {
                    max_aspect = aspect;
                }
            }

            let current_aspect = fixationHolder.clientHeight / fixationHolder.clientWidth;

            let aspect_rescale = max_aspect / current_aspect;

            // Set fixation target locations
            for (let i = 0; i < config.target_positions.length; i++) {
                const target = fixationTargets[i];
                const targetPosition = config.target_positions[i];
                target.target.style.left = `${targetPosition.x * 100}%`;
                target.target.style.top = `${((targetPosition.y - 0.5) * aspect_rescale + 0.5) * 100}%`;
            }

            updateTargetStyles();
        }
    };

    // Close connection
    ws.onclose = () => {
        console.log('Connection closed');
        ws = null;
        clearTimeout(bannerTimeout);
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(openWS, 1000);

        banner.style.backgroundColor = '';
        banner.style.display = '';
        banner.textContent = 'Disconnected from server!';
    };
}

function updateTargetStyles() {
    for (let i = 0; i < fixationTargets.length; i++) {
        const target = fixationTargets[i];
        if (target.use.getAttributeNS('http://www.w3.org/1999/xlink', 'href') !== `icons.svg#${config.target_icon}`) {
            target.use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `icons.svg#${config.target_icon}`);
        }

        const size = config.target_size * fixationHolder.clientWidth;
        if (target.target.style.width !== `${size}px`) {
            target.target.style.width = `${size}px`;
            target.target.style.height = `${size}px`;
        }

        if (target.target.style.color !== config.target_color) {
            target.target.style.color = config.target_color;
        }
    }
}
openWS();

// On resize
window.addEventListener('resize', () => {
    if (ws) {
        const message = {
            type: 'resize',
            width: window.innerWidth,
            height: window.innerHeight,
        };
        ws.send(JSON.stringify(message));
    }
    updateTargetStyles();
});

setInterval(() => {
    if (ws) {
        const message = {
            type: 'beat',
        };
        ws.send(JSON.stringify(message));
    }
}, 1000);