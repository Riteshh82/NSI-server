# Coppera Backend

> Node.js + Express + TypeScript + MongoDB Atlas REST API for the Coppera copper tile store.

---

## Quick Start

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in your **MongoDB Atlas** connection string:

```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/coppera?retryWrites=true&w=majority
```

To get a connection string:
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a free cluster
3. Click **Connect → Drivers → Node.js**
4. Copy the `mongodb+srv://…` URI

### 3. Run in development

```bash
npm run dev
```

The API starts at **http://localhost:5000**

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | Admin login → JWT |
| GET | `/api/products` | — | List products (`?category=&status=&featured=&q=&page=&limit=`) |
| GET | `/api/products/:slug` | — | Get product by slug (increments views) |
| POST | `/api/products` | ✅ | Create product |
| PUT | `/api/products/:id` | ✅ | Update product |
| DELETE | `/api/products/:id` | ✅ | Delete product |
| GET | `/api/categories` | — | List all categories |
| POST | `/api/categories` | ✅ | Create category |
| PUT | `/api/categories/:id` | ✅ | Update category |
| DELETE | `/api/categories/:id` | ✅ | Delete category |
| POST | `/api/bulk-orders` | — | Submit bulk inquiry (public form) |
| GET | `/api/bulk-orders` | ✅ | List all inquiries |
| GET | `/api/bulk-orders/:id` | ✅ | Get inquiry details |
| PUT | `/api/bulk-orders/:id` | ✅ | Update status / add note |
| POST | `/api/messages` | — | Submit contact message (public) |
| GET | `/api/messages` | ✅ | List all messages |
| PUT | `/api/messages/:id` | ✅ | Update message status |
| GET | `/api/health` | — | Health check |

✅ = requires `Authorization: Bearer <token>` header

---

## Connecting the Frontend

Set in `/coppera/frontend/.env`:

```
VITE_USE_REAL_API=true
VITE_API_URL=http://localhost:5000/api
```

The frontend's `src/api/index.ts` service will automatically switch from mock data to the real API.

---

## Admin Credentials

On first login, the server auto-seeds the admin from `.env`:

- **Email:** `admin@coppera.in`
- **Password:** `admin123`

Change these in `.env` before deploying to production.

---

## Production Build

```bash
npm run build
npm start
```

---

## Project Structure

```
backend/
  src/
    server.ts          # Express app + startup
    db.ts              # MongoDB Atlas connection
    models/
      Product.ts
      Category.ts
      BulkOrder.ts
      ContactMessage.ts
      Admin.ts
    routes/
      auth.ts
      products.ts
      categories.ts
      bulkOrders.ts
      messages.ts
    middleware/
      auth.ts          # JWT protect middleware
  .env.example
  package.json
  tsconfig.json
```
# NSI-server
