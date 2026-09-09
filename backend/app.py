from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from sqlalchemy.engine import URL
from sqlalchemy import or_
from werkzeug.utils import secure_filename

import os
import uuid


# -------------------------
# Environment
# -------------------------

load_dotenv()


# -------------------------
# Flask Application
# -------------------------

app = Flask(
    __name__,
    static_folder="uploads",
    static_url_path="/uploads"
)

CORS(app)


# -------------------------
# Upload Configuration
# -------------------------

UPLOAD_FOLDER = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "uploads"
)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {
    "png",
    "jpg",
    "jpeg",
    "webp"
}


def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower()
        in ALLOWED_EXTENSIONS
    )


# -------------------------
# Database Configuration
# -------------------------

database_url = URL.create(
    drivername="mysql+mysqlconnector",
    username=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT", 3306)),
    database=os.getenv("DB_NAME")
)

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


# -------------------------
# Database Models
# -------------------------

class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    name = db.Column(
        db.String(100),
        nullable=False,
        unique=True
    )

    description = db.Column(
        db.String(255)
    )

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.current_timestamp()
    )


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    category_id = db.Column(
        db.Integer,
        db.ForeignKey("categories.id"),
        nullable=False
    )

    name = db.Column(
        db.String(150),
        nullable=False
    )

    description = db.Column(
        db.Text
    )

    brand = db.Column(
        db.String(100)
    )

    sku = db.Column(
        db.String(50),
        nullable=False,
        unique=True
    )

    price = db.Column(
        db.Numeric(10, 2),
        nullable=False
    )

    stock_quantity = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    image_url = db.Column(
        db.String(500)
    )

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.current_timestamp()
    )

    updated_at = db.Column(
        db.DateTime,
        server_default=db.func.current_timestamp(),
        onupdate=db.func.current_timestamp()
    )


class Vehicle(db.Model):
    __tablename__ = "vehicles"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    make = db.Column(
        db.String(100),
        nullable=False
    )

    model = db.Column(
        db.String(100),
        nullable=False
    )

    year = db.Column(
        db.Integer,
        nullable=False
    )


# -------------------------
# Serialization Helpers
# -------------------------

def product_to_dict(product):
    return {
        "id": product.id,
        "category_id": product.category_id,
        "name": product.name,
        "description": product.description,
        "brand": product.brand,
        "sku": product.sku,
        "price": float(product.price),
        "stock_quantity": product.stock_quantity,
        "image_url": product.image_url
    }


def category_to_dict(category):
    return {
        "id": category.id,
        "name": category.name,
        "description": category.description
    }


# -------------------------
# Basic Routes
# -------------------------

@app.route("/")
def home():
    return jsonify({
        "message": "AutoParts Hub API is running",
        "status": "success"
    })


@app.route("/api/health")
def health():
    try:
        db.session.execute(db.text("SELECT 1"))

        return jsonify({
            "status": "success",
            "database": "connected"
        })

    except Exception as error:
        return jsonify({
            "status": "error",
            "database": "connection failed",
            "message": str(error)
        }), 500


# -------------------------
# Category Routes
# -------------------------

@app.route("/api/categories", methods=["GET"])
def get_categories():

    categories = Category.query.order_by(
        Category.name.asc()
    ).all()

    return jsonify([
        category_to_dict(category)
        for category in categories
    ])


# -------------------------
# Product Routes
# -------------------------

@app.route("/api/products", methods=["GET"])
def get_products():

    products = Product.query.order_by(
        Product.id.desc()
    ).all()

    return jsonify([
        product_to_dict(product)
        for product in products
    ])


@app.route("/api/products/<int:product_id>", methods=["GET"])
def get_product(product_id):

    product = db.session.get(
        Product,
        product_id
    )

    if not product:
        return jsonify({
            "error": "Product not found"
        }), 404

    return jsonify(product_to_dict(product))


# -------------------------
# Add Product
# -------------------------

