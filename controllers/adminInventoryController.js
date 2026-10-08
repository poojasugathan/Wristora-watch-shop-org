

const mongoose = require("mongoose");

const Product = require("../models/productModel");

const { escapeRegex } = require("../helpers/pagination");
const { setFlash, takeFlash } = require("../helpers/adminFlash");

const {
    LOW_STOCK_THRESHOLD,
    MAX_STOCK_VALUE,
    INVENTORY_PER_PAGE,
    INVENTORY_SEARCH_MAX_LENGTH,
    STOCK_FILTERS,
    INVENTORY_SORT_OPTIONS,
    getStockStatus,
    buildStockCondition
} = require("../config/inventoryConstants");


const asText = (value) => (typeof value === "string" ? value : "");



const buildInventoryUrl = ({ search, stock, sort, page }) => {

    const params = new URLSearchParams();

    if (search) params.set("search", search);
    if (stock && stock !== "all") params.set("stock", stock);
    if (sort && sort !== "latest") params.set("sort", sort);
    if (page && page > 1) params.set("page", String(page));

    const queryString = params.toString();

    return "/admin/inventory" + (queryString ? `?${queryString}` : "");
};


const loadInventory = async (req, res) => {

    const flash = takeFlash(req);

    try {

        const search = asText(req.query.search).trim().slice(0, INVENTORY_SEARCH_MAX_LENGTH);

        const stockFilter =
            STOCK_FILTERS.find((f) => f.value === asText(req.query.stock)) ||
            STOCK_FILTERS[0];

        const sortOption =
            INVENTORY_SORT_OPTIONS.find((s) => s.value === asText(req.query.sort)) ||
            INVENTORY_SORT_OPTIONS[0];

        let page = parseInt(asText(req.query.page), 10);

        if (isNaN(page) || page < 1) {
            page = 1;
        }

       
        const baseQuery = { isDeleted: false };

        const query = { ...baseQuery };

        if (search) {
            const pattern = new RegExp(escapeRegex(search), "i");
            query.$or = [{ productName: pattern }, { brand: pattern }];
        }

        const stockCondition = buildStockCondition(stockFilter.value);

        if (stockCondition) {
            query.stock = stockCondition;
        }

       
        const [totalAll, totalIn, totalLow, totalOut] = await Promise.all([
            Product.countDocuments(baseQuery),
            Product.countDocuments({ ...baseQuery, stock: buildStockCondition("in-stock") }),
            Product.countDocuments({ ...baseQuery, stock: buildStockCondition("low-stock") }),
            Product.countDocuments({ ...baseQuery, stock: buildStockCondition("out-of-stock") })
        ]);

        const totalProducts = await Product.countDocuments(query);

        const totalPages = Math.max(1, Math.ceil(totalProducts / INVENTORY_PER_PAGE));

        if (page > totalPages) {
            page = totalPages;
        }

        const products = await Product.find(query)
            .populate("category", "name")
            .sort(sortOption.sort)
            .skip((page - 1) * INVENTORY_PER_PAGE)
            .limit(INVENTORY_PER_PAGE)
            .lean();

        const rows = products.map((product) => {

            const stockStatus = getStockStatus(product.stock);

            return {
                ...product,
                stockStatus,
                stockClass: stockStatus.toLowerCase().replace(/\s+/g, "-"),
                // a customer can buy it only if all three are true
                isAvailable:
                    product.isListed === true &&
                    product.isBlocked !== true &&
                    product.stock > 0
            };
        });

        const urlFor = (changes = {}) =>
            buildInventoryUrl({
                search,
                stock: stockFilter.value,
                sort: sortOption.value,
                page: 1,
                ...changes
            });

        return res.render("admin/inventory", {
            title: "Inventory",
            products: rows,
            search,
            stock: stockFilter.value,
            sort: sortOption.value,
            currentPage: page,
            totalPages,
            totalProducts,
            counts: { all: totalAll, inStock: totalIn, lowStock: totalLow, outOfStock: totalOut },
            stockFilters: STOCK_FILTERS,
            sortOptions: INVENTORY_SORT_OPTIONS,
            lowStockThreshold: LOW_STOCK_THRESHOLD,
            maxStock: MAX_STOCK_VALUE,
            urlFor,
            flash,
            error: null
        });

    } catch (error) {

        console.error("Admin inventory error:", error);

        return res.status(500).render("admin/inventory", {
            title: "Inventory",
            products: [],
            search: "",
            stock: "all",
            sort: "latest",
            currentPage: 1,
            totalPages: 1,
            totalProducts: 0,
            counts: { all: 0, inStock: 0, lowStock: 0, outOfStock: 0 },
            stockFilters: STOCK_FILTERS,
            sortOptions: INVENTORY_SORT_OPTIONS,
            lowStockThreshold: LOW_STOCK_THRESHOLD,
            maxStock: MAX_STOCK_VALUE,
            urlFor: () => "/admin/inventory",
            flash,
            error: "Unable to load the inventory right now. Please try again."
        });
    }
};


// -----------------------------------------------------
// POST /admin/inventory/:id/stock
// body: stock (new stock number)
//       search, stockFilter, sort, page (only to return to the
//       same list view afterwards)
// -----------------------------------------------------
const updateStock = async (req, res) => {

    // Rebuilt from clean values (never a raw URL from the form),
    // so this redirect can only ever go to the inventory page.
    const pageNumber = parseInt(asText(req.body.page), 10);

    const backUrl = buildInventoryUrl({
        search: asText(req.body.search).trim().slice(0, INVENTORY_SEARCH_MAX_LENGTH),
        stock: STOCK_FILTERS.some((f) => f.value === req.body.stockFilter)
            ? req.body.stockFilter
            : "all",
        sort: INVENTORY_SORT_OPTIONS.some((s) => s.value === req.body.sort)
            ? req.body.sort
            : "latest",
        page: pageNumber > 0 ? pageNumber : 1
    });

    try {

        const productId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            setFlash(req, "error", "Invalid product.");
            return res.redirect(backUrl);
        }

        const rawStock = asText(req.body.stock).trim();

        // whole numbers only: rejects "", "-3", "2.5", "abc", "1e3"
        if (!/^\d{1,6}$/.test(rawStock)) {
            setFlash(req, "error", "Stock must be a whole number (0 or more).");
            return res.redirect(backUrl);
        }

        const newStock = Number(rawStock);

        if (newStock > MAX_STOCK_VALUE) {
            setFlash(req, "error", `Stock cannot be more than ${MAX_STOCK_VALUE}.`);
            return res.redirect(backUrl);
        }

        const product = await Product.findOneAndUpdate(
            { _id: productId, isDeleted: false },
            { $set: { stock: newStock } },
            { new: true, runValidators: true }
        ).lean();

        if (!product) {
            setFlash(req, "error", "Product not found.");
            return res.redirect(backUrl);
        }

        setFlash(
            req,
            "success",
            `Stock for "${product.productName}" updated to ${product.stock}.`
        );

        return res.redirect(backUrl);

    } catch (error) {

        console.error("Admin stock update error:", error);

        setFlash(req, "error", "Unable to update stock right now. Please try again.");

        return res.redirect(backUrl);
    }
};


module.exports = {
    loadInventory,
    updateStock
};