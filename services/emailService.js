const nodemailer = require("nodemailer");



const transporter = nodemailer.createTransport({
    service: "gmail",

    auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
    }
});




const sendOtpEmail = async (email, otp) => {
    const mailOptions = {
        from: `"Wristora" <${process.env.NODEMAILER_EMAIL}>`,
        to: email,
        subject: "Wristora - Email Verification OTP",

        html: `
            <div style="
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: auto;
                padding: 40px;
                color: #303030;
                background-color: #faf8f3;
            ">

                <h1 style="
                    font-family: Georgia, serif;
                    text-align: center;
                    font-size: 36px;
                    margin-bottom: 30px;
                ">
                    Wristora
                </h1>

                <div style="
                    background: #ffffff;
                    padding: 35px;
                    text-align: center;
                    border: 1px solid #e5e1da;
                ">

                    <h2 style="
                        font-family: Georgia, serif;
                        font-weight: normal;
                    ">
                        Verify Your Email
                    </h2>

                    <p style="
                        font-size: 15px;
                        line-height: 1.6;
                    ">
                        Your Wristora verification code is:
                    </p>

                    <div style="
                        font-size: 32px;
                        font-weight: bold;
                        letter-spacing: 8px;
                        margin: 25px 0;
                    ">
                        ${otp}
                    </div>

                    <p style="
                        font-size: 14px;
                        line-height: 1.6;
                        color: #555555;
                    ">
                        This verification code will expire in
                        <strong>5 minutes</strong>.
                    </p>

                    <p style="
                        font-size: 13px;
                        color: #777777;
                        margin-top: 30px;
                    ">
                        If you did not request this code, please ignore this email.
                    </p>

                </div>

                <p style="
                    text-align: center;
                    font-size: 11px;
                    letter-spacing: 2px;
                    margin-top: 30px;
                    color: #777777;
                ">
                    W R I S T O R A
                </p>

            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

module.exports = {
    sendOtpEmail
};