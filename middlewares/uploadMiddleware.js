const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const cloudinary = require("../config/cloudinary");


// =====================================================
// CLOUDINARY STORAGE
// =====================================================

const storage = new CloudinaryStorage({

    cloudinary: cloudinary,

    params: {
        folder: "wristora/profile-images",

        allowed_formats: ["jpg", "jpeg", "png", "webp"],

        transformation: [
            {
                width: 500,
                height: 500,
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
// MULTER UPLOAD
// =====================================================

const upload = multer({

    storage: storage,

    fileFilter: fileFilter,

    limits: {
        fileSize: 5 * 1024 * 1024
    }

});


module.exports = upload;