@app.route("/api/products", methods=["POST"])
def create_product():

    name = request.form.get("name", "").strip()
    brand = request.form.get("brand", "").strip()
    sku = request.form.get("sku", "").strip()
    description = request.form.get(
        "description",
        ""
    ).strip()

    category_id = request.form.get(
        "category_id",
        ""
    ).strip()

    price = request.form.get(
        "price",
        ""
    ).strip()

    stock_quantity = request.form.get(
        "stock_quantity",
        "0"
    ).strip()

    image = request.files.get("image")

    # -------------------------
    # Validation
    # -------------------------

    if not name:
        return jsonify({
            "error": "Product name is required"
        }), 400

    if not sku:
        return jsonify({
            "error": "SKU is required"
        }), 400

    if not category_id:
        return jsonify({
            "error": "Category is required"
        }), 400

    if not price:
        return jsonify({
            "error": "Price is required"
        }), 400

    try:
        category_id = int(category_id)
        price = float(price)
        stock_quantity = int(stock_quantity or 0)

    except ValueError:
        return jsonify({
            "error": "Category, price and stock must contain valid numbers"
        }), 400

    if price < 0:
        return jsonify({
            "error": "Price cannot be negative"
        }), 400

    if stock_quantity < 0:
        return jsonify({
            "error": "Stock quantity cannot be negative"
        }), 400

    category = db.session.get(
        Category,
        category_id
    )

    if not category:
        return jsonify({
            "error": "Selected category does not exist"
        }), 400

    existing_product = Product.query.filter_by(
        sku=sku
    ).first()

    if existing_product:
        return jsonify({
            "error": "A product with this SKU already exists"
        }), 409

    # -------------------------
    # Image Upload
    # -------------------------

    image_url = None

    if image and image.filename:

        if not allowed_file(image.filename):
            return jsonify({
                "error": "Unsupported image format. Use PNG, JPG, JPEG or WEBP."
            }), 400

        original_name = secure_filename(
            image.filename
        )

        extension = original_name.rsplit(
            ".",
            1
        )[1].lower()

        filename = (
            f"{uuid.uuid4().hex}.{extension}"
        )

        image_path = os.path.join(
            UPLOAD_FOLDER,
            filename
        )

        image.save(image_path)

        image_url = f"/uploads/{filename}"

    # -------------------------
    # Create Product
    # -------------------------

    product = Product(
        category_id=category_id,
        name=name,
        description=description,
        brand=brand,
        sku=sku,
        price=price,
        stock_quantity=stock_quantity,
        image_url=image_url
    )

    db.session.add(product)
    db.session.commit()

    return jsonify({
        "message": "Product created successfully",
        "product": product_to_dict(product)
    }), 201


# -------------------------
# Update Product
# -------------------------

@app.route("/api/products/<int:product_id>", methods=["PUT"])
def update_product(product_id):

    product = db.session.get(
        Product,
        product_id
    )

    if not product:
        return jsonify({
            "error": "Product not found"
        }), 404

    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    name = data.get(
        "name",
        product.name
    ).strip()

    brand = data.get(
        "brand",
        product.brand or ""
    ).strip()

    sku = data.get(
        "sku",
        product.sku
    ).strip()

    description = data.get(
        "description",
        product.description or ""
    ).strip()

    category_id = data.get(
        "category_id",
        product.category_id
    )

    price = data.get(
        "price",
        float(product.price)
    )

    stock_quantity = data.get(
        "stock_quantity",
        product.stock_quantity
    )

    if not name:
        return jsonify({
            "error": "Product name is required"
        }), 400

    if not sku:
        return jsonify({
            "error": "SKU is required"
        }), 400

    try:
        category_id = int(category_id)
        price = float(price)
        stock_quantity = int(stock_quantity)

    except (ValueError, TypeError):
        return jsonify({
            "error": "Category, price and stock must contain valid numbers"
        }), 400

    if price < 0 or stock_quantity < 0:
        return jsonify({
            "error": "Price and stock cannot be negative"
        }), 400

    category = db.session.get(
        Category,
        category_id
    )

    if not category:
        return jsonify({
            "error": "Selected category does not exist"
        }), 400

    duplicate = Product.query.filter(
        Product.sku == sku,
        Product.id != product_id
    ).first()

    if duplicate:
        return jsonify({
            "error": "Another product already uses this SKU"
        }), 409

    product.name = name
    product.brand = brand
    product.sku = sku
    product.description = description
    product.category_id = category_id
    product.price = price
    product.stock_quantity = stock_quantity

    db.session.commit()

    return jsonify({
        "message": "Product updated successfully",
        "product": product_to_dict(product)
    })


# -------------------------
# Delete Product
# -------------------------

@app.route("/api/products/<int:product_id>", methods=["DELETE"])
def delete_product(product_id):

    product = db.session.get(
        Product,
        product_id
    )

    if not product:
        return jsonify({
            "error": "Product not found"
        }), 404

    db.session.delete(product)
    db.session.commit()

    return jsonify({
        "message": "Product deleted successfully"
    })


# -------------------------
# Product Search
# -------------------------

@app.route("/api/products/search", methods=["GET"])
def search_products():

    query = request.args.get(
        "q",
        ""
    ).strip()

    products = Product.query

    if query:

        products = products.filter(
            or_(
                Product.name.ilike(
                    f"%{query}%"
                ),
                Product.brand.ilike(
                    f"%{query}%"
                ),
                Product.description.ilike(
                    f"%{query}%"
                ),
                Product.sku.ilike(
                    f"%{query}%"
                )
            )
        )

    results = products.order_by(
        Product.id.desc()
    ).all()

    return jsonify([
        product_to_dict(product)
        for product in results
    ])


# -------------------------
# Vehicle Routes
# -------------------------

@app.route("/api/vehicles", methods=["GET"])
def get_vehicles():

    vehicles = Vehicle.query.order_by(
        Vehicle.make.asc(),
        Vehicle.model.asc(),
        Vehicle.year.asc()
    ).all()

    return jsonify([
        {
            "id": vehicle.id,
            "make": vehicle.make,
            "model": vehicle.model,
            "year": vehicle.year
        }
        for vehicle in vehicles
    ])


# -------------------------
# Run Application
# -------------------------

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )