const mongoose = require("mongoose");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const { getActiveBrands } = require("../services/brandService");


// =====================================================
// CONFIG
// =====================================================

const PRODUCTS_PER_PAGE = 12;

// A product counts as "Limited Edition" when its stock is
// at or below this number (but still greater than 0 — a
// product with 0 stock is just out of stock, not "limited").
// Change this single number later if you want a different
// cutoff.
const LIMITED_STOCK_THRESHOLD = 5;


// =====================================================
// HELPERS (existing — unchanged)
// =====================================================

const escapeRegex = (text) =>
    text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


const resolveSortOption = (sortValue) => {

    if (sortValue === "price-low") {
        return { sellingPrice: 1 };
    }

    if (sortValue === "price-high") {
        return { sellingPrice: -1 };
    }

    if (sortValue === "az") {
        return { productName: 1 };
    }

    if (sortValue === "za") {
        return { productName: -1 };
    }

    return { createdAt: -1 };

};


const buildPageNumbers = (currentPage, totalPages) => {

    const pages = [];

    if (totalPages <= 7) {

        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }

        return pages;

    }

    pages.push(1);

    if (currentPage > 3) {
        pages.push("...");
    }

    const rangeStart = Math.max(2, currentPage - 1);
    const rangeEnd = Math.min(totalPages - 1, currentPage + 1);

    for (let i = rangeStart; i <= rangeEnd; i++) {
        pages.push(i);
    }

    if (currentPage < totalPages - 2) {
        pages.push("...");
    }

    pages.push(totalPages);

    return pages;

};


// =====================================================
// FILTER HELPERS (PHASE 39)
// =====================================================

const parseCategoryFilter = (categoryValue) => {

    if (!categoryValue) {
        return null;
    }

    if (!mongoose.Types.ObjectId.isValid(categoryValue)) {
        return null;
    }

    return categoryValue;

};


const parseBrandFilter = (brandValue) => {

    if (!brandValue) {
        return "";
    }

    return brandValue.trim();

};


const parsePriceFilter = (minRaw, maxRaw) => {

    let min = parseFloat(minRaw);
    let max = parseFloat(maxRaw);

    const minValid = !isNaN(min) && min >= 0;
    const maxValid = !isNaN(max) && max >= 0;

    if (!minValid) {
        min = undefined;
    }

    if (!maxValid) {
        max = undefined;
    }

    if (min !== undefined && max !== undefined && min > max) {
        const temp = min;
        min = max;
        max = temp;
    }

    return { min, max };

};


// "limited" only turns the filter on when the value is
// literally the string "true" — anything else (missing,
// "false", "1", garbage) just means "not applied".

const parseLimitedFilter = (limitedValue) =>
    limitedValue === "true";


// =====================================================
// USER PRODUCT LISTING (PHASE 38 + PHASE 39 FILTERS)
// =====================================================

