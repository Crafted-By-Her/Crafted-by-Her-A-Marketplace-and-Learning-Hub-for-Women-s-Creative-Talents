# Crafted-by-Her: A Marketplace and Learning Hub for Women’s Creative Talents

Crafted-by-Her is an empowering platform designed to celebrate and support women’s creative talents. It serves as both a marketplace for women to showcase and sell their handmade products and a learning hub where they can access resources, tutorials, and community support to enhance their skills.

The platform includes user authentication, role-based access control (super admin, admin, user), product management, and Cloudinary integration for image storage.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the Project](#running-the-project)
- [API Endpoints](#api-endpoints)
- [Folder Structure](#folder-structure)
- [Cloudinary Integration](#cloudinary-integration)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## Project Overview

Crafted-by-Her is a backend-focused application built to empower women by providing a marketplace to sell their creative products and a learning hub to foster skill development.

**User Roles:**

- **Users:** Create profiles, list products, and access learning resources.
- **Admins:** Manage products, users, and reports, with permissions to delete products and issue warnings.
- **Super Admins:** Full control, including managing admins and viewing system-wide statistics.

The backend is built with Node.js, Express, and MongoDB, using Mongoose for schema management. Cloudinary is integrated for image storage, and JWT is used for authentication.

---

## Features

- **User Authentication:** Secure registration, login, and password management using JWT and bcrypt.
- **Role-Based Access Control:**
  - Users: Manage their profiles and products.
  - Admins: Delete products, increment user warnings, and activate/deactivate users.
  - Super Admins: Create/delete admins, view dashboard statistics.
- **Product Management:** CRUD products with Cloudinary image uploads.
- **Learning Hub:** Placeholder for future learning resources (e.g., tutorials, videos).
- **Warnings System:** Admins can issue warnings to users, with automatic deactivation after 5 warnings.
- **Email Notifications:** Automated emails for account creation, warnings, and deactivation.
- **Cloudinary Integration:** Store and manage user profile photos and product images.

---

## Technologies Used

**Backend:**

- Node.js v18.x
- Express.js v4.x
- MongoDB v6.x (with Mongoose v7.x)

**Authentication:**

- JSON Web Tokens (JWT)
- bcrypt

**Image Storage:**

- Cloudinary

**Email:**

- Custom sendEmail service (e.g., SendGrid or Nodemailer)

**Environment:**

- dotenv

**Deployment:**

- Render (assumed)

**Development Tools:**

- ESLint
- Prettier
- Jest (optional)

---

## Prerequisites

- Node.js (v18.x or higher)
- npm (v9.x or higher) or Yarn
- MongoDB (local or cloud-based like MongoDB Atlas)
- Cloudinary account
- Git

---

## Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/your-username/Crafted-by-Her-A-Marketplace-and-Learning-Hub-for-Women-s-Creative-Talents.git
   cd Crafted-by-Her-A-Marketplace-and-Learning-Hub-for-Women-s-Creative-Talents/Server
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

## Environment Variables

- `PORT`: Port for the server (default: 8080)
- `NODE_ENV`: Environment mode (development or production)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Cloudinary credentials
- `BASE_URL`: Base URL for API
- `FRONTEND_URL`: Frontend URL
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`: Email service credentials

---

## Running the Project

**Start the Development Server:**

```bash
npm run dev
# or
yarn dev
```

Assumes a dev script using nodemon (e.g., `"dev": "nodemon src/server.js"`).

**Start the Production Server:**

```bash
npm start
# or
yarn start
```

Assumes a start script (e.g., `"start": "node src/server.js"`).

**Access the API:**  
The API will be available at [http://localhost:8080](http://localhost:8080) (or the port specified in `.env`).

---

## API Endpoints

### User Routes

- `POST /api/user/register` - Register a new user  
  **Body:**

  ```json
  {
    "firstName": "...",
    "lastName": "...",
    "email": "...",
    "password": "...",
    "phoneNumber": "...",
    "gender": "..."
  }
  ```

- `POST /api/user/login` - Login user and get JWT token  
  **Body:**

  ```json
  {
    "email": "...",
    "password": "..."
  }
  ```

- `PUT /api/user/profile` - Update user profile (including profile photo upload)  
  **Requires Authentication**  
  **Body:** Form-data with file (image) and optional fields like `firstName`, `email`

### Admin Routes

- `GET /api/admin/products` - Get all products (sorted by overallScore)  
  **Requires Authentication (Admin or Super Admin)**

- `DELETE /api/admin/products/:productId` - Delete a product  
  **Requires Authentication (Admin or Super Admin)**

- `PUT /api/admin/users/:userId/warning` - Increment user warnings  
  **Requires Authentication (Admin or Super Admin)**

- `PUT /api/admin/users/:userId/activate` - Activate user and reset warnings  
  **Requires Authentication (Admin or Super Admin)**

### Super Admin Routes

- `GET /api/superadmin/dashboard` - Get dashboard statistics  
  **Requires Authentication (Super Admin)**

- `POST /api/superadmin/admins` - Create a new admin  
  **Requires Authentication (Super Admin)**  
  **Body:**

  ```json
  {
    "email": "...",
    "firstName": "...",
    "lastName": "...",
    "phoneNumber": "...",
    "gender": "...",
    "password": "..."
  }
  ```

- `GET /api/superadmin/admins` - Get all admins  
  **Requires Authentication (Super Admin)**

- `DELETE /api/superadmin/admins/:adminId` - Delete an admin  
  **Requires Authentication (Super Admin)**

---

## Folder Structure

```
Crafted-by-Her-A-Marketplace-and-Learning-Hub-for-Women-s-Creative-Talents/
├── Server/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── userController.js
│   │   │   ├── adminController.js
│   │   │   ├── superAdminController.js
│   │   ├── middlewares/
│   │   │   ├── auth.js
│   │   │   ├── upload.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Admin.js
│   │   │   ├── Product.js
│   │   ├── services/
│   │   │   ├── sendEmail.js
│   │   ├── routes/
│   │   │   ├── userRoutes.js
│   │   │   ├── adminRoutes.js
│   │   │   ├── superAdminRoutes.js
│   │   ├── server.js
│   ├── .env
│   ├── package.json
│   ├── README.md
```

---

## Cloudinary Integration

Crafted-by-Her uses Cloudinary for storing user profile photos and product images.

- **Profile Photos:** Stored in `User.profilePhoto` as `{ url, public_id }`.
- **Product Images:** Stored in `Product.images` as an array of `{ url, public_id }`.
- **Middleware:** The `upload.js` middleware handles image uploads to Cloudinary and sets `req.file` with `path` (URL) and `filename` (`public_id`).
- **Deletion:** Images are deleted from Cloudinary when users or products are deleted using the `deleteFile` middleware.

**Example: Uploading a Profile Photo**

- **Endpoint:** `PUT /api/user/profile`
- **Request:** Form-data with file (image)
- **Response:**
  ```json
  {
    "profilePhoto": {
      "url": "https://res.cloudinary.com/...",
      "public_id": "..."
    }
  }
  ```

---

## Testing

- Use Postman or a similar tool to send HTTP requests.
- Import the API collection (if available) or manually create requests based on the API Endpoints section.

**Example: Test user login**

```bash
curl -X POST http://localhost:8080/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

### Unit Testing (Optional)

If unit tests are implemented (e.g., with Jest):

```bash
npm test
# or
yarn test
```

---

## Contributing

We welcome contributions!

1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature
   ```
3. Make your changes and commit:
   ```bash
   git commit -m "Add your feature"
   ```
4. Push to your branch:
   ```bash
   git push origin feature/your-feature
   ```
5. Create a Pull Request on GitHub.

Please ensure your code follows the project’s style guide (ESLint + Prettier) and includes tests if applicable.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.

---

## Contact

- **Email:** support@craftedbyher.com
- **GitHub Issues:** Create an Issue

---

_Crafted-by-Her is a project built with ❤️ to empower women’s creativity and entrepreneurship. Join us in making a difference!_
