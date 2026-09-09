import { useEffect, useMemo, useState } from "react";
import "./index.css";

const API_BASE = "http://127.0.0.1:5000";

const fallbackImages = {
  "Engine Parts":
    "https://placehold.co/600x400?text=Engine+Part",
  "Brake System":
    "https://placehold.co/600x400?text=Brake+Pads",
  Suspension:
    "https://placehold.co/600x400?text=Suspension",
  Electrical:
    "https://placehold.co/600x400?text=Automotive+Battery",
  Filters:
    "https://placehold.co/600x400?text=Oil+Filter",
  "Tires & Wheels":
    "https://placehold.co/600x400?text=Alloy+Wheel",
};

const defaultCategories = [
  { id: 1, name: "Engine Parts", description: "Parts used in vehicle engines" },
  { id: 2, name: "Brake System", description: "Brake pads, discs and related components" },
  { id: 3, name: "Suspension", description: "Suspension and steering components" },
  { id: 4, name: "Electrical", description: "Batteries, sensors and electrical components" },
  { id: 5, name: "Filters", description: "Oil, air and fuel filters" },
  { id: 6, name: "Tires & Wheels", description: "Tires, rims and wheel accessories" },
];

function formatCurrency(value) {
  return `KSh ${Number(value || 0).toLocaleString()}`;
}

function getImageUrl(imageUrl, category) {
  if (!imageUrl) {
    return (
      fallbackImages[category] ||
      "https://placehold.co/600x400?text=Auto+Part"
    );
  }

  if (imageUrl.startsWith("http")) {
    return imageUrl;
  }

  return `${API_BASE}${imageUrl}`;
}

