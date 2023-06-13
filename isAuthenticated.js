const jwt = require('jsonwebtoken');

module.exports = async function isAuthenticated(req, res, next) {
    const authorizationHeader = req.headers["authorization"];
    if (!authorizationHeader) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authorizationHeader.split(" ")[1];

    jwt.verify(token, "secret", (err, user) => {
        if (err) {
            return res.status(401).json({ message: "Unauthorized" });
        } else {
            req.user = user;
            next();
        }
    });
};