import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function Products({ user }) {
  const canCreate = user && ["seller", "admin"].includes(user.role);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    category: "",
    description: "",
    price: ""
  });

  useEffect(() => {
    let mounted = true;
    api
      .listProducts()
      .then((data) => {
        if (mounted) setProducts(data || []);
      })
      .catch((err) => {
        if (mounted) setError(err.message || "Failed to load products");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  function handleChange(event) {
    setForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value
    }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");

    const payload = {
      title: form.title.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      price: Number(form.price)
    };

    try {
      const created = await api.createProduct(payload);
      setProducts((prev) => [created, ...prev]);
      setForm({ title: "", category: "", description: "", price: "" });
    } catch (err) {
      setError(err.message || "Failed to create product");
    }
  }

  return (
    <div className="container">
      <div className="grid">
        <div className="card">
          <h2>Products</h2>
          <p className="muted">
            Browse products. Sellers can create and edit, admins can also delete.
          </p>
          {loading && <p>Loading...</p>}
          {error && <div className="error">{error}</div>}
          <div className="grid">
            {products.map((product) => (
              <div className="card" key={product.id}>
                <h3>{product.title}</h3>
                <p className="muted">{product.category}</p>
                <p>{product.description}</p>
                <p>
                  <strong>${product.price}</strong>
                </p>
                <Link className="nav__link" to={`/products/${product.id}`}>
                  View details
                </Link>
              </div>
            ))}
            {!loading && products.length === 0 && (
              <p className="muted">No products yet.</p>
            )}
          </div>
        </div>
        <div className="card">
          <h2>Create product</h2>
          {canCreate ? (
            <form onSubmit={handleCreate}>
              <div>
                <label htmlFor="title">Title</label>
                <input
                  id="title"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label htmlFor="category">Category</label>
                <input
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label htmlFor="price">Price</label>
                <input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={handleChange}
                  required
                />
              </div>
              <button type="submit">Create</button>
            </form>
          ) : (
            <p className="muted">
              Only sellers and admins can create products.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