function App() {
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [search, setSearch] = useState("");

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(defaultCategories);

  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState("");

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [formError, setFormError] = useState("");
  const [imagePreview, setImagePreview] = useState("");

  const [form, setForm] = useState({
    name: "",
    brand: "",
    category_id: "",
    sku: "",
    price: "",
    stock_quantity: "",
    description: "",
    image: null,
  });

  async function loadProducts() {
    const response = await fetch(`${API_BASE}/api/products`);

    if (!response.ok) {
      throw new Error("Unable to load products.");
    }

    const data = await response.json();
    setProducts(data);
  }

  async function loadCategories() {
    const response = await fetch(`${API_BASE}/api/categories`);

    if (!response.ok) {
      throw new Error("Unable to load categories.");
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      setCategories(data);
    }
  }

  async function loadData() {
    setLoading(true);
    setBackendError("");

    try {
      await Promise.all([
        loadProducts(),
        loadCategories(),
      ]);
    } catch (error) {
      console.error(error);
      setBackendError(
        "Unable to connect to the backend. Make sure Flask is running on port 5000."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) => {
      return (
        product.name?.toLowerCase().includes(query) ||
        product.brand?.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
      );
    });
  }, [products, search]);

  const totalProducts = products.length;

  const totalUnits = products.reduce(
    (total, product) =>
      total + Number(product.stock_quantity || 0),
    0
  );

  const inventoryValue = products.reduce(
    (total, product) =>
      total +
      Number(product.price || 0) *
        Number(product.stock_quantity || 0),
    0
  );

  const lowStockProducts = products.filter(
    (product) =>
      Number(product.stock_quantity || 0) <= 10
  );

  const categoryCounts = categories.map((category) => ({
    ...category,
    count: products.filter(
      (product) =>
        Number(product.category_id) === Number(category.id)
    ).length,
  }));

  function resetForm() {
    setForm({
      name: "",
      brand: "",
      category_id: "",
      sku: "",
      price: "",
      stock_quantity: "",
      description: "",
      image: null,
    });

    setImagePreview("");
    setFormError("");
  }

  function openAddProduct() {
    resetForm();
    setShowAddProduct(true);
  }

  function closeAddProduct() {
    if (savingProduct) {
      return;
    }

    setShowAddProduct(false);
    resetForm();
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setForm((current) => ({
      ...current,
      image: file,
    }));

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  }

  async function handleAddProduct(event) {
    event.preventDefault();

    setFormError("");

    if (!form.name.trim()) {
      setFormError("Product name is required.");
      return;
    }

    if (!form.category_id) {
      setFormError("Please select a category.");
      return;
    }

    if (!form.sku.trim()) {
      setFormError("SKU is required.");
      return;
    }

    if (!form.price || Number(form.price) < 0) {
      setFormError("Please enter a valid price.");
      return;
    }

    if (
      form.stock_quantity === "" ||
      Number(form.stock_quantity) < 0
    ) {
      setFormError("Please enter a valid stock quantity.");
      return;
    }

    const formData = new FormData();

    formData.append("name", form.name.trim());
    formData.append("brand", form.brand.trim());
    formData.append("category_id", form.category_id);
    formData.append("sku", form.sku.trim());
    formData.append("price", form.price);
    formData.append(
      "stock_quantity",
      form.stock_quantity
    );
    formData.append(
      "description",
      form.description.trim()
    );

    if (form.image) {
      formData.append("image", form.image);
    }

    setSavingProduct(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/products`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to create product."
        );
      }

      setProducts((current) => [
        data.product,
        ...current,
      ]);

      setShowAddProduct(false);
      resetForm();
    } catch (error) {
      console.error(error);
      setFormError(error.message);
    } finally {
      setSavingProduct(false);
    }
  }

  function handleCategoryClick(category) {
    setSearch(category.name);
    setActiveNav("Products");
  }

  function renderDashboard() {
    return (
      <>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">OVERVIEW</span>

            <h2>
              Good morning, <span>Jay.</span>
            </h2>

            <p>
              Here's what's happening across your
              auto-parts inventory today.
            </p>
          </div>

          <div className="hero-actions">
            <button
              type="button"
              className="secondary-button"
            >
              <span>↗</span>
              Export
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={openAddProduct}
            >
              <span>＋</span>
              Add Product
            </button>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span>Total Products</span>
              <div className="stat-icon">◈</div>
            </div>

            <div className="stat-value">
              {totalProducts}
            </div>

            <div className="stat-footer positive">
              <span>↑</span>
              <strong>12.5%</strong>
              <span>from last month</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Inventory Value</span>
              <div className="stat-icon">◇</div>
            </div>

            <div className="stat-value">
              {formatCurrency(inventoryValue)}
            </div>

            <div className="stat-footer positive">
              <span>↑</span>
              <strong>8.2%</strong>
              <span>from last month</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Units in Stock</span>
              <div className="stat-icon">▦</div>
            </div>

            <div className="stat-value">
              {totalUnits.toLocaleString()}
            </div>

            <div className="stat-footer neutral">
              <span>•</span>
              <span>Across all categories</span>
            </div>
          </div>

          <div className="stat-card warning-card">
            <div className="stat-header">
              <span>Low Stock</span>
              <div className="stat-icon warning">
                !
              </div>
            </div>

            <div className="stat-value">
              {lowStockProducts.length}
            </div>

            <div className="stat-footer warning">
              <span>●</span>
              <strong>Needs attention</strong>
            </div>
          </div>
        </section>

        <section className="content-grid">
          <div className="products-panel glass-panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">CATALOG</span>
                <h3>Recent Products</h3>
              </div>

              <button
                type="button"
                className="text-button"
                onClick={() => setActiveNav("Products")}
              >
                View all <span>→</span>
              </button>
            </div>

            <ProductSearch
              search={search}
              setSearch={setSearch}
            />

            <ProductList
              products={filteredProducts.slice(0, 6)}
            />
          </div>

          <div className="side-column">
            <div className="categories-panel glass-panel">
              <div className="panel-header compact">
                <div>
                  <span className="eyebrow">
                    BROWSE
                  </span>
                  <h3>Categories</h3>
                </div>

                <button
                  type="button"
                  className="circle-button"
                  onClick={() =>
                    setActiveNav("Categories")
                  }
                >
                  →
                </button>
              </div>

              <div className="category-list">
                {categoryCounts.map((category) => (
                  <button
                    type="button"
                    className="category-item"
                    key={category.id}
                    onClick={() =>
                      handleCategoryClick(category)
                    }
                  >
                    <div className="category-icon">
                      {getCategoryIcon(category.name)}
                    </div>

                    <div>
                      <strong>
                        {category.name}
                      </strong>

                      <span>
                        {category.count}{" "}
                        {category.count === 1
                          ? "product"
                          : "products"}
                      </span>
                    </div>

                    <span className="category-arrow">
                      ›
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="attention-panel">
              <div className="attention-top">
                <div className="attention-icon">
                  !
                </div>

                <span>
                  INVENTORY ALERT
                </span>
              </div>

              <h3>
                {lowStockProducts.length}{" "}
                {lowStockProducts.length === 1
                  ? "product needs"
                  : "products need"}{" "}
                attention
              </h3>

              <p>
                Some products are approaching their
                minimum stock threshold.
              </p>

              <button
                type="button"
                className="attention-button"
                onClick={() =>
                  setActiveNav("Inventory")
                }
              >
                Review inventory <span>→</span>
              </button>
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderProductsPage() {
    return (
      <section className="page-section">
        <div className="page-header">
          <div>
            <span className="eyebrow">
              CATALOG
            </span>

            <h2>Products</h2>

            <p>
              Manage your auto-parts catalogue,
              pricing and stock.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openAddProduct}
          >
            <span>＋</span>
            Add Product
          </button>
        </div>

        <div className="products-toolbar glass-panel">
          <ProductSearch
            search={search}
            setSearch={setSearch}
            fullWidth
          />

          <div className="product-summary">
            <strong>
              {filteredProducts.length}
            </strong>
            <span>
              {filteredProducts.length === 1
                ? "product"
                : "products"}
            </span>
          </div>
        </div>

        <div className="full-products-panel glass-panel">
          <ProductList
            products={filteredProducts}
            detailed
          />
        </div>
      </section>
    );
  }

  function renderPlaceholderPage(title, eyebrow, message) {
    return (
      <section className="page-section">
        <div className="page-header">
          <div>
            <span className="eyebrow">
              {eyebrow}
            </span>

            <h2>{title}</h2>

            <p>{message}</p>
          </div>
        </div>

        <div className="coming-panel glass-panel">
          <div className="coming-icon">◈</div>

          <span className="eyebrow">
            NEXT IMPLEMENTATION
          </span>

          <h3>
            {title} is ready for the next
            implementation phase.
          </h3>

          <p>
            The navigation and visual structure are
            already connected. We will build the
            underlying functionality into this
            section next.
          </p>
        </div>
      </section>
    );
  }

  function renderCurrentPage() {
    if (loading) {
      return (
        <div className="loading-panel glass-panel">
          <div className="loading-spinner" />
          <strong>
            Connecting to AutoPartsHub...
          </strong>
          <span>
            Loading your catalogue.
          </span>
        </div>
      );
    }

    if (backendError) {
      return (
        <div className="error-panel">
          <div className="attention-icon">
            !
          </div>

          <h3>Backend connection unavailable</h3>

          <p>{backendError}</p>

          <button
            type="button"
            className="primary-button"
            onClick={loadData}
          >
            Try again
          </button>
        </div>
      );
    }

    switch (activeNav) {
      case "Dashboard":
        return renderDashboard();

      case "Products":
        return renderProductsPage();

      case "Inventory":
        return renderPlaceholderPage(
          "Inventory",
          "STOCK CONTROL",
          "Monitor stock levels, restock products and track inventory movements."
        );

      case "Sales":
        return renderPlaceholderPage(
          "Sales",
          "TRANSACTIONS",
          "Record sales, calculate totals and automatically update inventory."
        );

      case "Invoices":
        return renderPlaceholderPage(
          "Invoices",
          "DOCUMENTS",
          "Create and manage invoices and receipts from completed sales."
        );

      case "Vehicles":
        return renderPlaceholderPage(
          "Vehicles",
          "FITMENT",
          "Manage vehicle makes, models and years for parts compatibility."
        );

      case "Categories":
        return renderPlaceholderPage(
          "Categories",
          "CATALOG STRUCTURE",
          "Organize products into the categories already established in your database."
        );

      default:
        return renderDashboard();
    }
  }

  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
              <span>AP</span>
            </div>

            <div>
              <div className="brand-name">
                AutoParts
              </div>

              <div className="brand-subtitle">
                HUB
              </div>
            </div>
          </div>

          <div className="sidebar-section-label">
            Workspace
          </div>

          <nav className="navigation">
            {[
              "Dashboard",
              "Products",
              "Inventory",
              "Sales",
              "Invoices",
            ].map((item) => (
              <button
                type="button"
                key={item}
                className={
                  activeNav === item
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() => {
                  setActiveNav(item);
                  setSearch("");
                }}
              >
                <span className="nav-icon">
                  {item === "Dashboard" && "⌂"}
                  {item === "Products" && "◈"}
                  {item === "Inventory" && "▦"}
                  {item === "Sales" && "↗"}
                  {item === "Invoices" && "▤"}
                </span>

                <span>{item}</span>

                {item === "Inventory" &&
                  lowStockProducts.length > 0 && (
                    <span className="nav-badge">
                      {lowStockProducts.length}
                    </span>
                  )}
              </button>
            ))}
          </nav>

          <div className="sidebar-section-label">
            Management
          </div>

          <nav className="navigation">
            {["Vehicles", "Categories"].map(
              (item) => (
                <button
                  type="button"
                  key={item}
                  className={
                    activeNav === item
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={() => {
                    setActiveNav(item);
                    setSearch("");
                  }}
                >
                  <span className="nav-icon">
                    {item === "Vehicles"
                      ? "◇"
                      : "◫"}
                  </span>

                  <span>{item}</span>
                </button>
              )
            )}
          </nav>

          <div className="sidebar-bottom">
            <button
              type="button"
              className="nav-item"
            >
              <span className="nav-icon">
                ⚙
              </span>
              <span>Settings</span>
            </button>

            <div className="user-card">
              <div className="avatar">J</div>

              <div className="user-info">
                <strong>Admin</strong>
                <span>Administrator</span>
              </div>

              <button
                type="button"
                className="more-button"
              >
                •••
              </button>
            </div>
          </div>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <div>
              <div className="breadcrumb">
                Workspace{" "}
                <span>/</span>{" "}
                {activeNav}
              </div>

              <h1>{activeNav}</h1>
            </div>

            <div className="topbar-actions">
              <button
                type="button"
                className="icon-button"
                aria-label="Notifications"
              >
                ♧
                <span className="notification-dot" />
              </button>

              <div className="topbar-divider" />

              <div className="profile">
                <div className="avatar small">
                  J
                </div>

                <div className="profile-text">
                  <strong>Admin</strong>
                  <span>AutoPartsHub</span>
                </div>

                <span className="chevron">
                  ⌄
                </span>
              </div>
            </div>
          </header>

          <div className="page-content">
            {renderCurrentPage()}
          </div>
        </main>
      </div>

      {showAddProduct && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeAddProduct();
            }
          }}
        >
          <div
            className="product-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-product-title"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  CATALOG
                </span>

                <h2 id="add-product-title">
                  Add Product
                </h2>

                <p>
                  Add a new part to your catalogue.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeAddProduct}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form
              className="product-form"
              onSubmit={handleAddProduct}
            >
              <div className="form-grid">
                <label className="form-field">
                  <span>Product name</span>

                  <input
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    placeholder="e.g. Toyota Corolla Air Filter"
                  />
                </label>

                <label className="form-field">
                  <span>Brand</span>

                  <input
                    name="brand"
                    value={form.brand}
                    onChange={handleFormChange}
                    placeholder="e.g. Bosch"
                  />
                </label>

                <label className="form-field">
                  <span>Category</span>

                  <select
                    name="category_id"
                    value={form.category_id}
                    onChange={handleFormChange}
                  >
                    <option value="">
                      Select category
                    </option>

                    {categories.map(
                      (category) => (
                        <option
                          key={category.id}
                          value={category.id}
                        >
                          {category.name}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="form-field">
                  <span>SKU</span>

                  <input
                    name="sku"
                    value={form.sku}
                    onChange={handleFormChange}
                    placeholder="e.g. AF-TOY-COR-002"
                  />
                </label>

                <label className="form-field">
                  <span>Price</span>

                  <div className="input-prefix">
                    <span>KSh</span>

                    <input
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={handleFormChange}
                      placeholder="0.00"
                    />
                  </div>
                </label>

                <label className="form-field">
                  <span>Initial stock</span>

                  <input
                    name="stock_quantity"
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock_quantity}
                    onChange={handleFormChange}
                    placeholder="0"
                  />
                </label>
              </div>

              <label className="form-field">
                <span>Product description</span>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Describe the product, compatibility or other useful details..."
                  rows="4"
                />
              </label>

              <div className="form-field">
                <span>Product image</span>

                <label className="image-upload">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Product preview"
                    />
                  ) : (
                    <>
                      <div className="upload-icon">
                        ↑
                      </div>

                      <strong>
                        Upload product image
                      </strong>

                      <span>
                        PNG, JPG, JPEG or WEBP
                      </span>
                    </>
                  )}

                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    onChange={handleImageChange}
                  />
                </label>
              </div>

              {formError && (
                <div className="form-error">
                  {formError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeAddProduct}
                  disabled={savingProduct}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={savingProduct}
                >
                  {savingProduct
                    ? "Adding product..."
                    : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}


function ProductSearch({
  search,
  setSearch,
  fullWidth = false,
}) {
  return (
    <div
      className={
        fullWidth
          ? "search-container full-width"
          : "search-container"
      }
    >
      <span className="search-icon">
        ⌕
      </span>

      <input
        type="text"
        placeholder="Search products, brands, categories or SKU..."
        value={search}
        onChange={(event) =>
          setSearch(event.target.value)
        }
      />

      {search && (
        <button
          type="button"
          className="clear-search"
          onClick={() => setSearch("")}
          aria-label="Clear search"
        >
          ×
        </button>
      )}

      <span className="search-shortcut">
        ⌘ K
      </span>
    </div>
  );
}


function ProductList({
  products,
  detailed = false,
}) {
  if (products.length === 0) {
    return (
      <div className="empty-state">
        <div>⌕</div>

        <strong>
          No products found
        </strong>

        <span>
          Try a different search term.
        </span>
      </div>
    );
  }

  return (
    <div className="product-list">
      {products.map((product) => {
        const stock = Number(
          product.stock_quantity || 0
        );

        const stockPercent = Math.min(
          stock * 3,
          100
        );

        return (
          <div
            className={
              detailed
                ? "product-row detailed"
                : "product-row"
            }
            key={product.id}
          >
            <div className="product-image">
              <img
                src={getImageUrl(
                  product.image_url,
                  getCategoryName(product.category_id)
                )}
                alt={product.name}
                onError={(event) => {
                  event.currentTarget.src =
                    "https://placehold.co/600x400?text=Auto+Part";
                }}
              />
            </div>

            <div className="product-main">
              <strong>
                {product.name}
              </strong>

              <span>
                {product.brand || "Unbranded"}{" "}
                · {product.sku}
              </span>

              {detailed &&
                product.description && (
                  <small>
                    {product.description}
                  </small>
                )}
            </div>

            <div className="product-category">
              {getCategoryName(
                product.category_id
              )}
            </div>

            <div className="product-price">
              {formatCurrency(product.price)}
            </div>

            <div className="stock-wrapper">
              <div className="stock-ring">
                <svg viewBox="0 0 40 40">
                  <circle
                    className="ring-background"
                    cx="20"
                    cy="20"
                    r="16"
                  />

                  <circle
                    className="ring-progress"
                    cx="20"
                    cy="20"
                    r="16"
                    strokeDasharray="100"
                    strokeDashoffset={
                      100 - stockPercent
                    }
                  />
                </svg>

                <span>{stock}</span>
              </div>

              <span className="stock-label">
                in stock
              </span>
            </div>

            <button
              type="button"
              className="row-action"
              aria-label={
                "Actions for " +
                product.name
              }
            >
              •••
            </button>
          </div>
        );
      })}
    </div>
  );
}


function getCategoryName(categoryId) {
  const category = defaultCategories.find(
    (item) =>
      Number(item.id) === Number(categoryId)
  );

  return category
    ? category.name
    : "Uncategorized";
}


function getCategoryIcon(categoryName) {
  const icons = {
    "Engine Parts": "⚙",
    "Brake System": "◉",
    Suspension: "⌁",
    Electrical: "ϟ",
    Filters: "◌",
    "Tires & Wheels": "○",
  };

  return icons[categoryName] || "◈";
}


export default App;