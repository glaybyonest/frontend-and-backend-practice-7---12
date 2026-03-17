import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

export default function ProductDetails({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const canEdit = user && ["seller", "admin"].includes(user.role);
  const canDelete = user && user.role === "admin";
  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "",
    category: "",
    description: "",
    price: ""
  });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .getProduct(id)
      .then((data) => {
        if (!mounted) return;
        setProduct(data);
        setForm({
          title: data.title || "",
          category: data.category || "",
          description: data.description || "",
          price: data.price ?? ""
        });
      })
      .catch((err) => {
        if (mounted) setError(err.message || "Failed to load product");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  function handleChange(event) {
    setForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value
    }));
  }

  async function handleUpdate(event) {
    event.preventDefault();
    setError("");

    const payload = {};
    if (form.title.trim() !== "") payload.title = form.title.trim();
    if (form.category.trim() !== "") payload.category = form.category.trim();
    if (form.description.trim() !== "") {
      payload.description = form.description.trim();
    }
    if (form.price !== "") {
      payload.price = Number(form.price);
    }

    try {
      const updated = await api.updateProduct(id, payload);
      setProduct(updated);
    } catch (err) {
      setError(err.message || "Failed to update product");
    }
  }

  async function handleDelete() {
    setError("");
    try {
      await api.deleteProduct(id);
      navigate("/products");
    } catch (err) {
      setError(err.message || "Failed to delete product");
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Product details</h2>
        {loading && <p>Loading...</p>}
        {error && <div className="error">{error}</div>}
        {!loading && product && (
          <div className="grid">
            <div className="card">
              <h3>{product.title}</h3>
              <p className="muted">{product.category}</p>
              <p>{product.description}</p>
              <p>
                <strong>${product.price}</strong>
              </p>
            </div>
            {canEdit ? (
              <div className="card">
                <h3>Update product</h3>
                <form onSubmit={handleUpdate}>
                  <div>
                    <label htmlFor="title">Title</label>
                    <input
                      id="title"
                      name="title"
                      value={form.title}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label htmlFor="category">Category</label>
                    <input
                      id="category"
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      name="description"
                      value={form.description}
                      onChange={handleChange}
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
                    />
                  </div>
                  <div className="inline">
                    <button type="submit">Save changes</button>
                    {canDelete && (
                      <button
                        className="danger"
                        type="button"
                        onClick={handleDelete}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </form>
              </div>
            ) : (
              <div className="card">
                <h3>Permissions</h3>
                <p className="muted">
                  This product is read-only for the current role.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
