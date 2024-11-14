(async () => {
    const config = await window.electronAPI.getConfig();
    let clientSizes = [];
    const fixationPreview = document.getElementById('fixation-preview');
    console.log(config);

    async function updateIP(ip, port) {
        const instructions = document.getElementById('instructions');
        instructions.innerHTML = `<p>Open this URL on your phone or desktop to view the fixation target:</p><p><strong>http://${ip}:${port}</strong></p>`;

        const qrcode = await window.electronAPI.generateQRCode(`http://${ip}:${port}`);
        const qrcodeHolder = document.getElementById('qrcode');
        qrcodeHolder.src = qrcode;
    }

    await updateIP(config.server_ip, config.port);
    window.electronAPI.onIPChange(({ip, port}) => updateIP(ip, port));

    const fixationTargets = [];
    const deviceBoxes = [];


    let width, height, scale_x, scale_y;

    function makeTarget() {
        const target = document.createElement('div');
        target.className = 'target';
        const size = config.target_size * fixationPreview.clientWidth;
        target.style.width = `${size}px`;
        target.style.height = `${size}px`;
        target.style.color = config.target_color;

        const targetIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `client/icons.svg#${config.target_icon}`);

        targetIcon.appendChild(use);
        target.appendChild(targetIcon);
        fixationPreview.appendChild(target);

        let  mousemove, mouseup;
        let prevClientX, prevClientY;
        let prevTargetPositions;
        mousemove = (e) => {
            const dx = e.clientX - prevClientX;
            const dy = e.clientY - prevClientY;
            const dsx = dx / scale_x;
            const dsy = dy / scale_y;

            for (let i = 0; i < config.target_positions.length; i++) {
                config.target_positions[i].x = prevTargetPositions[i].x + dsx;
                config.target_positions[i].y = prevTargetPositions[i].y + dsy;
            }

            updateConfig();
        }

        mouseup = (e) => {
            window.removeEventListener('mousemove', mousemove);
            window.removeEventListener('mouseup', mouseup);
        }

        target.addEventListener('mousedown', (e) => {
            window.addEventListener('mousemove', mousemove);
            window.addEventListener('mouseup', mouseup);
            prevClientX = e.clientX;
            prevClientY = e.clientY;
            prevTargetPositions = config.target_positions.map((pos) => ({...pos}));
        });

        return {
            target,
            targetIcon,
            use,
        };
    }

    window.electronAPI.onTargetPositionsUpdated((data) => {
        clientSizes = data.clientSizes;
        const target_positions = data.target_positions;
        config.target_positions = target_positions;

        renderTargets();
    });

    renderTargets();

    function renderTargets() {
        const target_positions = config.target_positions;
        if (target_positions.length !== fixationTargets.length) {
            while (fixationTargets.length > 0) {
                const target = fixationTargets.pop();
                target.target.remove();
            }

            for (let i = 0; i < target_positions.length; i++) {
                fixationTargets.push(makeTarget());
            }
        }

        // Get width and height of fixation-preview
        width = fixationPreview.clientWidth;
        height = fixationPreview.clientHeight;
        const aspect = height / width;

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

        scale_x = width;
        scale_y = height;

        if (clientSizes.length !== 0) {
            if (aspect >= max_aspect) { // Width is limiting factor
                scale_x = width;
                // Shrinking the height
                scale_y = width * max_aspect;
            } else {
                scale_y = height;
                // Shrinking the width
                scale_x = height / max_aspect;
            }
        }
        // Set fixation target locations
        for (let i = 0; i < target_positions.length; i++) {
            const target = fixationTargets[i];
            const targetPosition = target_positions[i];
            target.target.style.left = `${targetPosition.x * scale_x + (width - scale_x) / 2}px`;
            target.target.style.top = `${targetPosition.y * scale_y + (height - scale_y) / 2}px`;
            let size = config.target_size * scale_x;
            target.target.style.width = `${size}px`;
            target.target.style.height = `${size}px`;
        }

        // Set device boxes
        if (deviceBoxes.length !== clientSizes.length) {
            while (deviceBoxes.length > 0) {
                const deviceBox = deviceBoxes.pop();
                deviceBox.remove();
            }

            for (const clientSize of clientSizes) {
                const deviceBox = document.createElement('div');
                deviceBox.className = 'device-box';
                fixationPreview.prepend(deviceBox);
                deviceBoxes.push(deviceBox);
            }
        }

        for (let i = 0; i < clientSizes.length; i++) {
            const clientSize = clientSizes[i];
            const deviceBox = deviceBoxes[i];
            let dwidth = scale_x;
            let dheight = clientSize.height / clientSize.width * scale_x;
            deviceBox.style.width = `${dwidth}px`;
            deviceBox.style.height = `${dheight}px`;

            deviceBox.style.left = `${(width - dwidth) / 2}px`;
            deviceBox.style.top = `${(height - dheight) / 2}px`;
        }
    }

    const stepSizeInput = document.getElementById('step-size');
    const stepSizeIncrement = document.getElementById('step-size-increment');
    const stepSizeDecrement = document.getElementById('step-size-decrement');
    stepSizeInput.value = config.step_size;
    stepSizeInput.addEventListener('change', () => {
        config.step_size = Number(stepSizeInput.value);
        updateConfig();
    });

    stepSizeIncrement.addEventListener('click', () => {
        config.step_size = (Number(stepSizeInput.value) + 0.05).toFixed(2);
        updateConfig();
    });

    stepSizeDecrement.addEventListener('click', () => {
        config.step_size = (Number(stepSizeInput.value) - 0.05).toFixed(2);
        updateConfig();
    });

    const targetSizeInput = document.getElementById('target-size');
    const targetSizeIncrement = document.getElementById('target-size-increment');
    const targetSizeDecrement = document.getElementById('target-size-decrement');
    targetSizeInput.value = config.target_size;
    targetSizeInput.addEventListener('change', () => {
        config.target_size = Number(targetSizeInput.value);
        updateConfig();
    });

    targetSizeIncrement.addEventListener('click', () => {
        config.target_size = (Number(targetSizeInput.value) + 0.05).toFixed(2);
        updateConfig();
    });

    targetSizeDecrement.addEventListener('click', () => {
        config.target_size = (Number(targetSizeInput.value) - 0.05).toFixed(2);
        updateConfig();
    });

    const targetIconSelect = document.getElementById('target-icon');
    targetIconSelect.value = config.target_icon;
    targetIconSelect.addEventListener('change', () => {
        config.target_icon = targetIconSelect.value;
        updateConfig();
    });

    const interEyeDistanceInput = document.getElementById('inter-eye-distance');
    const interEyeDistanceIncrement = document.getElementById('inter-eye-distance-increment');
    const interEyeDistanceDecrement = document.getElementById('inter-eye-distance-decrement');
    interEyeDistanceInput.value = config.inter_eye_distance;
    interEyeDistanceInput.addEventListener('change', () => {
        config.inter_eye_distance = Number(interEyeDistanceInput.value);
        inter_eye_distance_change();
        updateConfig();
    });

    interEyeDistanceIncrement.addEventListener('click', () => {
        config.inter_eye_distance = (Number(interEyeDistanceInput.value) + 0.05).toFixed(2);
        inter_eye_distance_change();
        updateConfig();
    });

    interEyeDistanceDecrement.addEventListener('click', () => {
        config.inter_eye_distance = (Number(interEyeDistanceInput.value) - 0.05).toFixed(2);
        inter_eye_distance_change();
        updateConfig();
    });

    const colorInput = document.getElementById('color');
    colorInput.value = config.target_color;
    colorInput.addEventListener('input', () => {
        config.target_color = colorInput.value;
        updateConfig();
    });

    const backgroundColorInput = document.getElementById('background-color');
    backgroundColorInput.value = config.canvas_background;
    backgroundColorInput.addEventListener('input', () => {
        config.canvas_background = backgroundColorInput.value;
        updateConfig();
    });

    function inter_eye_distance_change() {
        const left = config.target_positions[0];
        const right = config.target_positions[1];
        const center = (left.x + right.x) / 2;
        left.x = center - config.inter_eye_distance / 2;
        right.x = center + config.inter_eye_distance / 2;
    }


    const gamepadUp = document.getElementById('gamepad-up');
    const gamepadDown = document.getElementById('gamepad-down');
    const gamepadLeft = document.getElementById('gamepad-left');
    const gamepadRight = document.getElementById('gamepad-right');
    const gamepadReset = document.getElementById('gamepad-reset');

    gamepadUp.addEventListener('click', () => {
        for (let i = 0; i < config.target_positions.length; i++) {
            config.target_positions[i].y -= config.step_size;
        }
        updateConfig();
    });

    gamepadDown.addEventListener('click', () => {
        for (let i = 0; i < config.target_positions.length; i++) {
            config.target_positions[i].y += config.step_size;
        }
        updateConfig();
    });

    gamepadLeft.addEventListener('click', () => {
        for (let i = 0; i < config.target_positions.length; i++) {
            config.target_positions[i].x -= config.step_size;
        }
        updateConfig();
    });

    gamepadRight.addEventListener('click', () => {
        for (let i = 0; i < config.target_positions.length; i++) {
            config.target_positions[i].x += config.step_size;
        }
        updateConfig();
    });

    gamepadReset.addEventListener('click', () => {
        config.target_positions = [
            { x: 0.25, y: 0.5 },
            { x: 0.75, y: 0.5 },
        ];
        updateConfig();
    });

    

    function updateConfig() {
        stepSizeInput.value = config.step_size;
        targetSizeInput.value = config.target_size;
        targetIconSelect.value = config.target_icon;
        interEyeDistanceInput.value = config.inter_eye_distance;

        window.electronAPI.setConfig(config);
        updateTargetStyles();
    }


    function updateTargetStyles() {
        for (let i = 0; i < fixationTargets.length; i++) {
            const target = fixationTargets[i];
            target.use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `client/icons.svg#${config.target_icon}`);
            target.target.style.color = config.target_color;
        }
        fixationPreview.style.backgroundColor = config.canvas_background;
        renderTargets();
    }



    // On resize
    window.addEventListener('resize', () => {
        updateTargetStyles();
    });
    updateTargetStyles();

    window.config = config;


})();