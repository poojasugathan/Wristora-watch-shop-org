const { validationResult } = require("express-validator");

const validate = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).render("user/signup", {
            title: "Signup",
            errors: errors.array(),
            formData: req.body
        });
    }

    next();
};

module.exports = validate;