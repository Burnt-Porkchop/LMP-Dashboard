
const statusPanel = document.getElementById("serverStatus");
const statusText = document.getElementById("statusText");
const playerList = document.getElementById("playerList");

const systemView = document.getElementById("systemView");
const bodyView = document.getElementById("bodyView");
const bodyTitle = document.getElementById("bodyTitle");
const bodyMap = document.getElementById("bodyMap");
const backButton = document.getElementById("backButton");

const serverURL = "http://162.216.112.162:5641/";

let currentVessels = [];
let selectedBody = null;

// ReferenceBody IDs
const bodyIDs = {
    "Kerbol": 0,
    "Kerbin": 1,
    "The Mun": 2,
    "Minmus": 3,
    "Moho": 4,
    "Eve": 5,
    "Duna": 6,
    "Ike": 7,
    "Jool": 8,
    "Laythe": 9,
    "Vall": 10,
    "Bop": 11,
    "Tylo": 12,
    "Gilly": 13,
    "Pol": 14,
    "Dres": 15,
    "Eeloo": 16
};

const bodyRadii = {
    "Kerbol": 261600000,
    "Moho": 250000,
    "Eve": 700000,
    "Kerbin": 600000,
    "Duna": 320000,
    "Dres": 138000,
    "Jool": 6000000,
    "Bop": 65000,
    "Tylo": 600000,
    "Vall": 300000,
    "Pol": 44000,
    "Laythe": 500000,
    "Eeloo": 210000,
    "Gilly": 13000,
    "The Mun": 200000,
    "Minmus": 60000,
    "Ike": 130000
}

function getBodyColor(bodyName) {
    const body = document.querySelector(
        `#systemView [data-body="${bodyName}"]`
    );

    return body ? getComputedStyle(body).fill : "#4786cb";
}

// Server status
function setServerStatus(online) {
    if (online) {
        statusPanel.className = "ServerStatus Online";
        statusText.textContent = "Online";
    } else {
        statusPanel.className = "ServerStatus Offline";
        statusText.textContent = "Offline";
    }
}

// Player list
function updatePlayers(data) {
    const players = data[0].CurrentState.CurrentPlayers;

    playerList.innerHTML = "";

    if (players.length === 0) {
        playerList.textContent = "None";
        return;
    }

    players.forEach(player => {
        const playerEntry = document.createElement("p");
        playerEntry.textContent = player;
        playerList.appendChild(playerEntry);
    });
}

// Convert orbital elements into 2D coordinates
function getOrbitalPosition(vessel) {
    const a = vessel.SemiMajorAxis;
    const e = vessel.Eccentricity;

    const inclination = vessel.Inclination * Math.PI / 180;
    const argument = vessel.ArgumentOfPeriapsis * Math.PI / 180;
    const ascendingNode = vessel.LongitudeOfAscendingNode * Math.PI / 180;

    const M = vessel.MeanAnomaly;

    // Solve Kepler's equation: M = E - e sin(E)
    let E = M;

    for (let i = 0; i < 10; i++) {
        E -= (E - e * Math.sin(E) - M) /
             (1 - e * Math.cos(E));
    }

    // Position in the orbital plane
    const xOrbit = a * (Math.cos(E) - e);
    const yOrbit = a * Math.sqrt(1 - e * e) * Math.sin(E);

    // Rotate into the reference coordinate system
    const xRotated = xOrbit * Math.cos(argument) -
        yOrbit * Math.sin(argument);

    const yRotated = xOrbit * Math.sin(argument) +
        yOrbit * Math.cos(argument);

    const x = xRotated * Math.cos(ascendingNode) -
        yRotated * Math.cos(inclination) * Math.sin(ascendingNode);

    const y = xRotated * Math.sin(ascendingNode) +
        yRotated * Math.cos(inclination) * Math.cos(ascendingNode);

    return { x, y };
}

// Create the Dres 404 display
function showDresError() {
    bodyMap.innerHTML = `
        <svg viewBox="0 0 1000 500"
             xmlns="http://www.w3.org/2000/svg">
            <rect width="1000" height="500" fill="#0A0E16"/>
            <text x="500" y="220"
                  text-anchor="middle"
                  fill="#aaaaaa"
                  font-size="100"
                  font-family="monospace">404.</text>
            <text x="500" y="290"
                  text-anchor="middle"
                  fill="#909090"
                  font-size="28"
                  font-family="monospace">That's an error.</text>
        </svg>
    `;
}

// Draw the craft map

