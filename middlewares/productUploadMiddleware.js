const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const cloudinary = require("../config/cloudinary");


// =====================================================
// CLOUDINARY STORAGE (separate folder from profile images)
// =====================================================

const storage = new CloudinaryStorage({

    cloudinary: cloudinary,

    params: {
        folder: "wristora/products",

        allowed_formats: ["jpg", "jpeg", "png", "webp"],

        transformation: [
            {
                width: 1000,
                height: 1000,
                crop: "limit"
            }
        ]
    }

});


// =====================================================
// FILE FILTER
// =====================================================

const fileFilter = (req, file, cb) => {

    const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {

        cb(null, true);

    } else {

        cb(
            new Error(
                "Only JPG, JPEG, PNG and WEBP images are allowed."
            ),
            false
        );

    }

};


// =====================================================
// MULTER UPLOAD (multiple files, field name "images")
// =====================================================

const productUpload = multer({

    storage: storage,

    fileFilter: fileFilter,

    limits: {
        fileSize: 5 * 1024 * 1024
    }

});


module.exports = productUpload;