const loadProductListing = async (req, res) => {

    try {

        const search = req.query.search
            ? req.query.search.trim()
            : "";


        const allowedSortValues = [
            "price-low",
            "price-high",
            "az",
            "za"
        ];

        const sortOption =
            allowedSortValues.includes(req.query.sort)
                ? req.query.sort
                : "";


        let page = parseInt(req.query.page, 10);

        if (isNaN(page) || page < 1) {
            page = 1;
        }


        // ---------------------------------------------
        // FILTER INPUTS
        // ---------------------------------------------

        const selectedCategory =
            parseCategoryFilter(req.query.category);

        const selectedBrand =
            parseBrandFilter(req.query.brand);

        const { min: minPrice, max: maxPrice } =
            parsePriceFilter(req.query.minPrice, req.query.maxPrice);

        const isLimitedView =
            parseLimitedFilter(req.query.limited);


        // ---------------------------------------------
        // AVAILABILITY FILTER — always applied, unchanged.
        // ---------------------------------------------

        const query = {
            isDeleted: false,
            isListed: true,
            isBlocked: false
        };


        if (search) {

            const escapedSearch = escapeRegex(search);

            query.$or = [

                {
                    productName: {
                        $regex: escapedSearch,
                        $options: "i"
                    }
                },

                {
                    brand: {
                        $regex: escapedSearch,
                        $options: "i"
                    }
                }

            ];

        }


        if (selectedCategory) {
            query.category = selectedCategory;
        }

        if (selectedBrand) {
            query.brand = selectedBrand;
        }

        if (minPrice !== undefined || maxPrice !== undefined) {

            query.sellingPrice = {};

            if (minPrice !== undefined) {
                query.sellingPrice.$gte = minPrice;
            }

            if (maxPrice !== undefined) {
                query.sellingPrice.$lte = maxPrice;
            }

        }

        // "Limited Edition" = low stock, but not zero.
        // If a normal stock condition ever gets added later
        // for other reasons, this will need merging with it
        // instead of being overwritten — worth remembering.
        if (isLimitedView) {

            query.stock = {
                $gt: 0,
                $lte: LIMITED_STOCK_THRESHOLD
            };

        }


        const sort = resolveSortOption(sortOption);


        const totalProducts =
            await Product.countDocuments(query);

        const totalPages =
            Math.ceil(totalProducts / PRODUCTS_PER_PAGE);


        if (totalPages > 0 && page > totalPages) {
            page = totalPages;
        }


        const skip = (page - 1) * PRODUCTS_PER_PAGE;


        const products = await Product.find(query)
            .populate("category", "name")
            .sort(sort)
            .skip(skip)
            .limit(PRODUCTS_PER_PAGE)
            .lean();


        // ---------------------------------------------
        // DATA FOR THE FILTER DROPDOWNS
        // ---------------------------------------------

        const categories = await Category.find({
            isListed: true,
            isDeleted: false
        })
            .sort({ name: 1 })
            .lean();

        const brands = await getActiveBrands();


        // ---------------------------------------------
        // QUERY STRING FOR LINKS
        // ---------------------------------------------

        const linkParams = new URLSearchParams();

        if (search) {
            linkParams.set("search", search);
        }

        if (sortOption) {
            linkParams.set("sort", sortOption);
        }

        if (selectedCategory) {
            linkParams.set("category", selectedCategory);
        }

        if (selectedBrand) {
            linkParams.set("brand", selectedBrand);
        }

        if (minPrice !== undefined) {
            linkParams.set("minPrice", minPrice);
        }

        if (maxPrice !== undefined) {
            linkParams.set("maxPrice", maxPrice);
        }

        if (isLimitedView) {
            linkParams.set("limited", "true");
        }

        const baseQueryString = linkParams.toString();


        // "Clear Filters" drops category/brand/price/limited
        // but keeps search + sort.

        const clearFiltersParams = new URLSearchParams();

        if (search) {
            clearFiltersParams.set("search", search);
        }

        if (sortOption) {
            clearFiltersParams.set("sort", sortOption);
        }

        const clearFiltersQueryString =
            clearFiltersParams.toString();


        const pageNumbers =
            buildPageNumbers(page, totalPages);


        const pageHeading = isLimitedView
            ? "Limited Edition Timepieces"
            : "All Timepieces";


        return res.render(
            "user/products",
            {

                title: isLimitedView
                    ? "Limited Edition"
                    : "Shop All Watches",

                pageHeading,

                products,

                search,

                sortOption,

                currentPage: page,

                totalPages,

                totalProducts,

                productsPerPage: PRODUCTS_PER_PAGE,

                baseQueryString,

                clearFiltersQueryString,

                pageNumbers,

                categories,

                brands,

                selectedCategory,

                selectedBrand,

                minPriceValue:
                    minPrice !== undefined ? minPrice : "",

                maxPriceValue:
                    maxPrice !== undefined ? maxPrice : "",

                isLimitedView,

                error: null

            }
        );


    } catch (error) {

        console.error(
            "Product listing error:",
            error
        );

        return res.status(500).render(
            "user/products",
            {

                title: "Shop All Watches",

                pageHeading: "All Timepieces",

                products: [],

                search:
                    req.query.search
                        ? req.query.search.trim()
                        : "",

                sortOption: "",

                currentPage: 1,

                totalPages: 0,

                totalProducts: 0,

                productsPerPage: PRODUCTS_PER_PAGE,

                baseQueryString: "",

                clearFiltersQueryString: "",

                pageNumbers: [],

                categories: [],

                brands: [],

                selectedCategory: "",

                selectedBrand: "",

                minPriceValue: "",

                maxPriceValue: "",

                isLimitedView: false,

                error:
                    "Unable to load products right now. Please try again."

            }
        );

    }

};


module.exports = {
    loadProductListing
};