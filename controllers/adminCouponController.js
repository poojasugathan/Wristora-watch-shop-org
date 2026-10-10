// =====================================================
// ADMIN COUPON MANAGEMENT (PHASE 55)
//
//   GET  /admin/coupons               list + "create coupon" form
//   POST /admin/coupons               create a coupon
//   POST /admin/coupons/:id/toggle    activate / deactivate
//   POST /admin/coupons/:id/delete    soft delete
//
// Every field is validated here on the server. The form's own
// HTML limits are only a convenience for the admin.
// =====================================================

const mongoose = require("mongoose");

const Coupon = require("../models/couponModel");

const { setFlash, takeFlash } = require("../helpers/adminFlash");
const { escapeRegex, buildPageNumbers } = require("../helpers/pagination");

const {
    COUPON_DISCOUNT_TYPE,
    COUPON_DISCOUNT_TYPE_LABEL,
    COUPON_CODE_PATTERN,
    COUPON_MAX_PERCENT,
    COUPON_MAX_AMOUNT,
    COUPON_DESCRIPTION_MAX_LENGTH,
    ADMIN_COUPONS_PER_PAGE
} = require("../config/couponConstants");

const asText = (value) => (typeof value === "string" ? value.trim() : "");

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const WHOLE_PATTERN = /^\d+$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// "2026-12-31" -> a real Date, or null when the date does not exist.
const parseDate = (text, endOfDay) => {

    const match = DATE_PATTERN.exec(text);

    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = endOfDay
        ? new Date(year, month - 1, day, 23, 59, 59, 999)
        : new Date(year, month - 1, day, 0, 0, 0, 0);

    const isRealDate =
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;

    return isRealDate ? date : null;
};

// Returns { error } or { data }.
const validateCouponForm = (body) => {

    const code = asText(body.code).toUpperCase();
    const description = asText(body.description);
    const discountType = asText(body.discountType);
    const discountValueText = asText(body.discountValue);
    const minimumText = asText(body.minimumPurchase) || "0";
    const maximumText = asText(body.maximumDiscount) || "0";
    const usageLimitText = asText(body.usageLimit) || "0";
    const perUserText = asText(body.perUserLimit) || "1";

    if (!COUPON_CODE_PATTERN.test(code)) {
        return { error: "Coupon code must be 4 to 20 letters or numbers (no spaces or symbols)." };
    }

    if (description.length > COUPON_DESCRIPTION_MAX_LENGTH) {
        return { error: `Description can be at most ${COUPON_DESCRIPTION_MAX_LENGTH} characters.` };
    }

    if (!Object.values(COUPON_DISCOUNT_TYPE).includes(discountType)) {
        return { error: "Please choose a discount type." };
    }

    if (!MONEY_PATTERN.test(discountValueText)) {
        return { error: "Discount value must be a positive number (up to 2 decimals)." };
    }

    const discountValue = Number(discountValueText);

    if (discountValue <= 0) {
        return { error: "Discount value must be greater than 0." };
    }

    if (discountType === COUPON_DISCOUNT_TYPE.PERCENT && discountValue > COUPON_MAX_PERCENT) {
        return { error: `A percentage coupon can give at most ${COUPON_MAX_PERCENT}% off.` };
    }

    if (discountType === COUPON_DISCOUNT_TYPE.FIXED && discountValue > COUPON_MAX_AMOUNT) {
        return { error: "Fixed discount amount is too large." };
    }

    if (!MONEY_PATTERN.test(minimumText)) {
        return { error: "Minimum purchase must be 0 or a positive amount." };
    }

    const minimumPurchase = Number(minimumText);

    if (minimumPurchase > COUPON_MAX_AMOUNT) {
        return { error: "Minimum purchase is too large." };
    }

    if (
        discountType === COUPON_DISCOUNT_TYPE.FIXED &&
        minimumPurchase > 0 &&
        discountValue > minimumPurchase
    ) {
        return { error: "A fixed discount cannot be bigger than the minimum purchase." };
    }

    let maximumDiscount = 0;

    if (discountType === COUPON_DISCOUNT_TYPE.PERCENT) {

        if (!MONEY_PATTERN.test(maximumText)) {
            return { error: "Maximum discount must be 0 (no cap) or a positive amount." };
        }

        maximumDiscount = Number(maximumText);

        if (maximumDiscount > COUPON_MAX_AMOUNT) {
            return { error: "Maximum discount is too large." };
        }
    }

    const startDate = parseDate(asText(body.startDate), false);
    const expiryDate = parseDate(asText(body.expiryDate), true);

    if (!startDate) {
        return { error: "Please choose a valid start date." };
    }

    if (!expiryDate) {
        return { error: "Please choose a valid expiry date." };
    }

    if (expiryDate < startDate) {
        return { error: "Expiry date cannot be before the start date." };
    }

    if (expiryDate < new Date()) {
        return { error: "Expiry date must be in the future." };
    }

    if (!WHOLE_PATTERN.test(usageLimitText)) {
        return { error: "Usage limit must be a whole number (0 means unlimited)." };
    }

    if (!WHOLE_PATTERN.test(perUserText)) {
        return { error: "Per-user limit must be a whole number of at least 1." };
    }

    const usageLimit = Number(usageLimitText);
    const perUserLimit = Number(perUserText);

    if (perUserLimit < 1) {
        return { error: "Per-user limit must be at least 1." };
    }

    if (usageLimit > 0 && perUserLimit > usageLimit) {
        return { error: "Per-user limit cannot be bigger than the total usage limit." };
    }

    return {
        data: {
            code,
            description,
            discountType,
            discountValue,
            minimumPurchase,
            maximumDiscount,
            startDate,
            expiryDate,
            usageLimit,
            perUserLimit
        }
    };
};