function renderBodyMap(bodyName) {
    if (bodyName === "Dres") {
        showDresError();
        return;
    }

    const bodyID = bodyIDs[bodyName];

    const vessels = currentVessels.filter(vessel =>
        vessel.ReferenceBody === bodyID &&
        vessel.Type !== "SpaceObject"
    );

    // Calculate positions
    const plottedVessels = vessels
        .filter(vessel =>
            Number.isFinite(vessel.SemiMajorAxis) &&
            Number.isFinite(vessel.Eccentricity) &&
            Number.isFinite(vessel.Inclination) &&
            Number.isFinite(vessel.ArgumentOfPeriapsis) &&
            Number.isFinite(vessel.LongitudeOfAscendingNode) &&
            Number.isFinite(vessel.MeanAnomaly)
        )
        .map(vessel => ({
            vessel,
            position: getOrbitalPosition(vessel)
        }));

    // Find the largest coordinate for automatic scaling
    // Calculate zoom based on body radius and farthest craft
    const bodyRadius = bodyRadii[bodyName];

    let maxDistance = bodyRadius;

    plottedVessels.forEach(item => {
        const distance = Math.hypot(
            item.position.x,
            item.position.y
        );

        maxDistance = Math.max(maxDistance, distance);
    });

    // Fit everything inside 260 pixels from the center
    const scale = 260 / maxDistance;

    const svgNS = "http://www.w3.org/2000/svg";

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 1000 700");

    // Map center
    const centerX = 500;
    const centerY = 350;

    // Draw the selected body at the origin
    const origin = document.createElementNS(svgNS, "circle");
    const bodyColor = getBodyColor(bodyName);
    origin.setAttribute("cx", centerX);
    origin.setAttribute("cy", centerY);
    origin.setAttribute("r", bodyRadius * scale);
    origin.setAttribute("fill", bodyColor);
    origin.setAttribute("stroke", "#000000");
    origin.setAttribute("stroke-width", 0/* bodyRadius * scale * 0.05 */);
    svg.appendChild(origin);

    // Draw each craft
    plottedVessels.forEach(item => {
        const x = centerX + item.position.x * scale;
        const y = centerY - item.position.y * scale;

        const group = document.createElementNS(svgNS, "g");

        const dot = document.createElementNS(svgNS, "circle");
        dot.setAttribute("cx", x);
        dot.setAttribute("cy", y);
        dot.setAttribute("r", "7");
        dot.setAttribute("fill", "#888");
        dot.setAttribute("stroke", "#000")
        dot.setAttribute("stroke-width", 2)
        dot.style.cursor = "pointer";

        // Hover information
        const info = document.createElementNS(svgNS, "text");
        info.setAttribute("x", x + 12);
        info.setAttribute("y", y - 10);
        info.setAttribute("fill", "#ffffff");
        info.setAttribute("font-size", "14");
        info.style.visibility = "hidden";
        info.style.pointerEvents = "none";

        const name = document.createElementNS(svgNS, "tspan");
        name.setAttribute("x", x + 12);
        name.textContent = item.vessel.Name;

        const altitude = document.createElementNS(svgNS, "tspan");
        altitude.setAttribute("x", x + 12);
        altitude.setAttribute("dy", "18");
        altitude.setAttribute("fill", "#aaaaaa");

        const alt = item.vessel.Alt;
        altitude.textContent = Number.isFinite(alt)
            ? `Altitude: ${(alt / 1000).toFixed(1)} km`
            : "Altitude: Unknown";

        info.appendChild(name);
        info.appendChild(altitude);

        group.addEventListener("mouseenter", () => {
            info.style.visibility = "visible";
        });

        group.addEventListener("mouseleave", () => {
            info.style.visibility = "hidden";
        });

        group.appendChild(dot);
        group.appendChild(info);
        svg.appendChild(group);
    });

    // Replace the previous map
    bodyMap.innerHTML = "";

    bodyMap.innerHTML = "";
    bodyMap.appendChild(svg);
}


// Fetch server data
async function checkServer() {
    try {
        const response = await fetch(serverURL, {
            cache: "no-store",
            signal: AbortSignal.timeout(4000)
        });

        if (!response.ok) {
            throw new Error("HTTP error: " + response.status);
        }

        const data = await response.json();
        const serverData = data[0];

        setServerStatus(true);
        updatePlayers(data);

        currentVessels = serverData.CurrentState.CurrentVessels;

        if (selectedBody !== null) {
            renderBodyMap(selectedBody);
        }
    } catch (error) {
        console.error("Dashboard error:", error);
        playerList.textContent = error.message;
    }
}

// Select a celestial body
document.querySelectorAll("#systemView [data-body]").forEach(body => {
    body.addEventListener("click", () => {
        selectedBody = body.dataset.body;

        systemView.hidden = true;
        bodyView.hidden = false;

        bodyTitle.textContent = selectedBody;

        renderBodyMap(selectedBody);
    });
});

// Return to the system map
backButton.addEventListener("click", () => {
    bodyView.hidden = true;
    systemView.hidden = false;

    selectedBody = null;
});

// Start polling
checkServer();
setInterval(checkServer, 5000);
