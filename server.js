const express = require("express");
const bodyParser = require("body-parser");
const requestIp = require("request-ip");

const app = express();
const allowedIPs = new Set();

const START_IP = "49.43.4.31";
allowedIPs.add(START_IP);

const analytics = {};

// Middleware to extract IP address from request
app.use(requestIp.mw());
app.use(bodyParser.json());

// Middleware to update analytics
const updateAnalytics = (req, res, next) => {
  const clientIp = req.clientIp;
  const path = req.path;

  // Initialize analytics entry if not present
  if (!analytics[clientIp]) {
    analytics[clientIp] = {};
  }

  // Increment hit count for the endpoint
  if (!analytics[clientIp][path]) {
    analytics[clientIp][path] = 1;
  } else {
    analytics[clientIp][path]++;
  }

  next();
};

app.use(updateAnalytics);

const allowAccessOnlyToAllowedIp = (req, res, next) => {
  const clientIp = req.clientIp;
  if (allowedIPs.has(clientIp)) {
    next();
  } else {
    res.status(403).send({ status: "not allowed" });
  }
};

app.get("/", allowAccessOnlyToAllowedIp, (req, res) => {
  res.send({ status: "working" });
});

// Route to get IP address
app.get("/ip", (req, res) => {
  const clientIp = req.clientIp;
  res.send({
    clientIp: clientIp,
    ip: req.ip,
    remoteAddress: req.socket.remoteAddress,
    x: req.headers["x-forwarded-for"],
  });
});

// Route to add IP address
app.post("/addIp", allowAccessOnlyToAllowedIp, (req, res) => {
  const newIp = req.body.ip;
  const clientIp = req.clientIp;
  // Check if IP is already in the allowedIPs set
  if (allowedIPs.has(newIp)) {
    res.status(400).send({ status: "IP already exists in the allowed list" });
  } else {
    // Check if the new IP is a valid IP address
    if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(newIp)) {
      allowedIPs.add(newIp);
      res.send({ status: "IP added successfully" });
    } else {
      console.log(req.body);
      res
        .status(400)
        .send({ status: "Invalid IP address format", ip_received: newIp });
    }
  }
});

// Route to remove IP address
app.post("/removeIp", allowAccessOnlyToAllowedIp, (req, res) => {
  const ipToDelete = req.body.ip;
  // Check if IP is already in the allowedIPs set
  if (allowedIPs.has(ipToDelete)) {
    allowedIPs.delete(ipToDelete);
    res.send({ status: "IP removed successfully" });
  } else {
    res.status(400).send({ status: "IP doesn't exists in the allowed list" });
  }
});

// Route to get all allowed IP addresses
app.get("/list-ips", allowAccessOnlyToAllowedIp, (req, res) => {
  res.send({ allowed_ips: Array.from(allowedIPs) });
});

// Route to remove all IP addresses
app.post("/remove-ips", allowAccessOnlyToAllowedIp, (req, res) => {
  allowedIPs.clear();
  allowedIPs.add(START_IP);
  res.send({ status: "IPs removed successfully" });
});

// Route to get analytics
app.get("/analytics", allowAccessOnlyToAllowedIp, (req, res) => {
  const clientIp = req.clientIp;
  // Check if analytics exist for the client's IP address
  if (clientIp === START_IP) {
    // res.send({ analytics: analytics[clientIp] });
    res.send(analytics);
  } else {
    res.status(403).send({ status: "Allowed to Admin Only" });
  }
});

// Route to get analytics for a specific IP address
app.get("/my-analytics", allowAccessOnlyToAllowedIp, (req, res) => {
  const clientIp = req.clientIp;
  // Check if analytics exist for the client's IP address
  if (analytics[clientIp]) {
    res.send(analytics[clientIp]);
  } else {
    res
      .status(404)
      .send({ status: "No analytics found for the given IP address" });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