// Friendly status shown in the list.
const describeState = (coupon) => {

    const now = new Date();

    if (!coupon.isActive) {
        return { key: "inactive", label: "Inactive" };
    }

    if (now > new Date(coupon.expiryDate)) {
        return { key: "expired", label: "Expired" };
    }

    if (now < new Date(coupon.startDate)) {
        return { key: "scheduled", label: "Scheduled" };
    }

    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
        return { key: "expired", label: "Fully used" };
    }

    return { key: "active", label: "Active" };
};

const renderCoupons = async (req, res, { error = null, formData = {}, status = 200 } = {}) => {

    const search = asText(req.query.search).slice(0, 40);

    const filter = { isDeleted: false };

    if (search) {
        filter.code = { $regex: escapeRegex(search), $options: "i" };
    }

    const totalCoupons = await Coupon.countDocuments(filter);

    const totalPages = Math.max(1, Math.ceil(totalCoupons / ADMIN_COUPONS_PER_PAGE));

    let page = parseInt(req.query.page, 10);

    if (isNaN(page) || page < 1) {
        page = 1;
    }

    page = Math.min(page, totalPages);

    const coupons = await Coupon.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * ADMIN_COUPONS_PER_PAGE)
        .limit(ADMIN_COUPONS_PER_PAGE)
        .select("-usedBy")
        .lean();

    const rows = coupons.map((coupon) => ({
        ...coupon,
        state: describeState(coupon)
    }));

    return res.status(status).render("admin/coupons", {
        title: "Coupons",
        coupons: rows,
        search,
        currentPage: page,
        totalPages,
        totalCoupons,
        pageNumbers: buildPageNumbers(page, totalPages),
        typeLabels: COUPON_DISCOUNT_TYPE_LABEL,
        maxPercent: COUPON_MAX_PERCENT,
        flash: takeFlash(req),
        error,
        formData
    });
};

const loadCoupons = async (req, res) => {

    try {
        return await renderCoupons(req, res);
    } catch (error) {

        console.error("Load coupons error:", error);

        return res.status(500).send("Something went wrong. Please try again.");
    }
};

const createCoupon = async (req, res) => {

    try {

        const result = validateCouponForm(req.body || {});

        if (result.error) {
            return await renderCoupons(req, res, {
                error: result.error,
                formData: req.body || {},
                status: 400
            });
        }

        await Coupon.create(result.data);

        setFlash(req, "success", `Coupon ${result.data.code} was created.`);

        return res.redirect("/admin/coupons");

    } catch (error) {

        if (error && error.code === 11000) {
            return renderCoupons(req, res, {
                error: "A coupon with this code already exists.",
                formData: req.body || {},
                status: 400
            });
        }

        console.error("Create coupon error:", error);

        setFlash(req, "error", "Could not create the coupon. Please try again.");

        return res.redirect("/admin/coupons");
    }
};

const toggleCoupon = async (req, res) => {

    try {

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            setFlash(req, "error", "Coupon not found.");
            return res.redirect("/admin/coupons");
        }

        const coupon = await Coupon.findOne({ _id: id, isDeleted: false });

        if (!coupon) {
            setFlash(req, "error", "Coupon not found.");
            return res.redirect("/admin/coupons");
        }

        coupon.isActive = !coupon.isActive;

        await coupon.save();

        setFlash(
            req,
            "success",
            `Coupon ${coupon.code} is now ${coupon.isActive ? "active" : "inactive"}.`
        );

        return res.redirect("/admin/coupons");

    } catch (error) {

        console.error("Toggle coupon error:", error);

        setFlash(req, "error", "Could not update the coupon.");

        return res.redirect("/admin/coupons");
    }
};

const deleteCoupon = async (req, res) => {

    try {

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            setFlash(req, "error", "Coupon not found.");
            return res.redirect("/admin/coupons");
        }

        const result = await Coupon.updateOne(
            { _id: id, isDeleted: false },
            { $set: { isDeleted: true, isActive: false } }
        );

        if (result.modifiedCount !== 1) {
            setFlash(req, "error", "Coupon not found.");
        } else {
            setFlash(req, "success", "Coupon deleted.");
        }

        return res.redirect("/admin/coupons");

    } catch (error) {

        console.error("Delete coupon error:", error);

        setFlash(req, "error", "Could not delete the coupon.");

        return res.redirect("/admin/coupons");
    }
};

module.exports = {
    loadCoupons,
    createCoupon,
    toggleCoupon,
    deleteCoupon
};