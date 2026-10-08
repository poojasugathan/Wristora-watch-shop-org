
const LOW_STOCK_THRESHOLD = 5;

const MAX_STOCK_VALUE = 10000;

const INVENTORY_PER_PAGE = 10;
const INVENTORY_SEARCH_MAX_LENGTH = 60;

const STOCK_STATUS = {
    IN_STOCK: "In Stock",
    LOW_STOCK: "Low Stock",
    OUT_OF_STOCK: "Out of Stock"
};

const STOCK_FILTERS = [
    { value: "all", label: "All" },
    { value: "in-stock", label: STOCK_STATUS.IN_STOCK },
    { value: "low-stock", label: STOCK_STATUS.LOW_STOCK },
    { value: "out-of-stock", label: STOCK_STATUS.OUT_OF_STOCK }
];

const INVENTORY_SORT_OPTIONS = [
    { value: "latest", label: "Newest first", sort: { createdAt: -1, _id: -1 } },
    { value: "stock-low", label: "Lowest stock first", sort: { stock: 1, _id: 1 } },
    { value: "stock-high", label: "Highest stock first", sort: { stock: -1, _id: 1 } }
];


const getStockStatus = (stock) => {

    if (!(stock > 0)) {
        return STOCK_STATUS.OUT_OF_STOCK;
    }

    if (stock <= LOW_STOCK_THRESHOLD) {
        return STOCK_STATUS.LOW_STOCK;
    }

    return STOCK_STATUS.IN_STOCK;
};

const buildStockCondition = (filterValue) => {

    if (filterValue === "in-stock") {
        return { $gt: LOW_STOCK_THRESHOLD };
    }

    if (filterValue === "low-stock") {
        return { $gt: 0, $lte: LOW_STOCK_THRESHOLD };
    }

    if (filterValue === "out-of-stock") {
        return { $lte: 0 };
    }

    return null;
};

module.exports = {
    LOW_STOCK_THRESHOLD,
    MAX_STOCK_VALUE,
    INVENTORY_PER_PAGE,
    INVENTORY_SEARCH_MAX_LENGTH,
    STOCK_STATUS,
    STOCK_FILTERS,
    INVENTORY_SORT_OPTIONS,
    getStockStatus,
    buildStockCondition
};