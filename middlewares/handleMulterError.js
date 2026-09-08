const multer = require("multer");

const cloudinary = require("../config/cloudinary");



const handleProductImageUpload = (multerMiddleware) => {

    return (req, res, next) => {

        multerMiddleware(req, res, async (err) => {

            if (!err) {

                return next();

            }



            const uploadedFiles = req.files || [];

            for (const file of uploadedFiles) {

                try {

                    await cloudinary.uploader.destroy(
                        file.filename
                    );

                } catch (cleanupError) {

                    console.error(
                        "Cloudinary cleanup error (upload middleware):",
                        cleanupError
                    );

                }

            }


            console.error(
                "Product image upload error:",
                err
            );


            let errorCode = "upload";

            if (err instanceof multer.MulterError) {

                if (err.code === "LIMIT_FILE_SIZE") {

                    errorCode = "size";

                } else if (
                    err.code === "LIMIT_UNEXPECTED_FILE" ||
                    err.code === "LIMIT_FILE_COUNT"
                ) {

                    errorCode = "count";

                }

            } else {


                errorCode = "type";

            }


            return res.redirect(
                `/admin/products/add?error=${errorCode}`
            );

        });

    };

};


module.exports = handleProductImageUpload;